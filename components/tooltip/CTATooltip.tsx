"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Info } from "lucide-react"
import type { TooltipProps } from "@/lib/tooltip/schema"
import { debugLogCategory } from "@/lib/utils/logger"

export function CTATooltip({
  pulsePosition,
  linePath,
  side,
  panelStyle,
  metrics,
  ctaText,
  isFormRelated = false,
}: TooltipProps & { isFormRelated?: boolean }) {
  // Add null checks and default values to prevent runtime errors
  const safeMetrics = {
    wastedClicks: metrics?.wastedClicks || 0,
    estimatedClicks: metrics?.estimatedClicks || 0,
    ctr: metrics?.ctr || 0,
    clickShare: metrics?.clickShare || 0,
    confidence: metrics?.confidence || "medium",
    ...metrics,
  }

  const safePulsePosition = {
    x: pulsePosition?.x || 0,
    y: pulsePosition?.y || 0,
    ...pulsePosition,
  }

  const safePanelStyle = {
    top: panelStyle?.top || 0,
    left: panelStyle?.left || 0,
    width: panelStyle?.width || 300,
    ...panelStyle,
  }

  // Determine labels based on whether this is a form-related tooltip
  const clicksLabel = isFormRelated ? "Leads" : "Clicks"
  const ctrLabel = isFormRelated ? "Conversion Rate" : "CTR"
  const clickShareLabel = isFormRelated ? "CTA Click Share" : "Click Share"

  // Check if mobile viewport
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768

  // FIXED: Use actual wasted clicks and spend from the v5.3 model predictions with null checks
  const wastedClicksFromModel = React.useMemo(() => {
    // Try to get wasted clicks from the primary CTA prediction data
    if (typeof window !== "undefined" && (window as any).primaryCTAPrediction) {
      const prediction = (window as any).primaryCTAPrediction
      debugLogCategory("TOOLTIP", "Using wasted clicks from primary CTA prediction:", prediction?.wastedClicks || 0)
      return prediction?.wastedClicks || 0
    }

    // Fallback to metrics if no prediction data available
    debugLogCategory("TOOLTIP", "Falling back to metrics.wastedClicks:", safeMetrics.wastedClicks)
    return safeMetrics.wastedClicks
  }, [safeMetrics.wastedClicks])

  const wastedSpendFromModel = React.useMemo(() => {
    // Try to get wasted spend from the primary CTA prediction data
    if (typeof window !== "undefined" && (window as any).primaryCTAPrediction) {
      const prediction = (window as any).primaryCTAPrediction
      debugLogCategory("TOOLTIP", "Using wasted spend from primary CTA prediction:", prediction?.wastedSpend || 0)
      return prediction?.wastedSpend || 0
    }

    // Fallback calculation using estimated CPC - UPDATED to $2.93
    const estimatedCPC = (typeof window !== "undefined" && (window as any).estimatedCPC) || 2.93
    const calculatedWastedSpend = wastedClicksFromModel * estimatedCPC
    debugLogCategory(
      "TOOLTIP", "Calculated wasted spend:",
      calculatedWastedSpend,
      "from",
      wastedClicksFromModel,
      "clicks at $",
      estimatedCPC,
      "CPC",
    )
    return calculatedWastedSpend
  }, [wastedClicksFromModel])

  // Log tooltip data for debugging
  React.useEffect(() => {
    debugLogCategory("TOOLTIP", "Rendering with data:", {
      isFormRelated,
      wastedClicksFromModel,
      wastedSpendFromModel,
      metricsWastedClicks: metrics.wastedClicks,
      primaryCTAPrediction: typeof window !== "undefined" ? (window as any).primaryCTAPrediction : null,
      estimatedCPC: typeof window !== "undefined" ? (window as any).estimatedCPC : null,
    })
  }, [isFormRelated, wastedClicksFromModel, wastedSpendFromModel, metrics.wastedClicks])

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Pulse animation at CTA position */}
      <div
        className="absolute w-3 h-3 bg-blue-500 rounded-full animate-ping"
        style={{
          left: safePulsePosition.x - 6,
          top: safePulsePosition.y - 6,
          animationDuration: "2s",
        }}
      />
      <div
        className="absolute w-2 h-2 bg-blue-600 rounded-full"
        style={{
          left: safePulsePosition.x - 4,
          top: safePulsePosition.y - 4,
        }}
      />

      {/* Connection line */}
      <svg className="absolute inset-0 w-full h-full">
        <path
          d={linePath || ""}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="5,5"
          fill="none"
          className="animate-pulse"
        />
      </svg>

      {/* Tooltip panel - positioned exactly like the screenshot for mobile */}
      <Card
        className={`absolute bg-white border shadow-lg pointer-events-auto ${isMobile ? "mx-2" : ""}`}
        style={{
          top: safePanelStyle.top,
          left: safePanelStyle.left,
          width: isMobile ? Math.min(safePanelStyle.width, window.innerWidth - 20) : safePanelStyle.width,
          zIndex: 50,
        }}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm">Primary CTA</span>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
              {safeMetrics.confidence}
            </Badge>
          </div>

          {/* CTA Text */}
          <div className="text-lg font-semibold text-gray-900">"{ctaText || "Primary CTA"}"</div>

          {/* Source */}
          <div className="text-xs text-gray-500">Source: {isFormRelated ? "form-bottleneck" : "element-ctr"}</div>

          {/* Main Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 py-2">
            {/* Clicks/Leads */}
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">⚡ {safeMetrics.estimatedClicks}</div>
              <div className="text-xs text-gray-600">{clicksLabel}</div>
            </div>

            {/* CTR/Conversion Rate */}
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">✓ {(safeMetrics.ctr * 100).toFixed(1)}%</div>
              <div className="text-xs text-gray-600">{ctrLabel}</div>
            </div>

            {/* Click Share/Form Click Share */}
            <div className="text-center">
              <div className="text-xl font-bold text-purple-600">👥 {(safeMetrics.clickShare * 100).toFixed(1)}%</div>
              <div className="text-xs text-gray-600">{clickShareLabel}</div>
            </div>
          </div>

          {/* Bottom Metrics - Using v5.3 Model Data with safe values */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">⚡ {wastedClicksFromModel}</div>
              <div className="text-xs text-gray-600">Wasted Clicks</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">$ ${wastedSpendFromModel.toFixed(2)}</div>
              <div className="text-xs text-gray-600">Wasted Spend</div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-400 text-center pt-2 border-t">(Based on 1000 site visitors)</div>
        </CardContent>
      </Card>
    </div>
  )
}
