// CTA Tooltip System - Public API barrel exports

// Import and re-export types
export type {
  Coordinates,
  TooltipSide,
  ClickPredictionResult,
  PerformanceMetrics,
  RawTooltipInput,
  TooltipProps,
  TooltipPositionResult,
} from "./schema"

// Import and re-export functions - fix the import paths
import { positionTooltip, detectCollisions } from "./positioner"
import { computeMetrics, calculateConfidenceScore, formatMetricValue } from "./metrics"
import {
  getTooltipArrowClasses,
  getConfidenceBadgeClasses,
  getRiskFactorIcon,
  formatDisplayValue,
  calculatePulseAnimationDelay,
  shouldShowTooltip,
} from "./render-utils"

// Re-export the imported functions
export {
  positionTooltip,
  detectCollisions,
  computeMetrics,
  calculateConfidenceScore,
  formatMetricValue,
  getTooltipArrowClasses,
  getConfidenceBadgeClasses,
  getRiskFactorIcon,
  formatDisplayValue,
  calculatePulseAnimationDelay,
  shouldShowTooltip,
}

// Main orchestration function
import type { TooltipProps, RawTooltipInput, ClickPredictionResult } from "./schema"

export function computeTooltipProps(input: RawTooltipInput): TooltipProps {
  // Calculate positioning
  const positionResult = positionTooltip(input)

  // Calculate metrics
  const metrics = computeMetrics(input)

  // Combine results
  return {
    ...positionResult,
    metrics,
    ctaText: input.ctaText || "CTA",
    isFormRelated: input.isFormRelated || false, // Pass through form detection
  }
}

// Validation helper
export function validateTooltipInput(input: Partial<RawTooltipInput>): input is RawTooltipInput {
  return !!(
    input.elementCoords &&
    input.imageSize &&
    input.containerSize &&
    input.clickPrediction &&
    typeof input.isFormRelated === "boolean"
  )
}

// Default prediction for fallback scenarios
export function createDefaultPrediction(elementId: string): ClickPredictionResult {
  return {
    elementId,
    ctr: 0.02,
    estimatedClicks: 10,
    clickShare: 0.15,
    wastedClicks: 2,
    wastedSpend: 5.0,
    avgCPC: 2.5,
    confidence: "medium",
    riskFactors: ["Limited data available"],
  }
}
