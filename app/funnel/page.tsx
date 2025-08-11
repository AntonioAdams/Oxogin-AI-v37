'use client'

import { useState, useEffect } from 'react'
import { FunnelAnalysis } from '@/components/funnel/FunnelAnalysis'
import { FunnelIntel } from '@/components/funnel/FunnelIntel'
import { CaptureDisplay } from '@/app/page/components/CaptureDisplay'
import { EnhancedLoadingScreen } from '@/components/ui/enhanced-loading-screen'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface FunnelData {
  url: string
  domain: string
  captureResult?: any
  clickPredictions?: any[]
  primaryCTAPrediction?: any
  croAnalysisResult?: any
  metadata?: {
    originalUrl: string
    funnelUrl: string
    timestamp: string
  }
}

export default function FunnelPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStage, setLoadingStage] = useState("")
  const [captureResult, setCaptureResult] = useState<any>(null)
  const [clickPredictions, setClickPredictions] = useState<any[]>([])
  const [primaryCTAPrediction, setPrimaryCTAPrediction] = useState<any>(null)
  const [croAnalysisResult, setCroAnalysisResult] = useState<any>(null)
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null)
  const [isFunnelAnalyzing, setIsFunnelAnalyzing] = useState(false)
  const [showIntelView, setShowIntelView] = useState(false)

  // Simulate loading phases for funnel analysis
  const startFunnelAnalysis = async (targetUrl: string) => {
    setIsFunnelAnalyzing(true)
    setLoadingProgress(0)
    setLoadingStage("Initializing funnel analysis...")

    // Simulate analysis phases
    const phases = [
      { progress: 20, stage: "Capturing funnel page..." },
      { progress: 40, stage: "Analyzing funnel structure..." },
      { progress: 60, stage: "Evaluating conversion elements..." },
      { progress: 80, stage: "Processing funnel flow..." },
      { progress: 90, stage: "Generating insights..." },
      { progress: 100, stage: "Analysis complete!" }
    ]

    for (const phase of phases) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setLoadingProgress(phase.progress)
      setLoadingStage(phase.stage)
    }

    // Mock funnel data - in real implementation, this would come from your API
    const mockFunnelData: FunnelData = {
      url: targetUrl,
      domain: new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`).hostname,
      captureResult: {
        screenshot: "/api/placeholder/800/600", // Placeholder image
        domData: {
          buttons: Array.from({ length: 5 }, (_, i) => ({ id: i, text: `CTA ${i + 1}` })),
          links: Array.from({ length: 6 }, (_, i) => ({ id: i, text: `Link ${i + 1}` }))
        }
      },
      clickPredictions: [
        { elementId: 1, estimatedClicks: 150, ctr: 0.08, wastedSpend: 200, wastedClicks: 45 },
        { elementId: 2, estimatedClicks: 120, ctr: 0.06, wastedSpend: 180, wastedClicks: 38 }
      ],
      primaryCTAPrediction: {
        ctr: 0.075,
        clickShare: 65,
        wastedSpend: 150
      },
      croAnalysisResult: {
        overallScore: 7.8,
        metrics: {
          conversionRate: 72,
          funnelFlow: 79,
          trustElements: 68,
          loadSpeed: 87
        }
      },
      metadata: {
        originalUrl: url,
        funnelUrl: targetUrl,
        timestamp: new Date().toISOString()
      }
    }

    setFunnelData(mockFunnelData)
    setIsFunnelAnalyzing(false)
  }

  const handleUrlSubmit = async () => {
    if (!url.trim()) return
    
    setIsCapturing(true)
    setLoadingProgress(0)
    setLoadingStage("Initializing analysis...")

    // Simulate main page analysis phases
    const phases = [
      { progress: 25, stage: "Capturing website..." },
      { progress: 50, stage: "Analyzing page structure..." },
      { progress: 75, stage: "Processing click predictions..." },
      { progress: 90, stage: "Running CRO analysis..." },
      { progress: 100, stage: "Analysis complete!" }
    ]

    for (const phase of phases) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setLoadingProgress(phase.progress)
      setLoadingStage(phase.stage)
    }

    // Mock data for main analysis
    const mockCaptureResult = {
      screenshot: "/api/placeholder/800/600", // Placeholder image
      domData: {
        buttons: Array.from({ length: 7 }, (_, i) => ({ id: i, text: `Button ${i + 1}` })),
        links: Array.from({ length: 9 }, (_, i) => ({ id: i, text: `Link ${i + 1}` }))
      }
    }

    const mockClickPredictions = [
      { elementId: 1, estimatedClicks: 200, ctr: 0.09, wastedSpend: 250, wastedClicks: 50 },
      { elementId: 2, estimatedClicks: 180, ctr: 0.07, wastedSpend: 220, wastedClicks: 42 }
    ]

    const mockPrimaryCTA = {
      ctr: 0.085,
      clickShare: 70,
      wastedSpend: 180
    }

    const mockCROResult = {
      overallScore: 8.2,
      frictionPoints: [
        { element: "Background Image", type: "Distraction", impact: "12%" },
        { element: "Multiple CTAs", type: "Friction", impact: "8%" }
      ]
    }

    setCaptureResult(mockCaptureResult)
    setClickPredictions(mockClickPredictions)
    setPrimaryCTAPrediction(mockPrimaryCTA)
    setCroAnalysisResult(mockCROResult)
    setIsCapturing(false)
  }

  const originalData = {
    url,
    captureResult,
    clickPredictions,
    primaryCTAPrediction,
    croAnalysisResult
  }

  if (showIntelView && funnelData) {
    return (
      <FunnelIntel
        originalData={originalData}
        funnelData={{
          desktopCaptureResult: funnelData.captureResult,
          mobileCaptureResult: null,
          analysis: funnelData.croAnalysisResult,
          metadata: funnelData.metadata!
        }}
        onBack={() => setShowIntelView(false)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()} className="p-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Funnel Analysis</h1>
                <p className="text-sm text-gray-600">Optimize your conversion funnel</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {!captureResult ? (
          // Initial URL Input
          <div className="max-w-2xl mx-auto mt-20">
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Target className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Analyze Your Funnel</h2>
                <p className="text-gray-600 mb-6">
                  Enter your website URL to start analyzing your conversion funnel performance
                </p>
                <div className="flex gap-3 max-w-md mx-auto">
                  <Input
                    type="url"
                    placeholder="https://your-website.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleUrlSubmit()}
                    disabled={isCapturing}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleUrlSubmit}
                    disabled={!url.trim() || isCapturing}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isCapturing ? 'Analyzing...' : 'Analyze'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : isCapturing ? (
          // Loading Screen
          <EnhancedLoadingScreen
            loadingProgress={loadingProgress}
            loadingStage={loadingStage}
            completedSteps={{
              desktopCapture: loadingProgress > 25,
              desktopAnalysis: loadingProgress > 50,
              desktopOpenAI: loadingProgress > 75,
              mobileCapture: false,
              mobileAnalysis: false,
              mobileOpenAI: false,
              finalizing: loadingProgress > 90,
            }}
            url={url}
            desktopCaptureResult={null}
            mobileCaptureResult={null}
            desktopClickPredictions={[]}
            mobileClickPredictions={[]}
          />
        ) : isFunnelAnalyzing ? (
          // Funnel Analysis Loading
          <EnhancedLoadingScreen
            loadingProgress={loadingProgress}
            loadingStage={loadingStage}
            completedSteps={{
              desktopCapture: loadingProgress > 20,
              desktopAnalysis: loadingProgress > 60,
              desktopOpenAI: loadingProgress > 80,
              mobileCapture: false,
              mobileAnalysis: false,
              mobileOpenAI: false,
              finalizing: loadingProgress > 90,
            }}
            url={funnelData?.url || "Benchmark funnel"}
            desktopCaptureResult={null}
            mobileCaptureResult={null}
            desktopClickPredictions={[]}
            mobileClickPredictions={[]}
          />
        ) : (
          // Analysis Results
          <FunnelAnalysis
            originalData={originalData}
            funnelData={funnelData}
            onFunnelUrlSubmit={startFunnelAnalysis}
          />
        )}
      </div>
    </div>
  )
}
