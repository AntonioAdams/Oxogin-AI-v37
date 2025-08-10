// Primary CTA Detection Model v1.0 - Main Scoring Function

import type { CTACandidate, ScoringContext } from "../../contracts/cta"
import {
  scoreLocation,
  scoreTextIntent,
  scoreVisualProminence,
  scoreSingularity,
  scoreContextAlignment,
  calculateAdjustmentLayers,
  determinePageSection,
} from "./rules"
import { MIN_SCORE_THRESHOLD } from "./constants"

// Remove the duplicate ScoredCTACandidate interface since it's now in contracts

export interface ScoredCTACandidate extends CTACandidate {
  baseScore: number
  adjustedScore: number
  section: keyof typeof PAGE_SECTIONS
  breakdown: {
    location: number
    textIntent: number
    visualProminence: number
    singularity: number
    contextAlignment: number
    adjustments: number
  }
}

// Update the PAGE_SECTIONS type reference
const PAGE_SECTIONS = {
  hero: { minY: 0, maxY: 800, priority: 10 },
  header: { minY: 0, maxY: 150, priority: 8 },
  features: { minY: 800, maxY: 1500, priority: 6 },
  testimonials: { minY: 1500, maxY: 2000, priority: 4 },
  footer: { minY: 2000, maxY: Number.POSITIVE_INFINITY, priority: 2 },
  "below-fold": { minY: 800, maxY: Number.POSITIVE_INFINITY, priority: 3 },
} as const

export function scoreCTA(
  candidate: CTACandidate,
  allCandidates: CTACandidate[],
  sectionCandidates: CTACandidate[],
  context: ScoringContext,
  imageSize: { width: number; height: number },
): ScoredCTACandidate {
  // Base scoring components (max 12 points)
  const locationScore = scoreLocation(candidate.coordinates, context.pageHeight)
  const textIntentScore = scoreTextIntent(candidate.text)
  const visualProminenceScore = scoreVisualProminence(candidate, allCandidates)
  const singularityScore = scoreSingularity(candidate, sectionCandidates)
  const contextAlignmentScore = scoreContextAlignment(candidate, context)

  const baseScore = locationScore + textIntentScore + visualProminenceScore + singularityScore + contextAlignmentScore

  // Adjustment layers (max +5)
  const adjustments = calculateAdjustmentLayers(candidate, context, imageSize)

  const adjustedScore = baseScore + adjustments
  const section = determinePageSection(candidate.coordinates, context.pageHeight)

  return {
    ...candidate,
    baseScore,
    adjustedScore,
    section,
    breakdown: {
      location: locationScore,
      textIntent: textIntentScore,
      visualProminence: visualProminenceScore,
      singularity: singularityScore,
      contextAlignment: contextAlignmentScore,
      adjustments,
    },
  }
}

export function findPrimaryCTA(
  candidates: CTACandidate[],
  context: ScoringContext,
  imageSize: { width: number; height: number },
): ScoredCTACandidate | null {
  if (candidates.length === 0) return null

  // Group candidates by section
  const candidatesBySection = new Map<keyof typeof PAGE_SECTIONS, CTACandidate[]>()

  candidates.forEach((candidate) => {
    const section = determinePageSection(candidate.coordinates, context.pageHeight)
    if (!candidatesBySection.has(section)) {
      candidatesBySection.set(section, [])
    }
    candidatesBySection.get(section)!.push(candidate)
  })

  // Score all candidates
  const scoredCandidates: ScoredCTACandidate[] = []

  candidatesBySection.forEach((sectionCandidates, section) => {
    sectionCandidates.forEach((candidate) => {
      const scored = scoreCTA(candidate, candidates, sectionCandidates, context, imageSize)
      scoredCandidates.push(scored)
    })
  })

  // Find top candidate from each section
  const sectionTops = new Map<keyof typeof PAGE_SECTIONS, ScoredCTACandidate>()

  candidatesBySection.forEach((_, section) => {
    const sectionScored = scoredCandidates.filter((c) => c.section === section)
    if (sectionScored.length > 0) {
      const topInSection = sectionScored.reduce((best, current) =>
        current.adjustedScore > best.adjustedScore ? current : best,
      )
      sectionTops.set(section, topInSection)
    }
  })

  // Find global winner
  const topCandidates = Array.from(sectionTops.values())
  if (topCandidates.length === 0) return null

  const primaryCTA = topCandidates.reduce((best, current) =>
    current.adjustedScore > best.adjustedScore ? current : best,
  )

  // Apply threshold check
  if (primaryCTA.adjustedScore < MIN_SCORE_THRESHOLD) {
    return null // No clear primary CTA detected
  }

  return primaryCTA
}

export function analyzeCTADistribution(scoredCandidates: ScoredCTACandidate[]): {
  sectionDistribution: Record<string, number>
  scoreDistribution: { min: number; max: number; avg: number }
  topCandidatesBySection: Record<string, ScoredCTACandidate>
} {
  const sectionDistribution: Record<string, number> = {}
  const topCandidatesBySection: Record<string, ScoredCTACandidate> = {}

  scoredCandidates.forEach((candidate) => {
    const section = candidate.section
    sectionDistribution[section] = (sectionDistribution[section] || 0) + 1

    if (!topCandidatesBySection[section] || candidate.adjustedScore > topCandidatesBySection[section].adjustedScore) {
      topCandidatesBySection[section] = candidate
    }
  })

  const scores = scoredCandidates.map((c) => c.adjustedScore)
  const scoreDistribution = {
    min: Math.min(...scores),
    max: Math.max(...scores),
    avg: scores.reduce((sum, score) => sum + score, 0) / scores.length,
  }

  return {
    sectionDistribution,
    scoreDistribution,
    topCandidatesBySection,
  }
}
