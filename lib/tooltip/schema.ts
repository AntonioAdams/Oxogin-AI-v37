// CTA Tooltip System - Type Definitions

export interface Coordinates {
  x: number
  y: number
  width?: number
  height?: number
}

export type TooltipSide = "left" | "right" | "top" | "bottom"

export interface ClickPredictionResult {
  elementId: string
  ctr: number
  estimatedClicks: number
  clickShare: number
  wastedClicks: number
  wastedSpend: number
  avgCPC: number
  confidence: "high" | "medium" | "low"
  riskFactors: string[]
  formCompletionRate?: number
  leadCount?: number
  bottleneckField?: string
}

export interface PerformanceMetrics {
  ctr: number // Note: For form tooltips, this represents conversion rate
  estimatedClicks: number // Note: For form tooltips, this represents leads
  clickShare: number // Note: For form tooltips, this represents form click share
  wastedClicks: number
  wastedSpend: number
  confidence: "high" | "medium" | "low"
  calculationSource: string
}

export interface RawTooltipInput {
  elementCoords: { x: number; y: number; width?: number; height?: number }
  imageSize: { width: number; height: number }
  containerSize: { width: number; height: number }
  clickPrediction: any
  isFormRelated: boolean
  ctaText: string
}

export interface TooltipPositionResult {
  pulsePosition: { x: number; y: number }
  linePath: string
  side: TooltipSide
  panelStyle: {
    top: number
    left: number
    width: number
  }
}

export interface TooltipProps extends TooltipPositionResult {
  metrics: PerformanceMetrics
  ctaText: string
  isFormRelated?: boolean
}
