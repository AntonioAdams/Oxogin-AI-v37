// CTA analysis-specific type definitions
import type { ElementCoordinates, DOMData } from "./capture"

export interface CTAInsight {
  text: string
  confidence: number
  hasForm: boolean
  reasoning: string
  elementType: "button" | "link" | "form"
  alternativeTexts: string[]
}

export interface MatchedElement {
  coordinates: ElementCoordinates
  text: string
  type: string
  confidence: number
  priority: "hero" | "header" | "below-fold"
  priorityScore: number
}

export interface DebugMatch {
  text: string
  similarity: number
  coordinates: ElementCoordinates
  type: string
  priority: "hero" | "header" | "below-fold"
  priorityScore: number
}

export interface AIAnalysisOptions {
  image: File | Blob
  domData: DOMData
  model?: string
}

export interface AIAnalysisResult {
  insight: CTAInsight
  processingTime: number
  model: string
}

export interface MatchingOptions {
  imageSize: { width: number; height: number }
  similarityThreshold?: number
  priorityWeights?: {
    location: number
    textIntent: number
    visualProminence: number
    singularity: number
    contextAlignment: number
  }
}

export interface MatchingResult {
  match: MatchedElement | null
  debug: DebugMatch[]
  candidates: MatchedElement[]
  processingTime: number
}

export interface CTACandidate {
  text: string
  coordinates: ElementCoordinates
  type: "button" | "link" | "form"
  className: string
  isVisible: boolean
  isAboveFold: boolean
  hasButtonStyling?: boolean
  formAction?: string | null
  pageHeight?: number
}

export interface ScoredCTACandidate extends CTACandidate {
  baseScore: number
  adjustedScore: number
  section: string
  breakdown: {
    location: number
    textIntent: number
    visualProminence: number
    singularity: number
    contextAlignment: number
    adjustments: number
  }
}

export interface ScoringContext {
  pageHeight: number
  totalCandidates: number
  sectionCandidates: number
  hasValueProposition: boolean
  hasUrgencyText: boolean
}
