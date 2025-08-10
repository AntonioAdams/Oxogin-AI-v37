"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Info, Target } from "lucide-react"
import type { ClickPredictionResult } from "@/app/page/types"
import { computeMetrics } from "@/lib/tooltip/metrics"
import type { RawTooltipInput } from "@/lib/tooltip/schema"

interface CTADataCardProps {
  ctaText: string
  clickPrediction: ClickPredictionResult
  isFormRelated: boolean
  elementCoords: { x: number; y: number; width?: number; height?: number }
  imageSize: { width: number; height: number }
  containerSize: { width: number; height: number }
}

export function CTADataCard({
  ctaText,
  clickPrediction,
  isFormRelated,
  elementCoords,
  imageSize,
  containerSize,
}: CTADataCardProps) {
  // Use the same metrics computation as tooltip
  const tooltipInput: RawTooltipInput = {
    elementCoords,
    imageSize,
    containerSize,
    clickPrediction,
    isFormRelated,
    ctaText,
  }

  const metrics = computeMetrics(tooltipInput)

  // Determine labels based on whether this is a form-related CTA
  const clicksLabel = isFormRelated ? "Leads" : "Clicks"
  const ctrLabel = isFormRelated ? "Conversion Rate" : "CTR"
  const clickShareLabel = isFormRelated ? "CTA Click Share" : "Click Share"

  return (
    <Card className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-blue-600" />
            Primary CTA Analysis
          </CardTitle>
          <Badge
            variant="secondary"
            className={`text-xs ${
              metrics.confidence === "high"
                ? "bg-green-100 text-green-700"
                : metrics.confidence === "medium"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {metrics.confidence} confidence
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-3">
        {/* CTA Text - More Compact */}
        <div className="bg-white rounded-lg p-2 border">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-3 h-3 text-blue-500" />
            <span className="text-xs font-medium text-gray-600">Detected CTA</span>
          </div>
          <div className="text-base font-semibold text-gray-900">"{ctaText}"</div>
          <div className="text-xs text-gray-500">Source: {metrics.calculationSource}</div>
        </div>

        {/* Metrics Row - Using computed metrics (same as tooltip) */}
        <div className="grid grid-cols-5 gap-2">
          {/* Clicks/Leads - Use computed metrics with corrected calculation */}
          <div className="bg-white rounded-lg p-2 border text-center">
            <div className="text-lg font-bold text-blue-600 mb-0">⚡ {metrics.estimatedClicks}</div>
            <div className="text-xs text-gray-600">{clicksLabel}</div>
          </div>

          {/* CTR/Conversion Rate - Use computed metrics */}
          <div className="bg-white rounded-lg p-2 border text-center">
            <div className="text-lg font-bold text-green-600 mb-0">✓ {(metrics.ctr * 100).toFixed(1)}%</div>
            <div className="text-xs text-gray-600">{ctrLabel}</div>
          </div>

          {/* Click Share - Use computed metrics */}
          <div className="bg-white rounded-lg p-2 border text-center">
            <div className="text-lg font-bold text-purple-600 mb-0">👥 {(metrics.clickShare * 100).toFixed(1)}%</div>
            <div className="text-xs text-gray-600">{clickShareLabel}</div>
          </div>

          {/* Wasted Clicks - Use computed metrics */}
          <div className="bg-white rounded-lg p-2 border text-center">
            <div className="text-lg font-bold text-orange-600 mb-0">⚡ {metrics.wastedClicks}</div>
            <div className="text-xs text-gray-600">Wasted Clicks</div>
          </div>

          {/* Wasted Spend - Use computed metrics */}
          <div className="bg-white rounded-lg p-2 border text-center">
            <div className="text-lg font-bold text-red-600 mb-0">$ ${metrics.wastedSpend.toFixed(2)}</div>
            <div className="text-xs text-gray-600">Wasted Spend</div>
          </div>
        </div>

        {/* Footer - Use computed CPC from metrics */}
        <div className="text-xs text-gray-400 text-center pt-1 border-t bg-gray-50 rounded p-1">
          Based on 1000 impressions & avg. CPC of $
          {(metrics.wastedSpend / Math.max(metrics.wastedClicks, 1)).toFixed(2)}
        </div>
      </CardContent>
    </Card>
  )
}
