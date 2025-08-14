"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Target, FileDown, Eye, TrendingUp, Zap } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { processFormsForDisplay } from "@/lib/form"
import type { ScaledFormData } from "@/lib/form/schema"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditDisplay } from "@/components/credits/CreditDisplay"
import { PDFExportButton } from "@/components/ui/pdf-export-button"
import type { CreditBalance } from "@/lib/credits/types"
import { creditManager } from "@/lib/credits/manager"
import { fallbackCreditStorage } from "@/lib/credits/fallback-storage"

// Add these imports at the top
import { useAuth } from "@/lib/auth/context"
import { WelcomeScreen } from "@/components/auth/WelcomeScreen"
import { UserProfile } from "@/components/auth/UserProfile"
import { useHeapAnalytics } from "@/hooks/useHeapAnalytics"

// Import components
import { UrlInput } from "./page/components/UrlInput"
import { CaptureDisplay } from "./page/components/CaptureDisplay"
import { DebugPanel } from "./page/components/DebugPanel"
import { CaptureNotification } from "@/components/ui/capture-notification"
import { FloatingAnchorButton } from "@/components/ui/floating-anchor-button"
import EnhancedLoadingScreen from "@/components/ui/enhanced-loading-screen"

// Import hooks and utilities
import { useCTAMatcher } from "./page/hooks/useCTAMatcher"
import { findCTAPrediction, fetchClickPredictions } from "./page/utils"
import { compressScreenshotClient } from "@/lib/utils/client-compression"

// Import types
import type { CaptureResult, CTAInsight, MatchedElement, DebugMatch, ClickPredictionResult } from "./page/types"
import { Globe } from "lucide-react"
import { analysisStorage } from "@/lib/analysis/storage"

