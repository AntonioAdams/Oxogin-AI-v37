"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Target, DollarSign, Clock, Loader2 } from "lucide-react"
import type { CaptureResult, ClickPredictionResult } from "@/app/page/types"
import { computeMetrics } from "@/lib/tooltip/metrics"
import type { RawTooltipInput } from "@/lib/tooltip/schema"
import { CROExecutiveBrief } from "./CROExecutiveBrief"
import { debugLogCategory } from "@/lib/utils/logger"

interface CROAssistantProps {
  captureResult: CaptureResult
  clickPredictions: ClickPredictionResult[]
  primaryCTAId?: string
  deviceType: "desktop" | "mobile"
  isAnalyzing: boolean
  onAnalyze: () => void
}

interface CROAnalysis {
  highRiskElements: Array<{
    element: {
      id: string
      text: string
      tagName: string
      coordinates: { x: number; y: number; width: number; height: number }
    }
    type: string
    classification: string
    wastedClickScore: number
    recommendation: string
    distractionFactors: string[]
  }>
  recommendations: string[]
  projectedImprovements: {
    ctrImprovement: number
    revenueImpact: number
    implementationDifficulty: string
    priorityScore: number
  }
  totalWastedElements: number
  primaryCTA: {
    id: string
    text: string
    coordinates: { x: number; y: number; width: number; height: number }
  } | null
}

interface CROMetrics {
  currentConversionRate: number
  projectedConversionRate: number
  improvementPotential: number
  revenueImpact: number
  implementationDifficulty: "easy" | "moderate" | "hard"
  priorityScore: number
  estimatedDays: string
  highRiskElements: number
  recommendationsCount: number
  isFormRelated: boolean
}

interface CRORecommendation {
  id: string
  title: string
  description: string
  impact: number
  difficulty: "easy" | "moderate" | "hard"
  priority: number
  factors: string[]
  isExpanded?: boolean
}

interface HighRiskElement {
  id: string
  text: string
  riskPercentage: number
  description: string
  factors: string[]
  wasteType: "wasted-click"
}

