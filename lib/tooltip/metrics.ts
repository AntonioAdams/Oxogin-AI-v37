import type { RawTooltipInput, PerformanceMetrics } from "./schema"

export function computeMetrics(input: RawTooltipInput): PerformanceMetrics {
  const { clickPrediction, isFormRelated } = input

  // Use the prediction's CTR directly as the baseline
  const ctr = clickPrediction.ctr || 0
  const clickShare = clickPrediction.clickShare || 0
  const wastedClicks = clickPrediction.wastedClicks || 0
  const wastedSpend = clickPrediction.wastedSpend || 0
  const confidence = clickPrediction.confidence || "low"

  // Calculate leads/clicks based on conversion rate * impressions (assuming 1000 impressions)
  const impressions = 1000
  const estimatedClicks = Math.round(ctr * impressions)

  return {
    ctr,
    estimatedClicks,
    clickShare,
    wastedClicks,
    wastedSpend,
    confidence,
    calculationSource: isFormRelated ? "form-bottleneck" : "element-ctr",
  }
}

export function calculateConfidenceScore(prediction: any): number {
  if (!prediction) return 0

  const confidenceMap = {
    high: 90,
    medium: 70,
    low: 50,
  }

  return confidenceMap[prediction.confidence as keyof typeof confidenceMap] || 50
}

export function formatMetricValue(value: number, type: "percentage" | "currency" | "number"): string {
  switch (type) {
    case "percentage":
      return `${(value * 100).toFixed(1)}%`
    case "currency":
      return `$${value.toFixed(2)}`
    case "number":
      return Math.round(value).toString()
    default:
      return value.toString()
  }
}
