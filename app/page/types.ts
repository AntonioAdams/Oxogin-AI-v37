import type { DOMData, CaptureResult as BaseCaptureResult } from "@/lib/contracts/capture"

// Extend the base CaptureResult to include mobile flag
export interface CaptureResult extends BaseCaptureResult {
  isMobile?: boolean
}

export interface CTAInsight {
  text: string
  confidence: number
  hasForm: boolean
  reasoning: string
  elementType: "button" | "link" | "form"
  alternativeTexts: string[]
}

export interface MatchedElement {
  text: string
  coordinates: { x: number; y: number; width: number; height: number }
  confidence: number
  priority: "primary" | "secondary" | "tertiary"
  elementType: string
}

export interface DebugMatch {
  text: string
  coordinates: { x: number; y: number; width: number; height: number }
  confidence: number
  reasoning: string
  elementType: string
}

export interface ClickPredictionResult {
  elementId: string
  elementType: string
  text: string
  coordinates: { x: number; y: number; width: number; height: number }
  ctr: number
  clickShare: number
  estimatedClicks: number
  wastedClicks: number
  wastedSpend: number
  confidence: "high" | "medium" | "low"
  riskFactors: string[]
  formCompletionRate?: number
  // ENHANCED: Add human-readable text and element information to match core types
  tagName?: string // HTML tag name
  wasteBreakdown?: {
    elementCategory: string
    phase1ElementClassification: number
    phase2AttentionRatio: number
    phase3VisualEmphasis: number
    phase4ContentClutter: number
    legacyQualityFactors: number
    cappedWasteRate: number
    attentionRatio?: number
    visualFactors: string[]
    clutterFactors: string[]
    legacyFactors: string[]
  }
}

// Re-export DOMData for convenience
export type { DOMData }
