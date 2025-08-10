"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Target,
  DollarSign,
  Loader2,
  Brain,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
} from "lucide-react"
import type { CaptureResult, ClickPredictionResult } from "@/app/page/types"
import { debugLogCategory } from "@/lib/utils/logger"
import { compressScreenshotClient } from "@/lib/utils/client-compression"

interface CROExecutiveBriefProps {
  captureResult: CaptureResult
  clickPredictions: ClickPredictionResult[]
  primaryCTAId?: string
  analysisResult?: any
  matchedElement?: any
  croAnalysisResult?: any
  dynamicBaseline: number
  isFormRelated: boolean
  isAnalyzing: boolean
  onAnalyze: () => void
  targetCTR?: number
  imageSize?: { width: number; height: number }
  openAIResult?: any // Add OpenAI result prop
  actualCROData?: {
    currentCTR: number
    projectedCTR: number
    improvementPotential: number
    costSavings: number
    implementationDifficulty: string
    priorityScore: number
  }
}

interface OpenAIAnalysis {
  companyName: string
  url: string
  deviceType: string
  dateAnalyzed: string
  currentPerformance: {
    primaryCTA: string
    currentConversionRate: number
    projectedConversionRate: number
    monthlyWastedSpend: number
    deviceSpecificMetrics?: any
  }
  frictionPoints: Array<{
    element: string
    type: string
    problem: string
    impact: string
  }>
  recommendedActions: {
    phase1: {
      title: string
      description: string
      elementsToFixOrRemove: string[]  // Updated field name
      teamOwner: string[]              // New field
      timeToValue: string              // New field
      estimatedTime: string            // New field
      expectedGain: string
      // Keep backward compatibility
      elementsToRemove?: string[]
    }
    phase2: {
      title: string
      description: string
      elementsToFixOrImprove: string[] // Updated field name
      teamOwner: string[]              // New field
      timeToValue: string              // New field
      estimatedTime: string            // New field
      expectedGain: string
      // Keep backward compatibility
      elementsToRemove?: string[]
    }
    phase3: {
      title: string
      description: string
      changes: string[]                // Keep existing field
      teamOwner: string[]              // New field
      timeToValue: string              // New field
      estimatedTime: string            // New field
      expectedGain: string
    }
  }
  deviceSpecificInsights?: any
  projectedResults: {
    currentCTR: number
    optimizedCTR: number
    totalUpliftRange: string
    deviceSpecificROI: string
  }
  nextSteps: string[]
  highlights: string[]                 // New field
  additionalNotes: string
}

// Cache for AI analysis results - persists across tab switches
const aiAnalysisCache = new Map<string, OpenAIAnalysis>()

