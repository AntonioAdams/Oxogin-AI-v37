import type { CaptureResult, CTAInsight, MatchedElement, ClickPredictionResult } from "../types"
import type { ScaledFormData } from "@/lib/form/schema"

export interface CaptureDisplayProps {
  captureResult: CaptureResult | null
  matchedElement: MatchedElement | null
  imageSize: { width: number; height: number }
  formBoundaryBoxes: ScaledFormData[]
  showTooltip: boolean
  primaryCTAPrediction: ClickPredictionResult | null
  analysisResult: CTAInsight | null
  isAnalyzing: boolean
  onImageLoad: (imageElement: HTMLImageElement) => void
  onAnalyzeCTA: () => void
  onReset: () => void
  clickPredictions?: ClickPredictionResult[]
  allDOMElements?: any
  openAIResult?: any // Add OpenAI result prop
  croAnalysisResult?: any // Add CRO analysis result prop
  funnelType?: 'form' | 'non-form' | 'none' // Add funnel type
  funnelStep?: 1 | 2 // Add funnel step (1 = current page, 2 = step 2 page)
}
