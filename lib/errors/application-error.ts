// Application Error Classes with File-Specific Error Codes

import type { ErrorCode } from "./error-codes"
import { getErrorInfo } from "./error-codes"

export interface ErrorContext {
  file: string
  function?: string
  line?: number
  userId?: string
  requestId?: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface ErrorDetails {
  code: ErrorCode
  message: string
  context: ErrorContext
  originalError?: Error
  severity: "low" | "medium" | "high" | "critical"
  category: "validation" | "network" | "processing" | "system" | "user"
  retryable: boolean
}

export class ApplicationError extends Error {
  public readonly code: ErrorCode
  public readonly context: ErrorContext
  public readonly originalError?: Error
  public readonly severity: "low" | "medium" | "high" | "critical"
  public readonly category: "validation" | "network" | "processing" | "system" | "user"
  public readonly retryable: boolean
  public readonly timestamp: string

  constructor(details: ErrorDetails) {
    super(details.message)

    this.name = "ApplicationError"
    this.code = details.code
    this.context = details.context
    this.originalError = details.originalError
    this.severity = details.severity
    this.category = details.category
    this.retryable = details.retryable
    this.timestamp = details.context.timestamp

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApplicationError)
    }
  }

  // Get error information
  getErrorInfo() {
    return getErrorInfo(this.code)
  }

  // Convert to JSON for logging/API responses
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      severity: this.severity,
      category: this.category,
      retryable: this.retryable,
      timestamp: this.timestamp,
      errorInfo: this.getErrorInfo(),
      stack: this.stack,
    }
  }

  // Create user-friendly message
  getUserMessage(): string {
    switch (this.category) {
      case "validation":
        return "Please check your input and try again."
      case "network":
        return "Network error occurred. Please check your connection and try again."
      case "processing":
        return "Processing error occurred. Please try again later."
      case "system":
        return "System error occurred. Our team has been notified."
      case "user":
        return this.message
      default:
        return "An unexpected error occurred. Please try again."
    }
  }
}

// Specific error classes for different modules
export class CaptureError extends ApplicationError {
  constructor(code: ErrorCode, message: string, context: Partial<ErrorContext>, originalError?: Error) {
    super({
      code,
      message,
      context: {
        file: context.file || "unknown",
        function: context.function,
        timestamp: new Date().toISOString(),
        ...context,
      },
      originalError,
      severity: "high",
      category: "network",
      retryable: true,
    })
  }
}

export class AIError extends ApplicationError {
  constructor(code: ErrorCode, message: string, context: Partial<ErrorContext>, originalError?: Error) {
    super({
      code,
      message,
      context: {
        file: context.file || "unknown",
        function: context.function,
        timestamp: new Date().toISOString(),
        ...context,
      },
      originalError,
      severity: "medium",
      category: "processing",
      retryable: false,
    })
  }
}

export class ValidationError extends ApplicationError {
  constructor(code: ErrorCode, message: string, context: Partial<ErrorContext>) {
    super({
      code,
      message,
      context: {
        file: context.file || "unknown",
        function: context.function,
        timestamp: new Date().toISOString(),
        ...context,
      },
      severity: "low",
      category: "validation",
      retryable: false,
    })
  }
}

export class SystemError extends ApplicationError {
  constructor(code: ErrorCode, message: string, context: Partial<ErrorContext>, originalError?: Error) {
    super({
      code,
      message,
      context: {
        file: context.file || "unknown",
        function: context.function,
        timestamp: new Date().toISOString(),
        ...context,
      },
      originalError,
      severity: "critical",
      category: "system",
      retryable: true,
    })
  }
}
