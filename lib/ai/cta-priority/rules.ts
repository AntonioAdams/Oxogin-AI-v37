// Primary CTA Detection Model v1.0 - Scoring Rules

import type { ElementCoordinates, CTACandidate, ScoringContext } from "../../contracts/cta"
import {
  LOCATION_WEIGHTS,
  TEXT_INTENT_SCORES,
  VISUAL_PROMINENCE_SCORES,
  SINGULARITY_SCORES,
  CONTEXT_ALIGNMENT_SCORES,
  FOLD_LINE_ESTIMATE,
  FOOTER_THRESHOLD,
  LONG_PAGE_THRESHOLD,
  PAGE_SECTIONS,
  STRONG_ACTION_VERBS,
  MEDIUM_ACTION_VERBS,
  PASSIVE_PHRASES,
  NAVIGATION_TERMS,
} from "./constants"

export function scoreLocation(coordinates: ElementCoordinates, pageHeight: number): number {
  const { y } = coordinates

  if (y <= FOLD_LINE_ESTIMATE) {
    return LOCATION_WEIGHTS["above-fold"]
  } else if (y <= FOOTER_THRESHOLD) {
    return LOCATION_WEIGHTS["mid-page"]
  } else {
    return LOCATION_WEIGHTS["below-fold"]
  }
}

export function scoreTextIntent(text: string): number {
  const lowerText = text.toLowerCase().trim()

  // Check for navigation terms first - these should be deprioritized
  const isNavigationTerm = NAVIGATION_TERMS.some((term) => lowerText === term || lowerText.includes(term))
  if (isNavigationTerm) {
    return TEXT_INTENT_SCORES.passive - 1 // Penalize navigation terms even more than passive
  }

  // Check for strong action verbs
  const hasStrongAction = STRONG_ACTION_VERBS.some((verb) => lowerText.includes(verb) || lowerText.startsWith(verb))
  if (hasStrongAction) {
    return TEXT_INTENT_SCORES.strong
  }

  // Check for medium action verbs
  const hasMediumAction = MEDIUM_ACTION_VERBS.some((verb) => lowerText.includes(verb) || lowerText.startsWith(verb))
  if (hasMediumAction) {
    return TEXT_INTENT_SCORES.medium
  }

  // Check for passive phrases
  const hasPassivePhrase = PASSIVE_PHRASES.some((phrase) => lowerText.includes(phrase))
  if (hasPassivePhrase) {
    return TEXT_INTENT_SCORES.passive
  }

  // Default to low if it has some action-oriented words
  if (lowerText.length > 0 && !lowerText.includes("click here")) {
    return TEXT_INTENT_SCORES.low
  }

  return TEXT_INTENT_SCORES.passive
}

export function scoreVisualProminence(candidate: CTACandidate, allCandidates: CTACandidate[]): number {
  const { coordinates, className, hasButtonStyling, type } = candidate
  const { width, height } = coordinates

  // Calculate relative size
  const area = width * height
  const avgArea =
    allCandidates.reduce((sum, c) => sum + c.coordinates.width * c.coordinates.height, 0) / allCandidates.length
  const sizeRatio = area / avgArea

  // Check for button styling indicators
  const hasButtonClass =
    className.toLowerCase().includes("btn") ||
    className.toLowerCase().includes("button") ||
    hasButtonStyling ||
    type === "button"

  // Check for prominent styling classes
  const hasProminentClass =
    className.toLowerCase().includes("primary") ||
    className.toLowerCase().includes("cta") ||
    className.toLowerCase().includes("action")

  if (sizeRatio > 1.5 && hasButtonClass && hasProminentClass) {
    return VISUAL_PROMINENCE_SCORES.high
  } else if (sizeRatio > 1.2 && hasButtonClass) {
    return VISUAL_PROMINENCE_SCORES.medium
  } else if (hasButtonClass || sizeRatio > 1.0) {
    return VISUAL_PROMINENCE_SCORES.low
  } else {
    return VISUAL_PROMINENCE_SCORES.hidden
  }
}

export function scoreSingularity(candidate: CTACandidate, sectionCandidates: CTACandidate[]): number {
  const sectionCount = sectionCandidates.length

  if (sectionCount === 1) {
    return SINGULARITY_SCORES.unique
  } else if (sectionCount <= 3) {
    // Check if this candidate stands out among the few
    const thisScore = scoreTextIntent(candidate.text)
    const avgScore = sectionCandidates.reduce((sum, c) => sum + scoreTextIntent(c.text), 0) / sectionCount

    if (thisScore > avgScore) {
      return SINGULARITY_SCORES.primary
    } else {
      return SINGULARITY_SCORES.competing
    }
  } else {
    return SINGULARITY_SCORES.competing
  }
}

export function scoreContextAlignment(candidate: CTACandidate, context: ScoringContext): number {
  const { text } = candidate
  const lowerText = text.toLowerCase()

  // Perfect alignment indicators
  const perfectIndicators = [
    "get started",
    "start free",
    "try free",
    "sign up free",
    "book demo",
    "request demo",
    "start trial",
  ]

  const hasPerfectAlignment = perfectIndicators.some((indicator) => lowerText.includes(indicator))

  if (hasPerfectAlignment && context.hasValueProposition) {
    return CONTEXT_ALIGNMENT_SCORES.perfect
  }

  // Partial alignment - action-oriented with some context
  if (scoreTextIntent(text) >= TEXT_INTENT_SCORES.medium) {
    return CONTEXT_ALIGNMENT_SCORES.partial
  }

  return CONTEXT_ALIGNMENT_SCORES.none
}

export function determinePageSection(coordinates: ElementCoordinates, pageHeight: number): keyof typeof PAGE_SECTIONS {
  const { y } = coordinates

  for (const [sectionName, section] of Object.entries(PAGE_SECTIONS)) {
    if (y >= section.minY && y < section.maxY) {
      return sectionName as keyof typeof PAGE_SECTIONS
    }
  }

  return "below-fold"
}

export function calculateAdjustmentLayers(
  candidate: CTACandidate,
  context: ScoringContext,
  imageSize: { width: number; height: number },
): number {
  let adjustments = 0
  const { coordinates } = candidate

  // 3.1 Motivation / Intent Adjuster
  if (context.hasValueProposition && context.hasUrgencyText) {
    adjustments += 1
  }

  // 3.2 Eye-Tracking Side-Bias Modifier
  const leftHalf = coordinates.x < imageSize.width / 2
  const upperHalf = coordinates.y < imageSize.height / 2
  const rightSide = coordinates.x > imageSize.width * 0.7

  if (leftHalf && upperHalf) {
    adjustments += 1 // Left upper zone
  }

  if (rightSide && (upperHalf || coordinates.y > imageSize.height * 0.8)) {
    adjustments += 1 // Z-pattern endpoint
  }

  // 3.3 Call-to-Value Context
  const hasValueText =
    candidate.text.toLowerCase().includes("save") ||
    candidate.text.toLowerCase().includes("free") ||
    candidate.text.toLowerCase().includes("trial") ||
    candidate.text.toLowerCase().includes("%")

  if (hasValueText) {
    adjustments += 1
  }

  // 3.4 Page Complexity & Length Modifier
  if (context.pageHeight > LONG_PAGE_THRESHOLD && coordinates.y > FOLD_LINE_ESTIMATE) {
    adjustments += 1 // Reduce below-fold penalty for long pages
  }

  return Math.min(adjustments, 5) // Cap at +5
}
