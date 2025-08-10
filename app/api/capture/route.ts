import { type NextRequest, NextResponse } from "next/server"
import { captureWebsite } from "@/lib/capture"
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
    })

    return NextResponse.json({
      ...result,
      requestId,
      timestamp: new Date().toISOString(),
      creditsRemaining: updatedBalance.remainingCredits,
      creditsUsed: updatedBalance.usedCredits,
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
