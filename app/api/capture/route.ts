import { type NextRequest, NextResponse } from "next/server"
import { runParallelAnalysis } from "@/lib/capture/parallel-analyzer"
import { logger } from "@/lib/utils/logger"
import { ApplicationError, ValidationError } from "@/lib/errors/application-error"
import { ERROR_CODE_REGISTRY } from "@/lib/errors/error-codes"
import { handleError, createErrorResponse, getHttpStatusCode } from "@/lib/errors/error-handler"
import { creditManager } from "@/lib/credits/manager"
import { sanitizeUrl } from "@/lib/utils"
import { validateUrl } from "@/lib/utils/validation"

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

    const { url: rawUrl, userId } = body
  // Note: isMobile parameter no longer needed as we capture both desktop and mobile in parallel

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

    apiLogger.info(`Starting parallel capture for URL: ${sanitizedUrl}`, {
      requestId,
      originalUrl: rawUrl,
      sanitizedUrl,
      userId: actualUserId,
      mode: 'parallel (desktop + mobile)'
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

    // Perform parallel capture for both desktop and mobile
    const { desktopAnalysis, mobileAnalysis, totalTime } = await runParallelAnalysis(sanitizedUrl, requestId)

    // Validate both results
    if (!desktopAnalysis.captureResult || !desktopAnalysis.captureResult.screenshot || !desktopAnalysis.captureResult.domData) {
      apiLogger.error("Invalid desktop capture result structure", undefined, {
        requestId,
        hasDesktopResult: !!desktopAnalysis.captureResult,
        hasDesktopScreenshot: !!desktopAnalysis.captureResult?.screenshot,
        hasDesktopDomData: !!desktopAnalysis.captureResult?.domData
      })

      throw new ApplicationError({
        code: ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.RESPONSE_GENERATION_FAILED,
        message: "Invalid desktop capture result from service - missing required data",
        context,
        severity: "high",
        category: "processing",
        retryable: true,
      })
    }

    if (!mobileAnalysis.captureResult || !mobileAnalysis.captureResult.screenshot || !mobileAnalysis.captureResult.domData) {
      apiLogger.error("Invalid mobile capture result structure", undefined, {
        requestId,
        hasMobileResult: !!mobileAnalysis.captureResult,
        hasMobileScreenshot: !!mobileAnalysis.captureResult?.screenshot,
        hasMobileDomData: !!mobileAnalysis.captureResult?.domData
      })

      throw new ApplicationError({
        code: ERROR_CODE_REGISTRY.API_CAPTURE.ERRORS.RESPONSE_GENERATION_FAILED,
        message: "Invalid mobile capture result from service - missing required data",
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
        isMobile: false, // Default for backward compatibility
        reason: "Parallel analysis (desktop + mobile)",
      })

      // Update global credit store on successful deduction
      if (typeof global !== 'undefined') {
        try {
          const { globalCreditStore } = await import('@/lib/credits/global-store')
          globalCreditStore.updateBalance(updatedBalance)
        } catch (error) {
          console.warn('Failed to update global credit store:', error)
        }
      }

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

    // Parallel analysis has already been completed above
    // Extract results for backward compatibility
    const desktopResult = desktopAnalysis.captureResult
    const mobileResult = mobileAnalysis.captureResult
    
    // Use desktop as primary result for backward compatibility
    const result = desktopResult
    const ctaInsight = desktopAnalysis.ctaInsight
    const clickPredictions = desktopAnalysis.clickPredictions
    const primaryCTAPrediction = desktopAnalysis.primaryCTAPrediction
    const elements = desktopAnalysis.elements

    apiLogger.info(`Successfully captured website (parallel): ${sanitizedUrl}`, {
      requestId,
      totalTime,
      desktopTime: desktopAnalysis.analysisTime,
      mobileTime: mobileAnalysis.analysisTime,
      desktop: {
        title: desktopResult.domData.title,
        buttonsFound: desktopResult.domData.buttons.length,
        linksFound: desktopResult.domData.links.length,
        formsFound: desktopResult.domData.forms.length,
        hasCTAInsight: !!desktopAnalysis.ctaInsight,
        hasClickPredictions: !!desktopAnalysis.clickPredictions
      },
      mobile: {
        title: mobileResult.domData.title,
        buttonsFound: mobileResult.domData.buttons.length,
        linksFound: mobileResult.domData.links.length,
        formsFound: mobileResult.domData.forms.length,
        hasCTAInsight: !!mobileAnalysis.ctaInsight,
        hasClickPredictions: !!mobileAnalysis.clickPredictions
      },
      creditsRemaining: updatedBalance.remainingCredits
    })

    return NextResponse.json({
      // Backward compatibility: primary result is desktop
      ...result,
      ctaInsight,
      clickPredictions,
      primaryCTAPrediction,
      
      // New parallel structure
      desktop: {
        captureResult: desktopResult,
        ctaInsight: desktopAnalysis.ctaInsight,
        clickPredictions: desktopAnalysis.clickPredictions,
        primaryCTAPrediction: desktopAnalysis.primaryCTAPrediction,
        elements: desktopAnalysis.elements,
        analysisTime: desktopAnalysis.analysisTime,
        deviceType: desktopAnalysis.deviceType
      },
      mobile: {
        captureResult: mobileResult,
        ctaInsight: mobileAnalysis.ctaInsight,
        clickPredictions: mobileAnalysis.clickPredictions,
        primaryCTAPrediction: mobileAnalysis.primaryCTAPrediction,
        elements: mobileAnalysis.elements,
        analysisTime: mobileAnalysis.analysisTime,
        deviceType: mobileAnalysis.deviceType
      },
      
      // Metadata
      requestId,
      timestamp: new Date().toISOString(),
      creditsRemaining: updatedBalance.remainingCredits,
      creditsUsed: updatedBalance.usedCredits,
      totalAnalysisTime: totalTime,
      parallelProcessing: true,
      
      // DEBUG: Enhanced debugging info
      debug: {
        desktopElementsProcessed: desktopAnalysis.elements?.length || 0,
        mobileElementsProcessed: mobileAnalysis.elements?.length || 0,
        desktop: {
          linksInDom: desktopResult.domData.links?.length || 0,
          buttonsInDom: desktopResult.domData.buttons?.length || 0,
          formFieldsInDom: desktopResult.domData.formFields?.length || 0,
          predictionEngineResult: desktopAnalysis.clickPredictions ? {
            count: desktopAnalysis.clickPredictions.length,
            sample: desktopAnalysis.clickPredictions[0]
          } : null
        },
        mobile: {
          linksInDom: mobileResult.domData.links?.length || 0,
          buttonsInDom: mobileResult.domData.buttons?.length || 0,
          formFieldsInDom: mobileResult.domData.formFields?.length || 0,
          predictionEngineResult: mobileAnalysis.clickPredictions ? {
            count: mobileAnalysis.clickPredictions.length,
            sample: mobileAnalysis.clickPredictions[0]
          } : null
        }
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
