// Unified AI Analysis - Consolidates CTA, CRO, and Click Predictions into single OpenAI call
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { compressScreenshotForOpenAI, validatePayloadSize, SIZE_LIMITS, handleOversizedPayload, createPayloadErrorResponse } from "@/lib/utils/screenshot-compression"
import { logger } from "@/lib/utils/logger"
import type { DOMData } from "../contracts/capture"

const moduleLogger = logger.module("unified-analysis")

export interface UnifiedAnalysisOptions {
  screenshot: string
  domData: DOMData
  deviceType: 'desktop' | 'mobile'
  requestId: string
  url: string
  elements?: any[]
  currentCTR?: number
  primaryCTAId?: string
}

export interface CTAResult {
  text: string
  confidence: number
  hasForm: boolean
  isFormAssociated: boolean
  reasoning: string
  elementType: 'button' | 'link' | 'form'
  alternativeTexts: string[]
}

export interface CROResult {
  companyName: string
  url: string
  deviceType: string
  dateAnalyzed: string
  currentPerformance: {
    primaryCTA: string
    currentConversionRate: number
    projectedConversionRate: number
    monthlyWastedSpend: number
    ctaType: string
    metricLabel: string
  }
  frictionPoints: Array<{
    element: string
    type: string
    problem: string
    impact: string
  }>
  recommendedActions: {
    phase1: {
      title: string
      description: string
      actions: string[]
      teamOwner: string[]
      timeToValue: string
      estimatedTime: string
      expectedGain: string
    }
    phase2: {
      title: string
      description: string
      actions: string[]
      teamOwner: string[]
      timeToValue: string
      estimatedTime: string
      expectedGain: string
    }
    phase3: {
      title: string
      description: string
      actions: string[]
      teamOwner: string[]
      timeToValue: string
      estimatedTime: string
      expectedGain: string
    }
  }
  nextSteps: string[]
  highlights: string[]
  additionalNotes: string
}

export interface PredictionsResult {
  predictions: Array<{
    elementId: string
    text: string
    predictedClicks: number
    ctr: number
    confidence: 'high' | 'medium' | 'low'
    wastedSpend?: number
  }>
  primaryCTA: {
    elementId: string
    text: string
    predictedClicks: number
    ctr: number
  } | null
}

export interface UnifiedAnalysisResult {
  cta: CTAResult
  predictions: PredictionsResult
  metadata: {
    deviceType: string
    timestamp: string
    analysisTime: number
    hasScreenshot: boolean
    requestId: string
  }
}

/**
 * Performs streamlined AI analysis combining CTA identification and click predictions
 * CRO analysis is now handled by internal engine. This reduces OpenAI API calls and costs.
 */
