// Primary CTA Detection Model v1.0 - Public API

export * from "./constants"
export * from "./rules"
export * from "./score-cta"

// Re-export main functions for convenience
export {
  scoreCTA,
  findPrimaryCTA,
  analyzeCTADistribution,
  type ScoredCTACandidate,
  type CTACandidate,
  type ScoringContext,
} from "./score-cta"

export {
  scoreLocation,
  scoreTextIntent,
  scoreVisualProminence,
  scoreSingularity,
  scoreContextAlignment,
  calculateAdjustmentLayers,
  determinePageSection,
} from "./rules"

// Convenience function for quick CTA analysis
import { findPrimaryCTA, type CTACandidate, type ScoringContext } from "./score-cta"

export function quickCTAAnalysis(
  candidates: CTACandidate[],
  pageHeight: number,
  imageSize: { width: number; height: number },
  options: {
    hasValueProposition?: boolean
    hasUrgencyText?: boolean
  } = {},
) {
  const context: ScoringContext = {
    pageHeight,
    totalCandidates: candidates.length,
    sectionCandidates: candidates.length, // Will be calculated per section
    hasValueProposition: options.hasValueProposition || false,
    hasUrgencyText: options.hasUrgencyText || false,
  }

  return findPrimaryCTA(candidates, context, imageSize)
}
