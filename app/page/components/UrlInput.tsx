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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Globe className="w-5 h-5" />
          Website CTA Analyzer
        </CardTitle>
        <CardDescription>
          Enter a website URL to analyze its call-to-action elements and conversion potential
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter website URL (e.g., apple.com or https://apple.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            className="flex-1"
            style={{
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #d1d5db'
            }}
          />
          <Button type="submit" disabled={!canSubmit} className="min-w-[100px]">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze"
            )}
          </Button>
        </form>
        {trimmedUrl && !isValidUrl(trimmedUrl) && (
          <p className="text-sm text-red-600 mt-2">Please enter a valid URL (e.g., apple.com or https://apple.com)</p>
        )}
      </CardContent>
    </Card>
  )
}