export async function performUnifiedAnalysis(options: UnifiedAnalysisOptions): Promise<UnifiedAnalysisResult> {
  const startTime = Date.now()
  
  // Enhanced debug logging for unified analysis
  console.log(`🔍 [UNIFIED-ANALYSIS] 🧠 Starting ${options.deviceType} unified analysis`, {
    requestId: options.requestId,
    url: options.url,
    hasScreenshot: !!options.screenshot,
    screenshotSize: options.screenshot ? Math.round(options.screenshot.length / 1024) + 'KB' : 'N/A',
    elementCount: options.elements?.length || 0,
    startTime: new Date().toISOString()
  })
  
  moduleLogger.info(`Starting unified analysis for ${options.deviceType}`, {
    requestId: options.requestId,
    url: options.url,
    hasScreenshot: !!options.screenshot,
    elementCount: options.elements?.length || 0
  })

  try {
    // Step 1: Compress screenshot
    const compressionStart = Date.now()
    console.log(`🔍 [UNIFIED-ANALYSIS] 📸 Compressing ${options.deviceType} screenshot...`, { requestId: options.requestId })
    
    const compressedScreenshot = await compressScreenshotForOpenAI(options.screenshot, options.deviceType)
    
    const compressionDuration = Date.now() - compressionStart
    console.log(`🔍 [UNIFIED-ANALYSIS] ✅ Screenshot compression complete`, {
      requestId: options.requestId,
      originalSize: Math.round(options.screenshot.length / 1024) + 'KB',
      compressedSize: Math.round(compressedScreenshot.length / 1024) + 'KB',
      compressionRatio: Math.round((1 - compressedScreenshot.length / options.screenshot.length) * 100) + '%',
      compressionTime: compressionDuration + 'ms'
    })
    
    // Calculate metrics
    const companyName = options.url.includes("://") ? new URL(options.url).hostname.replace("www.", "") : options.url
    const currentCTR = options.currentCTR || 0.065
    const projectedCTR = currentCTR * 1.4
    const improvementPotential = ((projectedCTR - currentCTR) / currentCTR) * 100
    const costSavings = Math.round(Math.random() * 2000 + 500)

    // Build element context for predictions
    const elementContext = options.elements?.slice(0, 20).map((el, idx) => 
      `${idx + 1}. "${el.text || el.elementId}" (${el.tagName || 'element'}) - ${el.isAboveFold ? 'above' : 'below'} fold`
    ).join('\n') || 'No elements provided'

    const unifiedPrompt = `AI Expert: Perform streamlined website analysis combining CTA identification and click predictions.

MISSION: Analyze screenshot and provide CTA identification and click predictions. CRO analysis is handled by internal engine.

PAGE CONTEXT:
- Title: ${options.domData?.title || "Unknown"}
- URL: ${options.url}
- Device: ${options.deviceType.toUpperCase()}
- Buttons: ${options.domData?.buttons?.length || 0}
- Forms: ${options.domData?.forms?.length || 0}
- Elements to analyze: ${options.elements?.length || 0}

CLICKABLE ELEMENTS:
${elementContext}

RESPONSE FORMAT - STRICT JSON ONLY:
{
  "cta": {
    "text": "exact primary CTA text",
    "confidence": 0.8,
    "hasForm": true,
    "isFormAssociated": true,
    "reasoning": "detailed explanation of CTA selection",
    "elementType": "button",
    "alternativeTexts": ["alternative1", "alternative2"]
  },
  "predictions": {
    "predictions": [
      {"elementId": "element_id", "text": "element text", "predictedClicks": 150, "ctr": 0.08, "confidence": "high", "wastedSpend": 300}
    ],
    "primaryCTA": {
      "elementId": "primary_cta_id",
      "text": "primary CTA text",
      "predictedClicks": 200,
      "ctr": 0.10
    }
  }
}

CTA ANALYSIS RULES:
1. ✅ PRIORITIZE FORMS only if ENTIRE FORM IS ABOVE FOLD (within first 800px)
2. ✅ If no forms above fold, identify MOST VISUALLY PROMINENT CTA BUTTON ABOVE FOLD
   - Priority: Hero Section > Header > Banner center
3. ❌ IGNORE CTAs BELOW THE FOLD (beyond 800px)
4. ❌ IGNORE navigation, search bars, cookie banners, privacy elements
5. ✅ PRIORITIZE ACTION-ORIENTED CTAs over navigation ("Buy" > "Mac", "Shop" > "About")

VISUAL PROMINENCE FACTORS:
- SIZE: Large buttons (>100px) > small buttons (<50px)
- COLOR: High contrast, unique colors that stand out
- POSITION: Centered, hero section, significant whitespace
- STYLE: Button styling, shadows, clickable appearance

FORM ASSOCIATION:
- isFormAssociated: true = CTA submits form data VISIBLE on current page (Submit, Sign Up, Get Started WITH visible form fields)
- isFormAssociated: false = CTA navigates to other pages OR commerce/purchasing (Buy Now, Shop, Add to Cart)
- CRITICAL: Only consider visible elements on current screenshot

CRO ANALYSIS RULES:
- Focus on removing friction and distractions
- Infer page goal (lead gen/signup/trial/commerce) and tailor recommendations
- Only analyze visible elements, no backend speculation
- Provide specific, actionable improvements with effort estimates

CLICK PREDICTIONS RULES:
- Predict click performance for visible elements from the provided list
- Higher CTR for: above fold, visually prominent, action-oriented elements
- Lower CTR for: below fold, navigation, small/unclear elements
- Assign confidence based on element visibility and prominence
- Estimate wastedSpend for underperforming elements

CRITICAL: Respond with valid JSON only. No additional text outside the JSON structure.`

    const messages: any[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: unifiedPrompt,
          },
          {
            type: "image",
            image: compressedScreenshot,
          },
        ],
      },
    ]

    // Validate payload size
    const requestPayload = {
      model: "gpt-4o-mini",
      messages,
      temperature: 0.1,
      maxTokens: 3000, // Increased for unified response
    }
    
    const validation = validatePayloadSize(requestPayload, SIZE_LIMITS.SAFE_PAYLOAD, `Unified Analysis (${options.deviceType})`)
    
    if (!validation.isValid) {
      moduleLogger.warn(`Payload validation failed: ${validation.error}`, {
        requestId: options.requestId,
        sizeKB: validation.sizeKB,
        limitKB: validation.limitKB
      })
      
      // Try emergency compression
      try {
        const fallback = await handleOversizedPayload(compressedScreenshot, options.deviceType, `Unified Analysis (${options.deviceType})`)
        
        if (fallback.applied !== 'none') {
          messages[0].content[1].image = fallback.compressedScreenshot
          moduleLogger.warn(`Using emergency compression: ${fallback.applied}`, { requestId: options.requestId })
        } else {
          throw new Error('Emergency compression failed')
        }
      } catch (emergencyError) {
        moduleLogger.error(`Emergency compression failed`, emergencyError as Error, { requestId: options.requestId })
        throw new Error(`Payload too large: ${validation.sizeKB}KB exceeds ${validation.limitKB}KB limit`)
      }
    }

    // Step 3: Call OpenAI
    const openaiStart = Date.now()
    console.log(`🔍 [UNIFIED-ANALYSIS] 🤖 Calling OpenAI for ${options.deviceType} analysis...`, {
      requestId: options.requestId,
      model: "gpt-4o-mini",
      temperature: 0.1,
      maxTokens: 3000,
      payloadSizeKB: Math.round(JSON.stringify(requestPayload).length / 1024)
    })
    
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      messages,
      temperature: 0.1,
      maxTokens: 3000,
    })

    const openaiDuration = Date.now() - openaiStart
    console.log(`🔍 [UNIFIED-ANALYSIS] ✅ OpenAI analysis completed`, {
      requestId: options.requestId,
      responseLength: result.text.length,
      openaiDuration: openaiDuration + 'ms',
      tokensUsed: result.usage?.totalTokens || 'unknown',
      costEstimate: result.usage?.totalTokens ? '$' + (result.usage.totalTokens * 0.00015 / 1000).toFixed(4) : 'unknown'
    })

    // Step 4: Parse the unified response
    const parsingStart = Date.now()
    console.log(`🔍 [UNIFIED-ANALYSIS] 📝 Parsing ${options.deviceType} OpenAI response...`, {
      requestId: options.requestId,
      responseLength: result.text.length
    })
    
    const analysisTime = Date.now() - startTime
    const parsedResult = parseUnifiedResponse(result.text, options, analysisTime)
    
    const parsingDuration = Date.now() - parsingStart
    console.log(`🔍 [UNIFIED-ANALYSIS] 🎉 ${options.deviceType} unified analysis completed`, {
      requestId: options.requestId,
      totalAnalysisTime: analysisTime + 'ms',
      parsingTime: parsingDuration + 'ms',
      hasCTA: !!parsedResult.cta.text,
      ctaText: parsedResult.cta.text,
      ctaConfidence: parsedResult.cta.confidence,
      predictionCount: parsedResult.predictions.predictions.length,
      hasPrimaryCTA: !!parsedResult.predictions.primaryCTA,
      primaryCTAText: parsedResult.predictions.primaryCTA?.text || 'None'
    })

    return parsedResult

  } catch (error) {
    const analysisTime = Date.now() - startTime
    console.log(`🔍 [UNIFIED-ANALYSIS] ❌ ${options.deviceType} unified analysis failed`, {
      requestId: options.requestId,
      totalAnalysisTime: analysisTime + 'ms',
      error: (error as Error).message,
      errorType: (error as Error).name,
      stackTrace: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    })
    
    moduleLogger.error(`Unified analysis failed for ${options.deviceType}`, error as Error, {
      requestId: options.requestId,
      analysisTime
    })
    throw error
  }
}

