"use client"

import type React from "react"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AuthModal } from "./AuthModal"
import { CaptureDisplay } from "@/app/page/components/CaptureDisplay"
import { CompetitorAnalysis } from "@/components/competitor/CompetitorAnalysis"
import { FunnelAnalysis } from "@/components/funnel/FunnelAnalysis"
import Link from "next/link"
import { detectPrimaryCtaType, followPrimaryCta, extractPrimaryCta } from "@/lib/funnel/analysis"
import { fetchClickPredictions } from "@/app/page/utils"

import { CreditDisplay } from "@/components/credits/CreditDisplay"
import { PDFExportButton } from "@/components/ui/pdf-export-button"
import { processFormsForDisplay } from "@/lib/form"
import { useCTAMatcher } from "@/app/page/hooks/useCTAMatcher"
import { findCTAPrediction } from "@/app/page/utils"
import { creditManager } from "@/lib/credits/manager"
import { analysisStorage, type SavedAnalysis } from "@/lib/analysis/storage"
import type { ScaledFormData } from "@/lib/form/schema"
import type { CreditBalance } from "@/lib/credits/types"
import type { CaptureResult, CTAInsight, MatchedElement, DebugMatch, ClickPredictionResult } from "@/app/page/types"
import {
  Target,
  Upload,
  ArrowDown,
  Zap,
  Brain,
  BarChart3,
  Globe,
  Loader2,
  Monitor,
  Smartphone,
  Clock,
  Trash2,
  Eye,
  Menu,
  ChevronDown,
  FileDown,
  TrendingUp,
} from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import EnhancedLoadingScreen from "@/components/ui/enhanced-loading-screen"
import { compressScreenshotClient } from "@/lib/utils/client-compression"

interface WelcomeScreenProps {
  onSkip: () => void
}

