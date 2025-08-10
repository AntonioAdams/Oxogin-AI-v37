import { type NextRequest, NextResponse } from "next/server"
import { captureWebsite } from "@/lib/capture"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { compressScreenshotForOpenAI, validatePayloadSize, SIZE_LIMITS } from "@/lib/utils/screenshot-compression"
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

    // Step 2: Compress screenshots for OpenAI analysis
    let desktopScreenshotBase64: string | null = null
    let mobileScreenshotBase64: string | null = null

    if (desktopCaptureResult.screenshot) {
      try {
        const desktopBase64 = desktopCaptureResult.screenshot.split(',')[1] || desktopCaptureResult.screenshot
        desktopScreenshotBase64 = await compressScreenshotForOpenAI(desktopBase64, 'desktop')
      } catch (error) {
        console.warn("[Competitor Analysis] Failed to compress desktop screenshot:", error)
      }
    }

    if (mobileCaptureResult.screenshot) {
      try {
        const mobileBase64 = mobileCaptureResult.screenshot.split(',')[1] || mobileCaptureResult.screenshot
        mobileScreenshotBase64 = await compressScreenshotForOpenAI(mobileBase64, 'mobile')
      } catch (error) {
        console.warn("[Competitor Analysis] Failed to compress mobile screenshot:", error)
      }
    }

    // Step 3: Analyze competitor with OpenAI
    console.log("[Competitor Analysis] Analyzing with OpenAI...")
    
    const prompt = `CRO Expert: Analyze competitor website ${competitorUrl} vs ${originalUrl}.

TASK: Analyze desktop + mobile screenshots for conversion strategy.

Focus on: CTAs, forms, trust signals, mobile UX, page structure.

JSON OUTPUT:
{
  "competitorName": "Company Name",
  "competitorUrl": "${competitorUrl}",
  "analysis": {"overallScore": 7.5, "desktopScore": 8.0, "mobileScore": 7.0, "ctaCount": 6, "trustSignalCount": 8},
  "strengths": ["Clear CTA above fold", "Strong social proof", "Mobile-optimized"],
  "weaknesses": ["Too many nav options", "Complex forms", "Loading issues"],
  "competitiveAdvantages": ["Superior mobile UX", "Better trust placement", "Clear value prop"],
  "metrics": {"mobileUX": 68, "ctaPower": 72, "trustScore": 76, "loadSpeed": 89},
  "primaryCTA": {"text": "Start Free Trial", "type": "form-based", "position": "hero", "visibility": "high"}
}`

    const messages: any[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ]

    // Add compressed screenshots if available
    if (desktopScreenshotBase64) {
      messages[0].content.push({
        type: "image",
        image: desktopScreenshotBase64,
      })
    }
    if (mobileScreenshotBase64) {
      messages[0].content.push({
        type: "image",
        image: mobileScreenshotBase64,
      })
    }

    // Validate payload size before sending to OpenAI
    const requestPayload = {
      model: "gpt-4o-mini",
      messages,
      temperature: 0.1,
      maxTokens: 2000,
    }
    
    const validation = validatePayloadSize(requestPayload, SIZE_LIMITS.SAFE_PAYLOAD, "Competitor Analysis")
    
    if (!validation.isValid) {
      console.error(`[Competitor Analysis] ${validation.error}`)
      // For competitor analysis with 2 screenshots, try a more aggressive limit
      const aggressiveValidation = validatePayloadSize(requestPayload, SIZE_LIMITS.VERCEL_FUNCTION * 0.8, "Competitor Analysis (Aggressive)")
      
      if (!aggressiveValidation.isValid) {
        throw new Error(`Payload too large: ${validation.sizeKB}KB exceeds safe limits. Try analyzing desktop and mobile separately.`)
      } else {
        console.warn(`[Competitor Analysis] Using aggressive payload size: ${validation.sizeKB}KB`)
      }
    }

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      messages,
      temperature: 0.1,
      maxTokens: 2000,
    })

    console.log("[Competitor Analysis] OpenAI analysis response:", result.text.substring(0, 300))

    // Parse the JSON response
    let competitorAnalysis
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        competitorAnalysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("No JSON found in response")
      }
    } catch (parseError) {
      console.error("[Competitor Analysis] Failed to parse analysis response:", parseError)
      throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }

    console.log("[Competitor Analysis] Analysis completed successfully")

    // Step 4: Generate click predictions for competitor
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
          hasDesktopScreenshot: !!desktopScreenshotBase64,
          hasMobileScreenshot: !!mobileScreenshotBase64,
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