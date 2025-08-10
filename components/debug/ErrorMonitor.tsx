// Error Monitoring Dashboard Component (Development Only)

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Bug, Info, AlertCircle, X } from "lucide-react"
import type { ApplicationError } from "@/lib/errors/application-error"

interface ErrorLog {
  id: string
  error: ApplicationError
  timestamp: string
  resolved: boolean
}

export function ErrorMonitor() {
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== "development") return

    // Listen for application errors
    const handleError = (event: ErrorEvent) => {
      const errorLog: ErrorLog = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        error: event.error,
        timestamp: new Date().toISOString(),
        resolved: false,
      }

      setErrors((prev) => [errorLog, ...prev].slice(0, 50)) // Keep last 50 errors
      setIsVisible(true)
    }

    window.addEventListener("error", handleError)
    return () => window.removeEventListener("error", handleError)
  }, [])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "high":
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      case "medium":
        return <Info className="w-4 h-4 text-yellow-500" />
      case "low":
        return <Bug className="w-4 h-4 text-blue-500" />
      default:
        return <Info className="w-4 h-4 text-gray-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const resolveError = (errorId: string) => {
    setErrors((prev) => prev.map((error) => (error.id === errorId ? { ...error, resolved: true } : error)))
  }

  const clearAllErrors = () => {
    setErrors([])
    setIsVisible(false)
  }

  if (process.env.NODE_ENV !== "development" || !isVisible) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 z-50">
      <Card className="shadow-lg border-2 border-red-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <CardTitle className="text-lg">Error Monitor</CardTitle>
              <Badge variant="destructive">{errors.filter((e) => !e.resolved).length}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsVisible(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription>Development error tracking (last {errors.length} errors)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-h-64 overflow-y-auto">
          {errors.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No errors logged</p>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <Button variant="outline" size="sm" onClick={clearAllErrors} className="text-xs bg-transparent">
                  Clear All
                </Button>
              </div>
              {errors.map((errorLog) => (
                <div key={errorLog.id} className={`p-3 rounded-lg border ${errorLog.resolved ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(errorLog.error.severity)}
                      <Badge className={getSeverityColor(errorLog.error.severity)}>{errorLog.error.code}</Badge>
                    </div>
                    {!errorLog.resolved && (
                      <Button variant="ghost" size="sm" onClick={() => resolveError(errorLog.id)} className="text-xs">
                        Resolve
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium">{errorLog.error.message}</p>
                    <div className="text-xs text-gray-500">
                      <div>File: {errorLog.error.context.file}</div>
                      {errorLog.error.context.function && <div>Function: {errorLog.error.context.function}</div>}
                      <div>Time: {new Date(errorLog.timestamp).toLocaleTimeString()}</div>
                      <div>Category: {errorLog.error.category}</div>
                      <div>Retryable: {errorLog.error.retryable ? "Yes" : "No"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
