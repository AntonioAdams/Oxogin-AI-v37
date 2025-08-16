import { type NextRequest, NextResponse } from "next/server"
import { captureWebsite } from "@/lib/capture"
import { clickPredictionEngine } from "@/lib/prediction/engine"

export async function POST(request: NextRequest) {
  try {
    const { competitorUrl, originalUrl, originalData } = await request.json()

    if (!competitorUrl) {
      return NextResponse.json(
        { success: false, error: "Competitor URL is required" },
        { status: 400 }
      )
    }

    console.log("[Competitor Analysis] Starting analysis for:", competitorUrl)

    // Step 1: Capture competitor website data (both desktop and mobile)
    console.log("[Competitor Analysis] Capturing desktop data...")
    const desktopCaptureResult = await captureWebsite(competitorUrl, { isMobile: false })
    
    console.log("[Competitor Analysis] Capturing mobile data...")
    const mobileCaptureResult = await captureWebsite(competitorUrl, { isMobile: true })

    // Step 2: Screenshots captured - no compression needed since no OpenAI analysis
    console.log("[Competitor Analysis] Screenshots captured successfully")

    // Step 3: Skip OpenAI analysis - use prediction engine data only
    console.log("[Competitor Analysis] Skipping OpenAI analysis - using prediction data only")

    // Create basic analysis structure from captured data without OpenAI
    const competitorAnalysis = {
      competitorName: competitorUrl.replace(/^https?:\/\//, '').split('/')[0],
      competitorUrl,
      analysis: { 
        overallScore: null, // No AI analysis available
        desktopScore: null, 
        mobileScore: null 
      },
      strengths: [], // No AI analysis available
      weaknesses: [], // No AI analysis available  
      metrics: {
        mobileUX: null,
        ctaPower: null, 
        trustScore: null,
        loadSpeed: null
      }
    }

    console.log("[Competitor Analysis] Basic analysis structure created")

    // Step 3: Generate click predictions for competitor
    console.log("[Competitor Analysis] Generating click predictions...")
    let clickPredictions: any[] = []
    let primaryCTAPrediction: any = null

    try {
      if (desktopCaptureResult.domData?.elements) {
        const context = {
          url: competitorUrl,
          deviceType: "desktop" as const,
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          viewport: { width: 1280, height: 720 },
          timestamp: Date.now()
        }
        
        const predictions = await clickPredictionEngine.predictClicks(desktopCaptureResult.domData.elements, context)
        clickPredictions = predictions.predictions || []
        
        // Find primary CTA (highest predicted clicks)
        if (clickPredictions.length > 0) {
          primaryCTAPrediction = clickPredictions.reduce((max, current) => 
            current.predictedClicks > max.predictedClicks ? current : max
          )
        }
        
        console.log(`[Competitor Analysis] Generated ${clickPredictions.length} click predictions`)
      }
    } catch (predictionError) {
      console.warn("[Competitor Analysis] Click prediction failed:", predictionError)
      // Continue without predictions rather than failing entirely
    }

    return NextResponse.json({
      success: true,
      competitorData: {
        desktopCaptureResult,
        mobileCaptureResult,
        analysis: competitorAnalysis,
        metadata: {
          originalUrl,
          competitorUrl,
          timestamp: new Date().toISOString(),
          hasDesktopScreenshot: !!desktopCaptureResult.screenshot,
          hasMobileScreenshot: !!mobileCaptureResult.screenshot,
        }
      },
      clickPredictions,
      primaryCTAPrediction
    })

  } catch (error) {
    console.error("[Competitor Analysis] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Competitor analysis failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}