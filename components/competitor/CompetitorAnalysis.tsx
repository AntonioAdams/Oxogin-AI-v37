"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Target, Zap, Clock, Trophy, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface OriginalData {
  url: string
  captureResult?: any
  clickPredictions?: any[]
  primaryCTAPrediction?: any
  croAnalysisResult?: any
}

interface CompetitorData {
  url: string
  domain: string
  captureResult?: any
  clickPredictions?: any[]
  primaryCTAPrediction?: any
  croAnalysisResult?: any
}

interface CompetitorAnalysisProps {
  originalData: OriginalData
  competitorData: CompetitorData | null
  onCompetitorUrlSubmit?: (url: string) => void
}

export function CompetitorAnalysis({ originalData, competitorData, onCompetitorUrlSubmit }: CompetitorAnalysisProps) {
  const [competitorUrl, setCompetitorUrl] = useState(competitorData?.url || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Update competitor URL when competitorData changes
  useEffect(() => {
    if (competitorData?.url) {
      setCompetitorUrl(competitorData.url)
    }
  }, [competitorData?.url])

  // URL shortening function
  const shortenUrl = (url: string, maxLength: number = 20) => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      const domain = urlObj.hostname.replace('www.', '')
      return domain.length > maxLength ? `${domain.substring(0, maxLength)}...` : domain
    } catch {
      return url.length > maxLength ? `${url.substring(0, maxLength)}...` : url
    }
  }

  const handleCompetitorSubmit = async () => {
    if (!competitorUrl.trim() || !onCompetitorUrlSubmit) return
    
    setIsSubmitting(true)
    try {
      await onCompetitorUrlSubmit(competitorUrl.trim())
      setIsEditing(false) // Close editing mode after successful analysis
    } finally {
      setIsSubmitting(false)
    }
  }
  // Use DIRECT data from prediction engine - no recalculation (same as original analysis)
  const getDirectMetrics = (predictions: any[], primaryCTA: any, fallbackValues: any) => {
    if (!predictions || predictions.length === 0 || !primaryCTA) {
      return fallbackValues
    }

    // Use DIRECT primary CTA data - exactly like original analysis
    const primaryCTR = primaryCTA.ctr || 0  // Direct from prediction engine
    const primaryClickShare = primaryCTA.clickShare || 0  // Direct from prediction engine
    const primaryWastedSpend = primaryCTA.wastedSpend || 0  // Direct from prediction engine
    
    // Use prediction totals for aggregate metrics
    const totalPredictedClicks = predictions.reduce((sum, p) => sum + (p.estimatedClicks || 0), 0)
    const totalWastedSpend = predictions.reduce((sum, p) => sum + (p.wastedSpend || 0), 0)
    const totalWastedClicks = predictions.reduce((sum, p) => sum + (p.wastedClicks || 0), 0)
    const ctaCount = predictions.length

    return {
      totalPredictedClicks: Math.round(totalPredictedClicks),
      totalWastedSpend: Math.round(totalWastedSpend), 
      totalWastedClicks: Math.round(totalWastedClicks),
      avgCTR: primaryCTR, // Direct from prediction engine - no rounding
      currentCTR: primaryCTR, // ADDED: Current CTR for screenshot cards
      ctaCount,
      primaryCTAPerformance: primaryClickShare, // Direct from prediction engine - no rounding
      primaryCTR: primaryCTR, // Direct from prediction engine - no rounding
      primaryWastedSpend: Math.round(primaryWastedSpend),
      overallScore: 1.0 // We'll calculate this based on who has better metrics
    }
  }

  // Get direct metrics for both sites using real data (same as original analysis)
  const originalMetrics = getDirectMetrics(
    originalData.clickPredictions || [],
    originalData.primaryCTAPrediction,
    {
      totalPredictedClicks: 0,
      totalWastedSpend: 0,
      totalWastedClicks: 0,
      avgCTR: 0.02,
      currentCTR: 0.02, // ADDED: Fallback current CTR for screenshot cards
      ctaCount: 0,
      primaryCTAPerformance: 0,
      primaryCTR: 0.02,
      primaryWastedSpend: 0,
      overallScore: 5.0
    }
  )
  
  const competitorMetrics = competitorData ? getDirectMetrics(
    competitorData.clickPredictions || [],
    competitorData.primaryCTAPrediction,
    {
      totalPredictedClicks: 0,
      totalWastedSpend: 0,
      totalWastedClicks: 0,
      avgCTR: 0.02, // Same fallback as original
      currentCTR: 0.02, // ADDED: Fallback current CTR for screenshot cards
      ctaCount: 0,
      primaryCTAPerformance: 0,
      primaryCTR: 0.02, // Same fallback as original
      primaryWastedSpend: 0,
      overallScore: 0
    }
  ) : null

  // Calculate simple overall scores based on key metrics
  const calculateOverallScore = (metrics: any) => {
    // Simple scoring: lower wasted spend = better, higher CTR = better
    const wastedSpendScore = Math.max(0, 10 - (metrics.totalWastedSpend / 2000) * 10) // $2000 = 0 score
    const ctrScore = Math.min(10, metrics.avgCTR * 100) // 10% CTR = 10 score
    const clickShareScore = Math.min(10, metrics.primaryCTAPerformance / 10) // 100% = 10 score
    
    return Number(((wastedSpendScore + ctrScore + clickShareScore) / 3).toFixed(1))
  }

  // Update overall scores
  originalMetrics.overallScore = calculateOverallScore(originalMetrics)
  if (competitorMetrics) {
    competitorMetrics.overallScore = calculateOverallScore(competitorMetrics)
  }

  // Determine winner based on overall score
  const isWinning = competitorMetrics ? originalMetrics.overallScore > competitorMetrics.overallScore : true
  const advantage = competitorMetrics ? Math.abs(originalMetrics.overallScore - competitorMetrics.overallScore) / Math.max(competitorMetrics.overallScore, 0.1) * 100 : 0

  // Generate action items based on CRO analysis friction points
  const getActionItems = () => {
    const items = []
    
    // Use CRO analysis data from original site
    const originalCROData = originalData.croAnalysisResult

    // Priority 1: Extract friction points from CRO analysis (most impactful)
    const frictionSources = [
      originalCROData?.openAIResult?.frictionPoints,
      originalCROData?.openAIResult?.analysis?.frictionPoints,
      originalCROData?.frictionPoints,
      originalCROData?.elements?.highRiskElements,
      originalCROData?.wastedClickAnalysis?.highRiskElements
    ].filter(Boolean)

    let frictionPoints = []
    for (const source of frictionSources) {
      if (source?.length > 0) {
        frictionPoints = source.slice(0, 3)
        break
      }
    }

    if (frictionPoints.length > 0) {
      console.log("🔍 Found friction points for actions:", frictionPoints)
      
      frictionPoints.forEach((friction: any, index: number) => {
        const priorityLevels = ["CRITICAL", "HIGH", "HIGH"]
        const colors = ["red", "orange", "orange"]
        
        // Extract action from friction data (handle OpenAI CRO structure)
        let actionText = friction.problem || friction.issue || friction.description || friction.recommendation || friction.text || "Remove friction point"
        let elementName = friction.element || friction.elementName || ""
        let elementType = friction.type || friction.elementType || ""
        
        console.log("Processing friction:", { element: elementName, type: elementType, problem: actionText })
        
        // Convert to specific actionable text based on the actual friction point
        if (elementName) {
          // Use the specific element name from the friction point
          if (elementName.toLowerCase().includes("background") || elementName.toLowerCase().includes("image")) {
            actionText = "Remove Background Image"
          } else if (elementName.toLowerCase().includes("testimonial") || elementName.toLowerCase().includes("client")) {
            actionText = "Relocate Client Testimonial"
          } else if (elementName.toLowerCase().includes("navigation")) {
            actionText = "Clean Header Navigation"
          } else if (elementType === "Distraction") {
            actionText = `Remove ${elementName.length > 15 ? elementName.substring(0, 12) + "..." : elementName}`
          } else if (elementType === "Friction") {
            actionText = `Fix ${elementName.length > 18 ? elementName.substring(0, 15) + "..." : elementName}`
          } else {
            actionText = `Optimize ${elementName.length > 15 ? elementName.substring(0, 12) + "..." : elementName}`
          }
        } else {
          // Fallback to content-based detection
          if (actionText.toLowerCase().includes("background") || actionText.toLowerCase().includes("map")) {
            actionText = "Remove Background Image"
          } else if (actionText.toLowerCase().includes("testimonial") || actionText.toLowerCase().includes("client")) {
            actionText = "Relocate Client Testimonial"
          } else if (actionText.toLowerCase().includes("multiple") || actionText.toLowerCase().includes("competing")) {
            actionText = "Reduce Multiple CTAs"
          } else if (actionText.toLowerCase().includes("form") || elementType.toLowerCase().includes("form")) {
            actionText = "Simplify Form Fields"
          } else if (actionText.toLowerCase().includes("navigation") || actionText.toLowerCase().includes("header")) {
            actionText = "Clean Header Navigation"
          } else if (elementType === "Distraction") {
            actionText = "Remove Distraction"
          } else if (elementType === "Friction") {
            actionText = "Reduce Friction"
          } else {
            // Use the friction description directly, but keep it concise
            actionText = actionText.length > 22 ? actionText.substring(0, 19) + "..." : actionText
          }
        }
        
        // Extract impact percentage (handle different structures)
        let impact = "+5% conversions"
        if (friction.impact) {
          const impactMatch = friction.impact.toString().match(/(\d+)%/)
          if (impactMatch) {
            impact = `+${impactMatch[1]}% conversions`
          }
        } else if (friction.impactPercentage) {
          impact = `+${friction.impactPercentage}% conversions`
        } else if (friction.wastedClickScore) {
          // Use wasted click score to estimate impact
          const estimatedImpact = Math.round(friction.wastedClickScore * 10)
          impact = `+${estimatedImpact}% efficiency`
        }
        
        items.push({
          priority: priorityLevels[index],
          action: actionText,
          impact: impact,
          color: colors[index]
        })
      })
    }

    // Fallback: Use CRO recommended actions if no friction points
    if (items.length === 0 && originalCROData?.recommendedActions?.phase1?.actions?.length > 0) {
      originalCROData.recommendedActions.phase1.actions.slice(0, 3).forEach((action: string, index: number) => {
        const priorityLevels = ["CRITICAL", "HIGH", "HIGH"]
        const colors = ["red", "orange", "orange"]
        
        items.push({
          priority: priorityLevels[index],
          action: action.length > 25 ? action.substring(0, 22) + "..." : action,
          impact: originalCROData.recommendedActions.phase1.expectedGain || "+5% conversions",
          color: colors[index]
        })
      })
    }

    // Priority 3: Metric-based comparisons if we have competitor data
    if (competitorData && competitorMetrics && items.length < 3) {
      // CTR Performance Comparison
      if (competitorMetrics.avgCTR > originalMetrics.avgCTR) {
        const ctrlDiff = ((competitorMetrics.avgCTR - originalMetrics.avgCTR) / originalMetrics.avgCTR * 100).toFixed(1)
        items.push({
          priority: "CRITICAL",
          action: "Optimize CTA Copy",
          impact: `+${ctrlDiff}% CTR improvement`,
          color: "red"
        })
      }
      
      // Wasted Spend Comparison
      if (originalMetrics.totalWastedSpend > competitorMetrics.totalWastedSpend) {
        const wastedSavings = originalMetrics.totalWastedSpend - competitorMetrics.totalWastedSpend
        items.push({
          priority: "CRITICAL",
          action: "Reduce Wasted Spend",
          impact: `Save $${wastedSavings}/month`,
          color: "red"
        })
      }
      
      // Primary CTA Performance
      if (competitorMetrics.primaryCTAPerformance > originalMetrics.primaryCTAPerformance) {
        const performanceDiff = (competitorMetrics.primaryCTAPerformance - originalMetrics.primaryCTAPerformance).toFixed(1)
        items.push({
          priority: "HIGH",
          action: "Boost Primary CTA",
          impact: `+${performanceDiff}% click share`,
          color: "orange"
        })
      }
    }

    // Enhanced fallback items based on common friction points
    if (items.length < 3) {
      const frictionBasedFallbacks = [
        { priority: "CRITICAL", action: "Remove Multiple CTAs", impact: "+10% conversion focus", color: "red" },
        { priority: "HIGH", action: "Simplify Form Fields", impact: "+15% completion rate", color: "orange" },
        { priority: "HIGH", action: "Remove Visual Clutter", impact: "+8% user clarity", color: "orange" },
        { priority: "HIGH", action: "Add Social Proof", impact: "+8% trust & conversions", color: "orange" },
        { priority: "HIGH", action: "Improve Mobile UX", impact: "+6% mobile conversions", color: "orange" },
        { priority: "HIGH", action: "Optimize Page Speed", impact: "+12% engagement", color: "orange" }
      ]
      
      frictionBasedFallbacks.forEach(item => {
        if (items.length < 3 && !items.find(existingItem => existingItem.action === item.action)) {
          items.push(item)
        }
      })
    }

    // Final safety net - ensure we always have exactly 3 items
    while (items.length < 3) {
      items.push({ 
        priority: "HIGH", 
        action: "Reduce Friction Points", 
        impact: "+5% conversions", 
        color: "orange" 
      })
    }

    return items.slice(0, 3)
  }

  const actionItems = getActionItems()
  return (
    <div className="min-h-screen bg-white p-2 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-2 sm:space-y-4">
        
        {/* Prominent Header with URL Comparison */}
        <div className="py-2 sm:py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 space-y-2 sm:space-y-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <Trophy className={`w-4 h-4 sm:w-6 sm:h-6 ${isWinning ? 'text-green-600' : 'text-red-600'}`} />
              <span className="font-bold text-lg sm:text-2xl">{isWinning ? 'YOU WIN' : 'THEY WIN'}</span>
              <Badge className={`${isWinning ? 'bg-green-600' : 'bg-red-600'} text-xs sm:text-sm`}>
                {isWinning ? '+' : '-'}{Math.round(advantage)}% {isWinning ? 'Advantage' : 'Behind'}
              </Badge>
            </div>
            <div className="text-xs text-gray-500">Analysis: Just now</div>
          </div>
          
          {/* URL vs URL - Mobile Responsive */}
          <div className="bg-gray-50 rounded-lg p-2 sm:p-3 border">
            <div className="text-center">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4">
                <div className="flex-1 text-center">
                  <div className="text-xs font-medium text-gray-500 mb-1">YOUR SITE</div>
                  <div className="font-bold text-sm sm:text-lg text-blue-600 truncate px-1">
                    {shortenUrl(originalData.url)}
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-gray-400">VS</div>
                <div className="flex-1 text-center">
                  <div className="text-xs font-medium text-gray-500 mb-1">COMPETITOR</div>
                  {competitorData && !isEditing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="font-bold text-sm sm:text-lg text-red-600 truncate px-1">
                        {shortenUrl(competitorData.metadata?.originalUrl || competitorData.domain || 'competitor.com')}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true)
                          setCompetitorUrl(competitorData.url || '')
                        }}
                        className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Edit
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center justify-center">
                      <Input
                        value={competitorUrl}
                        onChange={(e) => setCompetitorUrl(e.target.value)}
                        placeholder="Enter competitor URL..."
                        className="h-8 text-xs"
                        onKeyPress={(e) => e.key === 'Enter' && handleCompetitorSubmit()}
                      />
                      <Button 
                        onClick={handleCompetitorSubmit}
                        disabled={!competitorUrl.trim() || isSubmitting}
                        size="sm"
                        className="h-8 px-3 text-xs"
                      >
                        {isSubmitting ? 'Analyzing...' : (competitorData ? 'Reanalyze' : 'Compare')}
                      </Button>
                      {competitorData && isEditing && (
                        <Button 
                          variant="ghost"
                          onClick={() => setIsEditing(false)}
                          size="sm"
                          className="h-8 px-3 text-xs"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Side-by-Side Comparison - Mobile Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
          
          {/* Your Site */}
          <Card className={`border-4 ${isWinning ? 'border-green-400 bg-green-50/30' : 'border-red-400 bg-red-50/30'}`}>
            <CardContent className="p-2 sm:p-4">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                  <span className="font-bold text-xs sm:text-sm">YOUR SITE</span>
                </div>
                <Badge className={isWinning ? "bg-green-600 text-xs" : "bg-red-600 text-xs"}>
                  {isWinning ? "LEADING" : "TRAILING"}
                </Badge>
              </div>
              
              <div className="aspect-video bg-gray-100 rounded mb-2 sm:mb-3 relative overflow-hidden">
                {originalData.captureResult?.screenshot ? (
                  <img 
                    src={originalData.captureResult.screenshot}
                    alt="Your website"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs sm:text-sm">
                    Your Website Preview
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 text-white text-xs">
                    <div className="font-bold text-sm sm:text-lg">{originalMetrics?.currentCTR && !isNaN(originalMetrics.currentCTR) ? (originalMetrics.currentCTR * 100).toFixed(1) : '0.0'}%</div>
                    <div className="opacity-90 text-xs">Final Conversion Rate</div>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="space-y-1 sm:space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-xs sm:text-sm">Current CTR</span>
                  <div className="flex items-center gap-1">
                    <Progress value={originalMetrics.avgCTR * 1000} className="w-8 sm:w-12 h-1" />
                    <span className={`font-bold text-xs sm:text-sm ${originalMetrics.avgCTR > 0.05 ? 'text-green-600' : originalMetrics.avgCTR > 0.03 ? 'text-orange-600' : 'text-red-600'}`}>
                      {(originalMetrics.avgCTR * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-xs sm:text-sm">Projected CTR</span>
                  <div className="flex items-center gap-1">
                    <Progress value={(originalMetrics.avgCTR * 1.475) * 1000} className="w-8 sm:w-12 h-1" />
                    <span className={`font-bold text-xs sm:text-sm ${(originalMetrics.avgCTR * 1.475) > 0.05 ? 'text-green-600' : (originalMetrics.avgCTR * 1.475) > 0.03 ? 'text-orange-600' : 'text-red-600'}`}>
                      {((originalMetrics.avgCTR * 1.475) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Instant Wins */}
              <div className={`mt-2 sm:mt-3 p-1 sm:p-2 rounded text-xs ${isWinning ? 'bg-green-50' : 'bg-orange-50'}`}>
                <div className={`font-bold mb-1 ${isWinning ? 'text-green-800' : 'text-orange-800'}`}>
                  {isWinning ? '🎯 WINNING:' : '⚠️ BEHIND:'}
                </div>
                <div className={isWinning ? 'text-green-700' : 'text-orange-700'}>
                  {(() => {
                    if (!competitorMetrics) return 'Need optimization'
                    const advantages = []
                    if (originalMetrics.primaryCTAPerformance > competitorMetrics.primaryCTAPerformance) advantages.push('CTA Power')
                    if (originalMetrics.trustScore && competitorMetrics.trustScore && originalMetrics.trustScore > competitorMetrics.trustScore) advantages.push('Trust Score')
                    if (originalMetrics.loadSpeed && competitorMetrics.loadSpeed && originalMetrics.loadSpeed > competitorMetrics.loadSpeed) advantages.push('Page Speed')
                    return advantages.length > 0 ? advantages.join(' • ') : 'Need optimization'
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Competitor Site */}
          {competitorData && competitorMetrics ? (
            <Card className={`border-4 ${!isWinning ? 'border-green-400 bg-green-50/30' : 'border-red-400 bg-red-50/30'}`}>
              <CardContent className="p-2 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full"></div>
                    <span className="font-bold text-xs sm:text-sm">COMPETITOR</span>
                  </div>
                  <Badge className={!isWinning ? "bg-green-600 text-xs" : "bg-red-600 text-xs"}>
                    {!isWinning ? "LEADING" : "TRAILING"}
                  </Badge>
                </div>
                
                <div className="aspect-video bg-gray-100 rounded mb-2 sm:mb-3 relative overflow-hidden">
                  <img 
                    src={competitorData.captureResult.screenshot}
                    alt="Competitor website"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                    <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 text-white text-xs">
                      <div className="font-bold text-sm sm:text-lg">{competitorMetrics?.currentCTR && !isNaN(competitorMetrics.currentCTR) ? (competitorMetrics.currentCTR * 100).toFixed(1) : '0.0'}%</div>
                      <div className="opacity-90 text-xs">Final Conversion Rate</div>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-xs sm:text-sm">Current CTR</span>
                    <div className="flex items-center gap-1">
                      <Progress value={competitorMetrics.avgCTR * 1000} className="w-8 sm:w-12 h-1" />
                      <span className={`font-bold text-xs sm:text-sm ${competitorMetrics.avgCTR > 0.05 ? 'text-green-600' : competitorMetrics.avgCTR > 0.03 ? 'text-orange-600' : 'text-red-600'}`}>
                        {(competitorMetrics.avgCTR * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-xs sm:text-sm">Projected CTR</span>
                    <div className="flex items-center gap-1">
                      <Progress value={(competitorMetrics.avgCTR * 1.475) * 1000} className="w-8 sm:w-12 h-1" />
                      <span className={`font-bold text-xs sm:text-sm ${(competitorMetrics.avgCTR * 1.475) > 0.05 ? 'text-green-600' : (competitorMetrics.avgCTR * 1.475) > 0.03 ? 'text-orange-600' : 'text-red-600'}`}>
                        {((competitorMetrics.avgCTR * 1.475) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Their Advantages */}
                <div className={`mt-3 p-2 rounded text-xs ${!isWinning ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className={`font-bold mb-1 ${!isWinning ? 'text-green-800' : 'text-red-800'}`}>
                    {!isWinning ? '🎯 WINNING:' : '⚡ THEY WIN:'}
                  </div>
                  <div className={!isWinning ? 'text-green-700' : 'text-red-700'}>
                    {(() => {
                      const advantages = []
                      if (competitorMetrics.primaryCTAPerformance > originalMetrics.primaryCTAPerformance) advantages.push('CTA Power')
                      if (competitorMetrics.trustScore && competitorMetrics.trustScore > originalMetrics.trustScore) advantages.push('Trust Score')
                      if (competitorMetrics.loadSpeed && competitorMetrics.loadSpeed > originalMetrics.loadSpeed) advantages.push('Page Speed')
                      return advantages.length > 0 ? advantages.join(' • ') : 'Overall performance'
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-4 border-gray-300 bg-gray-50/30">
              <CardContent className="p-2 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-gray-500 rounded-full"></div>
                    <span className="font-bold text-xs sm:text-sm">COMPETITOR</span>
                  </div>
                  <Badge className="bg-gray-600 text-xs">PENDING</Badge>
                </div>
                
                <div className="aspect-video bg-gray-100 rounded mb-2 sm:mb-3 relative overflow-hidden flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="text-sm font-medium mb-2">Competitor Preview</div>
                    <div className="text-xs opacity-75">Enter URL above to analyze</div>
                  </div>
                </div>

                {/* Placeholder for empty state */}
                <div className="space-y-1 sm:space-y-2 opacity-50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-xs sm:text-sm">Current CTR</span>
                    <span className="text-xs sm:text-sm text-gray-400">--%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-xs sm:text-sm">Projected CTR</span>
                    <span className="text-xs sm:text-sm text-gray-400">--%</span>
                  </div>
                </div>

                <div className="mt-3 p-2 rounded text-xs bg-gray-100">
                  <div className="text-gray-600 text-center">
                    Enter competitor URL to start analysis
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Items - Mobile Responsive */}
        <Card className="border-2 border-orange-200">
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-3">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600" />
              <span className="font-bold text-xs sm:text-sm">IMMEDIATE ACTIONS</span>
              <Badge className="bg-orange-600 text-xs">3 QUICK WINS</Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {actionItems.map((item, index) => {
                const colorClasses = {
                  red: {
                    bg: 'bg-red-50',
                    border: 'border-red-200',
                    dot: 'bg-red-500',
                    text800: 'text-red-800',
                    text700: 'text-red-700',
                    text600: 'text-red-600'
                  },
                  orange: {
                    bg: 'bg-orange-50',
                    border: 'border-orange-200',
                    dot: 'bg-orange-500',
                    text800: 'text-orange-800',
                    text700: 'text-orange-700',
                    text600: 'text-orange-600'
                  },
                  blue: {
                    bg: 'bg-blue-50',
                    border: 'border-blue-200',
                    dot: 'bg-blue-500',
                    text800: 'text-blue-800',
                    text700: 'text-blue-700',
                    text600: 'text-blue-600'
                  }
                }
                const colors = colorClasses[item.color as keyof typeof colorClasses]
                
                return (
                  <div key={index} className={`p-1 sm:p-2 ${colors.bg} rounded border ${colors.border}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 ${colors.dot} rounded-full`}></div>
                      <span className={`font-bold text-xs ${colors.text800}`}>{item.priority}</span>
                    </div>
                    <div className={`text-xs ${colors.text700} mb-1`}>{item.action}</div>
                    <div className={`text-xs ${colors.text600}`}>{item.impact}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Summary Bar - Mobile Responsive */}
        {competitorMetrics ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 px-2 sm:px-4 bg-gray-100 rounded text-xs space-y-1 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span>Wasted Spend: <span className="font-bold text-red-600">${originalMetrics.totalWastedSpend}</span> vs <span className="font-bold text-green-600">${competitorMetrics.totalWastedSpend}</span></span>
              <span>CTR Diff: <span className={`font-bold ${originalMetrics.avgCTR > competitorMetrics.avgCTR ? 'text-green-600' : 'text-red-600'}`}>
                {originalMetrics.avgCTR > competitorMetrics.avgCTR ? '+' : ''}{((originalMetrics.avgCTR - competitorMetrics.avgCTR) * 100).toFixed(2)}%
              </span></span>
              <span className="hidden sm:inline">Implementation: <span className="font-bold">2-4 weeks</span></span>
            </div>
            <div className="text-gray-500 text-xs">
              Score: {originalMetrics.overallScore} vs {competitorMetrics.overallScore}
            </div>
          </div>
        ) : (
          <div className="py-2 px-2 sm:px-4 bg-gray-100 rounded text-xs text-center text-gray-500">
            Enter competitor URL above to see detailed comparison
          </div>
        )}
      </div>
    </div>
  )
}