// Funnel Analysis Types

import type { CaptureResult } from "@/app/page/types"
import type { PostClickPrediction } from "./post-click-model"

export type FunnelType = 'form' | 'non-form' | 'none'

export interface FunnelStep {
  url: string
  captureResult: CaptureResult
  ctaText: string
  ctaType: 'form' | 'button' | 'link'
  predictedCTR: number
  predictedClicks: number
  postClickPrediction?: PostClickPrediction // Enhanced post-click analysis
}

export interface FunnelData {
  url: string
  type: FunnelType
  step1: FunnelStep | null
  step2: FunnelStep | null
  
  // Calculated metrics
  n1: number // Initial visitors
  p1: number // Step 1 CTR
  n2: number // Step 1 clicks
  p2: number // Step 2 conversion rate
  pTotal: number // Combined conversion rate
  nConv: number // Final conversions
  
  // Status
  isLoading: boolean
  isStep2Loading: boolean
  error: string | null
}

export interface FunnelAnalysisState {
  yourSite: FunnelData
  competitor: FunnelData
}

export interface FunnelMetrics {
  sessionCount: number
  step1CTR: number
  step1Clicks: number
  step2ConversionRate: number
  finalConversions: number
  overallConversionRate: number
}

export interface CtaAnalysisResult {
  text: string
  confidence: number
  hasForm: boolean
  isFormAssociated?: boolean
  reasoning: string
  elementType: 'button' | 'link' | 'form'
  alternativeTexts: string[]
  href?: string
}

export interface FunnelViewProps {
  data: FunnelData
  title: string
  onExplore: () => void
  onRunFunnelAnalysis?: () => void
  showFunnelButton?: boolean
}
