"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Eye, Zap, Target, MousePointer } from 'lucide-react'

interface EnhancedLoadingScreenProps {
  loadingProgress: number
  loadingStage: string
  completedSteps: {
    desktopCapture: boolean
    desktopAnalysis: boolean
    desktopOpenAI?: boolean
    mobileCapture: boolean
    mobileAnalysis: boolean
    mobileOpenAI?: boolean
    finalizing?: boolean
  }
  url: string
  desktopCaptureResult?: any
  mobileCaptureResult?: any
  desktopClickPredictions?: any[]
  mobileClickPredictions?: any[]
}

// Detailed step tracking for granular progress
interface DetailedStep {
  id: string
  label: string
  progress: number
  status: 'pending' | 'active' | 'completed' | 'failed'
  duration?: number
  deviceType?: 'desktop' | 'mobile' | 'both'
  startTime?: number
}

export default function EnhancedLoadingScreen({
  loadingProgress,
  loadingStage,
  completedSteps,
  url,
  desktopCaptureResult,
  mobileCaptureResult,
  desktopClickPredictions = [],
  mobileClickPredictions = []
}: EnhancedLoadingScreenProps) {
  const [currentPhase, setCurrentPhase] = useState('wireframe')
  const [floatingPredictions, setFloatingPredictions] = useState<any[]>([])
  const [websiteScreenshot, setWebsiteScreenshot] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  // Detailed step tracking
  const [detailedSteps, setDetailedSteps] = useState<DetailedStep[]>([
    { id: 'init', label: 'Initializing Analysis', progress: 0, status: 'pending', deviceType: 'both' },
    { id: 'desktop_capture', label: 'Desktop Screenshot', progress: 0, status: 'pending', deviceType: 'desktop' },
    { id: 'mobile_capture', label: 'Mobile Screenshot', progress: 0, status: 'pending', deviceType: 'mobile' },
    { id: 'desktop_elements', label: 'Desktop Elements', progress: 0, status: 'pending', deviceType: 'desktop' },
    { id: 'mobile_elements', label: 'Mobile Elements', progress: 0, status: 'pending', deviceType: 'mobile' },
    { id: 'desktop_ai', label: 'Desktop AI Analysis', progress: 0, status: 'pending', deviceType: 'desktop' },
    { id: 'mobile_ai', label: 'Mobile AI Analysis', progress: 0, status: 'pending', deviceType: 'mobile' },
    { id: 'desktop_cro', label: 'Desktop CRO Analysis', progress: 0, status: 'pending', deviceType: 'desktop' },
    { id: 'mobile_cro', label: 'Mobile CRO Analysis', progress: 0, status: 'pending', deviceType: 'mobile' },
    { id: 'finalize', label: 'Finalizing Results', progress: 0, status: 'pending', deviceType: 'both' }
  ])
  
  // Performance metrics tracking
  const [performanceMetrics, setPerformanceMetrics] = useState({
    startTime: Date.now(),
    currentStep: 'Initializing...',
    stepsCompleted: 0,
    totalSteps: 10,
    estimatedTimeRemaining: 0,
    slowestStep: { name: '', duration: 0 }
  })

  const phases = [
    { name: 'wireframe', label: 'Mapping Site Structure', progress: 0 },
    { name: 'scanning', label: 'Scanning for Elements', progress: 25 },
    { name: 'content', label: 'Loading Visual Content', progress: 50 },
    { name: 'analyzing', label: 'Analyzing User Patterns', progress: 75 },
    { name: 'predictions', label: 'Generating Predictions', progress: 90 },
    { name: 'complete', label: 'Analysis Complete', progress: 100 }
  ]

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Update detailed steps based on loading progress and completed steps
  useEffect(() => {
    const updateSteps = () => {
      setDetailedSteps(prev => {
        const updated = prev.map(step => {
          let newStatus = step.status
          let newProgress = step.progress
          
          // Map completion status to step updates
          switch (step.id) {
            case 'init':
              if (loadingProgress > 0) {
                newStatus = loadingProgress >= 5 ? 'completed' : 'active'
                newProgress = Math.min(100, loadingProgress * 20) // 0-5% maps to 0-100%
              }
              break
            case 'desktop_capture':
              if (completedSteps.desktopCapture || desktopCaptureResult) {
                newStatus = 'completed'
                newProgress = 100
              } else if (loadingProgress > 5) {
                newStatus = 'active'
                newProgress = Math.min(100, (loadingProgress - 5) * 5) // 5-25% maps to 0-100%
              }
              break
            case 'mobile_capture':
              if (completedSteps.mobileCapture || mobileCaptureResult) {
                newStatus = 'completed'
                newProgress = 100
              } else if (loadingProgress > 5) {
                newStatus = 'active'
                newProgress = Math.min(100, (loadingProgress - 5) * 5) // 5-25% maps to 0-100%
              }
              break
            case 'desktop_elements':
              if (completedSteps.desktopCapture && desktopCaptureResult) {
                newStatus = 'completed'
                newProgress = 100
              } else if (loadingProgress > 20) {
                newStatus = 'active'
                newProgress = Math.min(100, (loadingProgress - 20) * 10) // 20-30% maps to 0-100%
              }
              break
            case 'mobile_elements':
              if (completedSteps.mobileCapture && mobileCaptureResult) {
                newStatus = 'completed'
                newProgress = 100
              } else if (loadingProgress > 20) {
                newStatus = 'active'
                newProgress = Math.min(100, (loadingProgress - 20) * 10) // 20-30% maps to 0-100%
              }
              break
            case 'desktop_ai':
              if (completedSteps.desktopAnalysis) {
                newStatus = 'completed'
                newProgress = 100
              } else if (loadingProgress > 30) {
                newStatus = 'active'
                newProgress = Math.min(100, (loadingProgress - 30) * 2.5) // 30-70% maps to 0-100%
              }
              break
            case 'mobile_ai':
              if (completedSteps.mobileAnalysis) {
                newStatus = 'completed'
                newProgress = 100
              } else if (loadingProgress > 30) {
                newStatus = 'active'
                newProgress = Math.min(100, (loadingProgress - 30) * 2.5) // 30-70% maps to 0-100%
              }
              break
            case 'desktop_cro':
              if (completedSteps.desktopOpenAI) {
                newStatus = 'completed'
                newProgress = 100
              } else if (loadingProgress > 70) {
                newStatus = 'active'
                newProgress = Math.min(100, (loadingProgress - 70) * 5) // 70-90% maps to 0-100%
              }
              break
            case 'mobile_cro':
              if (completedSteps.mobileOpenAI) {
                newStatus = 'completed'
                newProgress = 100
              } else if (loadingProgress > 70) {
                newStatus = 'active'
                newProgress = Math.min(100, (loadingProgress - 70) * 5) // 70-90% maps to 0-100%
              }
              break
            case 'finalize':
              if (completedSteps.finalizing || loadingProgress >= 100) {
                newStatus = 'completed'
                newProgress = 100
              } else if (loadingProgress > 90) {
                newStatus = 'active'
                newProgress = Math.min(100, (loadingProgress - 90) * 10) // 90-100% maps to 0-100%
              }
              break
          }
          
          return { ...step, status: newStatus, progress: newProgress }
        })
        
        // Update performance metrics based on the new state
        const completed = updated.filter(s => s.status === 'completed').length
        const active = updated.find(s => s.status === 'active')
        
        setPerformanceMetrics(prev => ({
          ...prev,
          currentStep: active ? active.label : (completed === updated.length ? 'Complete!' : 'Processing...'),
          stepsCompleted: completed,
          estimatedTimeRemaining: completed > 0 ? Math.round(((Date.now() - prev.startTime) / completed) * (updated.length - completed) / 1000) : 0
        }))
        
        return updated
      })
    }
    
    updateSteps()
  }, [loadingProgress, completedSteps, desktopCaptureResult, mobileCaptureResult])

  // Check if a new position overlaps with existing predictions
  const checkOverlap = (newX: number, newY: number, existingPredictions: any[], minDistance = 80) => {
    return existingPredictions.some(pred => {
      const distance = Math.sqrt(Math.pow(newX - pred.x, 2) + Math.pow(newY - pred.y, 2))
      return distance < minDistance
    })
  }

  // Generate a non-overlapping position - responsive to screen size
  const generateNonOverlappingPosition = (existingPredictions: any[], maxAttempts = 20) => {
    const maxX = isMobile ? 300 : 600
    const maxY = isMobile ? 400 : 600
    const offsetX = isMobile ? 50 : 100
    const offsetY = isMobile ? 50 : 100
    
    for (let i = 0; i < maxAttempts; i++) {
      const x = Math.random() * maxX + offsetX
      const y = Math.random() * maxY + offsetY
      
      if (!checkOverlap(x, y, existingPredictions, isMobile ? 60 : 80)) {
        return { x, y }
      }
    }
    // If we can't find a non-overlapping position, return a random one
    return {
      x: Math.random() * maxX + offsetX,
      y: Math.random() * maxY + offsetY
    }
  }

  useEffect(() => {
    // Update phase based on progress
    const currentPhaseData = phases.find(p => loadingProgress >= p.progress && loadingProgress < (phases[phases.indexOf(p) + 1]?.progress || 101))
    if (currentPhaseData) {
      setCurrentPhase(currentPhaseData.name)
    }
  }, [loadingProgress])

  // Separate effect for managing floating predictions to avoid infinite loops
  useEffect(() => {
    // Use real click predictions when available, otherwise generate random ones
    const allClickPredictions = [...desktopClickPredictions, ...mobileClickPredictions]
    
    // Add predictions on a timer instead of in render loop
    const predictionInterval = setInterval(() => {
      setFloatingPredictions(current => {
        // Start predictions immediately - don't wait for progress or screenshot
        if (loadingProgress >= 0) {
          // Add new predictions randomly, but not too many at once (fewer on mobile)
          const maxPredictions = isMobile ? 4 : 8
          if (Math.random() > 0.6 && current.length < maxPredictions) {
            const position = generateNonOverlappingPosition(current)
            
            // If we have real click predictions, use them
            if (allClickPredictions.length > 0) {
              const randomPrediction = allClickPredictions[Math.floor(Math.random() * allClickPredictions.length)]
              const newPrediction = {
                id: Math.random(),
                x: position.x,
                y: position.y,
                confidence: randomPrediction.confidence || Math.random() * 40 + 60,
                text: randomPrediction.text || 'Predicted Click',
                createdAt: Date.now(),
                duration: 2000 + Math.random() * 3000 // Random duration between 2-5 seconds
              }
              return [...current, newPrediction]
            } else {
              // Fallback to random predictions
              const newPrediction = {
                id: Math.random(),
                x: position.x,
                y: position.y,
                confidence: Math.random() * 40 + 60,
                text: 'Predicted Click',
                createdAt: Date.now(),
                duration: 2000 + Math.random() * 3000 // Random duration between 2-5 seconds
              }
              return [...current, newPrediction]
            }
          }
        }
        return current
      })
    }, 1000) // Check every second instead of on every render

    return () => clearInterval(predictionInterval)
  }, [loadingProgress, desktopClickPredictions, mobileClickPredictions, isMobile])

  // Remove predictions after their duration expires
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now()
      setFloatingPredictions(prev => prev.filter(p => now - p.createdAt < p.duration))
    }, 500)

    return () => clearInterval(cleanup)
  }, [])

  // Try to get website screenshot if available - PRIORITIZE DESKTOP for immediate display
  useEffect(() => {
    // 🔍 DEBUG: Log screenshot availability
    console.log(`🔍 [LOADING-SCREEN] Screenshot check:`, {
      hasDesktopScreenshot: !!desktopCaptureResult?.screenshot,
      hasMobileScreenshot: !!mobileCaptureResult?.screenshot,
      currentScreenshot: !!websiteScreenshot,
      timestamp: new Date().toISOString()
    })
    
    // PRIORITIZE desktop screenshot for immediate display
    if (desktopCaptureResult?.screenshot && websiteScreenshot !== desktopCaptureResult.screenshot) {
      console.log(`🔍 [LOADING-SCREEN] 📸 IMMEDIATE: Showing desktop screenshot!`, {
        size: Math.round(desktopCaptureResult.screenshot.length / 1024) + 'KB',
        timestamp: new Date().toISOString()
      })
      setWebsiteScreenshot(desktopCaptureResult.screenshot)
    } else if (mobileCaptureResult?.screenshot && !websiteScreenshot) {
      console.log(`🔍 [LOADING-SCREEN] 📱 Showing mobile screenshot as fallback`, {
        size: Math.round(mobileCaptureResult.screenshot.length / 1024) + 'KB',
        timestamp: new Date().toISOString()
      })
      setWebsiteScreenshot(mobileCaptureResult.screenshot)
    } else if (url && !websiteScreenshot && !desktopCaptureResult && !mobileCaptureResult) {
      // Only set placeholder if we don't have any screenshot yet and no capture results
      setWebsiteScreenshot('/images/placeholder-screenshot.svg')
    }
  }, [desktopCaptureResult, mobileCaptureResult, url, websiteScreenshot])

  return (
    <div className="h-full bg-gray-50 p-2 sm:p-4 lg:p-6 compact-height ultra-compact landscape-mobile">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        {/* Header - Responsive */}
        <div className="bg-blue-600 rounded-lg p-3 sm:p-4 lg:p-6 mb-3 sm:mb-4 lg:mb-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">AI-Powered Click Prediction</h1>
              <p className="text-blue-100 text-xs sm:text-sm">Watch our AI analyze and predict user behavior in real-time</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-100 text-xs sm:text-sm">
                <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                {phases.find(p => p.name === currentPhase)?.label}
              </Badge>
              <div className="text-right">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold">{loadingProgress.toFixed(0)}%</div>
                <div className="text-blue-200 text-xs sm:text-sm">Complete</div>
              </div>
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <Progress value={loadingProgress} className="h-1.5 sm:h-2 bg-blue-500/30" />
          </div>
        </div>

        {/* Enhanced Progressive Loading Visualization */}
        <Card className="w-full flex-1 flex flex-col min-h-0">
          <CardHeader className="card-header flex-shrink-0">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
              <Target className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <span className="hidden sm:inline">Live Prediction Analysis</span>
              <span className="sm:hidden">Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="card-content flex-1 min-h-0">
            <div 
              className="relative bg-white rounded-xl border-2 border-blue-200 overflow-hidden" 
              style={{ height: isMobile ? "400px" : "600px" }}
            >
              
              {/* Wireframe Layer */}
              <div className={`absolute inset-0 transition-opacity duration-500 ${
                websiteScreenshot ? 'opacity-0' : (currentPhase === 'wireframe' ? 'opacity-100' : 'opacity-15')
              }`}>
                <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-6">
                  {/* Header Wireframe */}
                  <div className="flex items-center justify-between p-2 sm:p-3 lg:p-4 border-2 border-dashed border-gray-300 rounded">
                    <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-dashed border-gray-300 rounded animate-pulse"></div>
                      <div className="w-20 sm:w-24 lg:w-32 h-3 sm:h-4 border border-dashed border-gray-300 rounded animate-pulse"></div>
                    </div>
                    <div className="w-16 sm:w-20 lg:w-24 h-6 sm:h-8 border-2 border-dashed border-gray-300 rounded animate-pulse"></div>
                  </div>

                  {/* Hero Wireframe */}
                  <div className="text-center p-4 sm:p-6 lg:p-8 border-2 border-dashed border-gray-300 rounded">
                    <div className="w-3/4 h-6 sm:h-8 border border-dashed border-gray-300 rounded mx-auto mb-2 sm:mb-4 animate-pulse"></div>
                    <div className="w-1/2 h-3 sm:h-4 border border-dashed border-gray-300 rounded mx-auto mb-4 sm:mb-6 animate-pulse"></div>
                    <div className="w-24 sm:w-28 lg:w-32 h-8 sm:h-10 border-2 border-dashed border-gray-300 rounded mx-auto animate-pulse"></div>
                  </div>

                  {/* Content Sections Wireframe */}
                  {[1,2,3,4].map(i => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 p-3 sm:p-4 lg:p-6 border-2 border-dashed border-gray-300 rounded">
                      <div className="space-y-2 sm:space-y-3">
                        <div className="w-full h-4 sm:h-6 border border-dashed border-gray-300 rounded animate-pulse"></div>
                        <div className="w-3/4 h-3 sm:h-4 border border-dashed border-gray-300 rounded animate-pulse"></div>
                        <div className="w-1/2 h-3 sm:h-4 border border-dashed border-gray-300 rounded animate-pulse"></div>
                      </div>
                      <div className="w-full h-20 sm:h-24 lg:h-32 border-2 border-dashed border-gray-300 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actual Screenshot Layer - IMMEDIATE reveal when screenshot available */}
              <div className={`absolute inset-0 transition-opacity duration-100 ${
                websiteScreenshot && websiteScreenshot !== '/images/placeholder-screenshot.svg' ? 'opacity-100' : 'opacity-0'
              }`}>
                {websiteScreenshot && websiteScreenshot !== '/images/placeholder-screenshot.svg' ? (
                  <img 
                    src={websiteScreenshot} 
                    alt="Website Screenshot" 
                    className="w-full h-full object-cover object-top"
                    onLoad={() => {
                      // 🔍 DEBUG: Log when image actually renders
                      console.log(`🔍 [LOADING-SCREEN] 🎉 Image rendered on screen!`, {
                        timestamp: new Date().toISOString(),
                        loadingProgress: loadingProgress
                      })
                    }}
                    onError={(e) => {
                      // 🔍 DEBUG: Log if image fails to load
                      console.log(`🔍 [LOADING-SCREEN] ❌ Image failed to load`, {
                        error: e,
                        timestamp: new Date().toISOString()
                      })
                    }}
                    style={{
                      clipPath: 'inset(0 0 0% 0)', // REMOVED artificial delay - show immediately when available
                      imageRendering: 'auto' // Ensure smooth rendering
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                    <div className="text-center text-gray-500 p-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2 sm:mb-4"></div>
                      <p className="text-sm sm:text-base">
                        {loadingProgress > 5 ? 'Processing screenshot...' : 'Loading website screenshot...'}
                      </p>
                      {/* 🔍 DEBUG: Show loading state details */}
                      {process.env.NODE_ENV === 'development' && (
                        <p className="text-xs text-gray-400 mt-2">
                          Progress: {loadingProgress}% | Stage: {loadingStage}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Progressive Prediction Circles - Non-overlapping */}
              {floatingPredictions.map((pred) => {
                const age = Date.now() - pred.createdAt
                const opacity = age < 500 ? age / 500 : age > pred.duration - 500 ? (pred.duration - age) / 500 : 1
                
                return (
                  <div
                    key={pred.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500"
                    style={{ 
                      left: pred.x, 
                      top: pred.y,
                      opacity: Math.max(0, Math.min(1, opacity))
                    }}
                  >
                    <div className="relative">
                      {/* Pulsing Circle */}
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-600 rounded-full animate-pulse border-2 border-white shadow-lg">
                        <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
                      </div>
                      
                      {/* Predicted Click Label */}
                      <div className="absolute -top-8 sm:-top-10 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 sm:px-3 py-1 rounded-lg text-xs whitespace-nowrap shadow-lg animate-bounce">
                        {pred.text}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Activity Counter - Responsive */}
              <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-white/95 backdrop-blur rounded-lg p-2 sm:p-3 lg:p-4 border border-blue-200 shadow-lg">
                <div className="text-center">
                  <div className="text-sm sm:text-lg font-bold text-gray-900">{loadingProgress.toFixed(0)}%</div>
                  <div className="text-xs text-gray-600 mb-1 sm:mb-2">Analysis Progress</div>
                  <div className="flex items-center gap-1 sm:gap-2 text-xs text-blue-600">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-600 rounded-full animate-pulse"></div>
                    <span className="hidden sm:inline">{floatingPredictions.length} active predictions</span>
                    <span className="sm:hidden">{floatingPredictions.length}</span>
                  </div>
                </div>
              </div>

              {/* Scanning Beam Effect */}
              {(currentPhase === 'scanning' || currentPhase === 'analyzing') && (
                <div className="absolute inset-0 pointer-events-none">
                  <div 
                    className="absolute w-full h-0.5 sm:h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60 animate-pulse"
                    style={{ 
                      top: `${(loadingProgress % 100) * (isMobile ? 4 : 8)}px`,
                      animationDuration: '2s'
                    }}
                  />
                </div>
              )}

              {/* Phase-specific Overlays */}
              {loadingProgress >= 90 && (
                <div className="absolute inset-0 bg-gradient-to-t from-blue-50/20 to-transparent pointer-events-none">
                  <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-lg shadow-lg">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-semibold text-sm sm:text-base">AI Predictions Ready!</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Legend - Responsive */}
              <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 bg-white/95 backdrop-blur rounded-lg p-2 sm:p-3 lg:p-4 border border-blue-200 shadow-lg max-w-[200px] sm:max-w-none">
                <div className="text-xs sm:text-sm font-semibold text-gray-900 mb-1 sm:mb-2">Prediction Types</div>
                <div className="space-y-0.5 sm:space-y-1">
                  <div className="flex items-center gap-1 sm:gap-2 text-xs">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500/60 rounded-full border border-red-600 animate-pulse"></div>
                    <span className="text-gray-600 text-xs">High Confidence (80%+)</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 text-xs">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500/50 rounded-full border border-blue-500 animate-pulse"></div>
                    <span className="text-gray-600 text-xs">Medium Confidence (60-80%)</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 text-xs">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-400/40 rounded-full border border-green-500 animate-pulse"></div>
                    <span className="text-gray-600 text-xs">Potential Interest (40-60%)</span>
                  </div>
                </div>
              </div>

              {/* AI Analysis Status - Responsive */}
              {loadingProgress > 30 && loadingProgress < 90 && (
                <div className="absolute bottom-16 sm:bottom-20 left-2 sm:left-4 bg-white/95 backdrop-blur rounded-lg p-2 sm:p-3 lg:p-4 border border-blue-200 shadow-lg max-w-[250px] sm:max-w-none">
                  <div className="flex items-center gap-1 sm:gap-2 text-blue-700">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs sm:text-sm font-medium">AI analyzing behavior patterns...</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {floatingPredictions.length} interaction points detected
                  </div>
                </div>
              )}

              {/* Enhanced Progress Panel - Responsive */}
              <div className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-white/95 backdrop-blur rounded-lg p-2 sm:p-3 lg:p-4 border border-blue-200 shadow-lg max-w-[280px] sm:max-w-none">
                <div className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">Analysis Progress</div>
                <div className="text-xs text-blue-600 font-medium mb-2">{performanceMetrics.currentStep}</div>
                
                {/* Detailed Steps List */}
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {detailedSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-2 text-xs">
                      {/* Status Icon */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        step.status === 'completed' ? 'bg-green-500' :
                        step.status === 'active' ? 'bg-blue-500 animate-pulse' :
                        step.status === 'failed' ? 'bg-red-500' :
                        'bg-gray-300'
                      }`} />
                      
                      {/* Step Label */}
                      <span className={`flex-1 truncate ${
                        step.status === 'completed' ? 'text-gray-700' :
                        step.status === 'active' ? 'text-blue-700 font-medium' :
                        'text-gray-500'
                      }`}>
                        {step.label}
                      </span>
                      
                      {/* Device Type Indicator */}
                      <span className={`text-xs px-1 rounded ${
                        step.deviceType === 'desktop' ? 'bg-blue-100 text-blue-600' :
                        step.deviceType === 'mobile' ? 'bg-green-100 text-green-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {step.deviceType === 'desktop' ? '🖥️' : 
                         step.deviceType === 'mobile' ? '📱' : '⚡'}
                      </span>
                      
                      {/* Progress Bar for Active Steps */}
                      {step.status === 'active' && (
                        <div className="w-8 bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${step.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Performance Summary */}
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                  <div>Progress: {performanceMetrics.stepsCompleted}/{performanceMetrics.totalSteps} steps</div>
                  <div>Elapsed: {Math.round((Date.now() - performanceMetrics.startTime) / 1000)}s</div>
                  {performanceMetrics.estimatedTimeRemaining > 0 && (
                    <div>ETA: ~{performanceMetrics.estimatedTimeRemaining}s</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 