export function CROExecutiveBrief({
  captureResult,
  clickPredictions,
  primaryCTAId,
  analysisResult,
  matchedElement,
  croAnalysisResult,
  dynamicBaseline,
  isFormRelated,
  isAnalyzing,
  onAnalyze,
  targetCTR,
  imageSize,
  openAIResult,
  actualCROData,
}: CROExecutiveBriefProps) {
  const [openAIAnalysis, setOpenAIAnalysis] = useState<OpenAIAnalysis | null>(openAIResult || null)
  const [isLoadingOpenAI, setIsLoadingOpenAI] = useState(false)
  const [openAIError, setOpenAIError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "projections">("overview")

  // Update openAIAnalysis when openAIResult changes
  useEffect(() => {
    if (openAIResult) {
      // The API now returns the analysis directly, not wrapped in executiveBrief
      setOpenAIAnalysis(openAIResult)
      debugLogCategory("CROExecutiveBrief", "Received OpenAI result:", openAIResult)
    }
  }, [openAIResult])

  // Derive device type from data
  const deviceType = useMemo(() => {
    if (captureResult?.isMobile !== undefined) {
      return captureResult.isMobile ? "mobile" : "desktop"
    }
    if (imageSize?.width) {
      return imageSize.width <= 400 ? "mobile" : "desktop"
    }
    if (captureResult?.domData?.foldLine?.position) {
      return captureResult.domData.foldLine.position <= 700 ? "mobile" : "desktop"
    }
    return "desktop"
  }, [captureResult, imageSize])

  // Pre-populate data immediately from existing calculations
  const prePopulatedData = useMemo(() => {
    const primaryCTAPrediction = primaryCTAId
      ? clickPredictions.find((pred) => pred.elementId === primaryCTAId)
      : clickPredictions[0]

    let currentCTR = dynamicBaseline
    let projectedCTR = dynamicBaseline * 1.475
    let improvementPotential = 47.5
    // FIXED: Use the exact same approach as tooltip - directly use wastedSpend from prediction
    let costSavings = primaryCTAPrediction?.wastedSpend || 0

    if (actualCROData) {
      currentCTR = actualCROData.currentCTR
      projectedCTR = actualCROData.projectedCTR
      improvementPotential = actualCROData.improvementPotential
      costSavings = actualCROData.costSavings
    } else if (primaryCTAPrediction) {
      currentCTR = primaryCTAPrediction.ctr || dynamicBaseline

      if (targetCTR) {
        projectedCTR = targetCTR
        improvementPotential = ((projectedCTR - currentCTR) / currentCTR) * 100
      } else {
        projectedCTR = currentCTR * 1.475
        improvementPotential = 47.5
      }

      // FIXED: Use wastedSpend directly from prediction (same as tooltip)
      costSavings = primaryCTAPrediction.wastedSpend || 0

      debugLogCategory("Click Prediction Report", "Using wastedSpend directly from prediction (same as tooltip):", {
        elementId: primaryCTAPrediction.elementId,
        currentCTR,
        projectedCTR,
        improvementPotential,
        wastedSpend: primaryCTAPrediction.wastedSpend,
        finalCostSavings: costSavings,
      })
    }

    const url = captureResult.domData?.url || "unknown"
    const companyName = url.includes("://") ? new URL(url).hostname.replace("www.", "") : url

    return {
      companyName,
      url,
      deviceType,
      primaryCTAText: primaryCTAPrediction?.text || matchedElement?.text || "Primary CTA",
      currentCTR: currentCTR * 100,
      projectedCTR: projectedCTR * 100,
      improvementPotential,
      costSavings,
      isFormRelated,
      primaryCTAPrediction,
    }
  }, [
    captureResult,
    clickPredictions,
    primaryCTAId,
    deviceType,
    dynamicBaseline,
    isFormRelated,
    matchedElement,
    actualCROData,
    targetCTR,
  ])

  // Create cache key for this analysis
  const cacheKey = useMemo(() => {
    return `${prePopulatedData.url}-${deviceType}-${primaryCTAId}-${prePopulatedData.primaryCTAText}`
  }, [prePopulatedData.url, deviceType, primaryCTAId, prePopulatedData.primaryCTAText])

  // Check cache on mount and when cache key changes
  useEffect(() => {
    const cachedAnalysis = aiAnalysisCache.get(cacheKey)
    if (cachedAnalysis) {
      debugLogCategory("CROExecutiveBrief", "Loading cached AI analysis for:", cacheKey)
      setOpenAIAnalysis(cachedAnalysis)
      setOpenAIError(null)
    }
  }, [cacheKey])

  // Note: Auto-trigger removed to prevent duplicate analysis calls
  // Analysis is now handled by the main flow in app/page.tsx

  const triggerOpenAIAnalysis = async () => {
    if (!captureResult?.domData || !prePopulatedData) {
      console.error("Missing required data for OpenAI analysis")
      return
    }

    setIsLoadingOpenAI(true)
    setOpenAIError(null)

    try {
      debugLogCategory("CROExecutiveBrief", "Starting OpenAI CRO analysis...")

      const cacheKey = `${deviceType}-${primaryCTAId}-${prePopulatedData.primaryCTAText}`

      // Compress screenshot before sending
      const compressedScreenshot = await compressScreenshotClient(captureResult.screenshot, deviceType || "desktop")

      const requestPayload = {
        primaryCTAId: primaryCTAId || "primary-cta",
        primaryCTAText: prePopulatedData.primaryCTAText,
        deviceType: deviceType || "desktop",
        currentCTR: prePopulatedData.currentCTR,
        projectedCTR: prePopulatedData.projectedCTR,
        improvementPotential: prePopulatedData.improvementPotential,
        costSavings: prePopulatedData.costSavings,
        screenshot: compressedScreenshot, // Use compressed screenshot
      }

      const response = await fetch("/api/analyze-cro-openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI analysis failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      debugLogCategory("CROExecutiveBrief", "AI analysis completed:", result)

      if (result.success && result.executiveBrief) {
        aiAnalysisCache.set(cacheKey, result.executiveBrief)
        debugLogCategory("CROExecutiveBrief", "Cached AI analysis for:", cacheKey)
        setOpenAIAnalysis(result.executiveBrief)
      } else {
        throw new Error(result.error || "AI analysis failed")
      }
    } catch (error) {
      console.error("🧠 AI analysis error:", error)
      setOpenAIError(error instanceof Error ? error.message : "Analysis failed")
    } finally {
      setIsLoadingOpenAI(false)
    }
  }

  // Calculate phase results using the target CTR as the final goal
  const calculatePhaseResults = () => {
    const currentCTR = prePopulatedData.currentCTR
    const finalTargetCTR = prePopulatedData.projectedCTR

    const phase1CTR = currentCTR * 1.035
    const phase2CTR = phase1CTR * 1.1
    const phase3CTR = finalTargetCTR

    return {
      current: currentCTR,
      phase1: phase1CTR,
      phase2: phase2CTR,
      phase3: phase3CTR,
      totalUplift: ((phase3CTR - currentCTR) / currentCTR) * 100,
    }
  }

  const phaseResults = calculatePhaseResults()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Click Prediction Report</h2>
              <p className="text-sm text-gray-600">
                {prePopulatedData.companyName} • {deviceType === "mobile" ? "Mobile" : "Desktop"} •{" "}
                {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLoadingOpenAI ? (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                AI Analyzing...
              </Badge>
            ) : openAIAnalysis ? (
              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                Analysis Complete
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                Ready for Analysis
              </Badge>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "overview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("projections")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "projections" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Projections
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Current Performance Snapshot</h3>
              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                Using Actual Data
              </Badge>
            </div>

            {/* Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Primary CTA */}
              <Card className="bg-white border border-gray-200">
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Primary CTA</div>
                  <div className="text-xl font-bold text-blue-600 truncate">"{prePopulatedData.primaryCTAText}"</div>
                </CardContent>
              </Card>

              {/* Current CTR/Conversion Rate */}
              <Card className="bg-white border border-gray-200">
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Current {isFormRelated ? "Conversion Rate" : "CTR"}
                  </div>
                  <div className="text-2xl font-bold text-green-600">{prePopulatedData.currentCTR.toFixed(1)}%</div>
                </CardContent>
              </Card>

              {/* Projected Conversion Rate/CTR */}
              <Card className="bg-white border border-gray-200">
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Projected {isFormRelated ? "Conversion Rate" : "CTR"}
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{prePopulatedData.projectedCTR.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "projections" && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Projected Results Summary</h3>
              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                Based on Actual Data
              </Badge>
            </div>

            {/* Phase Results */}
            <div className="space-y-4">
              {/* Current Performance */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    📊
                  </div>
                  <span className="font-medium text-gray-900">Current Performance</span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">{phaseResults.current.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">{isFormRelated ? "Conversion Rate" : "CTR"} Baseline</div>
                </div>
              </div>

              {/* Phase 1 */}
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <span className="font-medium text-gray-900">After Phase 1 (Easy Header Cleanup)</span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-blue-600">{phaseResults.phase1.toFixed(1)}%</div>
                  <div className="text-sm text-green-600 font-medium">+3-5% {isFormRelated ? "Conversion" : "CTR"}</div>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <span className="font-medium text-gray-900">After Phase 2 (Moderate Changes)</span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-600">{phaseResults.phase2.toFixed(1)}%</div>
                  <div className="text-sm text-green-600 font-medium">
                    +8-12% {isFormRelated ? "Conversion" : "CTR"}
                  </div>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <span className="font-medium text-gray-900">After Phase 3 (Advanced)</span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-purple-600">{phaseResults.phase3.toFixed(1)}%</div>
                  <div className="text-sm text-green-600 font-medium">
                    +{phaseResults.totalUplift.toFixed(0)}% Total Uplift
                  </div>
                </div>
              </div>

              {/* ROI Insight */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800">ROI Insight</span>
                </div>
                <p className="text-green-700">
                  Header navigation cleanup typically provides immediate 3-5%{" "}
                  {isFormRelated ? "conversion rate" : "CTR"} improvement with minimal effort
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* OpenAI Analysis Results */}
      {isLoadingOpenAI && (
        <Card className="bg-white border border-gray-200">
          <CardContent className="py-8">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">AI Analysis in Progress</h3>
              <p className="text-gray-700">
                Analyzing {deviceType} experience for conversion optimization recommendations...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {openAIError && (
        <Card className="bg-white border border-gray-200">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="font-medium text-red-900">Analysis Error</h3>
                <p className="text-sm text-red-700 mt-1">{openAIError}</p>
              </div>
            </div>
            <Button onClick={triggerOpenAIAnalysis} className="mt-4 bg-transparent" variant="outline">
              Retry Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recommended Actions */}
      {openAIAnalysis && openAIAnalysis.recommendedActions && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Recommended Actions</h3>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
              Phased by Difficulty
            </Badge>
          </div>

          {/* Phase 1 - Quick Wins */}
          {openAIAnalysis.recommendedActions.phase1 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <span className="text-gray-900">{openAIAnalysis.recommendedActions.phase1.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                      {openAIAnalysis.recommendedActions.phase1.expectedGain}
                    </Badge>
                    {openAIAnalysis.recommendedActions.phase1.estimatedTime && (
                      <Badge variant="outline" className="text-xs">
                        ⏱️ {openAIAnalysis.recommendedActions.phase1.estimatedTime}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
                {/* Team Owner and Time to Value */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {openAIAnalysis.recommendedActions.phase1.teamOwner && openAIAnalysis.recommendedActions.phase1.teamOwner.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Team:</span>
                      {openAIAnalysis.recommendedActions.phase1.teamOwner.map((owner, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                          {owner}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {openAIAnalysis.recommendedActions.phase1.timeToValue && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Time to Value:</span>
                      <span>{openAIAnalysis.recommendedActions.phase1.timeToValue}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Handle multiple possible field names from AI response */}
                {(openAIAnalysis.recommendedActions.phase1.elementsToFixOrRemove || 
                  openAIAnalysis.recommendedActions.phase1.elementsToRemove || 
                  openAIAnalysis.recommendedActions.phase1.actions) &&
                  (openAIAnalysis.recommendedActions.phase1.elementsToFixOrRemove?.length > 0 || 
                   openAIAnalysis.recommendedActions.phase1.elementsToRemove?.length > 0 ||
                   openAIAnalysis.recommendedActions.phase1.actions?.length > 0) && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        {isFormRelated ? "Specific Form Fields & Elements to Fix/Remove:" : "Elements to Fix or Remove:"}
                      </h4>
                      <ul className="space-y-1">
                        {(openAIAnalysis.recommendedActions.phase1.elementsToFixOrRemove || 
                          openAIAnalysis.recommendedActions.phase1.elementsToRemove || 
                          openAIAnalysis.recommendedActions.phase1.actions || []).map((element, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                            <ArrowRight className="w-3 h-3 text-blue-500" />"{element}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Phase 2 - Mid-Level Fixes */}
          {openAIAnalysis.recommendedActions.phase2 && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <span className="text-gray-900">{openAIAnalysis.recommendedActions.phase2.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                      {openAIAnalysis.recommendedActions.phase2.expectedGain}
                    </Badge>
                    {openAIAnalysis.recommendedActions.phase2.estimatedTime && (
                      <Badge variant="outline" className="text-xs">
                        ⏱️ {openAIAnalysis.recommendedActions.phase2.estimatedTime}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
                {/* Team Owner and Time to Value */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {openAIAnalysis.recommendedActions.phase2.teamOwner && openAIAnalysis.recommendedActions.phase2.teamOwner.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Team:</span>
                      {openAIAnalysis.recommendedActions.phase2.teamOwner.map((owner, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-700">
                          {owner}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {openAIAnalysis.recommendedActions.phase2.timeToValue && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Time to Value:</span>
                      <span>{openAIAnalysis.recommendedActions.phase2.timeToValue}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Handle multiple possible field names from AI response */}
                {(openAIAnalysis.recommendedActions.phase2.elementsToFixOrImprove || 
                  openAIAnalysis.recommendedActions.phase2.elementsToRemove ||
                  openAIAnalysis.recommendedActions.phase2.actions) &&
                  (openAIAnalysis.recommendedActions.phase2.elementsToFixOrImprove?.length > 0 || 
                   openAIAnalysis.recommendedActions.phase2.elementsToRemove?.length > 0 ||
                   openAIAnalysis.recommendedActions.phase2.actions?.length > 0) && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        {isFormRelated ? "Additional Form Elements to Fix/Improve:" : "Elements to Fix or Improve:"}
                      </h4>
                      <ul className="space-y-1">
                        {(openAIAnalysis.recommendedActions.phase2.elementsToFixOrImprove || 
                          openAIAnalysis.recommendedActions.phase2.elementsToRemove ||
                          openAIAnalysis.recommendedActions.phase2.actions || []).map((element, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                            <ArrowRight className="w-3 h-3 text-green-500" />"{element}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Phase 3 - Structural Improvements */}
          {openAIAnalysis.recommendedActions.phase3 && (
            <Card className="bg-purple-50 border-purple-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <span className="text-gray-900">{openAIAnalysis.recommendedActions.phase3.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                      {openAIAnalysis.recommendedActions.phase3.expectedGain}
                    </Badge>
                    {openAIAnalysis.recommendedActions.phase3.estimatedTime && (
                      <Badge variant="outline" className="text-xs">
                        ⏱️ {openAIAnalysis.recommendedActions.phase3.estimatedTime}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
                {/* Team Owner and Time to Value */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {openAIAnalysis.recommendedActions.phase3.teamOwner && openAIAnalysis.recommendedActions.phase3.teamOwner.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Team:</span>
                      {openAIAnalysis.recommendedActions.phase3.teamOwner.map((owner, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                          {owner}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {openAIAnalysis.recommendedActions.phase3.timeToValue && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Time to Value:</span>
                      <span>{openAIAnalysis.recommendedActions.phase3.timeToValue}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Handle multiple possible field names from AI response */}
                {(openAIAnalysis.recommendedActions.phase3.changes ||
                  openAIAnalysis.recommendedActions.phase3.actions) &&
                  (openAIAnalysis.recommendedActions.phase3.changes?.length > 0 ||
                   openAIAnalysis.recommendedActions.phase3.actions?.length > 0) && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Changes to Implement:</h4>
                      <ul className="space-y-1">
                        {(openAIAnalysis.recommendedActions.phase3.changes ||
                          openAIAnalysis.recommendedActions.phase3.actions || []).map((change, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                            <ArrowRight className="w-3 h-3 text-purple-500" />
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Highlights */}
          {openAIAnalysis.highlights && openAIAnalysis.highlights.length > 0 && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  Key Highlights & Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {openAIAnalysis.highlights.map((highlight, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center text-sm font-medium text-yellow-600 flex-shrink-0 mt-0.5">
                        ⚡
                      </div>
                      <p className="text-sm text-gray-700">{highlight}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Friction Points */}
          {openAIAnalysis.frictionPoints && openAIAnalysis.frictionPoints.length > 0 && (
            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Identified Friction Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {openAIAnalysis.frictionPoints.map((point, index) => (
                    <div key={index} className="border-l-4 border-red-300 pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-red-800">{point.element}</span>
                        <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-300">
                          {point.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{point.problem}</p>
                      <p className="text-xs text-red-600 font-medium">Impact: {point.impact}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ROI Insight */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-800">ROI Insight</span>
            </div>
            <p className="text-green-700">
              {isFormRelated
                ? "Form field reduction provides the highest impact for form-based CTAs - reducing from 7 to 3 fields can increase conversions by 15-25%"
                : "Header navigation cleanup typically provides immediate 3-5% CTR improvement with minimal effort"}
            </p>
          </div>

          {/* Next Steps */}
          {openAIAnalysis.nextSteps && openAIAnalysis.nextSteps.length > 0 && (
            <Card className="bg-white border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {openAIAnalysis.nextSteps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600 flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-sm text-gray-700">{step}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Manual Trigger Button (if auto-trigger failed and no cache) */}
      {!openAIAnalysis && !isLoadingOpenAI && !openAIError && (
        <Card className="bg-white border border-gray-200">
          <CardContent className="py-6 text-center">
            <Button onClick={triggerOpenAIAnalysis} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Brain className="w-4 h-4 mr-2 text-white" />
              Generate AI Analysis
            </Button>
            <p className="text-sm text-gray-700 mt-2">
              Analyze {deviceType} experience for conversion optimization recommendations
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
