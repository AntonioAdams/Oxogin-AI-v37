import { type NextRequest, NextResponse } from "next/server"
import { captureWebsite } from "@/lib/capture"
import { logger } from "@/lib/utils/logger"
import { ApplicationError, ValidationError } from "@/lib/errors/application-error"
import { ERROR_CODE_REGISTRY } from "@/lib/errors/error-codes"
import { handleError, createErrorResponse, getHttpStatusCode } from "@/lib/errors/error-handler"
import { creditManager } from "@/lib/credits/manager"
import { sanitizeUrl } from "@/lib/utils"
import { validateUrl } from "@/lib/utils/validation"
import { analyzeCTA } from "@/lib/ai"
import { ClickPredictionEngine } from "@/lib/prediction/engine"

const apiLogger = logger.module("api-capture")

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const context = {
    file: "app/api/capture/route.ts",
    function: "POST",
    requestId,
    metadata: {
      url: request.url,
      method: request.method,
      userAgent: request.headers.get("user-agent"),
    },
  }

  try {
    apiLogger.info("Capture API request started", { requestId })

    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      throw new ValidationError(
        ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.REQUEST_PARSING_FAILED,
        "Invalid JSON in request body",
        context,
      )
    }

    const { url: rawUrl, isMobile = false, userId } = body

    if (!rawUrl) {
      throw new ValidationError(
        ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.REQUEST_PARSING_FAILED,
        "URL is required",
        context,
      )
    }

    // Sanitize the URL first (adds https:// if needed)
    const sanitizedUrl = sanitizeUrl(rawUrl)

    // Then validate the sanitized URL
    const urlValidation = validateUrl(rawUrl) // Use original URL for validation to get proper error messages
    if (!urlValidation.isValid) {
      throw new ValidationError(
        ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.REQUEST_PARSING_FAILED,
        urlValidation.error || "Invalid URL format",
        context,
      )
    }

    // Additional URL format validation with sanitized URL
    try {
      const urlObj = new URL(sanitizedUrl)
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        throw new ValidationError(
          ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.REQUEST_PARSING_FAILED,
          "Only HTTP and HTTPS URLs are supported",
          context,
        )
      }
    } catch (urlError) {
      throw new ValidationError(
        ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.REQUEST_PARSING_FAILED,
        `Invalid URL format: ${urlError instanceof Error ? urlError.message : "Please provide a valid HTTP/HTTPS URL"}`,
        context,
      )
    }

    // Get or generate user ID for credit tracking
    const actualUserId = userId || await creditManager.getCurrentUserId()

    // Check credits before proceeding
    apiLogger.info("Checking credits before capture", { requestId, userId: actualUserId })
    const creditCheck = await creditManager.checkCredits(actualUserId)

    // Log credit check details for debugging
    console.log("🔍 Credit Check:", {
      userId: actualUserId,
      hasCredits: creditCheck.hasCredits,
      remainingCredits: creditCheck.remainingCredits,
      requiredCredits: creditCheck.requiredCredits,
      message: creditCheck.message,
      isDevelopment: process.env.NODE_ENV === "development"
    })

    if (!creditCheck.hasCredits) {
      apiLogger.warn("Insufficient credits for capture", {
        requestId,
        userId: actualUserId,
        remainingCredits: creditCheck.remainingCredits,
        requiredCredits: creditCheck.requiredCredits,
      })

      return NextResponse.json(
        {
          error: "Insufficient credits",
          message: creditCheck.message,
          remainingCredits: creditCheck.remainingCredits,
          requiredCredits: creditCheck.requiredCredits,
          requestId,
        },
        { status: 402 }, // Payment Required
      )
    }

    apiLogger.info(`Starting capture for URL: ${sanitizedUrl}`, {
      requestId,
      originalUrl: rawUrl,
      sanitizedUrl,
      isMobile,
      userId: actualUserId,
    })

    // Check environment variables
    if (!process.env.BROWSERLESS_API_KEY) {
      throw new ApplicationError({
        code: ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.MIDDLEWARE_ERROR,
        message: "Server configuration error: Missing Browserless API key",
        context,
        severity: "critical",
        category: "system",
        retryable: false,
      })
    }

    // Perform capture with mobile option using sanitized URL
    const result = await captureWebsite(sanitizedUrl, { isMobile })

    // Validate result structure
    if (!result || !result.screenshot || !result.domData) {
      apiLogger.error("Invalid capture result structure", undefined, {
        requestId,
        hasResult: !!result,
        hasScreenshot: !!result?.screenshot,
        hasDomData: !!result?.domData,
        screenshotLength: result?.screenshot?.length || 0,
        domDataKeys: result?.domData ? Object.keys(result.domData) : [],
      })

      throw new ApplicationError({
        code: ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.RESPONSE_GENERATION_FAILED,
        message: "Invalid capture result from service - missing required data",
        context,
        severity: "high",
        category: "processing",
        retryable: true,
      })
    }

    // Deduct credits after successful capture (2 credits for full analysis)
    let updatedBalance
    try {
      updatedBalance = await creditManager.deductCredits(actualUserId, 2, {
        url: sanitizedUrl,
        requestId,
        isMobile,
        reason: "Full analysis (desktop + mobile)",
      })

      apiLogger.info("Credits deducted for successful capture", {
        requestId,
        userId: actualUserId,
        remainingCredits: updatedBalance.remainingCredits,
        usedCredits: updatedBalance.usedCredits,
      })
    } catch (creditError) {
      // If credit deduction fails, we should fail the request since we already checked credits
      apiLogger.error("Failed to deduct credits after successful capture", creditError, {
        requestId,
        userId: actualUserId,
      })

      throw new ApplicationError({
        code: ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.RESPONSE_GENERATION_FAILED,
        message: "Failed to process credit deduction",
        context,
        severity: "high",
        category: "processing",
        retryable: true,
      })
    }

    // Add CTA analysis and click predictions for funnel feature
    let ctaInsight = null
    let clickPredictions = null
    let primaryCTAPrediction = null
    let elements = [] // Declare elements outside for debugging

    try {
      // Run CTA analysis if we have valid data
      if (result.screenshot && result.domData) {
        // Convert base64 screenshot to Blob for CTA analysis
        const base64Data = result.screenshot.replace(/^data:image\/[^;]+;base64,/, '')
        const binaryData = Buffer.from(base64Data, 'base64')
        const imageBlob = new Blob([binaryData], { type: 'image/png' })
        
        const ctaResult = await analyzeCTA({
          image: imageBlob,
          domData: result.domData,
        })
        ctaInsight = ctaResult.insight
        apiLogger.info("CTA analysis completed for capture", { requestId, ctaText: ctaInsight?.text })
      }
    } catch (ctaError) {
      apiLogger.warn("CTA analysis failed during capture", ctaError as Error, { requestId })
    }

    try {
      // Run click predictions if we have valid elements
      if (result.domData) {
        const predictionEngine = new ClickPredictionEngine()
        
        // Create elements array for prediction
        elements = [] // Reset the array
        
        console.log("🔧 DEBUGGING: Creating elements for prediction:", {
          linksInDomData: result.domData.links?.length || 0,
          buttonsInDomData: result.domData.buttons?.length || 0,
          formFieldsInDomData: result.domData.formFields?.length || 0,
          sampleLink: result.domData.links?.[0],
          sampleButton: result.domData.buttons?.[0]
        })
        
        if (result.domData.links) {
          result.domData.links.forEach((link, index) => {
            const element = {
              id: `link-${index}`,
              tagName: 'a',
              text: link.text || '',
              href: link.href,
              isAboveFold: link.isAboveFold,
              isVisible: link.isVisible !== false, // Default to true if not specified
              isInteractive: true, // Links are interactive
              className: link.className || '',
              coordinates: link.coordinates || { x: 0, y: 0, width: 0, height: 0 },
              hasButtonStyling: link.hasButtonStyling || false,
              distanceFromTop: link.distanceFromTop || 0
            }
            console.log(`🔧 DEBUGGING: Adding link element ${index}:`, element)
            elements.push(element)
          })
        }

        if (result.domData.buttons) {
          result.domData.buttons.forEach((button, index) => {
            const element = {
              id: `button-${index}`,
              tagName: 'button',
              text: button.text || '',
              isAboveFold: button.isAboveFold,
              isVisible: button.isVisible !== false, // Default to true if not specified
              isInteractive: true, // Buttons are interactive
              className: button.className || '',
              coordinates: button.coordinates || { x: 0, y: 0, width: 0, height: 0 },
              distanceFromTop: button.distanceFromTop || 0
            }
            console.log(`🔧 DEBUGGING: Adding button element ${index}:`, element)
            elements.push(element)
          })
        }

        // Also add form fields if present
        if (result.domData.formFields) {
          result.domData.formFields.forEach((field, index) => {
            const element = {
              id: `field-${index}`,
              tagName: 'input',
              text: field.label || field.placeholder || '',
              type: field.type || 'text',
              isAboveFold: field.isAboveFold,
              isVisible: field.isVisible !== false,
              isInteractive: true, // Form fields are interactive
              className: field.className || '',
              coordinates: field.coordinates || { x: 0, y: 0, width: 0, height: 0 },
              required: field.required || false,
              label: field.label,
              placeholder: field.placeholder,
              distanceFromTop: field.distanceFromTop || 0
            }
            console.log(`🔧 DEBUGGING: Adding form field element ${index}:`, element)
            elements.push(element)
          })
        }
        
        console.log("🔧 DEBUGGING: Total elements created:", elements.length)

        if (elements.length > 0) {
          apiLogger.info("Running click predictions", { 
            requestId, 
            elementsCount: elements.length,
            linkCount: result.domData.links?.length || 0,
            buttonCount: result.domData.buttons?.length || 0,
            formFieldCount: result.domData.formFields?.length || 0,
            sampleElements: elements.slice(0, 3).map(e => ({ id: e.id, tagName: e.tagName, text: e.text?.substring(0, 30), isVisible: e.isVisible, isInteractive: e.isInteractive }))
          })
          
          console.log("🔧 DEBUGGING: About to call prediction engine with context:", {
            url: sanitizedUrl,
            deviceType: result.isMobile ? 'mobile' : 'desktop',
            totalImpressions: 1000,
            trafficSource: 'unknown'
          })

          const predictions = await predictionEngine.predictClicks(elements, {
            url: sanitizedUrl,
            deviceType: result.isMobile ? 'mobile' : 'desktop',
            userAgent: 'capture-api',
            viewport: { width: result.isMobile ? 375 : 1920, height: result.isMobile ? 812 : 1080 },
            timestamp: Date.now(),
            totalImpressions: 1000, // Default traffic estimate
            trafficSource: 'unknown' // Default traffic source for capture analysis
          })

          console.log("🔧 DEBUGGING: Prediction engine result:", {
            predictionsCount: predictions.predictions?.length || 0,
            samplePrediction: predictions.predictions?.[0],
            warnings: predictions.warnings,
            metadata: predictions.metadata
          })

          clickPredictions = predictions.predictions
          
          // Find primary CTA prediction (highest predicted clicks)
          if (clickPredictions && clickPredictions.length > 0) {
            primaryCTAPrediction = clickPredictions.reduce((max, current) =>
              current.predictedClicks > max.predictedClicks ? current : max
            )
          }
          
          apiLogger.info("Click predictions completed for capture", { 
            requestId, 
            predictionsCount: clickPredictions?.length || 0,
            primaryCTAText: primaryCTAPrediction?.text || 'None'
          })
        } else {
          apiLogger.warn("No elements available for click prediction", {
            requestId,
            linkCount: result.domData.links?.length || 0,
            buttonCount: result.domData.buttons?.length || 0,
            formFieldCount: result.domData.formFields?.length || 0,
            hasCoordinates: {
              links: result.domData.links?.filter(l => l.coordinates).length || 0,
              buttons: result.domData.buttons?.filter(b => b.coordinates).length || 0
            }
          })
        }
      }
    } catch (predictionError) {
      apiLogger.warn("Click prediction failed during capture", predictionError as Error, { requestId })
    }

    apiLogger.info(`Successfully captured website: ${sanitizedUrl}`, {
      requestId,
      title: result.domData.title,
      buttonsFound: result.domData.buttons.length,
      linksFound: result.domData.links.length,
      formsFound: result.domData.forms.length,
      formFieldsFound: result.domData.formFields?.length || 0,
      screenshotSize: result.screenshot.length,
      aboveFoldButtons: result.domData.foldLine.aboveFoldButtons,
      isMobile: result.isMobile || false,
      creditsRemaining: updatedBalance.remainingCredits,
      hasCTAInsight: !!ctaInsight,
      hasClickPredictions: !!clickPredictions,
      hasPrimaryCTA: !!primaryCTAPrediction,
    })

    return NextResponse.json({
      ...result,
      ctaInsight,
      clickPredictions,
      primaryCTAPrediction,
      requestId,
      timestamp: new Date().toISOString(),
      creditsRemaining: updatedBalance.remainingCredits,
      creditsUsed: updatedBalance.usedCredits,
      // DEBUG: Add debugging info to response
      debug: {
        elementsProcessed: elements?.length || 0,
        linksInDom: result.domData.links?.length || 0,
        buttonsInDom: result.domData.buttons?.length || 0,
        formFieldsInDom: result.domData.formFields?.length || 0,
        predictionEngineResult: clickPredictions ? {
          count: clickPredictions.length,
          sample: clickPredictions[0]
        } : null
      }
    })
  } catch (error) {
    // Handle all errors through the centralized error handler
    const appError = handleError(error instanceof ApplicationError ? error : (error as Error), {
      logError: true,
      notifyMonitoring: true,
      includeStack: process.env.NODE_ENV === "development",
    })

    const statusCode = getHttpStatusCode(appError)
    const errorResponse = createErrorResponse(appError)

    apiLogger.error("Capture API error", appError.originalError || appError, {
      requestId,
      errorCode: appError.code,
      statusCode,
      severity: appError.severity,
    })

    return NextResponse.json(
      {
        ...errorResponse,
        requestId,
      },
      { status: statusCode },
    )
  }
}