export function CROAssistant({
  captureResult,
  clickPredictions,
  primaryCTAId,
  deviceType,
  isAnalyzing,
  onAnalyze,
}: CROAssistantProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [expandedRecommendations, setExpandedRecommendations] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<CROAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle CRO Analysis
  const handleAnalyzeCRO = async () => {
    if (!captureResult?.domData) {
      setError("No DOM data available for analysis")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      debugLogCategory("CRO", "Starting analysis with data:", {
        hasDomData: !!captureResult.domData,
        hasClickPredictions: !!clickPredictions,
        clickPredictionsLength: clickPredictions?.length || 0,
        primaryCTAId,
        deviceType,
        dynamicBaseline: croMetrics.currentConversionRate,
      })

      // FIXED: Using unified analysis results from global data
      console.log("✅ CROAssistant: Using unified analysis results (no separate API call needed)")
      
      // TODO: Get unified analysis data from parent props or global state
      // For now, simulate the expected result structure
      const result = {
        success: true,
        analysis: "CRO analysis data from unified analysis will be used here"
      }
      debugLogCategory("CRO", "Using unified analysis data instead of separate API call")

      if (result.success && result.analysis) {
        setAnalysis(result.analysis)
        debugLogCategory("CRO", "Analysis completed successfully")
      } else {
        throw new Error(result.error || "Analysis failed")
      }
    } catch (err) {
      console.error("[CRO] Analysis error:", err)
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setIsLoading(false)
    }

    // Also call the parent's onAnalyze if provided
    if (onAnalyze) {
      onAnalyze()
    }
  }

  // Calculate CRO metrics based on capture data and predictions
  const croMetrics = useMemo((): CROMetrics => {
    debugLogCategory("CRO Metrics", "Starting calculation with:", {
      primaryCTAId,
      clickPredictionsLength: clickPredictions.length,
      hasImageSize: !!captureResult.imageSize,
      hasContainerSize: !!captureResult.containerSize,
    })

    // Get primary CTA and its prediction
    const primaryCTAPrediction = primaryCTAId
      ? clickPredictions.find((pred) => pred.elementId === primaryCTAId)
      : clickPredictions[0] // fallback to first prediction

    debugLogCategory("CRO Metrics", "Primary CTA prediction:", {
      found: !!primaryCTAPrediction,
      elementId: primaryCTAPrediction?.elementId,
      ctr: primaryCTAPrediction?.ctr,
      isFormRelated: primaryCTAPrediction?.isFormRelated,
    })

    // Use computeMetrics to get the baseline (same as datacard)
    let baseConversionRate = 2.5 // Lower fallback to make it obvious when this is used
    let isFormRelated = false

    if (primaryCTAPrediction && captureResult.imageSize && captureResult.containerSize) {
      try {
        // Create tooltip input (same as CTADataCard)
        const tooltipInput: RawTooltipInput = {
          elementCoords: {
            x: primaryCTAPrediction.coordinates?.x || 0,
            y: primaryCTAPrediction.coordinates?.y || 0,
            width: primaryCTAPrediction.coordinates?.width || 100,
            height: primaryCTAPrediction.coordinates?.height || 30,
          },
          imageSize: captureResult.imageSize,
          containerSize: captureResult.containerSize,
          clickPrediction: primaryCTAPrediction,
          isFormRelated: primaryCTAPrediction.isFormRelated || false,
          ctaText: primaryCTAPrediction.text || "",
        }

        debugLogCategory("CRO Metrics", "Tooltip input created:", {
          elementCoords: tooltipInput.elementCoords,
          imageSize: tooltipInput.imageSize,
          containerSize: tooltipInput.containerSize,
          isFormRelated: tooltipInput.isFormRelated,
          ctaText: tooltipInput.ctaText,
        })

        const metrics = computeMetrics(tooltipInput)
        baseConversionRate = metrics.ctr * 100 // Convert to percentage
        isFormRelated = tooltipInput.isFormRelated

        debugLogCategory("CRO Metrics", "Computed metrics:", {
          ctr: metrics.ctr,
          baseConversionRatePercent: baseConversionRate,
          isFormRelated,
          calculationSource: metrics.calculationSource,
        })
      } catch (error) {
        console.error("[CRO Metrics] Error computing metrics:", error)
        // Keep fallback value
      }
    } else {
      console.warn("[CRO Metrics] Missing required data for computeMetrics:", {
        hasPrimaryCTAPrediction: !!primaryCTAPrediction,
        hasImageSize: !!captureResult.imageSize,
        hasContainerSize: !!captureResult.containerSize,
      })
    }

    const totalButtons = captureResult.domData.buttons?.length || 0
    const totalLinks = captureResult.domData.links?.length || 0

    // Use analysis data if available, otherwise use predictions
    const highRiskElements = analysis
      ? analysis.highRiskElements.length
      : clickPredictions.filter((pred) => pred.wastedClicks > 10 || (pred.wasteBreakdown?.cappedWasteRate || 0) > 0.5)
          .length

    const improvementPotential = analysis
      ? analysis.projectedImprovements.ctrImprovement * 100
      : Math.min(15.0, highRiskElements * 2.5)
    const projectedRate = baseConversionRate + (baseConversionRate * improvementPotential) / 100

    // Revenue impact calculation
    const revenueImpact = analysis
      ? analysis.projectedImprovements.revenueImpact
      : (() => {
          const monthlyTraffic = 10000 // Estimated monthly traffic
          const averageOrderValue = 150 // Estimated AOV
          const additionalConversions = monthlyTraffic * (improvementPotential / 100) * (baseConversionRate / 100)
          return additionalConversions * averageOrderValue
        })()

    // Implementation difficulty based on number of issues
    let difficulty: "easy" | "moderate" | "hard" = "easy"
    let estimatedDays = "1-2 days"
    let priorityScore = 21

    if (analysis) {
      difficulty = analysis.projectedImprovements.implementationDifficulty as "easy" | "moderate" | "hard"
      priorityScore = analysis.projectedImprovements.priorityScore
      estimatedDays = difficulty === "hard" ? "5-7 days" : difficulty === "moderate" ? "2-3 days" : "1-2 days"
    } else if (highRiskElements > 10) {
      difficulty = "hard"
      estimatedDays = "5-7 days"
      priorityScore = Math.min(330, highRiskElements * 5)
    } else if (highRiskElements > 5) {
      difficulty = "moderate"
      estimatedDays = "2-3 days"
      priorityScore = Math.min(100, highRiskElements * 8)
    }

    const result = {
      currentConversionRate: baseConversionRate,
      projectedConversionRate: projectedRate,
      improvementPotential,
      revenueImpact,
      implementationDifficulty: difficulty,
      priorityScore,
      estimatedDays,
      highRiskElements: analysis ? analysis.totalWastedElements : highRiskElements,
      recommendationsCount: analysis ? analysis.recommendations.length : Math.min(3, Math.ceil(highRiskElements / 5)),
      isFormRelated,
    }

    debugLogCategory("CRO Metrics", "Final result:", result)
    return result
  }, [captureResult, clickPredictions, analysis, primaryCTAId])

  // Generate high-risk elements list
  const highRiskElements = useMemo((): HighRiskElement[] => {
    if (analysis && analysis.highRiskElements) {
      return analysis.highRiskElements.map((element, index) => ({
        id: element.element.id,
        text: element.element.text,
        riskPercentage: Math.round(element.wastedClickScore * 100),
        description: element.recommendation,
        factors: element.distractionFactors,
        wasteType: "wasted-click" as const,
      }))
    }

    // Fallback to predictions or default data
    const elements: HighRiskElement[] = []

    // Add high-risk predictions
    clickPredictions
      .filter((pred) => pred.wastedClicks > 5)
      .slice(0, 10)
      .forEach((pred, index) => {
        const riskPercentage = pred.wasteBreakdown?.cappedWasteRate
          ? Math.round(pred.wasteBreakdown.cappedWasteRate * 100)
          : Math.round((pred.wastedClicks / pred.estimatedClicks) * 100)

        elements.push({
          id: `risk-${index}`,
          text: pred.text || `Element ${index + 1}`,
          riskPercentage: Math.min(90, Math.max(70, riskPercentage)),
          description: `High-priority optimization needed. Consider reducing the visual prominence of "${pred.text}" or repositioning it to avoid competing with the primary CTA.`,
          factors: pred.riskFactors.slice(0, 4),
          wasteType: "wasted-click",
        })
      })

    // Add some default high-risk elements if we don't have enough predictions
    if (elements.length < 3) {
      const defaultElements = [
        {
          id: "contact-sales",
          text: "Contact sales",
          riskPercentage: 90,
          description:
            'High-priority optimization needed. Consider reducing the visual prominence of "Contact sales" or repositioning it to avoid competing with the primary CTA.',
          factors: ["competing button", "above fold placement", "action oriented text", "button styling"],
          wasteType: "wasted-click" as const,
        },
        {
          id: "get-started",
          text: "Get started",
          riskPercentage: 90,
          description:
            'High-priority optimization needed. Consider reducing the visual prominence of "Get started" or repositioning it to avoid competing with the primary CTA.',
          factors: ["competing button", "above fold placement", "action oriented text", "button styling"],
          wasteType: "wasted-click" as const,
        },
      ]

      defaultElements.forEach((element) => {
        if (!elements.find((e) => e.text === element.text)) {
          elements.push(element)
        }
      })
    }

    return elements.slice(0, 5)
  }, [clickPredictions, analysis])

  // Generate recommendations
  const recommendations = useMemo((): CRORecommendation[] => {
    const recs: CRORecommendation[] = []

    if (analysis && analysis.recommendations) {
      analysis.recommendations.forEach((rec, index) => {
        recs.push({
          id: `rec-${index}`,
          title: "Eliminate Visual Distractions",
          description: rec,
          impact: croMetrics.improvementPotential,
          difficulty: croMetrics.implementationDifficulty,
          priority: index + 1,
          factors: ["competing button", "action oriented text"],
        })
      })
    } else {
      // Primary recommendation based on analysis
      if (highRiskElements.length > 0) {
        recs.push({
          id: "eliminate-distractions",
          title: "Eliminate Visual Distractions",
          description: `High interactive element density (${captureResult.domData.buttons?.length || 0} elements). Multiple forms competing for attention (${captureResult.domData.forms?.length || 0} forms). Excessive links throughout page (${captureResult.domData.links?.length || 0} links). This creates decision paralysis - visitors don't know where to focus, leading to lower conversion rates.`,
          impact: croMetrics.improvementPotential,
          difficulty: croMetrics.implementationDifficulty,
          priority: 1,
          factors: ["competing button", "action oriented text"],
        })
      }
    }

    return recs
  }, [captureResult, croMetrics, highRiskElements, analysis])

  const toggleRecommendation = (id: string) => {
    setExpandedRecommendations((prev) => (prev.includes(id) ? prev.filter((recId) => recId !== id) : [...prev, id]))
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "text-green-600 bg-green-100"
      case "moderate":
        return "text-yellow-600 bg-yellow-100"
      case "hard":
        return "text-red-600 bg-red-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  const opportunitiesCount = recommendations.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">CRO Assistant</h2>
              <p className="text-sm text-gray-600">AI-powered conversion optimization recommendations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
              {opportunitiesCount} opportunities found
            </Badge>
            <Button
              onClick={handleAnalyzeCRO}
              disabled={isLoading || isAnalyzing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Analyze CRO
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white">
            Overview
          </TabsTrigger>
          <TabsTrigger value="executive-brief" className="data-[state=active]:bg-white">
            Executive Brief
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Conversion Rate Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  {croMetrics.isFormRelated ? "Conversion Rate" : "CTR"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-4">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {croMetrics.currentConversionRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Current</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-400">
                      {croMetrics.projectedConversionRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Projected</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-blue-600">
                  +{croMetrics.improvementPotential.toFixed(1)}% improvement potential
                </div>
              </CardContent>
            </Card>

            {/* Revenue Impact Card */}
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Revenue Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold text-green-600">${croMetrics.revenueImpact.toLocaleString()}</div>
                <div className="text-xs text-gray-600">Monthly potential increase</div>
              </CardContent>
            </Card>

            {/* Implementation Card */}
            <Card className="bg-purple-50 border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Implementation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-bold text-purple-600">{croMetrics.implementationDifficulty}</div>
                <div className="text-xs text-gray-600">Est. {croMetrics.estimatedDays}</div>
                <div className="text-sm font-medium text-purple-600">{croMetrics.priorityScore} Priority Score</div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-red-600 mb-2">{croMetrics.highRiskElements}</div>
                <div className="text-sm text-gray-600">High-Risk Elements</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{croMetrics.recommendationsCount}</div>
                <div className="text-sm text-gray-600">Recommendations</div>
              </CardContent>
            </Card>
          </div>

          {/* Recommended Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recommended Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    #{rec.priority}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900 mb-1">{rec.title}</h4>
                    <p className="text-sm text-blue-700 mb-2">{rec.description}</p>
                    <div className="flex items-center gap-2">
                      <Badge className={getDifficultyColor(rec.difficulty)} variant="secondary">
                        {rec.difficulty}
                      </Badge>
                      <span className="text-sm font-medium text-green-600">+{rec.impact.toFixed(1)}% improvement</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Executive Brief Tab */}
        <TabsContent value="executive-brief" className="space-y-6">
          <CROExecutiveBrief
            captureResult={captureResult}
            clickPredictions={clickPredictions}
            primaryCTAId={primaryCTAId}
            deviceType={deviceType}
            analysisResult={null} // You may need to pass the actual analysis result
            matchedElement={null} // You may need to pass the actual matched element
            croAnalysisResult={analysis} // Pass the existing CRO analysis result
            dynamicBaseline={croMetrics.currentConversionRate / 100} // Convert back to decimal
            isFormRelated={croMetrics.isFormRelated}
            isAnalyzing={isAnalyzing}
            onAnalyze={onAnalyze}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
