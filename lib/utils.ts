import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitizes and normalizes a URL by adding https:// if no protocol is present
 * @param url - The URL to sanitize
 * @returns The sanitized URL with proper protocol
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") {
    return ""
  }

  const trimmed = url.trim()
  if (!trimmed) {
    return ""
  }

  // If URL already has a protocol, return as-is
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }

  // Add https:// prefix for domain-only URLs
  return `https://${trimmed}`
}
