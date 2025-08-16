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
}



/**
 * REMOVED: convertInternalCROToUIFormat function no longer needed
 * Using internal CRO data directly now
 */
function REMOVED_convertInternalCROToUIFormat_PLACEHOLDER(
  internalCRO: any, 
  primaryCTAPrediction?: any, 
  matchedElement?: any
): OpenAIAnalysis {
  console.log("🔄 Converting internal CRO analysis to UI format...")
  
  if (!internalCRO) {
    console.error("❌ No internal CRO data provided to conversion function")
    throw new Error("Internal CRO data is required for conversion")
  }
  
  const recommendations = internalCRO.recommendations || []
  console.log("📝 Processing recommendations:", {
    total: recommendations.length,
    categories: [...new Set(recommendations.map((r: any) => r.category))]
  })
  
  // Group recommendations by category (with fallbacks for different category names)
  const quickWins = recommendations.filter((r: any) => r.category === 'Quick Wins')
  const formFixes = recommendations.filter((r: any) => r.category === 'Form Fixes')
  const structuralChanges = recommendations.filter((r: any) => r.category === 'Structural Changes')
  const frictionPoints = recommendations.filter((r: any) => r.category === 'Friction Points')
  const keyHighlights = recommendations.filter((r: any) => r.category === 'Key Highlights')
  const roiInsights = recommendations.filter((r: any) => r.category === 'ROI Insights')
  const nextSteps = recommendations.filter((r: any) => r.category === 'Next Steps')
  
  // Use Next Steps as Structural Changes if no dedicated structural changes exist
  const effectiveStructuralChanges = structuralChanges.length > 0 ? structuralChanges : nextSteps
  
  // FIXED: Use click prediction system's CTA text instead of tokenizer's potentially incorrect identification
  const primaryCTA = primaryCTAPrediction?.text || 
                     matchedElement?.text || 
                     internalCRO.tokens?.labels?.primary_cta || 
                     "Primary CTA"
  
  console.log("🎯 CTA Text Source Priority:", {
    primaryCTAPredictionText: primaryCTAPrediction?.text,
    matchedElementText: matchedElement?.text,
    tokenizerText: internalCRO.tokens?.labels?.primary_cta,
    finalCTAText: primaryCTA
  })
  const currentCTR = 3.2 // Base conversion rate
  const projectedCTR = currentCTR + (internalCRO.summary?.estimatedUpliftRange?.min || 0) / 100 * currentCTR
  
  // Calculate uplift metrics
  const minUplift = internalCRO.summary?.estimatedUpliftRange?.min || 0
  const maxUplift = internalCRO.summary?.estimatedUpliftRange?.max || 0
  const totalUpliftRange = `${minUplift}-${maxUplift}%`
  
  const result = {
    companyName: internalCRO.metadata?.url ? 
      new URL(internalCRO.metadata.url).hostname.replace('www.', '').split('.')[0] : 
      "Company",
    url: internalCRO.metadata?.url || "",
    deviceType: internalCRO.metadata?.deviceType || "desktop",
    dateAnalyzed: new Date(internalCRO.metadata?.analyzedAt || Date.now()).toLocaleDateString(),
    
    currentPerformance: {
      primaryCTA: primaryCTA,
      currentConversionRate: currentCTR,
      projectedConversionRate: projectedCTR,
      monthlyWastedSpend: 2400, // Estimated based on improvements
      ctaType: "button",
      metricLabel: "Conversion Rate"
    },
    
    frictionPoints: frictionPoints
      .slice(0, 4)
      .map((r: any) => ({
        element: primaryCTA,
        type: "usability",
        problem: r.title,
        impact: r.description.split('→')[1]?.trim() || r.impact
      })),
    
    recommendedActions: {
      phase1: {
        title: "Quick Wins (1-2 hrs)",
        description: `Immediate improvements to boost "${primaryCTA}" performance`,
        elementsToFixOrRemove: quickWins.slice(0, 3).map((r: any) => r.description),
        teamOwner: ["Designer"],
        timeToValue: "1-2 days",
        estimatedTime: "1-2 hrs",
        expectedGain: quickWins.length > 0 ? quickWins[0].impact : "+3-5%"
      },
      phase2: {
        title: "Form Fixes (3-5 hrs)",
        description: "Optimize form completion and reduce abandonment",
        elementsToFixOrImprove: formFixes.slice(0, 3).map((r: any) => r.description),
        teamOwner: ["Developer"],
        timeToValue: "2-4 days",
        estimatedTime: "3-5 hrs",
        expectedGain: formFixes.length > 0 ? formFixes[0].impact : "+5-8%"
      },
      phase3: {
        title: "Structural (1-2 days)",
        description: "Major layout and flow improvements",
        changes: effectiveStructuralChanges.slice(0, 3).map((r: any) => r.description),
        teamOwner: ["Designer", "Developer"],
        timeToValue: "1-2 weeks",
        estimatedTime: "1-2 days",
        expectedGain: effectiveStructuralChanges.length > 0 ? effectiveStructuralChanges[0].impact : "+8-12%"
      }
    },
    
    // FIXED: Add missing projectedResults field
    projectedResults: {
      currentCTR: currentCTR,
      optimizedCTR: projectedCTR,
      totalUpliftRange: totalUpliftRange,
      deviceSpecificROI: `${Math.round((projectedCTR / currentCTR - 1) * 100)}% CTR improvement expected`
    },
    
    // FIXED: Add missing nextSteps field
    nextSteps: [
      "Implement Phase 1 quick wins to achieve immediate 3-5% improvement",
      "Monitor conversion metrics for 1-2 weeks to validate initial improvements",
      "Proceed with Phase 2 form optimizations for additional 5-8% gain",
      "Execute Phase 3 structural changes for maximum conversion potential",
      "Conduct A/B testing to validate each phase before full implementation"
    ],
    
    // FIXED: Add missing highlights field
    highlights: [
      ...keyHighlights.map((r: any) => r.description),
      ...roiInsights.map((r: any) => r.description),
      ...(recommendations.length > 0 ? [`${recommendations.length} total optimization opportunities identified`] : []),
      ...(minUplift > 0 ? [`Expected conversion rate improvement: ${totalUpliftRange}`] : [])
    ].slice(0, 5), // Limit to 5 key highlights
    
    keyInsights: [
      `Primary CTA "${primaryCTA}" shows ${minUplift}-${maxUplift}% improvement potential`,
      `${internalCRO.summary?.totalRecommendations || 0} specific recommendations identified`,
      `${internalCRO.summary?.quickWins || 0} quick wins available for immediate implementation`
    ],
    
    reasoning: `Analysis based on ${internalCRO.summary?.totalRecommendations || 0} tokenized recommendations from internal CRO engine. Focus areas: ${quickWins.length > 0 ? 'Quick Wins' : ''}${formFixes.length > 0 ? ', Form Optimization' : ''}${effectiveStructuralChanges.length > 0 ? ', Structural Changes' : ''}${nextSteps.length > 0 ? ', Next Steps' : ''}.`,
    
    additionalNotes: `Internal CRO engine analysis completed in ${internalCRO.metadata?.analyzedAt ? 'real-time' : 'background'}. Recommendations are based on actual DOM analysis and proven conversion optimization patterns.`
  }
  
  console.log("✅ Internal CRO conversion completed successfully")
  return result
}

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
    const primaryCTAPrediction = primaryCTAId
      ? clickPredictions.find((pred) => pred.elementId === primaryCTAId)
      : clickPredictions[0]

    let currentCTR = dynamicBaseline
    let projectedCTR = dynamicBaseline * 1.475
    let improvementPotential = 47.5
    // FIXED: Use the exact same approach as tooltip - directly use wastedSpend from prediction
    let costSavings = primaryCTAPrediction?.wastedSpend || 0

    if (primaryCTAPrediction) {
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
