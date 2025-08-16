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

  // Auto-expand when analysis is pre-loaded or CRO data is available
  useEffect(() => {

    
    if (preLoadedAnalysis && primaryCTAPrediction && matchedElement) {
      console.log("✅ Auto-expanding due to pre-loaded analysis with full CTA data")
      debugLogCategory("CRO Assistant", "Auto-expanding due to pre-loaded analysis with full CTA data")
      setIsExpanded(true)
    } else if (preLoadedAnalysis && croAnalysisResult?.recommendations) {
      console.log("✅ Auto-expanding due to available CRO analysis data")
      debugLogCategory("CRO Assistant", "Auto-expanding due to available CRO analysis data")
      setIsExpanded(true)
    } else {
      console.log("❌ Auto-expansion conditions not met")
    }
  }, [preLoadedAnalysis, primaryCTAPrediction, matchedElement, croAnalysisResult, isExpanded])

  // Enhanced check: Allow rendering if we have CRO analysis data even without complete CTA data
  if (!captureResult || (!primaryCTAPrediction && !croAnalysisResult) || (!matchedElement && !croAnalysisResult)) {
    console.log("🚫 CROAssistantIntegrated not rendering due to missing data:", {
      hasCaptureResult: !!captureResult,
      hasPrimaryCTAPrediction: !!primaryCTAPrediction,
      hasMatchedElement: !!matchedElement,
      hasCroAnalysisResult: !!croAnalysisResult,
      captureResultUrl: captureResult?.domData?.url,
      primaryCTAId: primaryCTAPrediction?.elementId,
      matchedElementText: matchedElement?.text
    })
    return null
  }

  console.log("✅ CROAssistantIntegrated rendering with all required data:", {
    deviceType,
    hasCroAnalysisResult: !!croAnalysisResult,
    preLoadedAnalysis,
    primaryCTAText: primaryCTAPrediction?.text
  })

  return (
    <Card className="bg-white border border-gray-200">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors p-3 sm:p-6 touch-manipulation">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm sm:text-lg flex items-center gap-1 sm:gap-2 flex-wrap">
                    <span className="hidden sm:inline">🧠 AI Analysis</span>
                    <span className="sm:hidden">🧠 AI</span>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 text-xs px-1 sm:px-2">
                      {deviceType === "mobile" ? "Mobile" : "Desktop"}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 hidden sm:block">
                    Comprehensive CRO analysis with actionable recommendations
                  </p>
                  <p className="text-xs text-gray-600 mt-1 sm:hidden">
                    CRO recommendations
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {preLoadedAnalysis && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs px-1 sm:px-2 hidden xs:flex">
                    <span className="hidden sm:inline">Analysis Ready</span>
                    <span className="sm:hidden">Ready</span>
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
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
