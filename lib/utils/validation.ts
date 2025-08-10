// URL and input validation utilities
import { logger } from "./logger"
import { sanitizeUrl } from "../utils"

const moduleLogger = logger.module("validation")

export interface ValidationResult {
  isValid: boolean
  error?: string
}

export function validateUrl(url: string): ValidationResult {
  moduleLogger.debug("Validating URL", { url })

  if (!url || !url.trim()) {
    return {
      isValid: false,
      error: "URL is required",
    }
  }

  // First sanitize the URL to add https:// if needed
  const sanitizedUrl = sanitizeUrl(url)

  try {
    const urlObj = new URL(sanitizedUrl)

    // Check for valid protocols
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: "URL must use HTTP or HTTPS protocol",
      }
    }

    // Check for valid hostname
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return {
        isValid: false,
        error: "URL must have a valid hostname",
      }
    }

    // Check for localhost in production
    if (process.env.NODE_ENV === "production" && (urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1")) {
      return {
        isValid: false,
        error: "Localhost URLs are not allowed in production",
      }
    }

    moduleLogger.debug("URL validation passed", { originalUrl: url, sanitizedUrl })
    return { isValid: true }
  } catch (error) {
    moduleLogger.warn("URL validation failed", { url, sanitizedUrl, error: (error as Error).message })
    return {
      isValid: false,
      error: "Invalid URL format",
    }
  }
}

export function validateImageFile(file: File): ValidationResult {
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
  const maxSize = 10 * 1024 * 1024 // 10MB

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: "Invalid file type. Only PNG, JPEG, and WebP images are allowed.",
    }
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      error: "File size too large. Maximum size is 10MB.",
    }
  }

  return { isValid: true }
}