/**
 * Parses the unified OpenAI response into structured results
 */
function parseUnifiedResponse(responseText: string, options: UnifiedAnalysisOptions, analysisTime: number): UnifiedAnalysisResult {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])
    
    // Validate structure (CRO removed - handled by internal engine)
    if (!parsed.cta || !parsed.predictions) {
      throw new Error('Invalid response structure - missing required sections')
    }

    // Ensure predictions has the right structure
    if (!parsed.predictions.predictions || !Array.isArray(parsed.predictions.predictions)) {
      parsed.predictions.predictions = []
    }

    // Find primary CTA from predictions or use first high-confidence prediction
    if (!parsed.predictions.primaryCTA && parsed.predictions.predictions.length > 0) {
      const highConfidencePredictions = parsed.predictions.predictions.filter((p: any) => p.confidence === 'high')
      const primaryPrediction = highConfidencePredictions.length > 0 
        ? highConfidencePredictions.reduce((max: any, current: any) => current.predictedClicks > max.predictedClicks ? current : max)
        : parsed.predictions.predictions[0]
      
      parsed.predictions.primaryCTA = {
        elementId: primaryPrediction.elementId,
        text: primaryPrediction.text,
        predictedClicks: primaryPrediction.predictedClicks,
        ctr: primaryPrediction.ctr
      }
    }

    return {
      cta: parsed.cta,
      predictions: parsed.predictions,
      metadata: {
        deviceType: options.deviceType,
        timestamp: new Date().toISOString(),
        analysisTime,
        hasScreenshot: !!options.screenshot,
        requestId: options.requestId
      }
    }
  } catch (parseError) {
    moduleLogger.error(`Failed to parse unified response`, parseError as Error, {
      requestId: options.requestId,
      responsePreview: responseText.substring(0, 500)
    })
    
    // Return fallback structure
    return createFallbackResponse(options, analysisTime)
  }
}

/**
 * Creates a fallback response if parsing fails
 */
function createFallbackResponse(options: UnifiedAnalysisOptions, analysisTime: number): UnifiedAnalysisResult {
  const companyName = options.url.includes("://") ? new URL(options.url).hostname.replace("www.", "") : options.url
  const currentCTR = options.currentCTR || 0.065
  
  return {
    cta: {
      text: "Primary CTA",
      confidence: 0.5,
      hasForm: false,
      isFormAssociated: false,
      reasoning: "Analysis failed - using fallback",
      elementType: "button",
      alternativeTexts: []
    },
    predictions: {
      predictions: [],
      primaryCTA: null
    },
    metadata: {
      deviceType: options.deviceType,
      timestamp: new Date().toISOString(),
      analysisTime,
      hasScreenshot: !!options.screenshot,
      requestId: options.requestId
    }
  }
}


