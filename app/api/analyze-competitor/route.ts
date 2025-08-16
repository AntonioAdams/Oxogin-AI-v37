import { type NextRequest, NextResponse } from "next/server"
import { runParallelAnalysis } from "@/lib/capture/parallel-analyzer"
import { clickPredictionEngine } from "@/lib/prediction/engine"
import { logger } from "@/lib/utils/logger"
import { performanceTracker, trackAnalysis, trackAPICall } from "@/lib/utils/performance-tracker"
import { creditManager } from "@/lib/credits/manager"
import { sanitizeUrl } from "@/lib/utils"

export async function POST(request: NextRequest) {
  const requestId = `competitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const sessionId = performanceTracker.startSession('competitor-analysis')
  const apiTracker = trackAPICall('/api/analyze-competitor', 'desktop')
  
  try {
    const { competitorUrl, originalUrl, originalData } = await request.json()

    if (!competitorUrl) {
      return NextResponse.json(
        { success: false, error: "Competitor URL is required" },
        { status: 400 }
      )
    }

    console.log("🔍 [COMPETITOR-ANALYSIS] Starting optimized analysis for:", competitorUrl)
    
    // Sanitize URL
    const sanitizedUrl = sanitizeUrl(competitorUrl)
    console.log("🔍 [COMPETITOR-ANALYSIS] Sanitized URL:", sanitizedUrl)

    // Progress tracking for debugging
    const progressLogs: Array<{ step: string; progress: number; timestamp: number; duration?: number }> = []
    const progressCallback = (deviceType: 'desktop' | 'mobile', step: string, progress: number, timing?: { duration: number }) => {
      const logEntry = {
        step: `${deviceType}: ${step}`,
        progress,
        timestamp: Date.now(),
        duration: timing?.duration
      }
      progressLogs.push(logEntry)
      console.log(`🔍 [COMPETITOR-ANALYSIS] Progress: ${progress}% - ${step}`, timing)
    }

    // Step 1: Fast parallel capture (we'll only use desktop data)
    console.log("🔍 [COMPETITOR-ANALYSIS] Using optimized parallel capture (desktop focused)...")
    const captureTracker = trackAnalysis('desktop', 'Competitor Capture')
    
    const { desktopAnalysis } = await runParallelAnalysis(sanitizedUrl, requestId, progressCallback)
    const desktopCaptureResult = desktopAnalysis.captureResult
    
    captureTracker() // End capture tracking
    console.log("✅ [COMPETITOR-ANALYSIS] Fast capture completed")

    // Step 2: Create basic analysis structure (no OpenAI analysis for competitor)
    console.log("🔍 [COMPETITOR-ANALYSIS] Creating analysis structure...")
    const competitorAnalysis = {
      competitorName: sanitizedUrl.replace(/^https?:\/\//, '').split('/')[0],
      competitorUrl: sanitizedUrl,
      analysis: { 
        overallScore: null, // No AI analysis needed for competitor
        desktopScore: null, 
        mobileScore: null 
      },
      strengths: [], 
      weaknesses: [],  
      metrics: {
        mobileUX: null,
        ctaPower: null, 
        trustScore: null,
        loadSpeed: null
      }
    }

    // Step 3: Generate click predictions using existing data from parallel capture
    console.log("🔍 [COMPETITOR-ANALYSIS] Processing click predictions...")
    const predictionTracker = trackAnalysis('desktop', 'Competitor Predictions')
    
    // Use click predictions that were already generated during parallel analysis
    let clickPredictions: any[] = desktopAnalysis.clickPredictions || []
    let primaryCTAPrediction: any = null

    // If predictions weren't generated during capture, generate them now
    if (clickPredictions.length === 0 && desktopCaptureResult.domData?.elements) {
      console.log("🔍 [COMPETITOR-ANALYSIS] Generating fallback click predictions...")
      try {
        const context = {
          url: sanitizedUrl,
          deviceType: "desktop" as const,
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          viewport: { width: 1280, height: 720 },
          timestamp: Date.now()
        }
        
        const predictions = await clickPredictionEngine.predictClicks(desktopCaptureResult.domData.elements, context)
        clickPredictions = predictions.predictions || []
        console.log(`✅ [COMPETITOR-ANALYSIS] Generated ${clickPredictions.length} fallback predictions`)
      } catch (predictionError) {
        console.warn("⚠️ [COMPETITOR-ANALYSIS] Click prediction failed:", predictionError)
        clickPredictions = []
      }
    }
    
    // Find primary CTA (highest predicted clicks)
    if (clickPredictions.length > 0) {
      primaryCTAPrediction = clickPredictions.reduce((max, current) => 
        current.predictedClicks > max.predictedClicks ? current : max
      )
      console.log(`✅ [COMPETITOR-ANALYSIS] Primary CTA identified: ${primaryCTAPrediction.text}`)
    }
    
    predictionTracker() // End prediction tracking

    // Final performance tracking
    apiTracker() // End API call tracking
    const session = performanceTracker.endSession()
    
    console.log("🔍 [COMPETITOR-ANALYSIS] Performance Summary:", {
      totalTime: session?.totalTime,
      steps: progressLogs.length,
      captureTime: progressLogs.find(p => p.step.includes('capture'))?.duration,
      predictionTime: progressLogs.find(p => p.step.includes('prediction'))?.duration
    })

    return NextResponse.json({
      success: true,
      competitorData: {
        desktopCaptureResult,
        mobileCaptureResult: null, // No mobile data needed for competitor analysis
        analysis: competitorAnalysis,
        metadata: {
          originalUrl,
          competitorUrl: sanitizedUrl,
          timestamp: new Date().toISOString(),
          hasDesktopScreenshot: !!desktopCaptureResult.screenshot,
          hasMobileScreenshot: false, // Desktop only
          performanceMetrics: {
            totalTime: session?.totalTime,
            requestId,
            sessionId
          }
        }
      },
      clickPredictions,
      primaryCTAPrediction
    })

  } catch (error) {
    console.error("❌ [COMPETITOR-ANALYSIS] Error:", error)
    
    // Track error performance
    apiTracker() // End API tracking on error
    const session = performanceTracker.endSession()
    
    return NextResponse.json(
      {
        success: false,
        error: "Competitor analysis failed",
        details: error instanceof Error ? error.message : "Unknown error",
        performanceMetrics: {
          totalTime: session?.totalTime,
          requestId,
          sessionId,
          failurePoint: "competitor-analysis"
        }
      },
      { status: 500 }
    )
  }
}