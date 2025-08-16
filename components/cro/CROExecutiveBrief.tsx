"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
  primaryCTAPrediction?: ClickPredictionResult | null // Add missing prop
}



// REMOVED: convertInternalCROToUIFormat function no longer needed - using internal CRO data directly now

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
  primaryCTAPrediction,
}: CROExecutiveBriefProps) {
  // DEBUG: Log component render and props
  console.log("🎯 CROExecutiveBrief component rendered with props:", {
    hasCaptureResult: !!captureResult,
    hasClickPredictions: !!clickPredictions,
    clickPredictionsLength: clickPredictions?.length || 0,
    primaryCTAId,
    hasMatchedElement: !!matchedElement,
    hasCroAnalysisResult: !!croAnalysisResult,
    croAnalysisKeys: croAnalysisResult ? Object.keys(croAnalysisResult) : [],
    croRecommendationsCount: croAnalysisResult?.recommendations?.length || 0
  })





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
    // FIXED: Use the same Primary CTA source as tooltip (AI-determined, not highest clicks)
    const primaryCTAPredictionFromClicks = primaryCTAId
      ? clickPredictions.find((pred) => pred.elementId === primaryCTAId)
      : clickPredictions[0]
    
    console.log("🔍 PRIMARY CTA PREDICTION LOOKUP:")
    console.log("  primaryCTAId:", primaryCTAId)
    console.log("  clickPredictions.length:", clickPredictions.length)
    console.log("  found prediction:", primaryCTAPredictionFromClicks)
    console.log("  prediction text:", primaryCTAPredictionFromClicks?.text)
    console.log("  clickPredictions[0]:", clickPredictions[0])
    console.log("  clickPredictions[0].text:", clickPredictions[0]?.text)

    let currentCTR = dynamicBaseline
    let projectedCTR = dynamicBaseline * 1.475
    let improvementPotential = 47.5
    // FIXED: Use the exact same approach as tooltip - directly use wastedSpend from prediction
    let costSavings = primaryCTAPredictionFromClicks?.wastedSpend || 0

    if (primaryCTAPredictionFromClicks) {
      currentCTR = primaryCTAPredictionFromClicks.ctr || dynamicBaseline

      if (targetCTR) {
        projectedCTR = targetCTR
        improvementPotential = ((projectedCTR - currentCTR) / currentCTR) * 100
      } else {
        projectedCTR = currentCTR * 1.475
        improvementPotential = 47.5
      }

      // FIXED: Use wastedSpend directly from prediction (same as tooltip)
      costSavings = primaryCTAPredictionFromClicks.wastedSpend || 0

      debugLogCategory("Click Prediction Report", "Using wastedSpend directly from prediction (same as tooltip):", {
        elementId: primaryCTAPredictionFromClicks.elementId,
        currentCTR,
        projectedCTR,
        improvementPotential,
        wastedSpend: primaryCTAPredictionFromClicks.wastedSpend,
        finalCostSavings: costSavings,
      })
    }

    const url = captureResult.domData?.url || "unknown"
    const companyName = url.includes("://") ? new URL(url).hostname.replace("www.", "") : url

    // FIXED: Use the same Primary CTA source as tooltip (matchedElement.text first)
    const finalPrimaryCTAText = matchedElement?.text || "Primary CTA"
    
    console.log("🎯 FIXED PRIMARY CTA TEXT DEBUG (same as tooltip):")
    console.log("  finalPrimaryCTAText:", finalPrimaryCTAText)
    console.log("  matchedElement?.text:", matchedElement?.text)
    console.log("  fallback: Primary CTA")
    console.log("  previouslyUsed primaryCTAPrediction?.text:", primaryCTAPrediction?.text)

    return {
      companyName,
      url,
      deviceType,
      primaryCTAText: finalPrimaryCTAText, // Use AI-determined Primary CTA (same as tooltip)
      currentCTR: currentCTR * 100,
      projectedCTR: projectedCTR * 100,
      improvementPotential,
      costSavings,
      isFormRelated,
      primaryCTAPrediction: primaryCTAPredictionFromClicks, // Keep click prediction for metrics
    }
  }, [
    captureResult,
    clickPredictions,
    primaryCTAId,
    deviceType,
    dynamicBaseline,
    isFormRelated,
    matchedElement,
    primaryCTAPrediction, // Add this dependency
    targetCTR,
  ])

  // Create cache key for this analysis
  const cacheKey = useMemo(() => {
    return `${prePopulatedData.url}-${deviceType}-${primaryCTAId}-${prePopulatedData.primaryCTAText}`
  }, [prePopulatedData.url, deviceType, primaryCTAId, prePopulatedData.primaryCTAText])









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
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
              Analysis Ready
            </Badge>
          </div>
        </div>



        {/* Current Performance Snapshot */}
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


      </div>



      {/* Internal CRO Recommendations */}
      {croAnalysisResult && croAnalysisResult.recommendations && croAnalysisResult.recommendations.length > 0 && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
                                    <div>
              <h3 className="text-xl font-semibold text-gray-900">CRO Analysis Report</h3>
              <p className="text-sm text-gray-600">
                {croAnalysisResult.summary.totalRecommendations} recommendations • 
                {croAnalysisResult.summary.estimatedUpliftRange.min}-{croAnalysisResult.summary.estimatedUpliftRange.max}% estimated uplift
              </p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{croAnalysisResult.summary.quickWins}</div>
              <div className="text-sm text-blue-700">Quick Wins</div>
              <div className="text-xs text-blue-600">1-2 hrs • +3-5%</div>
                    </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{croAnalysisResult.summary.formFixes}</div>
              <div className="text-sm text-green-700">Form Fixes</div>
              <div className="text-xs text-green-600">3-5 hrs • +5-8%</div>
                  </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{croAnalysisResult.summary.structuralChanges}</div>
              <div className="text-sm text-purple-700">Structural</div>
              <div className="text-xs text-purple-600">1-2 days • +8-12%</div>
                  </div>
                    </div>

          {/* Internal CRO Recommendations by Category */}
          {['Quick Wins', 'Form Fixes', 'Structural Changes', 'Key Highlights', 'Friction Points', 'ROI Insights', 'Next Steps'].map((category: string) => {
            const categoryRecommendations = croAnalysisResult.recommendations.filter((rec: any) => rec.category === category)
            if (categoryRecommendations.length === 0) return null

            const getCategoryConfig = (cat: string) => {
              switch (cat) {
                case 'Quick Wins': return { color: 'blue', icon: '⚡', bgClass: 'bg-blue-50 border-blue-200', titleClass: 'text-blue-900', badgeClass: 'bg-blue-100 text-blue-700 border-blue-300', iconClass: 'text-blue-600' }
                case 'Form Fixes': return { color: 'green', icon: '📝', bgClass: 'bg-green-50 border-green-200', titleClass: 'text-green-900', badgeClass: 'bg-green-100 text-green-700 border-green-300', iconClass: 'text-green-600' }
                case 'Structural Changes': return { color: 'purple', icon: '🏗️', bgClass: 'bg-purple-50 border-purple-200', titleClass: 'text-purple-900', badgeClass: 'bg-purple-100 text-purple-700 border-purple-300', iconClass: 'text-purple-600' }
                case 'Key Highlights': return { color: 'yellow', icon: '⚡', bgClass: 'bg-yellow-50 border-yellow-200', titleClass: 'text-yellow-900', badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-300', iconClass: 'text-yellow-600' }
                case 'Friction Points': return { color: 'red', icon: '⚠️', bgClass: 'bg-red-50 border-red-200', titleClass: 'text-red-900', badgeClass: 'bg-red-100 text-red-700 border-red-300', iconClass: 'text-red-600' }
                case 'ROI Insights': return { color: 'emerald', icon: '💰', bgClass: 'bg-emerald-50 border-emerald-200', titleClass: 'text-emerald-900', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300', iconClass: 'text-emerald-600' }
                case 'Next Steps': return { color: 'indigo', icon: '📋', bgClass: 'bg-indigo-50 border-indigo-200', titleClass: 'text-indigo-900', badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-300', iconClass: 'text-indigo-600' }
                default: return { color: 'gray', icon: '•', bgClass: 'bg-gray-50 border-gray-200', titleClass: 'text-gray-900', badgeClass: 'bg-gray-100 text-gray-700 border-gray-300', iconClass: 'text-gray-600' }
              }
            }

            const config = getCategoryConfig(category)

            return (
              <Card key={category} className={config.bgClass}>
              <CardHeader>
                  <CardTitle className={`text-lg flex items-center gap-2 ${config.titleClass}`}>
                    <span className="text-lg">{config.icon}</span>
                    {category}
                    <Badge variant="outline" className={`text-xs ${config.badgeClass}`}>
                      {categoryRecommendations.length}
                    </Badge>
                </CardTitle>
              </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categoryRecommendations.map((rec: any, index: number) => (
                      <div key={rec.id} className="border-l-4 border-current pl-4 py-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{rec.title}</span>
                              {rec.effort && (
                      <Badge variant="outline" className="text-xs">
                                  ⏱️ {rec.effort}
                      </Badge>
                    )}
                              {rec.impact && (
                                <Badge className={config.badgeClass}>
                                  {rec.impact}
                        </Badge>
                  )}
                    </div>
                            <p className="text-sm text-gray-700 mb-1">{rec.description}</p>
                            {rec.confidence > 0 && (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Confidence: {rec.confidence}%</span>
                                {rec.estimatedUplift.min > 0 && (
                                  <span>• Impact: {rec.estimatedUplift.min}-{rec.estimatedUplift.max}%</span>
                                )}
                    </div>
                  )}
                      </div>
                    </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )
          })}

          {/* Analysis Metadata */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">Analysis Details</span>
                      </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Device:</span> {croAnalysisResult.metadata.deviceType}
                    </div>
              <div>
                <span className="font-medium">Version:</span> {croAnalysisResult.metadata.analysisVersion}
                </div>
              <div>
                <span className="font-medium">Analyzed:</span> {new Date(croAnalysisResult.metadata.analyzedAt).toLocaleString()}
            </div>
              <div>
                <span className="font-medium">URL:</span> {croAnalysisResult.metadata.url}
          </div>
                      </div>
                    </div>
        </div>
      )}

      {/* Manual Trigger Button - No longer needed with internal CRO */}
      {croAnalysisResult && croAnalysisResult.recommendations && croAnalysisResult.recommendations.length === 0 && (
        <Card className="bg-yellow-50 border border-yellow-200">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-yellow-700">
              No CRO recommendations generated for this page analysis.
            </p>
          </CardContent>
        </Card>
      )}


    </div>
  )
}
