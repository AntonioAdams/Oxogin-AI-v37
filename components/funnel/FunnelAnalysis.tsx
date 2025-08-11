'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, TrendingUp, Eye } from 'lucide-react'
import { FunnelView } from './FunnelView'
import type { FunnelAnalysisState, FunnelData } from '@/lib/funnel/types'
import type { CaptureResult } from '@/app/page/types'
import { 
  createInitialFunnelData, 
  analyzeFunnelFromCapture,
  followPrimaryCta,
  extractPrimaryCta,
  getCurrentUserId,
  updateFunnelWithStep2,
  getPredictedCTR,
  getPrimaryCTAPerformance
} from '@/lib/funnel/analysis'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface FunnelAnalysisProps {
  initialUrl?: string
  initialCaptureData?: CaptureResult
  onBack: () => void
}

export function FunnelAnalysis({ initialUrl = "", initialCaptureData, onBack }: FunnelAnalysisProps) {
  const [state, setState] = useState<FunnelAnalysisState>({
    yourSite: createInitialFunnelData(initialUrl),
    competitor: createInitialFunnelData()
  })
  
  const [competitorUrl, setCompetitorUrl] = useState("")
  const [exploreModal, setExploreModal] = useState<{
    isOpen: boolean
    data: FunnelData | null
    title: string
  }>({
    isOpen: false,
    data: null,
    title: ""
  })
  
  // Load initial analysis for your site
  useEffect(() => {
    if (initialUrl) {
      if (initialCaptureData) {
        // Use existing capture data
        loadYourSiteFromCapture(initialUrl, initialCaptureData)
      } else {
        // Make new API call
        loadYourSiteAnalysis(initialUrl)
      }
    }
  }, [initialUrl, initialCaptureData])
  
  const loadYourSiteFromCapture = useCallback((url: string, captureData: CaptureResult) => {
    try {
      // Use actual performance data from capture (same as competitor analysis)
      const analysis = analyzeFunnelFromCapture(captureData, url, 1000)
      
      console.log("🔧 Funnel analysis from capture data:", {
        url,
        type: analysis.type,
        primaryCTA: analysis.step1?.ctaText,
        actualCTR: analysis.p1,
        hasPerformanceData: !!captureData.primaryCTAPrediction
      })
      
      setState(prev => ({
        ...prev,
        yourSite: analysis
      }))
    } catch (error) {
      console.error("❌ Error analyzing funnel from capture:", error)
      setState(prev => ({
        ...prev,
        yourSite: {
          ...prev.yourSite,
          isLoading: false,
          error: error instanceof Error ? error.message : "Analysis failed"
        }
      }))
    }
  }, [])
  
  const loadYourSiteAnalysis = useCallback(async (url: string) => {
    setState(prev => ({
      ...prev,
      yourSite: {
        ...prev.yourSite,
        url,
        isLoading: true,
        error: null
      }
    }))
    
    try {
      // Use the same API endpoint as competitor intel
      const response = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url, 
          isMobile: false,
          userId: getCurrentUserId()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to capture website")
      }

      const captureResult = await response.json()
      const analysis = analyzeFunnelFromCapture(captureResult, url, 1000)
      
      console.log("🔧 Funnel analysis from API capture:", {
        url,
        type: analysis.type,
        primaryCTA: analysis.step1?.ctaText,
        actualCTR: analysis.p1,
        hasPerformanceData: !!captureResult.primaryCTAPrediction
      })
      
      setState(prev => ({
        ...prev,
        yourSite: {
          ...analysis,
          isLoading: false
        }
      }))
    } catch (error) {
      let errorMessage = "Analysis failed"
      if (error instanceof Error) {
        if (error.message.includes("Browserless API key")) {
          errorMessage = "Browserless API key is required"
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out - please try again"
        } else if (error.message.includes("Network")) {
          errorMessage = "Network error - check your connection"
        } else {
          errorMessage = error.message
        }
      }
      
      setState(prev => ({
        ...prev,
        yourSite: {
          ...prev.yourSite,
          isLoading: false,
          error: errorMessage
        }
      }))
    }
  }, [])
  
  const runYourSiteFunnelAnalysis = useCallback(async () => {
    const currentData = state.yourSite
    
    if (!currentData.step1 || currentData.type !== 'non-form') {
      return
    }
    
    setState(prev => ({
      ...prev,
      yourSite: {
        ...prev.yourSite,
        isStep2Loading: true
      }
    }))
    
    try {
              const nextStep = followPrimaryCta(currentData.step1.captureResult, currentData.url)
        
        if (nextStep && !nextStep.reason.includes("manual entry required") && !nextStep.reason.includes("button without target URL")) {
        // Use API endpoint for step 2 capture
        const response = await fetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            url: nextStep.nextUrl, 
            isMobile: false,
            userId: getCurrentUserId()
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to capture step 2 website")
        }

        const step2Capture = await response.json()
        const step2Cta = extractPrimaryCta(step2Capture)
        
        if (step2Cta) {
          // Use actual performance data for step 2
          const step2Performance = getPrimaryCTAPerformance(step2Capture)
          
          const step2 = {
            url: nextStep.nextUrl,
            captureResult: step2Capture,
            ctaText: step2Performance.text,
            ctaType: step2Cta.elementType,
            predictedCTR: step2Performance.ctr, // Use actual CTR from step 2
            predictedClicks: Math.round((prev.yourSite.step1?.predictedClicks || 50) * (step2Performance.ctr / 100))
          }
          
          console.log("🔧 Your site step 2 analysis:", {
            url: nextStep.nextUrl,
            primaryCTA: step2Performance.text,
            actualCTR: step2Performance.ctr
          })
          
          // Update with step 2 data and recalculated metrics
          setState(prev => {
            const updatedFunnelData = updateFunnelWithStep2(prev.yourSite, step2)
            return {
              ...prev,
              yourSite: {
                ...updatedFunnelData,
                isStep2Loading: false
              }
            }
          })
        }
      } else {
        setState(prev => ({
          ...prev,
          yourSite: {
            ...prev.yourSite,
            isStep2Loading: false,
            error: "Could not follow primary CTA link automatically"
          }
        }))
      }
    } catch (error) {
      let errorMessage = "Step 2 analysis failed"
      if (error instanceof Error) {
        if (error.message.includes("Browserless API key")) {
          errorMessage = "Browserless API key is required"
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out - please try again"
        } else {
          errorMessage = error.message
        }
      }
      
      setState(prev => ({
        ...prev,
        yourSite: {
          ...prev.yourSite,
          isStep2Loading: false,
          error: errorMessage
        }
      }))
    }
  }, [state.yourSite])
  
  const loadCompetitorAnalysis = useCallback(async () => {
    if (!competitorUrl.trim()) return
    
    setState(prev => ({
      ...prev,
      competitor: {
        ...prev.competitor,
        url: competitorUrl,
        isLoading: true,
        error: null
      }
    }))
    
    try {
      // Step 1: Capture competitor website
      const response = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: competitorUrl, 
          isMobile: false,
          userId: getCurrentUserId()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to capture competitor website")
      }

      const captureResult = await response.json()
      const analysis = analyzeFunnelFromCapture(captureResult, competitorUrl, 1000)
      
      console.log("🔧 Competitor funnel analysis:", {
        url: competitorUrl,
        type: analysis.type,
        primaryCTA: analysis.step1?.ctaText,
        actualCTR: analysis.p1,
        hasPerformanceData: !!captureResult.primaryCTAPrediction
      })
      
      // Update with initial analysis
      setState(prev => ({
        ...prev,
        competitor: {
          ...analysis,
          isLoading: false
        }
      }))
      
      // If it's non-form, automatically run step 2
      if (analysis.type === 'non-form' && analysis.step1) {
        const nextStep = followPrimaryCta(captureResult, competitorUrl)
        
        if (nextStep && !nextStep.reason.includes("manual entry required") && !nextStep.reason.includes("button without target URL")) {
          // Run step 2 capture
          const step2Response = await fetch("/api/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              url: nextStep.nextUrl, 
              isMobile: false,
              userId: getCurrentUserId()
            })
          })

          if (step2Response.ok) {
            const step2Capture = await step2Response.json()
            const step2Cta = extractPrimaryCta(step2Capture)
            
            if (step2Cta) {
              // Use actual performance data for step 2
              const step2Performance = getPrimaryCTAPerformance(step2Capture)
              
              const step2 = {
                url: nextStep.nextUrl,
                captureResult: step2Capture,
                ctaText: step2Performance.text,
                ctaType: step2Cta.elementType,
                predictedCTR: step2Performance.ctr, // Use actual CTR from step 2
                predictedClicks: Math.round((prev.competitor.step1?.predictedClicks || 50) * (step2Performance.ctr / 100))
              }
              
              console.log("🔧 Competitor step 2 analysis:", {
                url: nextStep.nextUrl,
                primaryCTA: step2Performance.text,
                actualCTR: step2Performance.ctr
              })
              
              // Update with step 2 data and recalculated metrics
              setState(prev => {
                const updatedFunnelData = updateFunnelWithStep2(prev.competitor, step2)
                return {
                  ...prev,
                  competitor: updatedFunnelData
                }
              })
            }
          }
        }
      }
      
    } catch (error) {
      let errorMessage = "Competitor analysis failed"
      if (error instanceof Error) {
        if (error.message.includes("Browserless API key")) {
          errorMessage = "Browserless API key is required"
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out - please try again"
        } else if (error.message.includes("Network")) {
          errorMessage = "Network error - check your connection"
        } else {
          errorMessage = error.message
        }
      }
      
      setState(prev => ({
        ...prev,
        competitor: {
          ...prev.competitor,
          isLoading: false,
          error: errorMessage
        }
      }))
    }
  }, [competitorUrl])
  
  const openExploreModal = useCallback((data: FunnelData, title: string) => {
    setExploreModal({
      isOpen: true,
      data,
      title
    })
  }, [])
  
  const closeExploreModal = useCallback(() => {
    setExploreModal({
      isOpen: false,
      data: null,
      title: ""
    })
  }, [])
  
  return (
    <div id="funnel-analysis-content" className="p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="p-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-lg">Funnel Analysis</span>
          </div>
          <div className="text-xs text-gray-500">
            Compare conversion funnels • Identify optimization opportunities
          </div>
        </div>

        {/* URL Inputs Header */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              YOUR SITE
            </label>
            <div className="text-sm text-blue-600 font-medium">
              {state.yourSite.url || "No URL loaded"}
            </div>
          </div>
          <div className="text-2xl font-light text-gray-400">VS</div>
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Enter competitor URL..."
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={loadCompetitorAnalysis}
              disabled={!competitorUrl.trim() || state.competitor.isLoading}
            >
              {state.competitor.isLoading ? "Analyzing..." : "Compare"}
            </Button>
          </div>
        </div>
        
        {/* Side-by-Side Analysis Cards */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Your Site */}
          <Card className="border-2 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-bold text-sm">YOUR SITE</span>
                </div>
                <Badge className="bg-green-600 text-xs">
                  {state.yourSite.type === 'form' ? 'FORM' : 
                   state.yourSite.type === 'non-form' ? 'TWO-STEP' : 'ANALYZING'}
                </Badge>
              </div>
              
              <div className="aspect-video bg-gray-100 rounded mb-3 relative overflow-hidden">
                {state.yourSite.step1?.captureResult?.screenshot ? (
                  <img 
                    src={state.yourSite.step1.captureResult.screenshot.startsWith('data:') 
                      ? state.yourSite.step1.captureResult.screenshot 
                      : `data:image/png;base64,${state.yourSite.step1.captureResult.screenshot}`} 
                    alt="Your website"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                    <span className="text-green-700 font-semibold">
                      {state.yourSite.isLoading ? "Analyzing..." : "Your Site"}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                  <div className="absolute bottom-2 left-2 text-white text-xs">
                    <div className="font-bold">
                      Conversion: {(state.yourSite.pTotal * 100).toFixed(1)}%
                    </div>
                    <div className="opacity-90">
                      {state.yourSite.step1?.ctaText || "No CTA detected"}
                    </div>
                  </div>
                </div>
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
                <Badge variant="outline" className="text-red-600 border-red-600 text-xs">
                  {state.competitor.url ? 
                    (state.competitor.type === 'form' ? 'FORM' : 
                     state.competitor.type === 'non-form' ? 'TWO-STEP' : 'ANALYZING') 
                    : 'PENDING'}
                </Badge>
              </div>
              
              <div className="aspect-video bg-gray-100 rounded mb-3 relative overflow-hidden">
                {state.competitor.step1?.captureResult?.screenshot ? (
                  <img 
                    src={state.competitor.step1.captureResult.screenshot.startsWith('data:') 
                      ? state.competitor.step1.captureResult.screenshot 
                      : `data:image/png;base64,${state.competitor.step1.captureResult.screenshot}`} 
                    alt="Competitor website"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                    <span className="text-red-700 font-semibold">
                      {state.competitor.isLoading ? "Analyzing..." : "Enter URL to Compare"}
                    </span>
                  </div>
                )}
                {state.competitor.step1 && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
                    <div className="absolute bottom-2 left-2 text-white text-xs">
                      <div className="font-bold">
                        Conversion: {(state.competitor.pTotal * 100).toFixed(1)}%
                      </div>
                      <div className="opacity-90">
                        {state.competitor.step1?.ctaText || "No CTA detected"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Funnel Views */}
        <div className="grid grid-cols-2 gap-4">
          <FunnelView
            data={state.yourSite}
            title="Your Site Funnel"
            onExplore={() => openExploreModal(state.yourSite, "Your Site")}
            onRunFunnelAnalysis={runYourSiteFunnelAnalysis}
            showFunnelButton={true}
          />
          
          <FunnelView
            data={state.competitor}
            title="Competitor Funnel"
            onExplore={() => openExploreModal(state.competitor, "Competitor")}
            showFunnelButton={false}
          />
        </div>
      </div>

      {/* Explore Modal */}
      <Dialog open={exploreModal.isOpen} onOpenChange={closeExploreModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{exploreModal.title} - Funnel Details</DialogTitle>
          </DialogHeader>
          
          {exploreModal.data && (
            <div className="space-y-4">
              <Tabs defaultValue="step1">
                <TabsList>
                  <TabsTrigger value="step1">Step 1</TabsTrigger>
                  {exploreModal.data.step2 && (
                    <TabsTrigger value="step2">Step 2</TabsTrigger>
                  )}
                  <TabsTrigger value="metrics">Metrics</TabsTrigger>
                </TabsList>
                
                <TabsContent value="step1" className="space-y-4">
                  <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                    {exploreModal.data.step1?.captureResult?.screenshot && (
                      <img 
                        src={exploreModal.data.step1.captureResult.screenshot.startsWith('data:') 
                          ? exploreModal.data.step1.captureResult.screenshot 
                          : `data:image/png;base64,${exploreModal.data.step1.captureResult.screenshot}`} 
                        alt="Step 1 screenshot"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>URL:</strong> {exploreModal.data.step1?.url}
                    </div>
                    <div>
                      <strong>CTA Text:</strong> {exploreModal.data.step1?.ctaText}
                    </div>
                    <div>
                      <strong>CTA Type:</strong> {exploreModal.data.step1?.ctaType}
                    </div>
                    <div>
                      <strong>Predicted CTR:</strong> {exploreModal.data.step1?.predictedCTR.toFixed(1)}%
                    </div>
                  </div>
                </TabsContent>
                
                {exploreModal.data.step2 && (
                  <TabsContent value="step2" className="space-y-4">
                    <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                      {exploreModal.data.step2?.captureResult?.screenshot && (
                        <img 
                          src={exploreModal.data.step2.captureResult.screenshot.startsWith('data:') 
                            ? exploreModal.data.step2.captureResult.screenshot 
                            : `data:image/png;base64,${exploreModal.data.step2.captureResult.screenshot}`} 
                          alt="Step 2 screenshot"
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>URL:</strong> {exploreModal.data.step2?.url}
                      </div>
                      <div>
                        <strong>CTA Text:</strong> {exploreModal.data.step2?.ctaText}
                      </div>
                      <div>
                        <strong>CTA Type:</strong> {exploreModal.data.step2?.ctaType}
                      </div>
                      <div>
                        <strong>Predicted CTR:</strong> {exploreModal.data.step2?.predictedCTR.toFixed(1)}%
                      </div>
                    </div>
                  </TabsContent>
                )}
                
                <TabsContent value="metrics" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">Funnel Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Initial Visitors:</span>
                            <span className="font-mono">{exploreModal.data.n1.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Step 1 CTR:</span>
                            <span className="font-mono">{(exploreModal.data.p1 * 100).toFixed(1)}%</span>
                          </div>
                          {exploreModal.data.step2 && (
                            <>
                              <div className="flex justify-between">
                                <span>Step 1 Clicks:</span>
                                <span className="font-mono">{exploreModal.data.n2.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Step 2 CTR:</span>
                                <span className="font-mono">{(exploreModal.data.p2 * 100).toFixed(1)}%</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between font-semibold">
                            <span>Final Conversions:</span>
                            <span className="font-mono">{exploreModal.data.nConv.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-green-600">
                            <span>Overall Conversion Rate:</span>
                            <span className="font-mono">{(exploreModal.data.pTotal * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">Funnel Type</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Type:</span>
                            <span className="font-mono capitalize">{exploreModal.data.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Steps:</span>
                            <span className="font-mono">
                              {exploreModal.data.type === 'form' ? '1 (Form)' : 
                               exploreModal.data.step2 ? '2 (Multi-step)' : '1 (Single)'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