export function WelcomeScreen({ onSkip }: WelcomeScreenProps) {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showCompetitorIntel, setShowCompetitorIntel] = useState(false)
  const [isCompetitorAnalyzing, setIsCompetitorAnalyzing] = useState(false)
  const [showFunnelAnalysis, setShowFunnelAnalysis] = useState(false)
  const [isFunnelAnalyzing, setIsFunnelAnalyzing] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [competitorData, setCompetitorData] = useState<{
    url: string
    domain: string
    captureResult?: any
    analysisResult?: any
    clickPredictions?: any[]
    primaryCTAPrediction?: any
    croAnalysisResult?: any
  } | null>(null)
  const [funnelData, setFunnelData] = useState<{
    url: string
    domain: string
    captureResult?: any
    analysisResult?: any
    clickPredictions?: any[]
    primaryCTAPrediction?: any
    croAnalysisResult?: any
  } | null>(null)
  const [url, setUrl] = useState("")
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null)
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([])
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize CTA matchers
  const desktopCtaMatcher = useCTAMatcher({ width: 0, height: 0 })
  const mobileCtaMatcher = useCTAMatcher({ width: 0, height: 0 })

  // State management - same as main page
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturingDevice, setCapturingDevice] = useState<"desktop" | "mobile" | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  // Credit state now managed by global store

  // Credit initialization now handled by global store

  // Enhanced loading state with smooth progress
  const [isFullAnalysisLoading, setIsFullAnalysisLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [targetProgress, setTargetProgress] = useState(0)
  const [loadingStage, setLoadingStage] = useState("")
  const [completedSteps, setCompletedSteps] = useState({
    desktopCapture: false,
    desktopAnalysis: false,
    desktopOpenAI: false,
    mobileCapture: false,
    mobileAnalysis: false,
    mobileOpenAI: false,
  })

  // Two-step funnel state
  const [funnelType, setFunnelType] = useState<'form' | 'non-form' | 'none'>('none')
  const [step2CaptureResult, setStep2CaptureResult] = useState<any>(null)
  const [step2AnalysisResult, setStep2AnalysisResult] = useState<any>(null)
  const [step2PrimaryCTAPrediction, setStep2PrimaryCTAPrediction] = useState<any>(null)
  const [isStep2Processing, setIsStep2Processing] = useState(false)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Desktop state
  const [desktopCaptureResult, setDesktopCaptureResult] = useState<CaptureResult | null>(null)
  const [desktopAnalysisResult, setDesktopAnalysisResult] = useState<CTAInsight | null>(null)
  const [desktopMatchedElement, setDesktopMatchedElement] = useState<MatchedElement | null>(null)
  const [desktopDebugMatches, setDesktopDebugMatches] = useState<DebugMatch[]>([])
  const [desktopImageSize, setDesktopImageSize] = useState({ width: 0, height: 0 })
  const [desktopFormBoundaryBoxes, setDesktopFormBoundaryBoxes] = useState<ScaledFormData[]>([])
  const [desktopClickPredictions, setDesktopClickPredictions] = useState<ClickPredictionResult[]>([])
  const [desktopShowTooltip, setDesktopShowTooltip] = useState(false)
  const [desktopPrimaryCTAPrediction, setDesktopPrimaryCTAPrediction] = useState<ClickPredictionResult | null>(null)
  const [desktopOpenAIResult, setDesktopOpenAIResult] = useState<any>(null)
  const [desktopCroAnalysisResult, setDesktopCroAnalysisResult] = useState<any>(null)

  // Mobile state
  const [mobileCaptureResult, setMobileCaptureResult] = useState<CaptureResult | null>(null)
  const [mobileAnalysisResult, setMobileAnalysisResult] = useState<CTAInsight | null>(null)
  const [mobileMatchedElement, setMobileMatchedElement] = useState<MatchedElement | null>(null)
  const [mobileDebugMatches, setMobileDebugMatches] = useState<DebugMatch[]>([])
  const [mobileImageSize, setMobileImageSize] = useState({ width: 0, height: 0 })
  const [mobileFormBoundaryBoxes, setMobileFormBoundaryBoxes] = useState<ScaledFormData[]>([])
  const [mobileClickPredictions, setMobileClickPredictions] = useState<ClickPredictionResult[]>([])
  const [mobileShowTooltip, setMobileShowTooltip] = useState(false)
  const [mobilePrimaryCTAPrediction, setMobilePrimaryCTAPrediction] = useState<ClickPredictionResult | null>(null)
  const [mobileOpenAIResult, setMobileOpenAIResult] = useState<any>(null)
  const [mobileCroAnalysisResult, setMobileCroAnalysisResult] = useState<any>(null)

  const [activeTab, setActiveTab] = useState("desktop")

  // Smooth progress animation effect
  useEffect(() => {
    if (isFullAnalysisLoading && targetProgress > loadingProgress) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }

      progressIntervalRef.current = setInterval(() => {
        setLoadingProgress((current) => {
          const increment = Math.max(1, Math.ceil((targetProgress - current) / 10))
          const newProgress = Math.min(current + increment, targetProgress)

          if (newProgress >= targetProgress) {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current)
              progressIntervalRef.current = null
            }
          }

          return newProgress
        })
      }, 100) // Update every 100ms for smooth animation
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [targetProgress, loadingProgress, isFullAnalysisLoading])

  // Smooth progress setter function
  const setProgressSmooth = useCallback((newTarget: number, stage?: string) => {
    setTargetProgress(newTarget)
    if (stage) {
      setLoadingStage(stage)
    }
  }, [])

  // Load saved analyses on component mount
  useEffect(() => {
    const analyses = analysisStorage.getAnalyses()
    setSavedAnalyses(analyses)
  }, [])

  // Get current user ID
  const getCurrentUserId = useCallback(() => {
    return creditManager.getCurrentUserId()
  }, [])

  // Trigger credit refresh
  const triggerCreditRefresh = useCallback(() => {
    setCreditRefreshTrigger((prev) => prev + 1)
    if (process.env.NODE_ENV === "development") {
      console.log("💳 Triggering credit refresh")
    }
  }, [])

  // Save current analysis state with debouncing to prevent duplicates
  const saveCurrentAnalysis = useCallback(() => {
    if (!url.trim()) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout to save after 3 seconds of inactivity
    saveTimeoutRef.current = setTimeout(async () => {
      const desktopData = {
        desktopCaptureResult,
        desktopAnalysisResult,
        desktopMatchedElement,
        desktopDebugMatches,
        desktopImageSize,
        desktopFormBoundaryBoxes,
        desktopClickPredictions,
        desktopShowTooltip,
        desktopPrimaryCTAPrediction,
        desktopCroAnalysisResult,
      }

      const mobileData = {
        mobileCaptureResult,
        mobileAnalysisResult,
        mobileMatchedElement,
        mobileDebugMatches,
        mobileImageSize,
        mobileFormBoundaryBoxes,
        mobileClickPredictions,
        mobileShowTooltip,
        mobilePrimaryCTAPrediction,
        mobileCroAnalysisResult,
      }

      // Only save if we have meaningful data
      if (desktopCaptureResult || mobileCaptureResult) {
        const analysisId = await analysisStorage.saveAnalysis(url, desktopData, mobileData)
        if (analysisId) {
          setCurrentAnalysisId(analysisId)
          // Refresh the saved analyses list
          const analyses = analysisStorage.getAnalyses()
          setSavedAnalyses(analyses)
          if (process.env.NODE_ENV === "development") {
            console.log("💾 Analysis saved in WelcomeScreen:", analysisId)
          }
        }
      }
    }, 3000) // 3 second delay
  }, [
    url,
    desktopCaptureResult,
    desktopAnalysisResult,
    desktopMatchedElement,
    desktopDebugMatches,
    desktopImageSize,
    desktopFormBoundaryBoxes,
    desktopClickPredictions,
    desktopShowTooltip,
    desktopPrimaryCTAPrediction,
    desktopCroAnalysisResult,
    mobileCaptureResult,
    mobileAnalysisResult,
    mobileMatchedElement,
    mobileDebugMatches,
    mobileImageSize,
    mobileFormBoundaryBoxes,
    mobileClickPredictions,
    mobileShowTooltip,
    mobilePrimaryCTAPrediction,
    mobileCroAnalysisResult,
  ])

  // Load analysis from storage
  const loadAnalysis = useCallback((analysisId: string) => {
    const analysis = analysisStorage.getAnalysis(analysisId)
    if (!analysis) return

    // Set URL and show analysis
    setUrl(analysis.url)
    setShowAnalysis(true)
    setCurrentAnalysisId(analysisId)

    // Load desktop state
    setDesktopCaptureResult(analysis.desktopCaptureResult)
    setDesktopAnalysisResult(analysis.desktopAnalysisResult)
    setDesktopMatchedElement(analysis.desktopMatchedElement)
    setDesktopDebugMatches(analysis.desktopDebugMatches || [])
    setDesktopImageSize(analysis.desktopImageSize || { width: 0, height: 0 })
    setDesktopFormBoundaryBoxes(analysis.desktopFormBoundaryBoxes || [])
    setDesktopClickPredictions(analysis.desktopClickPredictions || [])
    setDesktopShowTooltip(analysis.desktopShowTooltip || false)
    setDesktopPrimaryCTAPrediction(analysis.desktopPrimaryCTAPrediction)
    setDesktopCroAnalysisResult(analysis.desktopCroAnalysisResult)

    // Load mobile state
    setMobileCaptureResult(analysis.mobileCaptureResult)
    setMobileAnalysisResult(analysis.mobileAnalysisResult)
    setMobileMatchedElement(analysis.mobileMatchedElement)
    setMobileDebugMatches(analysis.mobileDebugMatches || [])
    setMobileImageSize(analysis.mobileImageSize || { width: 0, height: 0 })
    setMobileFormBoundaryBoxes(analysis.mobileFormBoundaryBoxes || [])
    setMobileClickPredictions(analysis.mobileClickPredictions || [])
    setMobileShowTooltip(analysis.mobileShowTooltip || false)
    setMobilePrimaryCTAPrediction(analysis.mobilePrimaryCTAPrediction)
    setMobileCroAnalysisResult(analysis.mobileCroAnalysisResult)

    // Set active tab based on available data
    if (analysis.desktopCaptureResult) {
      setActiveTab("desktop")
    } else if (analysis.mobileCaptureResult) {
      setActiveTab("mobile")
    }

    if (process.env.NODE_ENV === "development") {
      console.log("📂 Analysis loaded:", analysis.title)
    }
  }, [])

  // Reset analysis
  const resetAnalysis = useCallback(() => {
    setShowAnalysis(false)
    setUrl("")
    setCurrentAnalysisId(null)

    // Clear save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Reset loading states
    setIsFullAnalysisLoading(false)
    setLoadingProgress(0)
    setTargetProgress(0)
    setLoadingStage("")
    setCompletedSteps({
      desktopCapture: false,
      desktopAnalysis: false,
      desktopOpenAI: false,
      mobileCapture: false,
      mobileAnalysis: false,
      mobileOpenAI: false,
    })

    // Reset desktop state
    setDesktopCaptureResult(null)
    setDesktopAnalysisResult(null)
    setDesktopMatchedElement(null)
    setDesktopDebugMatches([])
    setDesktopImageSize({ width: 0, height: 0 })
    setDesktopFormBoundaryBoxes([])
    setDesktopClickPredictions([])
    setDesktopShowTooltip(false)
    setDesktopPrimaryCTAPrediction(null)
    setDesktopCroAnalysisResult(null)

    // Reset mobile state
    setMobileCaptureResult(null)
    setMobileAnalysisResult(null)
    setMobileMatchedElement(null)
    setMobileDebugMatches([])
    setMobileImageSize({ width: 0, height: 0 })
    setMobileFormBoundaryBoxes([])
    setMobileClickPredictions([])
    setMobileShowTooltip(false)
    setMobilePrimaryCTAPrediction(null)
    setMobileCroAnalysisResult(null)

    // Clear competitor data only on new analysis
    setCompetitorData(null)
    setShowCompetitorIntel(false)
    setIsCompetitorAnalyzing(false)
    
    // Clear funnel data only on new analysis
    setFunnelData(null)
    setShowFunnelAnalysis(false)
    setIsFunnelAnalyzing(false)

    setActiveTab("desktop")
  }, [])

  // Delete analysis
  const deleteAnalysis = useCallback(
    (analysisId: string, event: React.MouseEvent) => {
      event.stopPropagation() // Prevent triggering the load analysis

      analysisStorage.deleteAnalysis(analysisId)

      // Refresh the saved analyses list
      const analyses = analysisStorage.getAnalyses()
      setSavedAnalyses(analyses)

      // If we're currently viewing the deleted analysis, reset
      if (currentAnalysisId === analysisId) {
        resetAnalysis()
      }
    },
    [analysisStorage, currentAnalysisId, resetAnalysis],
  )

  // Auto-save analysis when it's complete - with debouncing
  useEffect(() => {
    if (showAnalysis && (desktopCaptureResult || mobileCaptureResult)) {
      saveCurrentAnalysis()
    }
  }, [
    showAnalysis,
    desktopCaptureResult,
    mobileCaptureResult,
    desktopAnalysisResult,
    mobileAnalysisResult,
    saveCurrentAnalysis,
  ])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  // Handle image load - using exact same logic for both desktop and mobile
  const handleImageLoad = useCallback(
    (imageElement: HTMLImageElement, isMobile = false) => {
      const newImageSize = {
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight,
      }

      // Only log image load in development
      if (process.env.NODE_ENV === "development") {
        console.log(`📐 ${isMobile ? "Mobile" : "Desktop"} image loaded with size:`, newImageSize)
      }

      if (isMobile) {
        // Only update if the size actually changed to prevent infinite loops
        setMobileImageSize((prevSize) => {
          if (prevSize.width !== newImageSize.width || prevSize.height !== newImageSize.height) {
            if (mobileCaptureResult) {
              // Use exact same logic as desktop but with mobile-appropriate fold line
              const processedForms = processFormsForDisplay(mobileCaptureResult.domData, imageElement, {
                overlapThreshold: 0.2,
                excludeSearchForms: true,
                foldLinePosition: 600, // Mobile fold line
              })
              setMobileFormBoundaryBoxes(processedForms)
            }
            return newImageSize
          }
          return prevSize
        })
      } else {
        // Only update if the size actually changed to prevent infinite loops
        setDesktopImageSize((prevSize) => {
          if (prevSize.width !== newImageSize.width || prevSize.height !== newImageSize.height) {
            if (desktopCaptureResult) {
              // Desktop logic
              const processedForms = processFormsForDisplay(desktopCaptureResult.domData, imageElement, {
                overlapThreshold: 0.2,
                excludeSearchForms: true,
                foldLinePosition: 1000, // Desktop fold line
              })
              setDesktopFormBoundaryBoxes(processedForms)
            }
            return newImageSize
          }
          return prevSize
        })
      }
    },
    [mobileCaptureResult, desktopCaptureResult],
  )

  // Two-step funnel analysis handler
  const handleTwoStepFunnelAnalysis = useCallback(async (
    ctaInsight: any,
    captureResult: any,
    prediction: any
  ) => {
    try {
      console.log("🔄 Starting two-step funnel analysis...")
      
      // Step 1: Detect if this is a form or non-form CTA
      const detectedFunnelType = detectPrimaryCtaType(captureResult)
      setFunnelType(detectedFunnelType)
      
      console.log(`🎯 Detected funnel type: ${detectedFunnelType}`)
      
      if (detectedFunnelType === 'form') {
        console.log("✅ Form funnel detected - single step complete")
        return // Form funnel = single step, nothing more to do
      }
      
      if (detectedFunnelType === 'non-form') {
        console.log("🚀 Non-form funnel detected - proceeding to step 2...")
        setIsStep2Processing(true)
        
        // Step 2: Try to follow the CTA to the next page
        const followResult = followPrimaryCta(captureResult, url)
        
        if (!followResult || !followResult.nextUrl || followResult.nextUrl === url) {
          console.log(`⚠️ Cannot follow CTA: ${followResult?.reason || 'No next URL'}`)
          setIsStep2Processing(false)
          return
        }
        
        console.log(`🔗 Following CTA to: ${followResult.nextUrl}`)
        setProgressSmooth(85, `Capturing step 2: ${new URL(followResult.nextUrl).hostname}...`)
        
        // Step 3: Capture the second page
        const step2Response = await fetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            url: followResult.nextUrl, 
            isMobile: false,
            userId: getCurrentUserId()
          })
        })
        
        if (!step2Response.ok) {
          console.error("❌ Step 2 capture failed:", step2Response.status)
          setIsStep2Processing(false)
          return
        }
        
        const step2Data = await step2Response.json()
        setStep2CaptureResult(step2Data)
        console.log("✅ Step 2 capture successful")
        
        setProgressSmooth(90, "Analyzing step 2 conversion action...")
        
        // Step 4: Analyze the CTA on the second page
        const step2Response2 = await fetch(step2Data.screenshot)
        const step2Blob = await step2Response2.blob()
        
        const step2FormData = new FormData()
        step2FormData.append("image", step2Blob, "step2-screenshot.png")
        step2FormData.append("domData", JSON.stringify(step2Data.domData))
        
        const step2AnalysisResponse = await fetch("/api/analyze-cta", {
          method: "POST",
          body: step2FormData,
        })
        
        if (step2AnalysisResponse.ok) {
          const step2AnalysisData = await step2AnalysisResponse.json()
          setStep2AnalysisResult(step2AnalysisData.result)
          
          // Step 5: Get click predictions for step 2
          const step2Predictions = await fetchClickPredictions(
            step2Data,
            () => {}, // We don't need to set the full predictions array
            false, // Desktop
            getCurrentUserId()
          )
          
          if (step2Predictions && step2Predictions.length > 0) {
            // Find the primary CTA prediction for step 2
            const step2PrimaryPrediction = step2Predictions[0] // First prediction is usually primary
            setStep2PrimaryCTAPrediction(step2PrimaryPrediction)
            
            console.log("✅ Two-step funnel analysis complete!")
            console.log(`📊 Step 1 CTR: ${prediction.ctr * 100}%`)
            console.log(`📊 Step 2 Conversion Rate: ${step2PrimaryPrediction.ctr * 100}%`)
            
            setProgressSmooth(95, "Two-step funnel analysis complete!")
          }
        }
        
        setIsStep2Processing(false)
      }
    } catch (error) {
      console.error("❌ Two-step funnel analysis failed:", error)
      setIsStep2Processing(false)
    }
  }, [url, detectPrimaryCtaType, followPrimaryCta, getCurrentUserId, setProgressSmooth, fetchClickPredictions])

  // TRUE PARALLEL capture function - captures both desktop and mobile simultaneously
  const captureWebsite = useCallback(
    async () => {
      if (!url.trim()) {
        return
      }

      // 🔍 PERFORMANCE: Debug parallel capture start
      console.log("🔍 [WELCOM-SCREEN] 🚀 Starting TRUE PARALLEL capture for desktop + mobile", {
        url,
        timestamp: new Date().toISOString()
      })

      // Credit checks now handled by global store and API

      // Initialize full loading sequence for parallel capture
      setIsFullAnalysisLoading(true)
      setLoadingProgress(0)
      setTargetProgress(0)
      setProgressSmooth(5, "Initializing parallel desktop + mobile analysis...")
      setCompletedSteps({
        desktopCapture: false,
        desktopAnalysis: false,
        desktopOpenAI: false,
        mobileCapture: false,
        mobileAnalysis: false,
        mobileOpenAI: false,
      })

      // Clear all state for both devices
      setDesktopCaptureResult(null)
      setDesktopAnalysisResult(null)
      setDesktopMatchedElement(null)
      setDesktopDebugMatches([])
      setDesktopFormBoundaryBoxes([])
      setDesktopShowTooltip(false)
      setDesktopClickPredictions([])
      setDesktopPrimaryCTAPrediction(null)
      setDesktopCroAnalysisResult(null)

      setMobileCaptureResult(null)
      setMobileAnalysisResult(null)
      setMobileMatchedElement(null)
      setMobileDebugMatches([])
      setMobileFormBoundaryBoxes([])
      setMobileShowTooltip(false)
      setMobileClickPredictions([])
      setMobilePrimaryCTAPrediction(null)
      setMobileCroAnalysisResult(null)

      setIsCapturing(true)
      setCapturingDevice("both") // Capturing both devices in parallel

      try {
        const userId = getCurrentUserId()

        console.log("🔍 [WELCOM-SCREEN] 🚀 Starting PARALLEL capture with userId:", userId)

        setProgressSmooth(10, "Capturing desktop + mobile screenshots in parallel...")

        // 🔍 PERFORMANCE: Call parallel capture API (no isMobile parameter = parallel)
        const parallelStartTime = Date.now()
        console.log("🔍 [WELCOM-SCREEN] 📡 Calling parallel capture API...", {
          timestamp: new Date().toISOString(),
          url
        })

        const response = await fetch("/api/capture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url, userId }), // NO isMobile = triggers parallel analysis
        })

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`
          try {
            const errorData = await response.json()
            errorMessage = errorData.error?.message || errorData.error || errorMessage

            // Handle insufficient credits specifically
            if (response.status === 402) {
              if (process.env.NODE_ENV === "development") {
                console.log("💳 Insufficient credits, refreshing credit display")
              }
              triggerCreditRefresh()
            }
          } catch (jsonError) {
            if (process.env.NODE_ENV === "development") {
              console.error("Failed to parse error response as JSON:", jsonError)
            }
            errorMessage = `Server error: HTTP ${response.status}`
          }
          throw new Error(errorMessage)
        }

        const parallelDuration = Date.now() - parallelStartTime
        console.log("🔍 [WELCOM-SCREEN] ✅ Parallel capture API responded", {
          duration: parallelDuration + 'ms',
          timestamp: new Date().toISOString()
        })

        setProgressSmooth(20, "Processing parallel desktop + mobile data...")

        let data
        try {
          data = await response.json()
        } catch (jsonError) {
          if (process.env.NODE_ENV === "development") {
            console.error("Failed to parse JSON response:", jsonError)
          }
          throw new Error("Server returned invalid JSON response")
        }

        // 🔍 PERFORMANCE: Validate parallel response structure  
        if (!data || !data.desktop || !data.mobile) {
          if (process.env.NODE_ENV === "development") {
            console.error("Invalid parallel response structure:", data)
          }
          throw new Error("Invalid parallel response structure from server")
        }

        console.log("🔍 [WELCOM-SCREEN] 📊 Parallel data received:", {
          hasDesktop: !!data.desktop,
          hasMobile: !!data.mobile,
          desktopScreenshot: !!data.desktop?.captureResult?.screenshot,
          mobileScreenshot: !!data.mobile?.captureResult?.screenshot,
          timestamp: new Date().toISOString()
        })

        // Extract desktop and mobile data from parallel response
        const desktopData = data.desktop.captureResult
        const mobileData = data.mobile.captureResult
        const desktopInternalCRO = data.desktop.internalCROAnalysis
        const mobileInternalCRO = data.mobile.internalCROAnalysis

        // Update credit balance directly from API response
        if (data.creditsRemaining !== undefined && data.creditsUsed !== undefined) {
          // Credit updates now handled by global store via API side effects
          console.log("💳 Credits updated directly from API response:", data.creditsRemaining, "remaining")
        }

        // Log parallel capture success
        console.log("🔍 [WELCOM-SCREEN] ✅ PARALLEL capture successful:", {
          desktopTitle: desktopData?.title,
          mobileTitle: mobileData?.title,
          desktopFormFields: desktopData?.formFields?.length || 0,
          mobileFormFields: mobileData?.formFields?.length || 0,
          desktopButtons: desktopData?.buttons?.length || 0,
          mobileButtons: mobileData?.buttons?.length || 0,
          creditsRemaining: data.creditsRemaining,
          totalAnalysisTime: data.totalTime + 'ms'
        })

        // Set BOTH desktop and mobile data simultaneously 
        setDesktopCaptureResult(desktopData)
        setMobileCaptureResult(mobileData)
        setCompletedSteps((prev) => ({ 
          ...prev, 
          desktopCapture: true, 
          mobileCapture: true 
        }))
        setActiveTab("desktop") // Default to desktop view

        // EXTRACT INTERNAL CRO ANALYSIS DATA FOR BOTH DEVICES
        if (desktopInternalCRO) {
          console.log("📊 Setting desktop CRO analysis from internal engine:", desktopInternalCRO)
          setDesktopOpenAIResult(desktopInternalCRO)
          setDesktopCroAnalysisResult(desktopInternalCRO)
        }

        if (mobileInternalCRO) {
          console.log("📊 Setting mobile CRO analysis from internal engine:", mobileInternalCRO)
          setMobileOpenAIResult(mobileInternalCRO)
          setMobileCroAnalysisResult(mobileInternalCRO)
        }

        // Auto-analyze CTA for BOTH devices after successful parallel capture
        const autoAnalyzeBothDevices = async (attempt = 1) => {
          try {
            // Log auto-analysis start for parallel processing
            console.log(`🔄 Auto-analyzing BOTH desktop AND mobile CTAs (attempt ${attempt})...`)

            setIsAnalyzing(true)
            setProgressSmooth(25, "Analyzing call-to-actions for both devices...")

            // Clear analysis state for BOTH devices (KEEP CRO ANALYSIS!)
            setDesktopAnalysisResult(null)
            setDesktopMatchedElement(null)
            setDesktopDebugMatches([])
            setDesktopShowTooltip(false)
            setDesktopPrimaryCTAPrediction(null)
            
            setMobileAnalysisResult(null)
            setMobileMatchedElement(null)
            setMobileDebugMatches([])
            setMobileShowTooltip(false)
            setMobilePrimaryCTAPrediction(null)

            // STEP 1: Fetch click predictions for BOTH devices in PARALLEL
            console.log("📊 Fetching click predictions for BOTH devices...")
            setProgressSmooth(30, "Generating click predictions for both devices...")

            // Fetch predictions for both devices in parallel
            const [desktopPredictions, mobilePredictions] = await Promise.all([
              fetchClickPredictions(desktopData, setDesktopClickPredictions, false, getCurrentUserId()),
              fetchClickPredictions(mobileData, setMobileClickPredictions, true, getCurrentUserId())
            ])

            console.log("🔍 [WELCOM-SCREEN] ✅ PARALLEL click predictions completed:", {
              desktopPredictions: desktopPredictions?.length || 0,
              mobilePredictions: mobilePredictions?.length || 0,
              timestamp: new Date().toISOString()
            })

            // CRO analysis already handled by internal engine during capture
            console.log("✅ CRO analysis for BOTH devices provided by internal engine")
            
            if ((desktopPredictions && desktopPredictions.length > 0) || (mobilePredictions && mobilePredictions.length > 0)) {
              // Mark OpenAI steps as completed for both devices
              setCompletedSteps((prev) => ({ 
                ...prev, 
                desktopOpenAI: true,
                mobileOpenAI: true 
              }))
            }

            // STEP 2: Analyze CTA with AI for BOTH devices in PARALLEL
            console.log("🤖 Analyzing CTAs with AI for BOTH devices...")
            setProgressSmooth(50, "AI analyzing CTAs for both devices...")

            // Analyze both devices in parallel
            const analyzeDevice = async (deviceData: any, deviceType: 'desktop' | 'mobile') => {
              const response = await fetch(deviceData.screenshot)
              const blob = await response.blob()

              const formData = new FormData()
              formData.append("image", blob, `${deviceType}-screenshot.png`)
              formData.append("domData", JSON.stringify(deviceData.domData))

              return fetch("/api/analyze-cta", {
                method: "POST",
                body: formData,
              })
            }

            const [desktopAnalysisResponse, mobileAnalysisResponse] = await Promise.all([
              analyzeDevice(desktopData, 'desktop'),
              analyzeDevice(mobileData, 'mobile')
            ])

            // Process both responses
            const processResponse = async (response: Response, deviceType: 'desktop' | 'mobile') => {
              if (!response.ok) {
                const errorText = await response.text()
                console.error(`${deviceType} CTA analysis failed:`, response.status, errorText)
                throw new Error(`Failed to analyze ${deviceType} CTA`)
              }
              return await response.json()
            }

            const [desktopAnalysisData, mobileAnalysisData] = await Promise.all([
              processResponse(desktopAnalysisResponse, 'desktop'),
              processResponse(mobileAnalysisResponse, 'mobile')
            ])

            console.log("🔍 [WELCOM-SCREEN] ✅ PARALLEL AI analysis complete:", {
              desktopCTA: desktopAnalysisData.result.text,
              mobileCTA: mobileAnalysisData.result.text,
              timestamp: new Date().toISOString()
            })

            // Set analysis results for both devices
            setDesktopAnalysisResult(desktopAnalysisData.result)
            setMobileAnalysisResult(mobileAnalysisData.result)
            setCompletedSteps((prev) => ({ 
              ...prev, 
              desktopAnalysis: true,
              mobileAnalysis: true 
            }))

            // STEP 3: Match DOM elements for BOTH devices
            console.log("🎯 Matching DOM elements for BOTH devices...")
            setProgressSmooth(70, "Matching DOM elements...")

            // Match DOM elements for both devices in parallel
            const desktopMatch = desktopCtaMatcher.findMatchingElement(desktopAnalysisData.result, desktopData.domData)
            const mobileMatch = mobileCtaMatcher.findMatchingElement(mobileAnalysisData.result, mobileData.domData)

            // Set matched elements for both devices
            setDesktopMatchedElement(desktopMatch.match)
            setDesktopDebugMatches(desktopMatch.debug)
            setMobileMatchedElement(mobileMatch.match)
            setMobileDebugMatches(mobileMatch.debug)

            console.log("🔍 [WELCOM-SCREEN] ✅ PARALLEL DOM matching complete:", {
              desktopMatch: !!desktopMatch.match,
              mobileMatch: !!mobileMatch.match,
              desktopCTA: desktopMatch.match?.text || 'None',
              mobileCTA: mobileMatch.match?.text || 'None',
              timestamp: new Date().toISOString()
            })

            // STEP 4: Find matching predictions and show tooltips for BOTH devices
            console.log("🔍 Finding matching predictions for BOTH devices...")
            setProgressSmooth(85, "Setting up tooltips for both devices...")

            // Process desktop matches and predictions
            if (desktopMatch.match) {
              console.log("✅ Desktop DOM match found:", desktopMatch.match.text)
              
              const desktopPrediction = findCTAPrediction(
                desktopPredictions || desktopClickPredictions,
                desktopMatch.match,
                desktopAnalysisData.result.text,
                desktopAnalysisData.result,
              )

              if (desktopPrediction) {
                console.log("✅ Desktop prediction found, showing tooltip:", desktopPrediction.elementId)
                
                setDesktopPrimaryCTAPrediction(desktopPrediction)
                setTimeout(() => {
                  setDesktopShowTooltip(true)
                  console.log("🎉 Desktop tooltip should now be visible!")
                }, 100)

                // STEP 5: Two-Step Funnel Analysis for Non-Form CTAs (Desktop Only)
                setTimeout(async () => {
                  try {
                    await handleTwoStepFunnelAnalysis(desktopAnalysisData.result, desktopData, desktopPrediction)
                  } catch (error) {
                    console.log("⚠️ Desktop funnel analysis failed:", error)
                  }
                }, 500) // Small delay to let tooltip render
              } else {
                console.log("⚠️ No matching desktop prediction found")
              }
            } else {
              console.log("❌ No desktop DOM match found")
            }

            // Process mobile matches and predictions
            if (mobileMatch.match) {
              console.log("✅ Mobile DOM match found:", mobileMatch.match.text)
              
              const mobilePrediction = findCTAPrediction(
                mobilePredictions || mobileClickPredictions,
                mobileMatch.match,
                mobileAnalysisData.result.text,
                mobileAnalysisData.result,
              )

              if (mobilePrediction) {
                console.log("✅ Mobile prediction found, showing tooltip:", mobilePrediction.elementId)
                
                setMobilePrimaryCTAPrediction(mobilePrediction)
                setTimeout(() => {
                  setMobileShowTooltip(true)
                  console.log("🎉 Mobile tooltip should now be visible!")
                }, 100)
              } else {
                console.log("⚠️ No matching mobile prediction found")
              }
            } else {
              console.log("❌ No mobile DOM match found")
            }

            // 🔍 PERFORMANCE: PARALLEL analysis complete for BOTH devices!
            console.log("🔍 [WELCOM-SCREEN] 🎉 PARALLEL capture and analysis complete - both desktop and mobile available!")
            
            // Both desktop and mobile analysis complete - check if we should finish loading
            checkIfAnalysisComplete()
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              console.error(`❌ Auto-analysis attempt ${attempt} failed:`, error)
            }

            // Retry logic: only one retry allowed
            if (attempt === 1) {
              if (process.env.NODE_ENV === "development") {
                console.log("🔄 Retrying auto-analysis...")
              }
              setTimeout(() => autoAnalyzeBothDevices(2), 200)
            } else {
              if (process.env.NODE_ENV === "development") {
                console.log("❌ Auto-analysis failed after retry")
              }
              // Hide loading on error for parallel analysis
              checkIfAnalysisComplete()
            }
          } finally {
            setIsAnalyzing(false)
          }
        }

        // Start auto-analysis
        autoAnalyzeBothDevices()
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error capturing website:", error)
        }
        // Hide loading on error
        if (!isMobile) {
          setIsFullAnalysisLoading(false)
          setLoadingProgress(0)
          setTargetProgress(0)
          setLoadingStage("")
        }
      } finally {
        setIsCapturing(false)
        setCapturingDevice(null)
      }
    },
    [
      url,

      getCurrentUserId,
      triggerCreditRefresh,
      mobileCtaMatcher,
      desktopCtaMatcher,
      mobileClickPredictions,
      desktopClickPredictions,
      setProgressSmooth,
    ],
  )

  // Check if analysis is complete and hide loading
  const checkIfAnalysisComplete = useCallback(() => {
    // Wait for both desktop and mobile analysis to complete
    // For non-form funnels, also wait for step 2 to complete (if processing)
    const isBasicAnalysisComplete = desktopAnalysisResult && mobileAnalysisResult
    const isTwoStepFunnelComplete = funnelType === 'form' || funnelType === 'none' || !isStep2Processing
    
    if (isBasicAnalysisComplete && isTwoStepFunnelComplete) {
      setProgressSmooth(98, "Finalizing results...")

      // Wait a bit then complete
      setTimeout(() => {
        setProgressSmooth(99, "Analysis complete!")

        setTimeout(() => {
          setProgressSmooth(100, "Complete!")

          setTimeout(() => {
            setIsFullAnalysisLoading(false)
            setLoadingProgress(0)
            setTargetProgress(0)
            setLoadingStage("")
          }, 1000)
        }, 2000)
      }, 1000)
    }
  }, [desktopAnalysisResult, mobileAnalysisResult, funnelType, isStep2Processing, setProgressSmooth])

  // Effect to check completion when analysis results change
  useEffect(() => {
    if (isFullAnalysisLoading) {
      checkIfAnalysisComplete()
    }
  }, [desktopAnalysisResult, mobileAnalysisResult, isFullAnalysisLoading, checkIfAnalysisComplete])

  const handleAnalyzeClick = () => {
    if (url.trim()) {
      setShowAnalysis(true)
      setCurrentAnalysisId(null) // Clear current analysis ID for new analysis
      captureWebsite() // Start parallel capture for both desktop and mobile
    }
  }

  // Format timestamp for display
  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return timestamp.toLocaleDateString()
  }

  // Manual competitor analysis with user-provided URL
  const triggerManualCompetitorAnalysis = useCallback(async (competitorUrl: string) => {
    if (!url.trim() || !competitorUrl.trim()) return

    try {
      setIsCompetitorAnalyzing(true)
      setShowCompetitorIntel(true)
      
      console.log("🔍 Starting manual competitor analysis for:", competitorUrl)

      // Skip the competitor research step and go directly to capture
      setLoadingStage(`Analyzing competitor: ${competitorUrl}...`)
      setLoadingProgress(10)

      // Desktop capture
      setLoadingStage("Capturing competitor desktop...")
      setLoadingProgress(20)

      const desktopCaptureResponse = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: competitorUrl, 
          isMobile: false,
          userId: getCurrentUserId()
        })
      })

      if (!desktopCaptureResponse.ok) {
        const errorData = await desktopCaptureResponse.json()
        console.error("❌ Competitor capture failed:", errorData)
        throw new Error(errorData.error || "Failed to capture competitor website")
      }

      const desktopCaptureResult = await desktopCaptureResponse.json()
      console.log("✅ Competitor desktop captured")

      setLoadingStage("Processing competitor website...")
      setLoadingProgress(30)

      // Minimal delay to show progress
      await new Promise(resolve => setTimeout(resolve, 50))
      
      setLoadingProgress(35)

      // Set competitor data immediately with screenshot (like original analysis)
      setCompetitorData({
        url: competitorUrl,
        domain: new URL(competitorUrl.startsWith('http') ? competitorUrl : `https://${competitorUrl}`).hostname.replace('www.', ''),
        captureResult: desktopCaptureResult,
        clickPredictions: [],
        primaryCTAPrediction: null,
        croAnalysisResult: null,
        metadata: {
          originalUrl: competitorUrl,
          timestamp: new Date().toISOString(),
          analysisSource: 'manual-competitor'
        }
      })

      // Step 3: Run full click prediction analysis (same as homepage)
      setLoadingStage("Analyzing competitor click predictions...")
      setLoadingProgress(45)

      const clickPredictionsResponse = await fetch("/api/predict-clicks", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domData: desktopCaptureResult.domData,
          isMobile: false,
          userId: getCurrentUserId()
        })
      })

      if (!clickPredictionsResponse.ok) {
        const errorData = await clickPredictionsResponse.json()
        console.error("❌ Competitor click predictions failed:", errorData)
        throw new Error(errorData.error || "Failed to predict competitor clicks")
      }

      const clickPredictionsResult = await clickPredictionsResponse.json()
      console.log("✅ Competitor click predictions completed")

      setLoadingStage("Processing click behavior patterns...")
      setLoadingProgress(55)

      // Update competitor data with click predictions (incremental update)
      setCompetitorData(prevData => ({
        ...prevData!,
        clickPredictions: clickPredictionsResult.predictions || []
      }))

      // Step 4: Run CTA analysis (same as homepage)
      setLoadingStage("Finding competitor primary CTA...")
      setLoadingProgress(65)

      // Use the EXACT same image processing as the original analysis
      const screenshot = desktopCaptureResult.screenshot
      if (!screenshot) {
        throw new Error("No screenshot available for CTA analysis")
      }

      // Use the same method as original analysis - fetch blob from screenshot URL
      const response = await fetch(screenshot)
      const blob = await response.blob()

      const formData = new FormData()
      formData.append("image", blob, "screenshot.png")
      formData.append("domData", JSON.stringify(desktopCaptureResult.domData))

      const ctaAnalysisResponse = await fetch("/api/analyze-cta", {
        method: "POST",
        body: formData,
      })

      if (!ctaAnalysisResponse.ok) {
        const errorData = await ctaAnalysisResponse.json()
        console.error("❌ Competitor CTA analysis failed:", errorData)
        throw new Error(errorData.error || "Failed to analyze competitor CTA")
      }

      const ctaAnalysisResult = await ctaAnalysisResponse.json()
      console.log("✅ Competitor CTA analysis completed")

      setLoadingStage("Analyzing primary conversion elements...")
      setLoadingProgress(75)

      // Find matching prediction using text matching (same logic as original analysis)
      const ctaInsight = ctaAnalysisResult.primaryCTA
      let primaryCTAPrediction = null
      
      if (ctaInsight && clickPredictionsResult.predictions) {
        console.log("🔍 Looking for primary CTA prediction matching:", ctaInsight.text)
        console.log("📊 Available predictions:", clickPredictionsResult.predictions.map(p => ({ id: p.elementId, text: p.text, ctr: p.ctr })))
        
        // Find the prediction that matches the CTA text (same logic as original)
        primaryCTAPrediction = clickPredictionsResult.predictions.find((p) => {
          // Text-based matching (primary method)
          if (p.text && ctaInsight.text) {
            const normalizedPredText = p.text.toLowerCase().trim()
            const normalizedCtaText = ctaInsight.text.toLowerCase().trim()
            return normalizedPredText === normalizedCtaText || 
                   normalizedPredText.includes(normalizedCtaText) ||
                   normalizedCtaText.includes(normalizedPredText)
          }
          return false
        })
        
        // Fallback: Use highest CTR prediction if no text match
        if (!primaryCTAPrediction && clickPredictionsResult.predictions.length > 0) {
          primaryCTAPrediction = clickPredictionsResult.predictions.reduce((best, current) => 
            (current.ctr > best.ctr) ? current : best
          )
        }
        
        console.log("🎯 Competitor primary CTA found:", primaryCTAPrediction ? { 
          id: primaryCTAPrediction.elementId, 
          text: primaryCTAPrediction.text, 
          ctr: primaryCTAPrediction.ctr 
        } : null)
      }

      // Update competitor data with primary CTA (incremental update)
      setCompetitorData(prevData => ({
        ...prevData!,
        primaryCTAPrediction: primaryCTAPrediction
      }))

      // Step 5: Run CRO analysis (same as homepage)
      setLoadingStage("Generating competitor optimization recommendations...")
      setLoadingProgress(85)

      const croAnalysisResponse = await fetch("/api/analyze-cro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domData: desktopCaptureResult.domData,
          clickPredictions: clickPredictionsResult.predictions || [],
          primaryCTAId: ctaAnalysisResult.primaryCTA?.elementId || null,
          deviceType: "desktop",
          dynamicBaseline: ctaAnalysisResult.primaryCTA?.ctr || 0.065,
          isFormRelated: ctaAnalysisResult.primaryCTA?.isFormRelated || false,
          primaryCTAPrediction: ctaAnalysisResult.primaryCTA,
          matchedElement: ctaAnalysisResult.primaryCTA,
          allDOMElements: desktopCaptureResult.domData,
          analysisMetadata: {
            imageSize: desktopCaptureResult.screenshot ? desktopCaptureResult.screenshot.length : 0,
            timestamp: new Date().toISOString(),
            url: competitorUrl,
            enhancedLabelsAvailable: clickPredictionsResult.predictions?.some((p) => p.text && p.text !== p.elementId) || false
          }
        })
      })

      if (!croAnalysisResponse.ok) {
        const errorData = await croAnalysisResponse.json()
        console.error("❌ Competitor CRO analysis failed:", errorData)
        // Don't fail completely if CRO analysis fails, just continue without it
        console.warn("Continuing without CRO analysis...")
      }

      const croAnalysisResult = croAnalysisResponse.ok ? await croAnalysisResponse.json() : null
      console.log("✅ Competitor CRO analysis completed")

      setLoadingStage("Building competitor insights...")
      setLoadingProgress(90)

      // Minimal delay to show progress
      await new Promise(resolve => setTimeout(resolve, 50))

      setLoadingStage("Finalizing analysis...")
      setLoadingProgress(95)

      // Final update to competitor data with CRO analysis (incremental update)
      setCompetitorData(prevData => ({
        ...prevData!,
        croAnalysisResult: croAnalysisResult || null,
        analysis: {
          competitorName: new URL(competitorUrl.startsWith('http') ? competitorUrl : `https://${competitorUrl}`).hostname.replace('www.', '').split('.')[0],
          competitorUrl,
          overallScore: prevData!.primaryCTAPrediction ? Math.min(10, (prevData!.primaryCTAPrediction.ctr || 0.05) * 100) : 7.5,
          ctaCount: prevData!.clickPredictions?.length || 0,
          trustSignalCount: 8 // Default value
        },
        metadata: {
          ...prevData!.metadata,
          hasFullAnalysis: true
        }
      }))
      setLoadingProgress(100)
      setLoadingStage("Analysis complete!")

      console.log("🎉 Manual competitor analysis completed successfully")

    } catch (error) {
      console.error("❌ Manual competitor analysis failed:", error)
      setLoadingProgress(0)
      setLoadingStage("")
    } finally {
      setIsCompetitorAnalyzing(false)
    }
  }, [url, desktopClickPredictions])

  // Show competitor intelligence screen immediately (no auto research)
  const showCompetitorIntelligence = useCallback(() => {
    if (!url.trim()) return
    
    console.log("🎯 Opening Competitor Intelligence screen")
    setShowCompetitorIntel(true)
    // Don't trigger any automatic competitor research - let user input URL manually
  }, [url])

  // Show funnel analysis screen immediately
  const showFunnelAnalysisScreen = useCallback(() => {
    if (!url.trim()) return
    
    console.log("⚡ Opening Funnel Analysis screen")
    setShowFunnelAnalysis(true)
    // Don't trigger any automatic funnel analysis - let user input URL manually
  }, [url])

  // Trigger manual funnel analysis with REAL API calls
  const triggerManualFunnelAnalysis = useCallback(async (funnelUrl: string) => {
    if (!url.trim() || !funnelUrl.trim()) return

    try {
      setIsFunnelAnalyzing(true)
      setShowFunnelAnalysis(true)
      
      console.log("⚡ Starting manual funnel analysis for:", funnelUrl)

      // Check if analyzing the same URL as original - if so, reuse data for consistency
      const normalizeUrl = (inputUrl: string) => {
        try {
          const urlObj = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`)
          return urlObj.href.replace(/\/$/, '') // Remove trailing slash
        } catch {
          return inputUrl.trim().replace(/\/$/, '')
        }
      }

      const isSameUrl = normalizeUrl(funnelUrl) === normalizeUrl(url)
      
      if (isSameUrl && desktopCaptureResult && desktopClickPredictions) {
        console.log("🔄 Same URL detected, reusing original analysis data for consistency")
        
        setLoadingStage("Reusing original analysis...")
        setLoadingProgress(50)
        
        // Create consistent funnel data from original analysis
        const consistentFunnelData = {
          url: funnelUrl,
          domain: new URL(funnelUrl.startsWith('http') ? funnelUrl : `https://${funnelUrl}`).hostname,
          captureResult: desktopCaptureResult,
          clickPredictions: desktopClickPredictions,
          primaryCTAPrediction: desktopClickPredictions[0] || null,
          croAnalysisResult: croAnalysisResult || null,
          analysis: {
            funnelName: new URL(funnelUrl.startsWith('http') ? funnelUrl : `https://${funnelUrl}`).hostname.replace('www.', '').split('.')[0],
            funnelUrl,
            overallScore: desktopClickPredictions[0] ? Math.min(10, (desktopClickPredictions[0].ctr || 0.05) * 100) : 7.5,
            ctaCount: desktopClickPredictions.length || 0,
            trustSignalCount: 8
          },
          metadata: {
            originalUrl: funnelUrl,
            analysisTimestamp: new Date().toISOString(),
            hasFullAnalysis: true,
            reuseOriginal: true // Flag to indicate this is reused data
          }
        }

        setFunnelData(consistentFunnelData)
        setLoadingProgress(100)
        setLoadingStage("Analysis complete!")
        console.log("🎉 Consistent funnel analysis completed (reused original data)")
        return
      }

      // Step 1: Capture the funnel page
      setLoadingStage("Capturing funnel page...")
      setLoadingProgress(15)
      
      const captureResponse = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: funnelUrl })
      })
      
      if (!captureResponse.ok) {
        throw new Error('Failed to capture funnel page')
      }
      
      const captureResult = await captureResponse.json()
      console.log("⚡ Funnel page captured successfully")

      // Set initial funnel data after capture
      setFunnelData({
        url: funnelUrl,
        domain: new URL(funnelUrl.startsWith('http') ? funnelUrl : `https://${funnelUrl}`).hostname,
        captureResult
      })

      // Step 2: Predict clicks
      setLoadingStage("Analyzing funnel CTAs...")
      setLoadingProgress(40)
      
      const clicksResponse = await fetch('/api/predict-clicks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domData: captureResult.domData,
          screenshot: captureResult.screenshot
        })
      })
      
      if (!clicksResponse.ok) {
        throw new Error('Failed to predict clicks')
      }
      
      const clickPredictions = await clicksResponse.json()
      const primaryCTAPrediction = clickPredictions.predictions?.[0] || null
      console.log("⚡ Funnel click predictions generated")

      // Update funnel data with predictions
      setFunnelData(prevData => ({
        ...prevData!,
        clickPredictions: clickPredictions.predictions || [],
        primaryCTAPrediction,
        metadata: {
          originalUrl: funnelUrl,
          analysisTimestamp: new Date().toISOString()
        }
      }))

      // Step 3: Run CRO analysis
      setLoadingStage("Running CRO analysis...")
      setLoadingProgress(70)
      
      // FIXED: Extract CRO analysis from internal CRO engine instead of OpenAI
      let croAnalysisResult = null
      if (captureResult.desktop?.internalCROAnalysis) {
        console.log("📊 Using internal CRO analysis for funnel:", captureResult.desktop.internalCROAnalysis)
        croAnalysisResult = captureResult.desktop.internalCROAnalysis
      } else {
        console.log("⚠️ No internal CRO analysis found in capture result")
      }
      console.log("⚡ Funnel CRO analysis extracted from unified analysis")

      setLoadingStage("Finalizing analysis...")
      setLoadingProgress(95)

      // Final update to funnel data with CRO analysis
      setFunnelData(prevData => ({
        ...prevData!,
        croAnalysisResult: croAnalysisResult || null,
        analysis: {
          funnelName: new URL(funnelUrl.startsWith('http') ? funnelUrl : `https://${funnelUrl}`).hostname.replace('www.', '').split('.')[0],
          funnelUrl,
          overallScore: prevData!.primaryCTAPrediction ? Math.min(10, (prevData!.primaryCTAPrediction.ctr || 0.05) * 100) : 7.5,
          ctaCount: prevData!.clickPredictions?.length || 0,
          trustSignalCount: 8 // Default value
        },
        metadata: {
          ...prevData!.metadata,
          hasFullAnalysis: true
        }
      }))
      setLoadingProgress(100)
      setLoadingStage("Funnel analysis complete!")

      console.log("🎉 Manual funnel analysis completed successfully")
      
    } catch (error) {
      console.error("❌ Manual funnel analysis failed:", error)
      setLoadingProgress(0)
      setLoadingStage("")
    } finally {
      setIsFunnelAnalyzing(false)
    }
  }, [url])

  // Trigger competitor analysis workflow (legacy function, keeping for backward compatibility)
  const triggerCompetitorAnalysis = useCallback(async () => {
    if (!url.trim()) return

    // If competitor data already exists, just show the existing results
    if (competitorData && competitorData.clickPredictions && competitorData.clickPredictions.length > 0) {
      console.log("🎯 Competitor data already exists, showing cached results")
      setShowCompetitorIntel(true)
      return
    }

    try {
      setIsCompetitorAnalyzing(true)
      setShowCompetitorIntel(true)
      
      console.log("🔍 Starting competitor research for:", url)

      // Step 1: Find competitor using OpenAI
      setLoadingStage("Finding your #1 competitor...")
      setLoadingProgress(5)

      const competitorResponse = await fetch("/api/competitor-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      })

      if (!competitorResponse.ok) {
        const errorData = await competitorResponse.json()
        console.error("❌ Competitor research API error:", errorData)
        
        // Provide more specific error messages based on status
        if (competitorResponse.status === 429) {
          throw new Error("OpenAI API quota exceeded. Please try again later.")
        } else if (competitorResponse.status === 408) {
          throw new Error("Request timed out. OpenAI is taking too long to respond.")
        } else if (competitorResponse.status === 404) {
          throw new Error("No clear competitor found for this website. Try a more specific company URL.")
        } else {
          throw new Error(errorData.error || "Failed to find competitor")
        }
      }

      const { competitor } = await competitorResponse.json()
      console.log("✅ Competitor found:", competitor.url)

      // Step 2: Capture competitor website (desktop + mobile)
      setLoadingStage(`Analyzing competitor: ${competitor.domain}...`)
      setLoadingProgress(15)

      // Desktop capture
      setLoadingStage("Capturing competitor desktop...")
      setLoadingProgress(25)

      const desktopCaptureResponse = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: competitor.url, 
          isMobile: false,
          userId: getCurrentUserId()
        })
      })

      if (!desktopCaptureResponse.ok) {
        throw new Error("Failed to capture competitor desktop")
      }

      const desktopData = await desktopCaptureResponse.json()

      // 🎯 Immediately show competitor screenshot in loading screen
      setCompetitorData({
        url: competitor.url,
        domain: competitor.domain,
        captureResult: desktopData,
        clickPredictions: [],
        primaryCTAPrediction: null,
        croAnalysisResult: null
      })

      // Mobile capture
      setLoadingStage("Capturing competitor mobile...")
      setLoadingProgress(45)

      const mobileCaptureResponse = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: competitor.url, 
          isMobile: true,
          userId: getCurrentUserId()
        })
      })

      if (!mobileCaptureResponse.ok) {
        throw new Error("Failed to capture competitor mobile")
      }

      const mobileData = await mobileCaptureResponse.json()

      // Step 3: Analyze competitor (similar to main analysis flow)
      setLoadingStage("Analyzing competitor CTAs...")
      setLoadingProgress(60)

      // Get click predictions for competitor
      const competitorPredictions = await fetchClickPredictions(desktopData, () => {}, false, getCurrentUserId())

      // 🎯 Update competitor data with click predictions immediately
      setCompetitorData(prevData => ({
        ...prevData!,
        clickPredictions: competitorPredictions
      }))

      // Step 4: Get CRO analysis for competitor
      setLoadingStage("Generating competitor insights...")
      setLoadingProgress(80)

      const primaryPrediction = competitorPredictions?.[0]
      
      let competitorCROResult = null
      if (primaryPrediction && desktopData?.domData) {
        try {
          const croResponse = await fetch("/api/analyze-cro-internal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              captureData: {
                domData: desktopData.domData,
                screenshot: desktopData.screenshot || '',
                timestamp: new Date().toISOString(),
                isMobile: false
              },
              deviceType: "desktop"
            })
          })

          if (croResponse.ok) {
            competitorCROResult = await croResponse.json()
            console.log("📊 Competitor internal CRO analysis completed")
          } else {
            console.warn("⚠️ Competitor internal CRO analysis failed, continuing without it")
          }
        } catch (error) {
          console.warn("⚠️ Competitor internal CRO analysis error:", error)
        }
      }

      // Step 5: Update competitor data with analysis results
      setCompetitorData(prevData => ({
        ...prevData!,
        clickPredictions: competitorPredictions,
        primaryCTAPrediction: primaryPrediction,
        croAnalysisResult: competitorCROResult
      }))

      setLoadingStage("Comparison complete!")
      setLoadingProgress(100)

      // Hide loading after completion
      setTimeout(() => {
        setIsCompetitorAnalyzing(false)
        setLoadingProgress(0)
        setLoadingStage("")
      }, 1000)

      console.log("✅ Competitor analysis complete")

    } catch (error) {
      console.error("❌ Competitor analysis failed:", error)
      setIsCompetitorAnalyzing(false)
      setLoadingProgress(0)
      setLoadingStage("")
      
      // Show better error feedback
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // If it's a quota/timeout error, offer to show a demo
      if (errorMessage.includes('quota') || errorMessage.includes('timeout')) {
        const showDemo = confirm(
          `${errorMessage}\n\nWould you like to see a demo of the Competitor Intel feature instead?`
        )
        
        if (showDemo) {
          // Set demo competitor data
          setCompetitorData({
            url: "https://samsung.com",
            domain: "samsung.com",
            captureResult: {
              screenshot: "/placeholder.svg?height=300&width=500&text=Demo+Competitor+Site"
            },
            clickPredictions: [
              { elementId: "demo-cta", text: "Shop Now", ctr: 0.047, wastedSpend: 800 }
            ],
            primaryCTAPrediction: { 
              elementId: "demo-cta", 
              text: "Shop Now", 
              ctr: 0.047, 
              wastedSpend: 800 
            }
          })
          return // Exit early to show demo data
        }
      } else {
        alert(`Competitor analysis failed: ${errorMessage}`)
      }
    }
  }, [url, getCurrentUserId, competitorData])

  // If showing funnel analysis, render the funnel analysis interface
  if (showFunnelAnalysis) {
    return (
      <div className="min-h-screen bg-white">
        {/* Mobile Header - Only visible on mobile */}
        <div className="lg:hidden bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">Oxogin AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-medium">
                Funnel Analysis
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFunnelAnalysis(false)} className="text-xs bg-transparent">
                ← Back
              </Button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Left Sidebar - Hidden on mobile, visible on desktop */}
          <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 p-8 flex-col shadow-sm">
            {/* Logo */}
            <div className="flex items-center gap-4 mb-12">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-semibold text-gray-900">Oxogin AI</span>
            </div>

            {/* Navigation */}
            <div className="space-y-2 mb-8">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg h-12"
                onClick={() => setShowFunnelAnalysis(false)}
              >
                <Globe className="w-5 h-5" />
                Back to Analysis
              </Button>
              {/* PDF Export Button - Only show when analysis is complete */}
              {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
                <div className="pt-2">
                  <PDFExportButton 
                    analysisElementId="analysis-content"
                    filename={`oxogin-funnel-analysis-${url || 'website'}-${new Date().toISOString().split('T')[0]}.pdf`}
                    variant="sidebar"
                    className=""
                  />
                </div>
              )}
            </div>

            {/* Current Analysis */}
            <div className="space-y-3 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-gray-700 mb-2 font-medium">Funnel Analysis</div>
                <div className="text-xs text-gray-600 break-all">{url}</div>
              </div>
            </div>

            {/* Credit Display */}
            <div className="mb-6">
              <CreditDisplay />
            </div>

            {/* Bottom Section */}
            <div className="mt-auto">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-gray-900 font-medium">Guest User</div>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Sign in to save your analysis history and access premium features
                </p>
                <Button
                  className="w-full bg-gray-400 text-white rounded-lg h-10 cursor-not-allowed"
                  disabled={true}
                >
                  Sign in
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content - Funnel Analysis Results */}
          <div className="flex-1 p-2 sm:p-4 lg:p-6 overflow-auto">
            {/* Mobile Current Analysis Info */}
            <div className="lg:hidden mb-4">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-sm text-gray-700 mb-1 font-medium">Funnel Analysis</div>
                <div className="text-xs text-gray-600 break-all">{url}</div>
              </div>
            </div>

            {/* Funnel Analysis Content */}
            {isFunnelAnalyzing ? (
              <EnhancedLoadingScreen
                loadingProgress={loadingProgress}
                loadingStage={loadingStage}
                completedSteps={{
                  desktopCapture: loadingProgress > 25,
                  desktopAnalysis: loadingProgress > 60,
                  desktopOpenAI: loadingProgress > 80,
                  mobileCapture: loadingProgress > 45,
                  mobileAnalysis: loadingProgress > 65,
                  mobileOpenAI: loadingProgress > 85,
                  finalizing: loadingProgress > 95,
                }}
                url={funnelData?.url || "Benchmark funnel"}
                desktopCaptureResult={funnelData?.captureResult}
                mobileCaptureResult={null}
                desktopClickPredictions={funnelData?.clickPredictions || []}
                mobileClickPredictions={[]}
              />
            ) : (
              <FunnelAnalysis 
                originalData={{
                  url,
                  captureResult: desktopCaptureResult,
                  clickPredictions: desktopClickPredictions,
                  primaryCTAPrediction: desktopPrimaryCTAPrediction, // Use the matched primary CTA
                  croAnalysisResult: desktopCroAnalysisResult
                }}
                funnelData={funnelData}
                onFunnelUrlSubmit={triggerManualFunnelAnalysis}
              />
            )}
          </div>
        </div>

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    )
  }

  // If showing competitor intel, render the competitor intel interface
  if (showCompetitorIntel) {
    return (
      <div className="min-h-screen bg-white">
        {/* Mobile Header - Only visible on mobile */}
        <div className="lg:hidden bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">Oxogin AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-md font-medium">
                Competitor Intel
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowCompetitorIntel(false)} className="text-xs bg-transparent">
                ← Back
              </Button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Left Sidebar - Hidden on mobile, visible on desktop */}
          <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 p-8 flex-col shadow-sm">
            {/* Logo */}
            <div className="flex items-center gap-4 mb-12">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-semibold text-gray-900">Oxogin AI</span>
            </div>

            {/* Navigation */}
            <div className="space-y-2 mb-8">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg h-12"
                onClick={() => setShowCompetitorIntel(false)}
              >
                <Globe className="w-5 h-5" />
                Back to Analysis
              </Button>
              {/* PDF Export Button - Only show when analysis is complete */}
              {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
                <div className="pt-2">
                  <PDFExportButton 
                    analysisElementId="analysis-content"
                    filename={`oxogin-competitor-intel-${url || 'website'}-${new Date().toISOString().split('T')[0]}.pdf`}
                    variant="sidebar"
                    className=""
                  />
                </div>
              )}
            </div>

            {/* Current Analysis */}
            <div className="space-y-3 mb-6">
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-gray-700 mb-2 font-medium">Competitor Intelligence</div>
                <div className="text-xs text-gray-600 break-all">{url}</div>
              </div>
            </div>

            {/* Credit Display */}
            <div className="mb-6">
              <CreditDisplay />
            </div>

            {/* Bottom Section */}
            <div className="mt-auto">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-gray-900 font-medium">Guest User</div>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Sign in to save your analysis history and access premium features
                </p>
                <Button
                  className="w-full bg-gray-400 text-white rounded-lg h-10 cursor-not-allowed"
                  disabled={true}
                >
                  Sign in
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content - Competitor Intel Results */}
          <div className="flex-1 p-2 sm:p-4 lg:p-6 overflow-auto">
            {/* Mobile Current Analysis Info */}
            <div className="lg:hidden mb-4">
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="text-sm text-gray-700 mb-1 font-medium">Competitor Intelligence</div>
                <div className="text-xs text-gray-600 break-all">{url}</div>
              </div>
            </div>

            {/* Competitor Analysis Content */}
            {isCompetitorAnalyzing ? (
              <EnhancedLoadingScreen
                loadingProgress={loadingProgress}
                loadingStage={loadingStage}
                completedSteps={{
                  desktopCapture: loadingProgress > 25,
                  desktopAnalysis: loadingProgress > 60,
                  desktopOpenAI: loadingProgress > 80,
                  mobileCapture: loadingProgress > 45,
                  mobileAnalysis: loadingProgress > 65,
                  mobileOpenAI: loadingProgress > 85,
                  finalizing: loadingProgress > 95,
                }}
                url={competitorData?.url || "Competitor site"}
                desktopCaptureResult={competitorData?.captureResult}
                mobileCaptureResult={null}
                desktopClickPredictions={competitorData?.clickPredictions || []}
                mobileClickPredictions={[]}
              />
            ) : (
              <CompetitorAnalysis 
                originalData={{
                  url,
                  captureResult: desktopCaptureResult,
                  clickPredictions: desktopClickPredictions,
                  primaryCTAPrediction: desktopPrimaryCTAPrediction,
                  croAnalysisResult: desktopCroAnalysisResult
                }}
                competitorData={competitorData}
                onCompetitorUrlSubmit={triggerManualCompetitorAnalysis}
              />
            )}
          </div>
        </div>

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    )
  }

  // If showing analysis, render the analysis interface (keep existing logic)
  if (showAnalysis) {
    return (
      <div className="min-h-screen bg-white">
        {/* Mobile Header - Only visible on mobile */}
        <div className="lg:hidden bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">Oxogin AI</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={resetAnalysis} className="text-xs bg-transparent">
                New
              </Button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Left Sidebar - Hidden on mobile, visible on desktop */}
          <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 p-8 flex-col shadow-sm">
            {/* Logo */}
            <div className="flex items-center gap-4 mb-12">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-semibold text-gray-900">Oxogin AI</span>
            </div>

            {/* Navigation */}
            <div className="space-y-2 mb-8">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-400 rounded-lg h-12 cursor-not-allowed"
                disabled={true}
              >
                <Upload className="w-5 h-5" />
                Analyze Website
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg h-12"
                onClick={resetAnalysis}
              >
                <Globe className="w-5 h-5" />
                New Analysis
              </Button>
              {/* Funnel Analysis Button - Only show when analysis is complete */}
              {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg h-12"
                  onClick={showFunnelAnalysisScreen}
                >
                  <Zap className="w-5 h-5" />
                  <span className="flex-1 text-left">Funnel Analysis</span>
                  {funnelData && funnelData.clickPredictions && funnelData.clickPredictions.length > 0 && (
                    <Badge className="bg-blue-100 text-blue-700 text-xs">
                      Ready →
                    </Badge>
                  )}
                </Button>
              )}
              {/* Competitor Intel Button - Only show when analysis is complete */}
              {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-gray-600 hover:bg-purple-50 hover:text-purple-700 rounded-lg h-12"
                  onClick={showCompetitorIntelligence}
                >
                  <Eye className="w-5 h-5" />
                  <span className="flex-1 text-left">Competitor Intel</span>
                  {competitorData && competitorData.clickPredictions && competitorData.clickPredictions.length > 0 && (
                    <Badge className="bg-purple-100 text-purple-700 text-xs">
                      Ready →
                    </Badge>
                  )}
                </Button>
              )}

              {/* PDF Export Button - Only show when analysis is complete */}
              {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
                <div className="pt-2">
                  <PDFExportButton 
                    analysisElementId="analysis-content"
                    filename={`oxogin-analysis-${url || 'website'}-${new Date().toISOString().split('T')[0]}.pdf`}
                    variant="sidebar"
                    className=""
                  />
                </div>
              )}
            </div>

            {/* Current Analysis */}
            <div className="space-y-3 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-gray-700 mb-2 font-medium">Current Analysis</div>
                <div className="text-xs text-gray-600 break-all">{url}</div>
              </div>
            </div>

            {/* Recent Analyses */}
            {savedAnalyses.length > 0 && (
              <div className="mb-8">
                <div className="text-sm text-gray-500 mb-4 flex items-center gap-2 font-medium">
                  <Clock className="w-4 h-4" />
                  Recent Analyses
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedAnalyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className={`group relative bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-blue-50 transition-colors border border-gray-100 ${
                        currentAnalysisId === analysis.id ? "ring-2 ring-blue-500 bg-blue-50" : ""
                      }`}
                      onClick={() => loadAnalysis(analysis.id)}
                    >
                      <div className="text-sm text-gray-900 truncate pr-6 font-medium">{analysis.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{formatTimestamp(analysis.timestamp)}</div>
                      <button
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                        onClick={(e) => deleteAnalysis(analysis.id, e)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Credit Display */}
            <div className="mb-6">
              <CreditDisplay />
            </div>

            {/* Bottom Section */}
            <div className="mt-auto">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-gray-900 font-medium">Guest User</div>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Sign in to save your analysis history and access premium features
                </p>
                <Button
                  className="w-full bg-gray-400 text-white rounded-lg h-10 cursor-not-allowed"
                  disabled={true}
                >
                  Sign in
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content - Analysis Results - Responsive */}
          <div className="flex-1 p-4 sm:p-6 overflow-auto">
            {/* Mobile Current Analysis Info */}
            <div className="lg:hidden mb-4">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-sm text-gray-700 mb-1 font-medium">Current Analysis</div>
                <div className="text-xs text-gray-600 break-all">{url}</div>
              </div>
            </div>

            {isFullAnalysisLoading ? (
              <EnhancedLoadingScreen
                loadingProgress={loadingProgress}
                loadingStage={loadingStage}
                completedSteps={completedSteps}
                url={url}
                desktopCaptureResult={desktopCaptureResult}
                mobileCaptureResult={mobileCaptureResult}
                desktopClickPredictions={desktopClickPredictions}
                mobileClickPredictions={mobileClickPredictions}
              />
            ) : (
              // Show results when not loading - Always render analysis content for PDF export
              (desktopCaptureResult || mobileCaptureResult) && (
                <>
                  {/* Tab Navigation - Move back to top */}
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
                    <TabsList className="grid w-full grid-cols-2 h-9 bg-gray-100">
                      <TabsTrigger value="desktop" className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
                        <Monitor className="w-3 h-3" />
                        <span className="hidden sm:inline">Desktop Analysis</span>
                        <span className="sm:hidden">Desktop</span>
                        {desktopCaptureResult && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            Ready
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="mobile" className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
                        <Smartphone className="w-3 h-3" />
                        <span className="hidden sm:inline">Mobile Analysis</span>
                        <span className="sm:hidden">Mobile</span>
                        {mobileCaptureResult && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            Ready
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Always render analysis content for PDF export - hidden/shown via CSS */}
                  <div className={`${activeTab === 'desktop' ? 'block' : 'hidden'}`}>
                    {desktopCaptureResult ? (
                      <CaptureDisplay
                        captureResult={desktopCaptureResult}
                        matchedElement={desktopMatchedElement}
                        imageSize={desktopImageSize}
                        formBoundaryBoxes={desktopFormBoundaryBoxes}
                        showTooltip={desktopShowTooltip}
                        primaryCTAPrediction={desktopPrimaryCTAPrediction}
                        analysisResult={desktopAnalysisResult}
                        isAnalyzing={isAnalyzing}
                        onImageLoad={(img) => handleImageLoad(img, false)}
                        onAnalyzeCTA={() => {}}
                        onReset={resetAnalysis}
                        clickPredictions={desktopClickPredictions}
                        allDOMElements={desktopCaptureResult.domData}
                        croAnalysisResult={desktopCroAnalysisResult}
                      />
                    ) : (
                      <Card className="p-6">
                        <p className="text-sm text-gray-500">Desktop analysis in progress...</p>
                      </Card>
                    )}
                  </div>

                  <div className={`${activeTab === 'mobile' ? 'block' : 'hidden'}`}>
                    {mobileCaptureResult ? (
                      <CaptureDisplay
                        captureResult={mobileCaptureResult}
                        matchedElement={mobileMatchedElement}
                        imageSize={mobileImageSize}
                        formBoundaryBoxes={mobileFormBoundaryBoxes}
                        showTooltip={mobileShowTooltip}
                        primaryCTAPrediction={mobilePrimaryCTAPrediction}
                        analysisResult={mobileAnalysisResult}
                        isAnalyzing={isAnalyzing}
                        onImageLoad={(img) => handleImageLoad(img, true)}
                        onAnalyzeCTA={() => {}}
                        onReset={resetAnalysis}
                        clickPredictions={mobileClickPredictions}
                        allDOMElements={mobileCaptureResult.domData}
                        croAnalysisResult={mobileCroAnalysisResult}
                      />
                    ) : (
                      <Card className="p-6">
                        <p className="text-sm text-gray-500">Mobile analysis in progress...</p>
                      </Card>
                    )}
                  </div>
                </>
              )
            )}
          </div>
        </div>

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    )
  }

  // Corporate design with enhanced contrast and hover effects - NOW RESPONSIVE
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header - Only visible on mobile */}
      <div className="lg:hidden bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">Oxogin AI</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditDisplay 

            />
            {/* Mobile Menu Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Menu className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={resetAnalysis} className="gap-2">
                  <Globe className="w-4 h-4" />
                  New Analysis
                </DropdownMenuItem>
                {/* Funnel Analysis - Only show when analysis is complete */}
                {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
                  <DropdownMenuItem onClick={showFunnelAnalysisScreen} className="gap-2">
                    <Zap className="w-4 h-4" />
                    <span className="flex-1">Funnel Analysis</span>
                    {funnelData && funnelData.clickPredictions && funnelData.clickPredictions.length > 0 && (
                      <Badge className="bg-blue-100 text-blue-700 text-xs ml-2">
                        Ready →
                      </Badge>
                    )}
                  </DropdownMenuItem>
                )}
                {/* Competitor Intel - Only show when analysis is complete */}
                {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
                  <DropdownMenuItem onClick={showCompetitorIntelligence} className="gap-2">
                    <Eye className="w-4 h-4" />
                    <span className="flex-1">Competitor Intel</span>
                    {competitorData && competitorData.clickPredictions && competitorData.clickPredictions.length > 0 && (
                      <Badge className="bg-purple-100 text-purple-700 text-xs ml-2">
                        Ready →
                      </Badge>
                    )}
                  </DropdownMenuItem>
                )}
                {/* PDF Export - Only show when analysis is complete */}
                {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
                  <DropdownMenuItem 
                    onClick={() => {
                      // Trigger PDF export by clicking the hidden button
                      const pdfButton = document.querySelector('[data-pdf-export-button]') as HTMLButtonElement
                      if (pdfButton) {
                        pdfButton.click()
                      }
                    }}
                    className="gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Export to PDF
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled className="gap-2 text-gray-400">
                  <Target className="w-4 h-4" />
                  Sign in
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 p-8 flex-col shadow-sm">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-semibold text-gray-900">Oxogin AI</span>
          </div>

          {/* Navigation */}
          <div className="space-y-2 mb-8">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-400 rounded-lg h-12 cursor-not-allowed"
              disabled={true}
            >
              <Upload className="w-5 h-5" />
              Analyze Website
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg h-12"
              onClick={resetAnalysis}
            >
              <Globe className="w-5 h-5" />
              New Analysis
            </Button>
            {/* Funnel Analysis Button - Only show when analysis is complete */}
            {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg h-12"
                onClick={showFunnelAnalysisScreen}
              >
                <Zap className="w-5 h-5" />
                <span className="flex-1 text-left">Funnel Analysis</span>
                {funnelData && funnelData.clickPredictions && funnelData.clickPredictions.length > 0 && (
                  <Badge className="bg-blue-100 text-blue-700 text-xs">
                    Ready →
                  </Badge>
                )}
              </Button>
            )}
            {/* Competitor Intel Button - Only show when analysis is complete */}
            {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-600 hover:bg-purple-50 hover:text-purple-700 rounded-lg h-12"
                onClick={showCompetitorIntelligence}
              >
                <Eye className="w-5 h-5" />
                <span className="flex-1 text-left">Competitor Intel</span>
                {competitorData && competitorData.clickPredictions && competitorData.clickPredictions.length > 0 && (
                  <Badge className="bg-purple-100 text-purple-700 text-xs">
                    Ready →
                  </Badge>
                )}
              </Button>
            )}
            {/* PDF Export Button - Only show when analysis is complete */}
            {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
              <div className="pt-2">
                <PDFExportButton 
                  analysisElementId="analysis-content"
                  filename={`oxogin-analysis-${url || 'website'}-${new Date().toISOString().split('T')[0]}.pdf`}
                  variant="sidebar"
                  className=""
                />
              </div>
            )}
          </div>

          {/* Recent Analyses */}
          {savedAnalyses.length > 0 && (
            <div className="mb-8">
              <div className="text-sm text-gray-500 mb-4 flex items-center gap-2 font-medium">
                <Clock className="w-4 h-4" />
                Recent Analyses
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedAnalyses.slice(0, 3).map((analysis) => (
                  <div
                    key={analysis.id}
                    className="group relative bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-blue-50 transition-colors border border-gray-100"
                    onClick={() => loadAnalysis(analysis.id)}
                  >
                    <div className="text-sm text-gray-900 truncate pr-6 font-medium">{analysis.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{formatTimestamp(analysis.timestamp)}</div>
                    <button
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                      onClick={(e) => deleteAnalysis(analysis.id, e)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credit Display */}
          <div className="mb-6">
            <CreditDisplay 

            />
          </div>

          {/* Bottom Section */}
          <div className="mt-auto">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm text-gray-900 font-medium">Guest User</div>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Sign in to save your analysis history and access premium features
              </p>
              <Button
                className="w-full bg-gray-400 text-white rounded-lg h-10 cursor-not-allowed"
                disabled={true}
              >
                Sign in
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content - Responsive */}
        <div className="flex-1 flex flex-col">
          {/* Header Stats - Responsive */}
          <div className="hidden md:flex justify-center items-center gap-8 lg:gap-16 py-6 lg:py-8 bg-white border-b border-gray-200">
            <div className="flex items-center gap-2 lg:gap-3 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 lg:w-5 lg:h-5 text-purple-700" />
              </div>
              <div>
                <div className="text-sm lg:text-base font-semibold text-gray-900">#1 CRO AI</div>
                <div className="text-xs text-gray-700">Industry Leader</div>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 lg:w-5 lg:h-5 text-blue-700" />
              </div>
              <div>
                <div className="text-sm lg:text-base font-semibold text-gray-900">1,000+</div>
                <div className="text-xs text-gray-700">Daily Analyses</div>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 lg:w-5 lg:h-5 text-orange-700" />
              </div>
              <div>
                <div className="text-sm lg:text-base font-semibold text-gray-900">Top 50</div>
                <div className="text-xs text-gray-700">AI Apps 2025</div>
              </div>
            </div>
          </div>

          {/* Main Hero - Responsive */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16 bg-gradient-to-b from-white to-gray-50">
            <div className="max-w-3xl w-full text-center">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 lg:mb-6 leading-tight">
              Transform Clicks into{" "}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Conversions
                </span>
              </h1>

              <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-8 sm:mb-12 lg:mb-16 leading-relaxed px-4">
              Paste a page link. We'll instantly predict any page’s conversion rate — no code, no spend, no wasted tests.
              </p>

              {/* Enhanced Input Area - Responsive */}
              <div className="max-w-2xl mx-auto">
                <Card className="border-2 sm:border-4 border-blue-200 shadow-xl hover:border-blue-400 hover:shadow-3xl transition-all duration-300 transform hover:scale-[1.02] bg-gradient-to-br from-blue-50 to-indigo-50">
                  <div className="p-6 sm:p-8 lg:p-10 space-y-6 lg:space-y-8">
                    {/* Enhanced Icon with Animation - Responsive */}
                    <div className="w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110">
                      <ArrowDown className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white" />
                    </div>

                    <div>
                      {/* Enhanced Title - Responsive */}
                      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-6 lg:mb-8">
                        Enter website URL, or paste URL here
                      </h2>

                      <div className="space-y-4 lg:space-y-6">
                        <Input
                          type="url"
                          placeholder="https://example.com"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="h-12 sm:h-14 lg:h-16 text-center text-base sm:text-lg lg:text-xl border-2 lg:border-3 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-4 focus:ring-blue-100 hover:border-blue-400 transition-all duration-200 bg-white shadow-inner font-medium text-gray-900 placeholder:text-gray-500"
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && url.trim()) {
                              handleAnalyzeClick()
                            }
                          }}
                        />
                        <Button
                          className="w-full h-12 sm:h-14 lg:h-16 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-base sm:text-lg lg:text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                          onClick={handleAnalyzeClick}
                          disabled={!url.trim() || isCapturing}
                        >
                          {isCapturing ? (
                            <>
                              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 mr-3 lg:mr-4 animate-spin" />
                              <span className="hidden sm:inline">
                                {capturingDevice === "desktop" ? "Capturing Desktop..." : "Capturing Mobile..."}
                              </span>
                              <span className="sm:hidden">Analyzing...</span>
                            </>
                          ) : (
                            <>
                              <Target className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 mr-3 lg:mr-4" />
                              <span className="hidden sm:inline">Analyze Website</span>
                              <span className="sm:hidden">Analyze</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>

          {/* Bottom Brands - Responsive */}
          <div className="py-6 lg:py-8 bg-white border-t border-gray-200">
            <p className="text-center text-gray-600 text-xs sm:text-sm mb-4 lg:mb-6 font-medium px-4">
              Built for the marketers and researchers shaping tomorrow's top institutions
            </p>
            <div className="flex justify-center items-center gap-4 sm:gap-8 lg:gap-12 opacity-60 px-4 overflow-x-auto">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-800 whitespace-nowrap">SHOPIFY</div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 whitespace-nowrap">NETFLIX</div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 whitespace-nowrap">MICROSOFT</div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 whitespace-nowrap">SPOTIFY</div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600 whitespace-nowrap">STRIPE</div>
            </div>
          </div>
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}
