"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, RefreshCw, X, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface CaptureNotificationProps {
  isVisible: boolean
  onClose: () => void
  onRetry: () => void
  onTryNewUrl: () => void
  errorType: "stall" | "failure" | "timeout"
  deviceType: "desktop" | "mobile" | "both"
  progress?: number
  stage?: string
  url?: string
}

export function CaptureNotification({
  isVisible,
  onClose,
  onRetry,
  onTryNewUrl,
  errorType,
  deviceType,
  progress = 0,
  stage = "",
  url = "",
}: CaptureNotificationProps) {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (!isVisible) {
      setIsClosing(false)
    }
  }, [isVisible])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 200)
  }

  const getErrorTitle = () => {
    switch (errorType) {
      case "stall":
        return "Capture Stalled"
      case "failure":
        return "Capture Failed"
      case "timeout":
        return "Capture Timeout"
      default:
        return "Capture Error"
    }
  }

  const getErrorDescription = () => {
    switch (errorType) {
      case "stall":
        return `The ${deviceType} capture appears to be stuck at ${progress}%. This can happen with complex websites or slow loading times.`
      case "failure":
        return `The ${deviceType} capture failed to complete. This might be due to website restrictions, network issues, or server problems.`
      case "timeout":
        return `The ${deviceType} capture took too long to complete and timed out. This can happen with large or complex websites.`
      default:
        return `An unexpected error occurred during the ${deviceType} capture.`
    }
  }

  const getErrorColor = () => {
    switch (errorType) {
      case "stall":
        return "bg-yellow-50 border-yellow-200 text-yellow-800"
      case "failure":
        return "bg-red-50 border-red-200 text-red-800"
      case "timeout":
        return "bg-orange-50 border-orange-200 text-orange-800"
      default:
        return "bg-red-50 border-red-200 text-red-800"
    }
  }

  if (!isVisible) return null

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-opacity duration-200",
      isClosing ? "opacity-0" : "opacity-100"
    )}>
      <Card className={cn(
        "w-full max-w-md shadow-2xl border-2 transition-all duration-200",
        isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100",
        getErrorColor()
      )}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                errorType === "stall" ? "bg-yellow-100" : 
                errorType === "failure" ? "bg-red-100" : "bg-orange-100"
              )}>
                <AlertTriangle className={cn(
                  "w-5 h-5",
                  errorType === "stall" ? "text-yellow-600" : 
                  errorType === "failure" ? "text-red-600" : "text-orange-600"
                )} />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  {getErrorTitle()}
                </CardTitle>
                <Badge variant="outline" className="mt-1 text-xs">
                  {deviceType} {errorType}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0 hover:bg-black/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">
            {getErrorDescription()}
          </p>
          
          {progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    errorType === "stall" ? "bg-yellow-400" : 
                    errorType === "failure" ? "bg-red-400" : "bg-orange-400"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {stage && (
                <p className="text-xs text-muted-foreground">
                  Stage: {stage}
                </p>
              )}
            </div>
          )}

          {url && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <span className="truncate">{url}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={onRetry}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Capture
            </Button>
            <Button
              onClick={onTryNewUrl}
              variant="outline"
              className="flex-1"
            >
              Try New URL
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 