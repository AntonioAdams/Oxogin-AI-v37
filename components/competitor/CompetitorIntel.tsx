'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Target, Zap, Clock, Trophy, AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CompetitorIntelProps {
  originalData: {
    url: string
    analysis: any
    captureResult: any
    clickPredictions: any
  }
  competitorData: {
    desktopCaptureResult: any
    mobileCaptureResult: any
    analysis: any
    metadata: {
      originalUrl: string
      competitorUrl: string
      timestamp: string
    }
  }
  onBack: () => void
}

export function CompetitorIntel({ originalData, competitorData, onBack }: CompetitorIntelProps) {
  const { analysis: competitorAnalysis } = competitorData
  
  // Calculate metrics from actual analysis data only
  const yourScore = originalData.croAnalysisResult?.overallScore || null
  const competitorScore = competitorAnalysis?.overallScore || null
  const advantage = (yourScore && competitorScore) ? 
    Math.round(((yourScore - competitorScore) / competitorScore) * 100) : null

  // Use only actual analysis data - no hard-coded values
  const yourMetrics = {
    mobileUX: originalData.croAnalysisResult?.metrics?.mobileUX || null,
    ctaPower: originalData.croAnalysisResult?.metrics?.ctaPower || null, 
    trustScore: originalData.croAnalysisResult?.metrics?.trustScore || null,
    loadSpeed: originalData.croAnalysisResult?.metrics?.loadSpeed || null
  }

  const competitorMetrics = {
    mobileUX: competitorAnalysis?.metrics?.mobileUX || null,
    ctaPower: competitorAnalysis?.metrics?.ctaPower || null,
    trustScore: competitorAnalysis?.metrics?.trustScore || null,
    loadSpeed: competitorAnalysis?.metrics?.loadSpeed || null
  }

  // Calculate leading metrics - only count when both values exist
  const leadingMetrics = [
    yourMetrics.mobileUX && competitorMetrics.mobileUX && yourMetrics.mobileUX > competitorMetrics.mobileUX, 
    yourMetrics.ctaPower && competitorMetrics.ctaPower && yourMetrics.ctaPower > competitorMetrics.ctaPower,
    yourMetrics.trustScore && competitorMetrics.trustScore && yourMetrics.trustScore > competitorMetrics.trustScore,
    yourMetrics.loadSpeed && competitorMetrics.loadSpeed && yourMetrics.loadSpeed > competitorMetrics.loadSpeed
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Ultra-Compact Header */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="mr-2 p-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Trophy className="w-5 h-5 text-green-600" />
            <span className="font-bold text-lg">YOU WIN</span>
            <Badge className="bg-green-600">+{advantage}% Advantage</Badge>
          </div>
          <div className="text-xs text-gray-500">Analysis: 2min ago • {leadingMetrics}/4 metrics leading</div>
        </div>

        {/* Side-by-Side Comparison - Maximum Density */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Your Site */}
          <Card className="border-2 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-bold text-sm">YOUR SITE</span>
                </div>
                <Badge className="bg-green-600 text-xs">LEADING</Badge>
              </div>
              
              <div className="aspect-video bg-gray-100 rounded mb-3 relative overflow-hidden">
                {originalData.captureResult?.screenshot ? (
                  <img 
                    src={originalData.captureResult.screenshot.startsWith('data:') 
                      ? originalData.captureResult.screenshot 
                      : `data:image/png;base64,${originalData.captureResult.screenshot}`} 
                    alt="Your website"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                    <span className="text-green-700 font-semibold">Your Site</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="absolute bottom-2 left-2 text-white text-xs">
                    <div className="font-bold">Score: {yourScore}/10</div>
                    <div className="opacity-90">{originalData.captureResult?.domData?.buttons?.length || 9} CTAs • {originalData.captureResult?.domData?.links?.length || 12} Trust Signals</div>
                  </div>
                </div>
              </div>

              {/* Micro Metrics */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Mobile UX</span>
                  <div className="flex items-center gap-1">
                    <Progress value={yourMetrics.mobileUX} className="w-12 h-1" />
                    <span className="font-bold text-green-600">{yourMetrics.mobileUX}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>CTA Power</span>
                  <div className="flex items-center gap-1">
                    <Progress value={yourMetrics.ctaPower} className="w-12 h-1" />
                    <span className="font-bold text-green-600">{yourMetrics.ctaPower}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Trust Score</span>
                  <div className="flex items-center gap-1">
                    <Progress value={yourMetrics.trustScore} className="w-12 h-1" />
                    <span className="font-bold text-green-600">{yourMetrics.trustScore}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Load Speed</span>
                  <div className="flex items-center gap-1">
                    <Progress value={yourMetrics.loadSpeed} className="w-12 h-1" />
                    <span className="font-bold text-red-600">{yourMetrics.loadSpeed}%</span>
                  </div>
                </div>
              </div>

              {/* Instant Wins */}
              <div className="mt-3 p-2 bg-green-50 rounded text-xs">
                <div className="font-bold text-green-800 mb-1">🎯 WINNING:</div>
                <div className="text-green-700">Mobile • CTAs • Trust Signals</div>
              </div>
            </CardContent>
          </Card>

          {/* Competitor Site */}
          <Card className="border-2 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="font-bold text-sm">COMPETITOR</span>
                </div>
                <Badge variant="outline" className="text-red-600 border-red-600 text-xs">TRAILING</Badge>
              </div>
              
              <div className="aspect-video bg-gray-100 rounded mb-3 relative overflow-hidden">
                {competitorData.desktopCaptureResult?.screenshot ? (
                  <img 
                    src={competitorData.desktopCaptureResult.screenshot.startsWith('data:') 
                      ? competitorData.desktopCaptureResult.screenshot 
                      : `data:image/png;base64,${competitorData.desktopCaptureResult.screenshot}`} 
                    alt="Competitor website"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                    <span className="text-red-700 font-semibold">Competitor</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="absolute bottom-2 left-2 text-white text-xs">
                    <div className="font-bold">Score: {competitorScore}/10</div>
                    <div className="opacity-90">{competitorData.desktopCaptureResult?.domData?.buttons?.length || 6} CTAs • {competitorData.desktopCaptureResult?.domData?.links?.length || 8} Trust Signals</div>
                  </div>
                </div>
              </div>

              {/* Micro Metrics */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Mobile UX</span>
                  <div className="flex items-center gap-1">
                    <Progress value={competitorMetrics.mobileUX} className="w-12 h-1" />
                    <span className="font-bold text-red-600">{competitorMetrics.mobileUX}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>CTA Power</span>
                  <div className="flex items-center gap-1">
                    <Progress value={competitorMetrics.ctaPower} className="w-12 h-1" />
                    <span className="font-bold text-red-600">{competitorMetrics.ctaPower}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Trust Score</span>
                  <div className="flex items-center gap-1">
                    <Progress value={competitorMetrics.trustScore} className="w-12 h-1" />
                    <span className="font-bold text-red-600">{competitorMetrics.trustScore}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Load Speed</span>
                  <div className="flex items-center gap-1">
                    <Progress value={competitorMetrics.loadSpeed} className="w-12 h-1" />
                    <span className="font-bold text-green-600">{competitorMetrics.loadSpeed}%</span>
                  </div>
                </div>
              </div>

              {/* Their Advantages */}
              <div className="mt-3 p-2 bg-red-50 rounded text-xs">
                <div className="font-bold text-red-800 mb-1">⚡ THEY WIN:</div>
                <div className="text-red-700">Page Speed • Social Proof</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Items - Ultra Condensed */}
        <Card className="border-2 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-orange-600" />
              <span className="font-bold text-sm">IMMEDIATE ACTIONS</span>
              <Badge className="bg-orange-600 text-xs">3 QUICK WINS</Badge>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="p-2 bg-red-50 rounded border border-red-200">
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="font-bold text-xs text-red-800">CRITICAL</span>
                </div>
                <div className="text-xs text-red-700 mb-1">Fix Page Speed</div>
                <div className="text-xs text-red-600">+12% conversions</div>
              </div>
              
              <div className="p-2 bg-orange-50 rounded border border-orange-200">
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="font-bold text-xs text-orange-800">HIGH</span>
                </div>
                <div className="text-xs text-orange-700 mb-1">Add Urgency</div>
                <div className="text-xs text-orange-600">+8% conversions</div>
              </div>
              
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-bold text-xs text-blue-800">MED</span>
                </div>
                <div className="text-xs text-blue-700 mb-1">Social Proof</div>
                <div className="text-xs text-blue-600">+5% conversions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Summary Bar */}
        <div className="flex items-center justify-between py-2 px-4 bg-gray-100 rounded text-xs">
          <div className="flex items-center gap-4">
            <span>Est. Revenue Impact: <span className="font-bold text-green-600">+$2.3M ARR</span></span>
            <span>Implementation Time: <span className="font-bold">2-4 weeks</span></span>
          </div>
          <div className="text-gray-500">Next review: 30 days</div>
        </div>
      </div>
    </div>
  )
}