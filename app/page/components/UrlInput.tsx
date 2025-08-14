"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe, Loader2 } from "lucide-react"
import { sanitizeUrl } from "@/lib/utils"

interface UrlInputProps {
  onCapture: (url: string) => void
  isLoading: boolean
}

export function UrlInput({ onCapture, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // FIXED: Add null/undefined check and trim() safety
    const trimmedUrl = url?.trim?.() || ""
    if (trimmedUrl) {
      // Use sanitized URL for submission
      const sanitizedUrl = sanitizeUrl(trimmedUrl)
      onCapture(sanitizedUrl)
    }
  }

  const isValidUrl = (urlString: string) => {
    // FIXED: Add null/undefined check before trim()
    const trimmedUrl = urlString?.trim?.() || ""
    if (!trimmedUrl) return false

    try {
      // Use sanitized URL for validation
      const sanitizedUrl = sanitizeUrl(trimmedUrl)
      const url = new URL(sanitizedUrl)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }

  // FIXED: Add null/undefined check before trim()
  const trimmedUrl = url?.trim?.() || ""
  const canSubmit = trimmedUrl && isValidUrl(trimmedUrl) && !isLoading

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Main input form - maximum space efficiency */}
      <div className="bg-blue-50/30 border-2 border-blue-200 rounded-xl p-3 sm:p-4">
        {/* Compact instruction text */}
        <div className="text-center mb-3">
          <p className="text-sm font-medium text-gray-700 mb-1">
            Enter website URL, or paste URL here
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-0 sm:flex sm:gap-3">
          <Input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            className="flex-1 text-sm sm:text-base h-11 sm:h-12 w-full rounded-lg border-gray-300"
            style={{
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #d1d5db'
            }}
          />
          <Button 
            type="submit" 
            disabled={!canSubmit} 
            className="w-full sm:w-auto min-w-[100px] sm:min-w-[120px] h-11 sm:h-12 text-sm px-4 bg-blue-600 hover:bg-blue-700 rounded-lg"
            size="default"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>Analyze</span>
              </>
            )}
          </Button>
        </form>
        
        {trimmedUrl && !isValidUrl(trimmedUrl) && (
          <p className="text-xs text-red-600 mt-2 text-center">
            <span className="hidden sm:inline">Please enter a valid URL (e.g., apple.com or https://apple.com)</span>
            <span className="sm:hidden">Please enter a valid URL</span>
          </p>
        )}
      </div>
    </div>
  )
}
