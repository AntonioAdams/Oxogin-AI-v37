// CTA Tooltip System - Shared DOM helpers and utilities

import type { TooltipSide, Coordinates } from "./schema"

export function getTooltipArrowClasses(side: TooltipSide): string {
  const baseClasses = "absolute w-0 h-0 border-solid"

  switch (side) {
    case "right":
      return `${baseClasses} border-r-8 border-r-white border-t-8 border-t-transparent border-b-8 border-b-transparent -left-2 top-1/2 -translate-y-1/2`
    case "left":
      return `${baseClasses} border-l-8 border-l-white border-t-8 border-t-transparent border-b-8 border-b-transparent -right-2 top-1/2 -translate-y-1/2`
    case "top":
      return `${baseClasses} border-t-8 border-t-white border-l-8 border-l-transparent border-r-8 border-r-transparent -bottom-2 left-1/2 -translate-x-1/2`
    case "bottom":
      return `${baseClasses} border-b-8 border-b-white border-l-8 border-l-transparent border-r-8 border-r-transparent -top-2 left-1/2 -translate-x-1/2`
    default:
      return baseClasses
  }
}

export function getConfidenceBadgeClasses(confidence: string): string {
  const baseClasses = "px-3 py-1 rounded-full text-sm font-medium"

  switch (confidence) {
    case "high":
      return `${baseClasses} bg-green-100 text-green-700 border border-green-200`
    case "medium":
      return `${baseClasses} bg-yellow-100 text-yellow-700 border border-yellow-200`
    case "low":
      return `${baseClasses} bg-red-100 text-red-700 border border-red-200`
    default:
      return `${baseClasses} bg-gray-100 text-gray-700 border border-gray-200`
  }
}

export function getRiskFactorIcon(riskFactor: string): string {
  const lowerRisk = riskFactor.toLowerCase()

  if (lowerRisk.includes("form")) return "📝"
  if (lowerRisk.includes("generic")) return "⚠️"
  if (lowerRisk.includes("short")) return "📏"
  if (lowerRisk.includes("value")) return "💰"
  if (lowerRisk.includes("position")) return "📍"
  if (lowerRisk.includes("color")) return "🎨"

  return "⚡"
}

export function formatDisplayValue(value: number, type: "clicks" | "ctr" | "currency" | "percentage"): string {
  switch (type) {
    case "clicks":
      return value >= 1 ? Math.round(value).toLocaleString() : value.toFixed(1)
    case "ctr":
      return `${value.toFixed(1)}%`
    case "currency":
      return `$${value.toFixed(2)}`
    case "percentage":
      return `${value.toFixed(1)}%`
    default:
      return value.toString()
  }
}

export function calculatePulseAnimationDelay(elementPosition: { x: number; y: number }): number {
  // Add slight delay based on position to create staggered effect
  return (elementPosition.x + elementPosition.y) % 1000
}

export function shouldShowTooltip(
  elementCoords: Coordinates,
  containerSize: { width: number; height: number },
): boolean {
  // Don't show tooltip if element is too close to edges
  const minDistance = 50

  return (
    elementCoords.x > minDistance &&
    elementCoords.y > minDistance &&
    elementCoords.x + elementCoords.width < containerSize.width - minDistance &&
    elementCoords.y + elementCoords.height < containerSize.height - minDistance
  )
}
