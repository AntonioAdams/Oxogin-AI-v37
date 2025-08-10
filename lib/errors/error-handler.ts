// Centralized Error Handling Utilities

import { ApplicationError, SystemError } from "./application-error"
import { ERROR_CODE_REGISTRY } from "./error-codes"
import { logger } from "../utils/logger"

const errorLogger = logger.module("error-handler")

export interface ErrorHandlerOptions {
  logError?: boolean
  notifyMonitoring?: boolean
  includeStack?: boolean
  sanitizeMessage?: boolean
}

export class ErrorHandler {
  private static instance: ErrorHandler
  private monitoringService?: any // Replace with actual monitoring service

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  // Handle and log application errors
  handleError(error: Error | ApplicationError, options: ErrorHandlerOptions = {}): ApplicationError {
    const {
      logError = true,
      notifyMonitoring = process.env.NODE_ENV === "production",
      includeStack = process.env.NODE_ENV === "development",
      sanitizeMessage = process.env.NODE_ENV === "production",
    } = options

    let appError: ApplicationError

    // Convert regular errors to ApplicationError
    if (error instanceof ApplicationError) {
      appError = error
    } else {
      appError = new SystemError(
        ERROR_CODE_REGISTRY.UTILS_LOGGER.ERRORS.LOG_ENTRY_CREATION_FAILED,
        sanitizeMessage ? "An unexpected error occurred" : error.message,
        {
          file: "error-handler.ts",
          function: "handleError",
          metadata: { originalErrorName: error.name },
        },
        error,
      )
    }

    // Log the error
    if (logError) {
      this.logError(appError, includeStack)
    }

    // Notify monitoring service
    if (notifyMonitoring && appError.severity === "critical") {
      this.notifyMonitoring(appError)
    }

    return appError
  }

  // Log error with structured format
  private logError(error: ApplicationError, includeStack = false) {
    const logData = {
      errorCode: error.code,
      message: error.message,
      context: error.context,
      severity: error.severity,
      category: error.category,
      retryable: error.retryable,
      errorInfo: error.getErrorInfo(),
      ...(includeStack && { stack: error.stack }),
    }

    switch (error.severity) {
      case "critical":
        errorLogger.error("Critical application error", error.originalError, logData)
        break
      case "high":
        errorLogger.error("High severity error", error.originalError, logData)
        break
      case "medium":
        errorLogger.warn("Medium severity error", logData)
        break
      case "low":
        errorLogger.info("Low severity error", logData)
        break
    }
  }

  // Notify external monitoring service
  private async notifyMonitoring(error: ApplicationError) {
    try {
      if (this.monitoringService) {
        await this.monitoringService.reportError({
          errorCode: error.code,
          message: error.message,
          context: error.context,
          severity: error.severity,
          timestamp: error.timestamp,
        })
      }
    } catch (monitoringError) {
      errorLogger.error("Failed to notify monitoring service", monitoringError as Error)
    }
  }

  // Create error response for API endpoints
  createErrorResponse(error: ApplicationError) {
    const isDevelopment = process.env.NODE_ENV === "development"

    return {
      error: {
        code: error.code,
        message: isDevelopment ? error.message : error.getUserMessage(),
        timestamp: error.timestamp,
        retryable: error.retryable,
        ...(isDevelopment && {
          context: error.context,
          severity: error.severity,
          category: error.category,
          errorInfo: error.getErrorInfo(),
        }),
      },
    }
  }

  // Determine HTTP status code from error
  getHttpStatusCode(error: ApplicationError): number {
    const errorInfo = error.getErrorInfo()

    // Map error codes to HTTP status codes
    if (error.category === "validation") return 400
    if (error.code.includes("TIMEOUT")) return 408
    if (error.code.includes("RATE_LIMITED")) return 429
    if (error.code.includes("API_KEY")) return 401
    if (error.category === "network") return 503

    return 500 // Default to internal server error
  }
}

// Convenience functions
export const errorHandler = ErrorHandler.getInstance()

export function handleError(error: Error | ApplicationError, options?: ErrorHandlerOptions): ApplicationError {
  return errorHandler.handleError(error, options)
}

export function createErrorResponse(error: ApplicationError) {
  return errorHandler.createErrorResponse(error)
}

export function getHttpStatusCode(error: ApplicationError): number {
  return errorHandler.getHttpStatusCode(error)
}
