// Updated Capture Module with Comprehensive Error Handling

import { BrowserlessClient } from "./browserless"
import type { CaptureOptions, CaptureResult } from "../contracts/capture"
import { validateUrl } from "../utils/validation"
import { logger } from "../utils/logger"
import { CaptureError } from "../errors/application-error"
import { ERROR_CODE_REGISTRY } from "../errors/error-codes"
import { handleError } from "../errors/error-handler"

// Re-export types from feature-specific contracts
export type {
  CaptureResult,
  CaptureOptions,
  CaptureError as CaptureErrorType,
  DOMData,
  ButtonData,
  LinkData,
  FormData,
  ElementCoordinates,
  FoldLineMetrics,
} from "../contracts/capture"

const moduleLogger = logger.module("capture")
let browserlessClient: BrowserlessClient | null = null

function getBrowserlessClient(): BrowserlessClient {
  if (!browserlessClient) {
    browserlessClient = new BrowserlessClient()
  }
  return browserlessClient
}

export async function captureWebsite(url: string, options: { isMobile?: boolean } = {}): Promise<CaptureResult> {
  const context = {
    file: "lib/capture/index.ts",
    function: "captureWebsite",
    metadata: { url, options },
  }

  moduleLogger.info(`Starting website capture`, { url })

  try {
    // Validate URL
    const validationResult = validateUrl(url)
    if (!validationResult.isValid) {
      throw new CaptureError(
        ERROR_CODE_REGISTRY.CAPTURE_INDEX.ERRORS.INVALID_URL,
        validationResult.error || "Invalid URL",
        context,
      )
    }

    const client = getBrowserlessClient()
    const captureOptions: CaptureOptions = {
      url,
      timeout: options.isMobile ? 15000 : 15000, // Optimized timeouts for both mobile and desktop
      width: options.isMobile ? 375 : 1920,
      height: options.isMobile ? 812 : 1080,
      foldLinePosition: options.isMobile ? 600 : 1000,
      isMobile: options.isMobile || false,
    }

    const result = await client.capture(captureOptions)

    moduleLogger.info(`Website capture completed`, {
      url,
      buttonsFound: result.domData.buttons.length,
      linksFound: result.domData.links.length,
      formsFound: result.domData.forms.length,
    })

    return result
  } catch (error) {
    if (error instanceof CaptureError) {
      throw error // Re-throw application errors
    }

    // Handle unexpected errors
    const appError = new CaptureError(
      ERROR_CODE_REGISTRY.CAPTURE_INDEX.ERRORS.CAPTURE_FAILED,
      `Website capture failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      context,
      error instanceof Error ? error : undefined,
    )

    handleError(appError)
    throw appError
  }
}
