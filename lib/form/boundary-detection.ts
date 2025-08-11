/**
 * Form boundary detection - shared logic between main analysis and funnel
 * This ensures consistent isFormRelated determination across the app
 */

import { debugLogCategory } from "@/lib/utils/logger"

export interface ScaledFormData {
  displayCoords: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface CTACoordinates {
  x: number
  y: number
  width?: number
  height?: number
}

/**
 * Determine if CTA coordinates overlap with form boundary boxes
 * This is the exact same logic used in the main analysis tooltips
 */
export function isCtaWithinFormBoundary(
  ctaCoords: CTACoordinates,
  formBoundaryBoxes: ScaledFormData[],
  imageSize: { width: number; height: number },
  displaySize: { width: number; height: number },
): boolean {
  if (!formBoundaryBoxes || formBoundaryBoxes.length === 0) {
    debugLogCategory("Form Detection", "No form boundaries available")
    return false
  }

  if (!ctaCoords || imageSize.width === 0 || imageSize.height === 0) {
    debugLogCategory("Form Detection", "Invalid CTA coordinates or image size")
    return false
  }

  // Calculate scaling factors from original image to display size
  const scaleX = displaySize.width / imageSize.width
  const scaleY = displaySize.height / imageSize.height

  // Scale CTA coordinates to match display coordinates (same as form boundaries)
  const scaledCtaCoords = {
    x: Math.round(ctaCoords.x * scaleX),
    y: Math.round(ctaCoords.y * scaleY),
    width: Math.round((ctaCoords.width || 100) * scaleX), // Default width if not provided
    height: Math.round((ctaCoords.height || 30) * scaleY), // Default height if not provided
  }

  debugLogCategory("Form Detection", "Scaled CTA coordinates:", scaledCtaCoords)
  debugLogCategory("Form Detection", "Checking against", formBoundaryBoxes.length, "form boundaries")

  // Check overlap with each form boundary
  for (let i = 0; i < formBoundaryBoxes.length; i++) {
    const form = formBoundaryBoxes[i]
    const formCoords = form.displayCoords // Use display coordinates

    debugLogCategory("Form Detection", `Checking form ${i + 1}:`, formCoords)

    // Calculate overlap using rectangle intersection
    const xOverlap = Math.max(
      0,
      Math.min(scaledCtaCoords.x + scaledCtaCoords.width, formCoords.x + formCoords.width) -
        Math.max(scaledCtaCoords.x, formCoords.x),
    )

    const yOverlap = Math.max(
      0,
      Math.min(scaledCtaCoords.y + scaledCtaCoords.height, formCoords.y + formCoords.height) -
        Math.max(scaledCtaCoords.y, formCoords.y),
    )

    debugLogCategory("Form Detection", `Form ${i + 1} overlap - X: ${xOverlap}, Y: ${yOverlap}`)

    // ENHANCED: Check for direct overlap first
    if (xOverlap > 0 && yOverlap > 0) {
      const overlapArea = xOverlap * yOverlap
      const ctaArea = scaledCtaCoords.width * scaledCtaCoords.height
      const overlapPercentage = (overlapArea / ctaArea) * 100

      debugLogCategory("Form Detection", `✅ DIRECT OVERLAP DETECTED with form ${i + 1}!`)
      debugLogCategory("Form Detection", `Overlap area: ${overlapArea}px², CTA area: ${ctaArea}px²`)
      debugLogCategory("Form Detection", `Overlap percentage: ${overlapPercentage.toFixed(1)}%`)

      return true
    }

    // PROXIMITY: Check if CTA is near form (design spacing consideration)
    const ctaCenterX = scaledCtaCoords.x + (scaledCtaCoords.width / 2)
    const ctaCenterY = scaledCtaCoords.y + (scaledCtaCoords.height / 2)
    const formCenterX = formCoords.x + (formCoords.width / 2)
    const formCenterY = formCoords.y + (formCoords.height / 2)
    
    // Calculate distance between centers
    const distance = Math.sqrt(
      Math.pow(ctaCenterX - formCenterX, 2) + Math.pow(ctaCenterY - formCenterY, 2)
    )
    
    // Proximity threshold: within reasonable distance considering form and CTA sizes
    const maxFormDimension = Math.max(formCoords.width, formCoords.height)
    const maxCtaDimension = Math.max(scaledCtaCoords.width, scaledCtaCoords.height)
    const proximityThreshold = (maxFormDimension + maxCtaDimension) / 2 + 50 // 50px buffer for design spacing
    
    if (distance <= proximityThreshold) {
      debugLogCategory("Form Detection", `✅ PROXIMITY DETECTED with form ${i + 1}!`)
      debugLogCategory("Form Detection", `Distance: ${distance.toFixed(1)}px, Threshold: ${proximityThreshold.toFixed(1)}px`)
      debugLogCategory("Form Detection", `CTA center: (${ctaCenterX}, ${ctaCenterY}), Form center: (${formCenterX}, ${formCenterY})`)
      
      return true
    }
  }

  debugLogCategory("Form Detection", "❌ No overlap detected with any form")
  return false
}

/**
 * Determine if a CTA is form-related using the same logic as main analysis
 * This ensures funnel classification matches tooltip labels (Conversion Rate vs CTR)
 */
export function determineIsFormRelated(
  ctaCoords: CTACoordinates | null,
  formBoundaryBoxes: ScaledFormData[],
  imageSize: { width: number; height: number },
  displaySize: { width: number; height: number } = { width: 800, height: 600 }
): boolean {
  if (!ctaCoords || !formBoundaryBoxes || formBoundaryBoxes.length === 0) {
    return false
  }

  return isCtaWithinFormBoundary(ctaCoords, formBoundaryBoxes, imageSize, displaySize)
}
