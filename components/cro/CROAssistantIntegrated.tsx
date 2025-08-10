"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Brain } from "lucide-react"
import { CROExecutiveBrief } from "./CROExecutiveBrief"
import type { CaptureResult, ClickPredictionResult } from "@/app/page/types"
import { debugLogCategory } from "@/lib/utils/logger"

interface CROAssistantIntegratedProps {
  captureResult: CaptureResult
  clickPredictions: ClickPredictionResult[]
  primaryCTAId?: string
  isAnalyzing: boolean
  onAnalyze: () => void
  primaryCTAPrediction?: ClickPredictionResult | null
  matchedElement?: any
  imageSize?: { width: number; height: number }
  allDOMElements?: any
  preLoadedAnalysis?: boolean
  targetCTR?: number // NEW: Accept target CTR from parent
  openAIResult?: any // Add OpenAI result prop
  croAnalysisResult?: any // Add CRO analysis result prop
}

export function CROAssistantIntegrated({
  captureResult,
  clickPredictions,
  primaryCTAId,
  isAnalyzing,
  onAnalyze,
  primaryCTAPrediction,
  matchedElement,
  imageSize,
  allDOMElements,
  preLoadedAnalysis = false,
      targetCTR, // NEW: Pass target CTR to Click Prediction Report
  openAIResult, // Add OpenAI result
  croAnalysisResult, // Add CRO analysis result
}: CROAssistantIntegratedProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // FIXED: Derive device type from data instead of prop
  const deviceType = useMemo(() => {
    // Method 1: Check isMobile flag (most reliable)
    if (captureResult?.isMobile !== undefined) {
      return captureResult.isMobile ? "mobile" : "desktop"
    }

    // Method 2: Image dimensions (mobile screenshots are typically 375px wide)
    if (imageSize?.width) {
      return imageSize.width <= 400 ? "mobile" : "desktop"
    }

    // Method 3: DOM fold line (mobile typically has lower fold line)
    if (captureResult?.domData?.foldLine?.position) {
      return captureResult.domData.foldLine.position <= 700 ? "mobile" : "desktop"
    }

    // Default fallback
    return "desktop"
  }, [captureResult, imageSize])

  // Calculate dynamic baseline from primary CTA prediction
  const dynamicBaseline = useMemo(() => {
    if (primaryCTAPrediction?.ctr) {
      return primaryCTAPrediction.ctr
    }
    return 0.065 // Default fallback
  }, [primaryCTAPrediction])

  // Determine if CTA is form-related
  const isFormRelated = useMemo(() => {
    return matchedElement?.isFormRelated || false
  }, [matchedElement])

  // Auto-expand when analysis is pre-loaded
  useEffect(() => {
    if (preLoadedAnalysis && primaryCTAPrediction && matchedElement) {
      debugLogCategory("CRO Assistant", "Auto-expanding due to pre-loaded analysis")
      setIsExpanded(true)
    }
  }, [preLoadedAnalysis, primaryCTAPrediction, matchedElement])

  if (!captureResult || !primaryCTAPrediction || !matchedElement) {
    return null
  }

  return (
    <Card className="bg-white border border-gray-200">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    🧠 AI Analysis
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                      {deviceType === "mobile" ? "Mobile" : "Desktop"}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Comprehensive CRO analysis with actionable recommendations
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {preLoadedAnalysis && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                    Analysis Ready
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <CROExecutiveBrief
              captureResult={captureResult}
              clickPredictions={clickPredictions}
              primaryCTAId={primaryCTAId}
              matchedElement={matchedElement}
              dynamicBaseline={dynamicBaseline}
              isFormRelated={isFormRelated}
              isAnalyzing={isAnalyzing}
              onAnalyze={onAnalyze}
              targetCTR={targetCTR} // NEW: Pass target CTR to Click Prediction Report
              imageSize={imageSize} // Pass imageSize for device type derivation
              openAIResult={openAIResult} // Pass OpenAI result
              croAnalysisResult={croAnalysisResult} // Pass CRO analysis result
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