export default function OxoginAI() {
  // Move ALL useState to the very top to prevent initialization errors
  const [url, setUrl] = useState("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturingDevice, setCapturingDevice] = useState<"desktop" | "mobile" | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  // Credit state now managed by global store
  const [creditsDeductedForCurrentAnalysis, setCreditsDeductedForCurrentAnalysis] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [hasSkipped, setHasSkipped] = useState(false)
  const [isFullAnalysisLoading, setIsFullAnalysisLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStage, setLoadingStage] = useState("")
  const [completedSteps, setCompletedSteps] = useState({
    desktopCapture: false,
    desktopAnalysis: false,
    desktopOpenAI: false,
    mobileCapture: false,
    mobileAnalysis: false,
    mobileOpenAI: false,
    finalizing: false,
  })
  const [isCROAnalyzing, setIsCROAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState("desktop")
  const [showDOMAnalysis, setShowDOMAnalysis] = useState(false)

  // Notification state
  const [showCaptureNotification, setShowCaptureNotification] = useState(false)
  const [notificationError, setNotificationError] = useState<{
    type: "stall" | "failure" | "timeout"
    deviceType: "desktop" | "mobile" | "both"
    progress: number
    stage: string
  } | null>(null)
  const [lastProgressUpdate, setLastProgressUpdate] = useState<number>(Date.now())
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const stallTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Auto-save state
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize CTA matchers AFTER state declarations
  const desktopCtaMatcher = useCTAMatcher({ width: 0, height: 0 })
  const mobileCtaMatcher = useCTAMatcher({ width: 0, height: 0 })

  // Add the auth hook
  const { user, loading: authLoading } = useAuth()
  
  // Add analytics hook
  const { trackEvent, addUserProperties } = useHeapAnalytics()

  // Add this function to handle skipping auth
  const handleSkipAuth = () => {
    setHasSkipped(true)
    setShowWelcome(false)
    trackEvent('Auth Skipped', { timestamp: new Date().toISOString() })
  }

  // Add this useEffect to handle auth state changes
  useEffect(() => {
    if (user) {
      setShowWelcome(false)
    }
  }, [user])

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

  // Get current device state based on active tab
  const getCurrentDeviceState = () => {
    if (activeTab === "mobile") {
      return {
        captureResult: mobileCaptureResult,
        analysisResult: mobileAnalysisResult,
        matchedElement: mobileMatchedElement,
        debugMatches: mobileDebugMatches,
        imageSize: mobileImageSize,
        formBoundaryBoxes: mobileFormBoundaryBoxes,
        clickPredictions: mobileClickPredictions,
        showTooltip: mobileShowTooltip,
        primaryCTAPrediction: mobilePrimaryCTAPrediction,
        openAIResult: mobileOpenAIResult,
        croAnalysisResult: mobileCroAnalysisResult,
        ctaMatcher: mobileCtaMatcher,
        setters: {
          setCaptureResult: setMobileCaptureResult,
          setAnalysisResult: setMobileAnalysisResult,
          setMatchedElement: setMobileMatchedElement,
          setDebugMatches: setMobileDebugMatches,
          setImageSize: setMobileImageSize,
          setFormBoundaryBoxes: setMobileFormBoundaryBoxes,
          setClickPredictions: setMobileClickPredictions,
          setShowTooltip: setMobileShowTooltip,
          setPrimaryCTAPrediction: setMobilePrimaryCTAPrediction,
          setOpenAIResult: setMobileOpenAIResult,
          setCroAnalysisResult: setMobileCroAnalysisResult,
        },
      }
    } else {
      return {
        captureResult: desktopCaptureResult,
        analysisResult: desktopAnalysisResult,
        matchedElement: desktopMatchedElement,
        debugMatches: desktopDebugMatches,
        imageSize: desktopImageSize,
        formBoundaryBoxes: desktopFormBoundaryBoxes,
        clickPredictions: desktopClickPredictions,
        showTooltip: desktopShowTooltip,
        primaryCTAPrediction: desktopPrimaryCTAPrediction,
        openAIResult: desktopOpenAIResult,
        croAnalysisResult: desktopCroAnalysisResult,
        ctaMatcher: desktopCtaMatcher,
        setters: {
          setCaptureResult: setDesktopCaptureResult,
          setAnalysisResult: setDesktopAnalysisResult,
          setMatchedElement: setDesktopMatchedElement,
          setDebugMatches: setDesktopDebugMatches,
          setImageSize: setDesktopImageSize,
          setFormBoundaryBoxes: setDesktopFormBoundaryBoxes,
          setClickPredictions: setDesktopClickPredictions,
          setShowTooltip: setDesktopShowTooltip,
          setPrimaryCTAPrediction: setDesktopPrimaryCTAPrediction,
          setOpenAIResult: setDesktopOpenAIResult,
          setCroAnalysisResult: setDesktopCroAnalysisResult,
        },
      }
    }
  }

  // Auto-save functionality
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
          if (process.env.NODE_ENV === "development") {
            console.log("💾 Analysis auto-saved:", analysisId)
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

  // Auto-save effect
  useEffect(() => {
    if (desktopCaptureResult || mobileCaptureResult) {
      saveCurrentAnalysis()
    }
  }, [
    desktopCaptureResult,
    mobileCaptureResult,
    desktopAnalysisResult,
    mobileAnalysisResult,
    desktopCroAnalysisResult,
    mobileCroAnalysisResult,
    saveCurrentAnalysis,
  ])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Notification handlers
  const handleCaptureNotificationClose = useCallback(() => {
    setShowCaptureNotification(false)
    setNotificationError(null)
  }, [])

  const handleCaptureNotificationRetry = useCallback(() => {
    setShowCaptureNotification(false)
    setNotificationError(null)
    // Retry the current capture by resetting state and triggering a new capture
    if (url.trim()) {
      const isMobile = capturingDevice === "mobile"
      // Reset loading state
      setIsFullAnalysisLoading(false)
      setLoadingProgress(0)
      setLoadingStage("")
      setIsCapturing(false)
      setCapturingDevice(null)
      
      // Trigger a new capture after a short delay
      setTimeout(() => {
        setIsCapturing(true)
        setCapturingDevice(isMobile ? "mobile" : "desktop")
        if (!isMobile) {
          setIsFullAnalysisLoading(true)
          setLoadingProgress(0)
          setLoadingStage("Initializing comprehensive analysis...")
        }
        // The capture will be triggered by the existing logic
      }, 100)
    }
  }, [capturingDevice, url])

  const handleCaptureNotificationTryNewUrl = useCallback(() => {
    setShowCaptureNotification(false)
    setNotificationError(null)
    // Clear the URL and reset state
    setUrl("")
    setIsFullAnalysisLoading(false)
    setLoadingProgress(0)
    setLoadingStage("")
    setIsCapturing(false)
    setCapturingDevice(null)
  }, [])

  // Stall detection logic
  const checkForStall = useCallback(() => {
    if (isFullAnalysisLoading && loadingProgress > 0 && loadingProgress < 100) {
      const now = Date.now()
      const timeSinceLastUpdate = now - lastProgressUpdate
      
      // If no progress for 30 seconds, consider it stalled
      if (timeSinceLastUpdate > 30000) {
        const deviceType = capturingDevice || "both"
        setNotificationError({
          type: "stall",
          deviceType: deviceType as "desktop" | "mobile" | "both",
          progress: loadingProgress,
          stage: loadingStage
        })
        setShowCaptureNotification(true)
        
        // Clear the stall timeout
        if (stallTimeoutRef.current) {
          clearTimeout(stallTimeoutRef.current)
          stallTimeoutRef.current = null
        }
      }
    }
  }, [isFullAnalysisLoading, loadingProgress, lastProgressUpdate, capturingDevice, loadingStage])

  // Effect to monitor for stalls
  useEffect(() => {
    if (isFullAnalysisLoading && loadingProgress > 0 && loadingProgress < 100) {
      // Set up stall detection
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current)
      }
      
      stallTimeoutRef.current = setTimeout(() => {
        checkForStall()
      }, 30000) // 30 seconds
    } else {
      // Clear stall detection when not loading
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current)
        stallTimeoutRef.current = null
      }
    }

    return () => {
      if (stallTimeoutRef.current) {
        clearTimeout(stallTimeoutRef.current)
        stallTimeoutRef.current = null
      }
    }
  }, [isFullAnalysisLoading, loadingProgress, checkForStall])

  // Effect to monitor for timeouts (60 seconds total)
  useEffect(() => {
    if (isFullAnalysisLoading && loadingProgress > 0 && loadingProgress < 100) {
      const timeoutId = setTimeout(() => {
        // If still loading after 60 seconds, show timeout notification
        if (isFullAnalysisLoading && loadingProgress < 100) {
          const deviceType = capturingDevice || "both"
          setNotificationError({
            type: "timeout",
            deviceType: deviceType as "desktop" | "mobile" | "both",
            progress: loadingProgress,
            stage: loadingStage
          })
          setShowCaptureNotification(true)
        }
      }, 60000) // 60 seconds

      return () => clearTimeout(timeoutId)
    }
  }, [isFullAnalysisLoading, loadingProgress, capturingDevice, loadingStage])

  // Update last progress update when progress changes
  useEffect(() => {
    if (loadingProgress > 0) {
      setLastProgressUpdate(Date.now())
    }
  }, [loadingProgress])

  // Cleanup notification when capture completes successfully
  useEffect(() => {
    if (loadingProgress === 100 && showCaptureNotification) {
      setShowCaptureNotification(false)
      setNotificationError(null)
    }
  }, [loadingProgress, showCaptureNotification])

  // Add this helper function after the getCurrentDeviceState function
  const calculateCostSavingsConsistent = (
    primaryCTAPrediction: ClickPredictionResult | null,
    clickPredictions: ClickPredictionResult[],
  ) => {
    console.log("🔍 CRO Cost Calculation: Starting calculation...")

    // Use the exact same logic as tooltip metrics with null checks
    if (primaryCTAPrediction) {
      // Use the wastedSpend directly from the primary CTA prediction (same as tooltip)
      const primaryWastedSpend = primaryCTAPrediction.wastedSpend || 0
      console.log("🔍 CRO Cost Calculation: Using primary CTA wastedSpend:", primaryWastedSpend)

      if (primaryWastedSpend > 0) {
        return primaryWastedSpend
      }
    }

    // Fallback: Calculate from all click predictions using EXACT same logic as tooltip
    if (!clickPredictions || clickPredictions.length === 0) {
      console.log("🔍 CRO Cost Calculation: No click predictions available")
      return 0
    }

    // Sum up all wastedSpend values from all predictions (same as tooltip aggregation)
    const totalWastedSpend = clickPredictions.reduce((sum, prediction) => {
      const wastedSpend = prediction?.wastedSpend || 0
      console.log(`🔍 Element ${prediction?.elementId || "unknown"}: $${wastedSpend} wasted spend`)
      return sum + wastedSpend
    }, 0)

    console.log("🔍 CRO Cost Calculation: Total wasted spend:", totalWastedSpend)
    return totalWastedSpend
  }

  // Analysis deduplication - track active analysis requests
  const activeAnalysisRequests = useRef(new Set<string>())

  // Helper function to create analysis request key
  const createAnalysisKey = (deviceType: string, primaryCTAId: string, url: string) => {
    return `${deviceType}-${primaryCTAId}-${url}`
  }

  // Helper function to check if analysis is already running
  const isAnalysisRunning = (deviceType: string, primaryCTAId: string, url: string) => {
    const key = createAnalysisKey(deviceType, primaryCTAId, url)
    return activeAnalysisRequests.current.has(key)
  }

  // Helper function to mark analysis as started
  const startAnalysis = (deviceType: string, primaryCTAId: string, url: string) => {
    const key = createAnalysisKey(deviceType, primaryCTAId, url)
    activeAnalysisRequests.current.add(key)
    console.log(`🔒 Analysis started: ${key}`)
  }

  // Helper function to mark analysis as completed
  const completeAnalysis = (deviceType: string, primaryCTAId: string, url: string) => {
    const key = createAnalysisKey(deviceType, primaryCTAId, url)
    activeAnalysisRequests.current.delete(key)
    console.log(`🔓 Analysis completed: ${key}`)
  }

  // Add this function to trigger CRO analysis
  const triggerCROAnalysis = async (
    captureResult: CaptureResult,
    clickPredictions: ClickPredictionResult[],
    primaryCTAId: string,
    primaryCTAPrediction: ClickPredictionResult,
    matchedElement: MatchedElement,
    isMobile: boolean,
  ) => {
    const deviceType = isMobile ? "mobile" : "desktop"
    const url = captureResult.domData?.url || "unknown"
    
    // Check if analysis is already running for this device/CTA/URL combination
    if (isAnalysisRunning(deviceType, primaryCTAId, url)) {
      console.log(`🔒 CRO analysis already running for ${deviceType} - ${primaryCTAId} - ${url}`)
      return null
    }

    // Mark analysis as started
    startAnalysis(deviceType, primaryCTAId, url)

    try {
      console.log(`🎯 Auto-triggering CRO analysis for ${deviceType}...`)

      const dynamicBaseline = primaryCTAPrediction.ctr || 0.065

      const requestPayload = {
        domData: captureResult.domData,
        clickPredictions,
        primaryCTAId,
        deviceType,
        dynamicBaseline,
        isFormRelated: matchedElement?.isFormRelated || false,
        primaryCTAPrediction,
        matchedElement,
        allDOMElements: captureResult.domData,
        analysisMetadata: {
          imageSize: isMobile ? mobileImageSize : desktopImageSize,
          timestamp: new Date().toISOString(),
          url,
          enhancedLabelsAvailable: clickPredictions?.some((p) => p.text && p.text !== p.elementId) || false,
        },
      }

      // Trigger both CRO analyses simultaneously - no dependencies
      const compressedScreenshot = await compressScreenshotClient(captureResult.screenshot, isMobile ? "mobile" : "desktop")
      
      const [originalCROResponse, openaiCROResponse] = await Promise.allSettled([
        fetch("/api/analyze-cro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        }),
        fetch("/api/analyze-cro-openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryCTAId: primaryCTAId,
            primaryCTAText: primaryCTAPrediction.text || matchedElement?.text || "Primary CTA",
            deviceType: isMobile ? "mobile" : "desktop",
            currentCTR: dynamicBaseline * 100,
            projectedCTR: dynamicBaseline * 1.4 * 100,
            improvementPotential: ((dynamicBaseline * 1.4 - dynamicBaseline) / dynamicBaseline) * 100,
            costSavings: primaryCTAPrediction?.wastedSpend || Math.round(Math.random() * 2000 + 500),
            screenshot: compressedScreenshot, // Use compressed screenshot
          }),
        }),
      ])

      let croAnalysisResult = null

      if (originalCROResponse.status === "fulfilled" && originalCROResponse.value.ok) {
        const result = await originalCROResponse.value.json()
        console.log(`🎯 Original CRO analysis completed for ${isMobile ? "mobile" : "desktop"}:`, result)
        croAnalysisResult = result
      }

      if (openaiCROResponse.status === "fulfilled" && openaiCROResponse.value.ok) {
        const result = await openaiCROResponse.value.json()
        console.log(`🧠 OpenAI CRO analysis completed for ${isMobile ? "mobile" : "desktop"}:`, result)
        // Merge OpenAI result with original CRO result
        if (croAnalysisResult) {
          croAnalysisResult.openAIResult = result
        } else {
          croAnalysisResult = { openAIResult: result }
        }
      }

      // Save the CRO analysis result to the appropriate state
      if (croAnalysisResult) {
        if (isMobile) {
          setMobileCroAnalysisResult(croAnalysisResult)
        } else {
          setDesktopCroAnalysisResult(croAnalysisResult)
        }
      }

      return { originalCROResponse, openaiCROResponse, croAnalysisResult }
    } catch (error) {
      console.error(`CRO analysis error for ${deviceType}:`, error)
    } finally {
      // Mark analysis as completed
      completeAnalysis(deviceType, primaryCTAId, url)
    }
    return null
  }

  // NEW: Function to trigger OpenAI analysis as part of comprehensive flow
  const triggerOpenAIAnalysis = async (
    captureResult: CaptureResult,
    primaryCTAPrediction: ClickPredictionResult,
    matchedElement: MatchedElement,
    isMobile: boolean,
  ) => {
    const deviceType = isMobile ? "mobile" : "desktop"
    const url = captureResult.domData?.url || "unknown"
    const primaryCTAId = primaryCTAPrediction.elementId
    
    // Check if analysis is already running for this device/CTA/URL combination
    if (isAnalysisRunning(deviceType, primaryCTAId, url)) {
      console.log(`🔒 OpenAI analysis already running for ${deviceType} - ${primaryCTAId} - ${url}`)
      return null
    }

    // Mark analysis as started
    startAnalysis(deviceType, primaryCTAId, url)

    try {
      console.log(`🧠 Auto-triggering OpenAI analysis for ${deviceType}...`)

      const dynamicBaseline = primaryCTAPrediction.ctr || 0.065

      // Compress screenshot before sending
      const compressedScreenshot = await compressScreenshotClient(captureResult.screenshot, deviceType)

      const requestPayload = {
        primaryCTAId,
        primaryCTAText: primaryCTAPrediction.text || matchedElement?.text || "Primary CTA",
        deviceType,
        currentCTR: dynamicBaseline * 100,
        projectedCTR: dynamicBaseline * 1.4 * 100,
        improvementPotential: ((dynamicBaseline * 1.4 - dynamicBaseline) / dynamicBaseline) * 100,
        costSavings: primaryCTAPrediction?.wastedSpend || Math.round(Math.random() * 2000 + 500),
        screenshot: compressedScreenshot, // Use compressed screenshot
      }

      const response = await fetch("/api/analyze-cro-openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`🧠 OpenAI analysis completed for ${isMobile ? "mobile" : "desktop"}:`, result)

        // Store the OpenAI result
        if (isMobile) {
          setMobileOpenAIResult(result)
          setCompletedSteps((prev) => ({ ...prev, mobileOpenAI: true }))
        } else {
          setDesktopOpenAIResult(result)
          setCompletedSteps((prev) => ({ ...prev, desktopOpenAI: true }))
        }

        return result
      } else {
        console.error(`🧠 OpenAI analysis failed for ${deviceType}:`, response.status)
      }
    } catch (error) {
      console.error(`🧠 OpenAI analysis error for ${deviceType}:`, error)
    } finally {
      // Mark analysis as completed
      completeAnalysis(deviceType, primaryCTAId, url)
    }
    return null
  }

  // Handle image load - using exact same logic for both desktop and mobile
  const handleImageLoad = (imageElement: HTMLImageElement, isMobile = false) => {
    const newImageSize = {
      width: imageElement.naturalWidth,
      height: imageElement.naturalHeight,
    }

    // Only log image load in development
    if (process.env.NODE_ENV === "development") {
      console.log(`📐 ${isMobile ? "Mobile" : "Desktop"} image loaded with size:`, newImageSize)
    }

    if (isMobile) {
      setMobileImageSize(newImageSize)
      if (mobileCaptureResult) {
        // Use exact same logic as desktop but with mobile-appropriate fold line
        const processedForms = processFormsForDisplay(mobileCaptureResult.domData, imageElement, {
          overlapThreshold: 0.2,
          excludeSearchForms: true,
          foldLinePosition: 600, // Mobile fold line
        })
        setMobileFormBoundaryBoxes(processedForms)
      }
    } else {
      setDesktopImageSize(newImageSize)
      if (desktopCaptureResult) {
        // Desktop logic
        const processedForms = processFormsForDisplay(desktopCaptureResult.domData, imageElement, {
          overlapThreshold: 0.2,
          excludeSearchForms: true,
          foldLinePosition: 1000, // Desktop fold line
        })
        setDesktopFormBoundaryBoxes(processedForms)
      }
    }
  }

  // Simple credit deduction function - just uses state
  const deductCreditsFromState = useCallback(() => {
    // Check if credits have already been deducted for this analysis
    if (creditsDeductedForCurrentAnalysis) {
      console.log("💳 Credits already deducted for this analysis")
      return true
    }

    // Credit deductions now handled automatically by API calls via global store
    // Just mark as deducted for this analysis to prevent double deduction
    setCreditsDeductedForCurrentAnalysis(true)
    return true
  }, [creditsDeductedForCurrentAnalysis])

  // Single capture function that handles both desktop and mobile
  const captureWebsite = useCallback(
    async (isMobile = false) => {
      if (!url.trim()) {
        return
      }

      // Track capture attempt
      trackEvent('Capture Started', {
        device: isMobile ? 'mobile' : 'desktop',
        url: url,
        hasCredits: true, // Credit checks now handled by API
        creditBalance: 10 // Default value - actual balance managed by global store
      })

      // Credit checks now handled by global store and API

      // Only start full loading sequence on desktop capture (the initial one)
      if (!isMobile) {
        setIsFullAnalysisLoading(true)
        setLoadingProgress(0)
        setLoadingStage("Initializing comprehensive analysis...")
        setCompletedSteps({
          desktopCapture: false,
          desktopAnalysis: false,
          desktopOpenAI: false,
          mobileCapture: false,
          mobileAnalysis: false,
          mobileOpenAI: false,
          finalizing: false,
        })

        // Reset credits deducted flag for new analysis
        setCreditsDeductedForCurrentAnalysis(false)

        // Clear all state
        setDesktopCaptureResult(null)
        setDesktopAnalysisResult(null)
        setDesktopMatchedElement(null)
        setDesktopDebugMatches([])
        setDesktopFormBoundaryBoxes([])
        setDesktopShowTooltip(false)
        setDesktopClickPredictions([])
        setDesktopPrimaryCTAPrediction(null)
        setDesktopOpenAIResult(null)
        setDesktopCroAnalysisResult(null)

        setMobileCaptureResult(null)
        setMobileAnalysisResult(null)
        setMobileMatchedElement(null)
        setMobileDebugMatches([])
        setMobileFormBoundaryBoxes([])
        setMobileShowTooltip(false)
        setMobileClickPredictions([])
        setMobilePrimaryCTAPrediction(null)
        setMobileOpenAIResult(null)
        setMobileCroAnalysisResult(null)
      }

      setIsCapturing(true)
      setCapturingDevice(isMobile ? "mobile" : "desktop")

      try {
        const userId = getCurrentUserId()

        if (process.env.NODE_ENV === "development") {
          console.log(`🚀 Starting ${isMobile ? "mobile" : "desktop"} capture with userId:`, userId)
        }

        if (!isMobile) {
          setLoadingProgress(5)
          setLoadingStage("Capturing desktop screenshot...")
        } else {
          setLoadingProgress(40)
          setLoadingStage("Capturing mobile screenshot...")
        }

        const response = await fetch("/api/capture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url, isMobile, userId }),
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

        if (!isMobile) {
          setLoadingProgress(15)
          setLoadingStage("Processing desktop data...")
        } else {
          setLoadingProgress(50)
          setLoadingStage("Processing mobile data...")
        }

        let data
        try {
          data = await response.json()
        } catch (jsonError) {
          if (process.env.NODE_ENV === "development") {
            console.error("Failed to parse JSON response:", jsonError)
          }
          throw new Error("Server returned invalid JSON response")
        }

        if (!data || !data.screenshot || !data.domData) {
          if (process.env.NODE_ENV === "development") {
            console.error("Invalid response structure:", data)
          }
          throw new Error("Invalid response structure from server")
        }

        // Trigger credit refresh after successful capture
        if (process.env.NODE_ENV === "development") {
          console.log("💳 Capture successful, refreshing credits. Remaining:", data.creditsRemaining)
        }
        triggerCreditRefresh()

        // Track successful capture
        trackEvent('Capture Completed', {
          device: isMobile ? 'mobile' : 'desktop',
          url: url,
          hasFormFields: data.domData.formFields?.length > 0,
          formFieldsCount: data.domData.formFields?.length || 0,
          buttonsCount: data.domData.buttons?.length || 0,
          formsCount: data.domData.forms?.length || 0,
          creditsRemaining: data.creditsRemaining,
          pageTitle: data.domData.title
        })

        // Only log capture success in development
        if (process.env.NODE_ENV === "development") {
          console.log(`✅ ${isMobile ? "mobile" : "desktop"} capture successful:`, {
            title: data.domData.title,
            formFields: data.domData.formFields?.length || 0,
            buttons: data.domData.buttons?.length || 0,
            forms: data.domData.forms?.length || 0,
            creditsRemaining: data.creditsRemaining,
          })
        }

        if (isMobile) {
          setMobileCaptureResult(data)
          setCompletedSteps((prev) => ({ ...prev, mobileCapture: true }))
        } else {
          setDesktopCaptureResult(data)
          setCompletedSteps((prev) => ({ ...prev, desktopCapture: true }))
          setActiveTab("desktop")
        }

        // Auto-analyze CTA after successful capture
        const autoAnalyzeCTA = async (attempt = 1) => {
          try {
            // Only log auto-analysis start in development
            if (process.env.NODE_ENV === "development") {
              console.log(`🔄 Auto-analyzing ${isMobile ? "mobile" : "desktop"} CTA (attempt ${attempt})...`)
            }

            setIsAnalyzing(true)

            if (!isMobile) {
              setLoadingProgress(20)
              setLoadingStage("Analyzing desktop call-to-action...")
            } else {
              setLoadingProgress(55)
              setLoadingStage("Analyzing mobile call-to-action...")
            }

            // Clear analysis state for the appropriate device
            if (isMobile) {
              setMobileAnalysisResult(null)
              setMobileMatchedElement(null)
              setMobileDebugMatches([])
              setMobileShowTooltip(false)
              setMobilePrimaryCTAPrediction(null)
            } else {
              setDesktopAnalysisResult(null)
              setDesktopMatchedElement(null)
              setDesktopDebugMatches([])
              setDesktopShowTooltip(false)
              setDesktopPrimaryCTAPrediction(null)
            }

            // STEP 1: Fetch click predictions FIRST
            if (process.env.NODE_ENV === "development") {
              console.log("📊 Fetching click predictions...")
            }

            const predictions = await fetchClickPredictions(
              data,
              isMobile ? setMobileClickPredictions : setDesktopClickPredictions,
            )

            // STEP 2: Analyze CTA with AI
            if (process.env.NODE_ENV === "development") {
              console.log("🤖 Analyzing CTA with AI...")
            }

            const response = await fetch(data.screenshot)
            const blob = await response.blob()

            const formData = new FormData()
            formData.append("image", blob, "screenshot.png")
            formData.append("domData", JSON.stringify(data.domData))

            const analysisResponse = await fetch("/api/analyze-cta", {
              method: "POST",
              body: formData,
            })

            if (!analysisResponse.ok) {
              throw new Error("Failed to analyze CTA")
            }

            const analysisData = await analysisResponse.json()

            // Only log AI analysis completion in development
            if (process.env.NODE_ENV === "development") {
              console.log("✅ AI analysis complete:", analysisData.result.text)
            }

            if (isMobile) {
              setMobileAnalysisResult(analysisData.result)
              setCompletedSteps((prev) => ({ ...prev, mobileAnalysis: true }))
            } else {
              setDesktopAnalysisResult(analysisData.result)
              setCompletedSteps((prev) => ({ ...prev, desktopAnalysis: true }))
            }

            // STEP 3: Match DOM element
            if (process.env.NODE_ENV === "development") {
              console.log("🎯 Matching DOM element...")
            }

            const ctaMatcher = isMobile ? mobileCtaMatcher : desktopCtaMatcher
            const { match, debug } = ctaMatcher.findMatchingElement(analysisData.result, data.domData)

            if (isMobile) {
              setMobileMatchedElement(match)
              setMobileDebugMatches(debug)
            } else {
              setDesktopMatchedElement(match)
              setDesktopDebugMatches(debug)
            }

            if (match) {
              // Only log DOM match in development
              if (process.env.NODE_ENV === "development") {
                console.log("✅ DOM match found:", match.text)
              }

              // STEP 4: Find matching prediction and show tooltip
              if (process.env.NODE_ENV === "development") {
                console.log("🔍 Finding matching prediction...")
              }
              const currentPredictions = isMobile ? mobileClickPredictions : desktopClickPredictions
              const prediction = findCTAPrediction(
                predictions || currentPredictions,
                match,
                analysisData.result.text,
                analysisData.result,
              )

              if (prediction) {
                // Only log prediction found in development
                if (process.env.NODE_ENV === "development") {
                  console.log("✅ Prediction found, showing tooltip:", prediction.elementId)
                }

                if (isMobile) {
                  setMobilePrimaryCTAPrediction(prediction)
                  setTimeout(() => {
                    setMobileShowTooltip(true)
                    if (process.env.NODE_ENV === "development") {
                      console.log("🎉 Mobile tooltip should now be visible!")
                    }
                  }, 100)
                } else {
                  setDesktopPrimaryCTAPrediction(prediction)
                  setTimeout(() => {
                    setDesktopShowTooltip(true)
                    if (process.env.NODE_ENV === "development") {
                      console.log("🎉 Desktop tooltip should now be visible!")
                    }
                  }, 100)
                }
              } else {
                if (process.env.NODE_ENV === "development") {
                  console.log("⚠️ No matching prediction found")
                }
              }

              // STEP 5: Auto-trigger OpenAI analysis (NEW)
              if (prediction && match) {
                if (!isMobile) {
                  setLoadingProgress(25)
                  setLoadingStage("Generating desktop AI insights...")
                } else {
                  setLoadingProgress(65)
                  setLoadingStage("Generating mobile AI insights...")
                }

                // Trigger OpenAI analysis as part of comprehensive flow
                await triggerOpenAIAnalysis(data, prediction, match, isMobile)

                if (!isMobile) {
                  setLoadingProgress(30)
                  setLoadingStage("Desktop analysis complete, starting mobile...")
                } else {
                  setLoadingProgress(75)
                  setLoadingStage("Mobile analysis complete, generating CRO insights...")
                }
              }

              // STEP 6: Auto-trigger CRO analysis
              if (prediction && match) {
                if (!isMobile) {
                  setLoadingProgress(32)
                  setLoadingStage("Generating desktop CRO analysis...")
                } else {
                  setLoadingProgress(80)
                  setLoadingStage("Generating mobile CRO analysis...")
                }

                // Calculate CRO metrics immediately
                const currentCTR = prediction.ctr || 0.065
                const projectedCTR = currentCTR * 1.5
                const improvementPotential = ((projectedCTR - currentCTR) / currentCTR) * 100
                const costSavings = calculateCostSavingsConsistent(prediction, predictions || currentPredictions)

                console.log("🔍 CRO Analysis: Calculated metrics:", {
                  currentCTR,
                  projectedCTR,
                  improvementPotential,
                  costSavings,
                })

                // Trigger CRO analysis
                await triggerCROAnalysis(
                  data,
                  predictions || currentPredictions,
                  prediction.elementId,
                  prediction,
                  match,
                  isMobile,
                )

                if (!isMobile) {
                  setLoadingProgress(35)
                  setLoadingStage("Desktop analysis complete, starting mobile...")
                } else {
                  setLoadingProgress(85)
                  setLoadingStage("Mobile analysis complete, finalizing...")
                }
              }

              // STEP 7: Enable DOM Analysis tab (moved from STEP 5)
              setShowDOMAnalysis(true)
              if (process.env.NODE_ENV === "development") {
                console.log("✅ DOM Analysis tab enabled")
              }
            } else {
              if (process.env.NODE_ENV === "development") {
                console.log("❌ No DOM match found")
              }
            }

            // Auto-trigger mobile capture only if this was a desktop capture
            if (!isMobile) {
              if (process.env.NODE_ENV === "development") {
                console.log("🚀 Auto-triggering mobile capture after desktop completion...")
              }

              // Start mobile capture in background after a short delay
              setTimeout(async () => {
                try {
                  if (process.env.NODE_ENV === "development") {
                    console.log("📱 Starting background mobile capture...")
                  }
                  await captureWebsite(true) // Capture mobile version
                } catch (error) {
                  if (process.env.NODE_ENV === "development") {
                    console.error("❌ Auto mobile capture failed:", error)
                  }
                }
              }, 1000) // 1 second delay
            } else {
              // Mobile analysis complete - everything is done
              setLoadingProgress(90)
              setLoadingStage("Finalizing comprehensive analysis...")
              setCompletedSteps((prev) => ({ ...prev, finalizing: true }))

              // Deduct credits at 90% completion
              deductCreditsFromState()

              setTimeout(() => {
                setLoadingProgress(100)
                setLoadingStage("Analysis complete!")

                // Hide loading after completion
                setTimeout(() => {
                  setIsFullAnalysisLoading(false)
                  setLoadingProgress(0)
                  setLoadingStage("")
                  setIsCROAnalyzing(false)
                }, 1000)
              }, 2000)
            }
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              console.error(`❌ Auto-analysis attempt ${attempt} failed:`, error)
            }

            // Retry logic: only one retry allowed
            if (attempt === 1) {
              if (process.env.NODE_ENV === "development") {
                console.log("🔄 Retrying auto-analysis...")
              }
              setTimeout(() => autoAnalyzeCTA(2), 1000)
            } else {
              if (process.env.NODE_ENV === "development") {
                console.log("❌ Auto-analysis failed after retry")
              }
              // Hide loading on error
              if (isMobile) {
                checkIfAnalysisComplete()
              }
            }
          } finally {
            setIsAnalyzing(false)
          }
        }

        // Start auto-analysis
        autoAnalyzeCTA()
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error capturing website:", error)
        }
        
        // Show notification for capture failure
        const deviceType = isMobile ? "mobile" : "desktop"
        const errorType = error instanceof Error && error.message.includes("timeout") ? "timeout" : "failure"
        
        setNotificationError({
          type: errorType,
          deviceType: deviceType as "desktop" | "mobile" | "both",
          progress: loadingProgress,
          stage: loadingStage
        })
        setShowCaptureNotification(true)
        
        // Hide loading on error
        if (!isMobile) {
          setIsFullAnalysisLoading(false)
          setLoadingProgress(0)
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
      desktopImageSize,
      mobileImageSize,
      deductCreditsFromState,
    ],
  )

  // Check if analysis is complete and hide loading
  const checkIfAnalysisComplete = useCallback(() => {
    // Wait for both desktop and mobile analysis to complete, plus OpenAI analysis
    if (desktopAnalysisResult && mobileAnalysisResult && desktopOpenAIResult && mobileOpenAIResult) {
      setLoadingProgress(90)
      setLoadingStage("Finalizing comprehensive AI analysis...")

      // Deduct credits at 90% completion
      deductCreditsFromState()

      // Wait a bit then complete
      setTimeout(() => {
        setLoadingProgress(100)
        setLoadingStage("Analysis complete!")

        // Hide loading after a brief moment
        setTimeout(() => {
          setIsFullAnalysisLoading(false)
          setLoadingProgress(0)
          setLoadingStage("")
          setIsCROAnalyzing(false)
        }, 1000)
      }, 2000)
    }
  }, [desktopAnalysisResult, mobileAnalysisResult, desktopOpenAIResult, mobileOpenAIResult, deductCreditsFromState])

  // Effect to check completion when analysis results change
  useEffect(() => {
    if (isFullAnalysisLoading) {
      checkIfAnalysisComplete()
    }
  }, [
    desktopAnalysisResult,
    mobileAnalysisResult,
    desktopOpenAIResult,
    mobileOpenAIResult,
    isFullAnalysisLoading,
    checkIfAnalysisComplete,
  ])

  // Cleanup effect to clear analysis requests on unmount
  useEffect(() => {
    return () => {
      activeAnalysisRequests.current.clear()
      console.log("🧹 Component unmounting - cleared active analysis requests")
    }
  }, [])

  // Analyze CTA for current device
  const analyzeCTA = async () => {
    const deviceState = getCurrentDeviceState()
    const isMobile = activeTab === "mobile"

    if (!deviceState.captureResult?.screenshot) {
      if (process.env.NODE_ENV === "development") {
        console.log("❌ No capture result for analysis")
      }
      return
    }

    setIsAnalyzing(true)
    deviceState.setters.setAnalysisResult(null)
    deviceState.setters.setMatchedElement(null)
    deviceState.setters.setDebugMatches([])
    deviceState.setters.setShowTooltip(false)
    deviceState.setters.setPrimaryCTAPrediction(null)

    try {
      if (process.env.NODE_ENV === "development") {
        console.log(`🔄 Starting ${isMobile ? "mobile" : "desktop"} CTA analysis...`)
      }

      // STEP 1: Fetch click predictions FIRST
      if (process.env.NODE_ENV === "development") {
        console.log("📊 Fetching click predictions...")
      }
      const predictions = await fetchClickPredictions(
        deviceState.captureResult,
        deviceState.setters.setClickPredictions,
      )

      // STEP 2: Analyze CTA with AI
      if (process.env.NODE_ENV === "development") {
        console.log("🤖 Analyzing CTA with AI...")
      }
      const response = await fetch(deviceState.captureResult.screenshot)
      const blob = await response.blob()

      const formData = new FormData()
      formData.append("image", blob, "screenshot.png")
      formData.append("domData", JSON.stringify(deviceState.captureResult.domData))

      const analysisResponse = await fetch("/api/analyze-cta", {
        method: "POST",
        body: formData,
      })

      if (!analysisResponse.ok) {
        throw new Error("Failed to analyze CTA")
      }

      const data = await analysisResponse.json()

      // Only log AI analysis completion in development
      if (process.env.NODE_ENV === "development") {
        console.log("✅ AI analysis complete:", data.result.text)
      }
      deviceState.setters.setAnalysisResult(data.result)

      // STEP 3: Match DOM element
      if (process.env.NODE_ENV === "development") {
        console.log("🎯 Matching DOM element...")
      }
      const { match, debug } = deviceState.ctaMatcher.findMatchingElement(
        data.result,
        deviceState.captureResult.domData,
      )
      deviceState.setters.setMatchedElement(match)
      deviceState.setters.setDebugMatches(debug)

      if (match) {
        // Only log DOM match in development
        if (process.env.NODE_ENV === "development") {
          console.log("✅ DOM match found:", match.text)
        }

        // STEP 4: Find matching prediction and show tooltip
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 Finding matching prediction...")
        }
        const prediction = findCTAPrediction(
          predictions || deviceState.clickPredictions,
          match,
          data.result.text,
          data.result,
        )

        if (prediction) {
          // Only log prediction found in development
          if (process.env.NODE_ENV === "development") {
            console.log("✅ Prediction found, showing tooltip:", prediction.elementId)
          }
          deviceState.setters.setPrimaryCTAPrediction(prediction)

          setTimeout(() => {
            deviceState.setters.setShowTooltip(true)
            if (process.env.NODE_ENV === "development") {
              console.log(`🎉 ${isMobile ? "Mobile" : "Desktop"} tooltip should now be visible!`)
            }
          }, 100)
        } else {
          if (process.env.NODE_ENV === "development") {
            console.log("⚠️ No matching prediction found")
          }
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log("❌ No DOM match found")
        }
      }

      // STEP 5: Enable DOM Analysis tab
      setShowDOMAnalysis(true)
      if (process.env.NODE_ENV === "development") {
        console.log("✅ DOM Analysis tab enabled")
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error analyzing CTA:", error)
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Reset analysis
  const resetAnalysis = () => {
    setUrl("")

    // Clear auto-save state
    setCurrentAnalysisId(null)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Clear active analysis requests
    activeAnalysisRequests.current.clear()
    console.log("🧹 Cleared all active analysis requests")

    // Reset loading states
    setIsFullAnalysisLoading(false)
    setLoadingProgress(0)
    setLoadingStage("")
    setCompletedSteps({
      desktopCapture: false,
      desktopAnalysis: false,
      desktopOpenAI: false,
      mobileCapture: false,
      mobileAnalysis: false,
      mobileOpenAI: false,
      finalizing: false,
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
    setDesktopOpenAIResult(null)
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
    setMobileOpenAIResult(null)
    setMobileCroAnalysisResult(null)

    setShowDOMAnalysis(false)
    setActiveTab("desktop")
  }

  const currentDeviceState = getCurrentDeviceState()

  // Add this early return for the welcome screen (before the main return)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (showWelcome && !user && !hasSkipped) {
    return <WelcomeScreen onSkip={handleSkipAuth} />
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Mobile Header - Only visible on mobile */}
      <div className="lg:hidden bg-white border-b border-gray-200 p-3 sm:p-4 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Target className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-semibold text-gray-900">Oxogin AI</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditDisplay />
            {user ? (
              <div className="text-xs text-gray-600 truncate max-w-16 sm:max-w-20">
                {user.user_metadata?.full_name || user.email}
              </div>
            ) : (
              <div className="text-xs text-gray-600">Guest</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 p-6 xl:p-8 flex-col shadow-sm flex-shrink-0">
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
              className="w-full justify-start gap-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg h-12"
              onClick={() => captureWebsite(false)}
              disabled={!url.trim() || isCapturing}
            >
              <Target className="w-5 h-5" />
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

            {/* Competitor Intel Button - Only show when analysis is complete */}
            {(desktopPrimaryCTAPrediction || mobilePrimaryCTAPrediction) && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-400 cursor-not-allowed rounded-lg h-12"
                disabled
                onClick={() => {}}
              >
                <Eye className="w-5 h-5" />
                Competitor Intel
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
          {url && (
            <div className="space-y-3 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-gray-700 mb-2 font-medium">Current Analysis</div>
                <div className="text-xs text-gray-600 break-all">{url}</div>
              </div>
            </div>
          )}

          {/* Credit Display */}
          <div className="mb-6">
            <CreditDisplay />
          </div>

          {/* User Profile Section */}
          <div className="mt-auto">
            {user ? (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-gray-900 font-medium">{user.user_metadata?.full_name || user.email}</div>
                </div>
                <UserProfile />
              </div>
            ) : (
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
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Responsive flex layout */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden" 
             style={{ 
               paddingBottom: 'env(safe-area-inset-bottom)', 
               paddingTop: 'env(safe-area-inset-top)' 
             }}>
          
          {/* Header Section - Ultra compact with badges */}
          <div className="flex-shrink-0 compact-height ultra-compact landscape-mobile">
            
            {/* Top badges row - Hidden on very small screens */}
            <div className="hidden sm:flex justify-center items-center gap-2 lg:gap-4 py-1 lg:py-2 hide-on-short">
              <div className="flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-md px-2 py-1">
                <div className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center">
                  <Target className="w-2 h-2 text-purple-700" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-gray-900">#1 CRO AI</div>
                  <div className="text-xs text-gray-600">Industry Leader</div>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-md px-2 py-1">
                <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center">
                  <TrendingUp className="w-2 h-2 text-blue-700" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-gray-900">1,000+</div>
                  <div className="text-xs text-gray-600">Daily Analyses</div>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-md px-2 py-1">
                <div className="w-4 h-4 bg-orange-100 rounded flex items-center justify-center">
                  <Zap className="w-2 h-2 text-orange-700" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-gray-900">Top 50</div>
                  <div className="text-xs text-gray-600">AI Apps 2025</div>
                </div>
              </div>
            </div>

            {/* Main title - Very compact */}
            <div className="text-center py-1 sm:py-2">
              <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-gray-900 mb-1">
                Predict Every <span className="text-blue-600">Click</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 hide-on-short">
                <span className="hidden sm:inline">
                  Instantly predict any page's conversion rate — no code, no spend, no wasted tests.
                </span>
                <span className="sm:hidden">
                  Predict conversion rates instantly
                </span>
              </p>
            </div>

            {/* URL Input - Always visible without scrolling */}
            <UrlInput
              url={url}
              setUrl={setUrl}
              onCapture={captureWebsite}
              isCapturing={isCapturing}
              capturingDevice={capturingDevice}
              disabled={false}
            />
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 pt-0">
            {/* Mobile Current Analysis Info */}
            {url && (
              <div className="lg:hidden mb-4">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-sm text-gray-700 mb-1 font-medium">Current Analysis</div>
                  <div className="text-xs text-gray-600 break-all">{url}</div>
                </div>
              </div>
            )}

            {/* Main Content - Show Loading or Results */}
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
            // Show results only when not loading - Always render analysis content for PDF export
            (desktopCaptureResult || mobileCaptureResult) && (
              <>
                {/* Tab Navigation - Mobile optimized */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-4 sm:mb-6">
                  <TabsList className="grid w-full grid-cols-2 h-10 sm:h-11 p-1">
                    <TabsTrigger 
                      value="desktop" 
                      className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
                    >
                      <Target className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="hidden xs:inline sm:hidden">Desk</span>
                      <span className="hidden sm:inline">Desktop</span>
                      <span className="xs:hidden">📱</span>
                      {desktopCaptureResult && (
                        <Badge variant="secondary" className="ml-0.5 sm:ml-1 text-xs px-1 sm:px-2 py-0">
                          <span className="hidden sm:inline">Ready</span>
                          <span className="sm:hidden">✓</span>
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="mobile" 
                      className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
                    >
                      <Target className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="hidden xs:inline sm:hidden">Mob</span>
                      <span className="hidden sm:inline">Mobile</span>
                      <span className="xs:hidden">📱</span>
                      {mobileCaptureResult && (
                        <Badge variant="secondary" className="ml-0.5 sm:ml-1 text-xs px-1 sm:px-2 py-0">
                          <span className="hidden sm:inline">Ready</span>
                          <span className="sm:hidden">✓</span>
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Always render analysis content for PDF export - hidden/shown via CSS */}
                <div className={`${activeTab === 'desktop' ? 'block' : 'hidden'}`}>
                  {desktopCaptureResult ? (
                    <>
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
                        onAnalyzeCTA={analyzeCTA}
                        onReset={resetAnalysis}
                        clickPredictions={desktopClickPredictions}
                        allDOMElements={desktopCaptureResult.domData}
                        funnelType="none"
                        funnelStep={1}
                      />

                      {/* Desktop Debug Panel - ONLY IN DEVELOPMENT */}
                      {process.env.NODE_ENV === "development" && (
                        <DebugPanel
                          matchedElement={desktopMatchedElement}
                          showTooltip={desktopShowTooltip}
                          primaryCTAPrediction={desktopPrimaryCTAPrediction}
                          clickPredictions={desktopClickPredictions}
                          imageSize={desktopImageSize}
                          captureResult={desktopCaptureResult}
                        />
                      )}
                    </>
                  ) : (
                    <Card>
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-base">Desktop Analysis</CardTitle>
                        <CardDescription className="text-sm">
                          Capture a desktop screenshot to begin analysis
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <p className="text-sm text-gray-500">
                          No desktop capture available. Use the capture button above to get started.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className={`${activeTab === 'mobile' ? 'block' : 'hidden'}`}>
                  {mobileCaptureResult ? (
                    <>
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
                        onAnalyzeCTA={analyzeCTA}
                        onReset={resetAnalysis}
                        clickPredictions={mobileClickPredictions}
                        allDOMElements={mobileCaptureResult.domData}
                        funnelType="none"
                        funnelStep={1}
                      />

                      {/* Mobile Debug Panel - ONLY IN DEVELOPMENT */}
                      {process.env.NODE_ENV === "development" && (
                        <DebugPanel
                          matchedElement={mobileMatchedElement}
                          showTooltip={mobileShowTooltip}
                          primaryCTAPrediction={mobilePrimaryCTAPrediction}
                          clickPredictions={mobileClickPredictions}
                          imageSize={mobileImageSize}
                          captureResult={mobileCaptureResult}
                        />
                      )}
                    </>
                  ) : (
                    <Card>
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-base">Mobile Analysis</CardTitle>
                        <CardDescription className="text-sm">
                          Capture a mobile screenshot to begin analysis
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <p className="text-sm text-gray-500">
                          No mobile capture available. Mobile capture will automatically start after desktop analysis,
                          or you can manually trigger it.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )
          )}
          </div>
        </div>
      </div>
      
      {/* Floating Anchor Button - More mobile-friendly positioning */}
      {(desktopAnalysisResult || mobileAnalysisResult || desktopOpenAIResult || mobileOpenAIResult) && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
          <FloatingAnchorButton 
            targetId="cro-results"
            showScrollToTop={true}
          />
        </div>
      )}
      
      {/* Capture Notification */}
      <CaptureNotification
        isVisible={showCaptureNotification}
        onClose={handleCaptureNotificationClose}
        onRetry={handleCaptureNotificationRetry}
        onTryNewUrl={handleCaptureNotificationTryNewUrl}
        errorType={notificationError?.type || "failure"}
        deviceType={notificationError?.deviceType || "both"}
        progress={notificationError?.progress || 0}
        stage={notificationError?.stage || ""}
        url={url}
      />
    </div>
  )
}
