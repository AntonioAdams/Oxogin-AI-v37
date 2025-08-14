// Parallel Analysis Helper for Capture API
import { captureWebsite } from "./index"
import { analyzeCTA } from "@/lib/ai"
import { ClickPredictionEngine } from "@/lib/prediction/engine"
import { performUnifiedAnalysis } from "@/lib/ai/unified-analysis"
import { logger } from "@/lib/utils/logger"
import type { CaptureResult } from "../contracts/capture"

const moduleLogger = logger.module("parallel-analyzer")

export interface AnalysisOptions {
  isMobile: boolean
  requestId: string
}

export interface AnalysisResult {
  captureResult: CaptureResult
  ctaInsight: any | null
  clickPredictions: any[] | null
  primaryCTAPrediction: any | null
  elements: any[]
  analysisTime: number
  deviceType: 'desktop' | 'mobile'
}

/**
 * Analyze a single capture result with CTA analysis and click predictions
 */
export async function analyzeCapture(
  url: string, 
  options: AnalysisOptions
): Promise<AnalysisResult> {
  const startTime = Date.now()
  const context = {
    file: "lib/capture/parallel-analyzer.ts",
    function: "analyzeCapture",
    metadata: { url, deviceType: options.isMobile ? 'mobile' : 'desktop' }
  }

  moduleLogger.info(`Starting ${options.isMobile ? 'mobile' : 'desktop'} analysis`, {
    requestId: options.requestId,
    url
  })

  try {
    // Step 1: Capture website
    const captureResult = await captureWebsite(url, { isMobile: options.isMobile })

    // Validate capture result
    if (!captureResult || !captureResult.screenshot || !captureResult.domData) {
      throw new Error(`Invalid capture result from service - missing required data`)
    }

    // Step 2: Run CTA analysis in parallel with click prediction setup
    let ctaInsight = null
    let clickPredictions = null
    let primaryCTAPrediction = null
    let elements: any[] = []

    const [elementPreparationResult, _] = await Promise.allSettled([
      // Element preparation
      (async () => {
        if (captureResult.domData) {
          const preparedElements: any[] = []
          
          // Process links
          if (captureResult.domData.links) {
            captureResult.domData.links.forEach((link, index) => {
              preparedElements.push({
                id: `link-${index}`,
                tagName: 'a',
                text: link.text || '',
                href: link.href,
                isAboveFold: link.isAboveFold,
                isVisible: link.isVisible !== false,
                isInteractive: true,
                className: link.className || '',
                coordinates: link.coordinates || { x: 0, y: 0, width: 0, height: 0 },
                hasButtonStyling: link.hasButtonStyling || false,
                distanceFromTop: link.distanceFromTop || 0
              })
            })
          }

          // Process buttons
          if (captureResult.domData.buttons) {
            captureResult.domData.buttons.forEach((button, index) => {
              preparedElements.push({
                id: `button-${index}`,
                tagName: 'button',
                text: button.text || '',
                isAboveFold: button.isAboveFold,
                isVisible: button.isVisible !== false,
                isInteractive: true,
                className: button.className || '',
                coordinates: button.coordinates || { x: 0, y: 0, width: 0, height: 0 },
                distanceFromTop: button.distanceFromTop || 0
              })
            })
          }

          // Process form fields
          if (captureResult.domData.formFields) {
            captureResult.domData.formFields.forEach((field, index) => {
              preparedElements.push({
                id: `field-${index}`,
                tagName: 'input',
                text: field.label || field.placeholder || '',
                type: field.type || 'text',
                isAboveFold: field.isAboveFold,
                isVisible: field.isVisible !== false,
                isInteractive: true,
                className: field.className || '',
                coordinates: field.coordinates || { x: 0, y: 0, width: 0, height: 0 },
                required: field.required || false,
                label: field.label,
                placeholder: field.placeholder,
                distanceFromTop: field.distanceFromTop || 0
              })
            })
          }

          return preparedElements
        }
        return []
      })()
    ])

    // Extract element preparation result
    if (elementPreparationResult.status === 'fulfilled') {
      elements = elementPreparationResult.value || []
    }

    // Use unified analysis instead of individual CTA analysis
    try {
      if (captureResult.screenshot && captureResult.domData) {
        const unifiedResult = await performUnifiedAnalysis({
          screenshot: captureResult.screenshot,
          domData: captureResult.domData,
          deviceType: options.isMobile ? 'mobile' : 'desktop',
          requestId: options.requestId,
          url,
          elements: elements.map(el => ({ ...el, elementId: el.id })), // Ensure elementId is set
          currentCTR: 0.065 // Default baseline
        })

        // Extract results from unified analysis
        ctaInsight = unifiedResult.cta
        clickPredictions = unifiedResult.predictions.predictions
        primaryCTAPrediction = unifiedResult.predictions.primaryCTA

        moduleLogger.info(`Unified analysis completed for ${options.isMobile ? 'mobile' : 'desktop'}`, {
          requestId: options.requestId,
          ctaText: ctaInsight?.text,
          predictionsCount: clickPredictions?.length || 0,
          primaryCTAText: primaryCTAPrediction?.text || 'None',
          analysisTime: unifiedResult.metadata.analysisTime
        })
      }
    } catch (unifiedError) {
      moduleLogger.warn(`Unified analysis failed for ${options.isMobile ? 'mobile' : 'desktop'}, falling back to individual CTA analysis`, unifiedError as Error, {
        requestId: options.requestId
      })

      // Fallback to individual CTA analysis
      try {
        if (captureResult.screenshot && captureResult.domData) {
          const base64Data = captureResult.screenshot.replace(/^data:image\/[^;]+;base64,/, '')
          const binaryData = Buffer.from(base64Data, 'base64')
          const imageBlob = new Blob([binaryData], { type: 'image/png' })
          
          const result = await analyzeCTA({
            image: imageBlob,
            domData: captureResult.domData,
          })
          ctaInsight = result.insight

          moduleLogger.info(`Fallback CTA analysis completed for ${options.isMobile ? 'mobile' : 'desktop'}`, {
            requestId: options.requestId,
            ctaText: ctaInsight?.text
          })
        }
      } catch (fallbackError) {
        moduleLogger.error(`Fallback CTA analysis also failed for ${options.isMobile ? 'mobile' : 'desktop'}`, fallbackError as Error, {
          requestId: options.requestId
        })
      }
    }

    // Step 3: Fallback click predictions (only if unified analysis didn't provide them)
    if (!clickPredictions && captureResult.domData && elements.length > 0) {
      try {
        const predictionEngine = new ClickPredictionEngine()
        
        const predictions = await predictionEngine.predictClicks(elements, {
          url,
          deviceType: options.isMobile ? 'mobile' : 'desktop',
          userAgent: 'capture-api',
          viewport: { width: options.isMobile ? 375 : 1920, height: options.isMobile ? 812 : 1080 },
          timestamp: Date.now(),
          totalImpressions: 1000,
          trafficSource: 'unknown'
        })

        clickPredictions = predictions.predictions

        // Find primary CTA prediction
        if (clickPredictions && clickPredictions.length > 0) {
          primaryCTAPrediction = clickPredictions.reduce((max, current) =>
            current.predictedClicks > max.predictedClicks ? current : max
          )
        }

        moduleLogger.info(`Fallback click predictions completed for ${options.isMobile ? 'mobile' : 'desktop'}`, {
          requestId: options.requestId,
          predictionsCount: clickPredictions?.length || 0,
          primaryCTAText: primaryCTAPrediction?.text || 'None'
        })
      } catch (predictionError) {
        moduleLogger.warn(`Fallback click prediction failed for ${options.isMobile ? 'mobile' : 'desktop'}`, predictionError as Error, {
          requestId: options.requestId
        })
      }
    }

    const analysisTime = Date.now() - startTime

    moduleLogger.info(`Analysis completed for ${options.isMobile ? 'mobile' : 'desktop'}`, {
      requestId: options.requestId,
      analysisTime,
      hasCTAInsight: !!ctaInsight,
      hasClickPredictions: !!clickPredictions,
      elementsProcessed: elements.length
    })

    return {
      captureResult,
      ctaInsight,
      clickPredictions,
      primaryCTAPrediction,
      elements,
      analysisTime,
      deviceType: options.isMobile ? 'mobile' : 'desktop'
    }

  } catch (error) {
    const analysisTime = Date.now() - startTime
    moduleLogger.error(`Analysis failed for ${options.isMobile ? 'mobile' : 'desktop'}`, error as Error, {
      requestId: options.requestId,
      analysisTime
    })
    throw error
  }
}

/**
 * Run parallel analysis for both desktop and mobile
 */
export async function runParallelAnalysis(
  url: string,
  requestId: string
): Promise<{
  desktopAnalysis: AnalysisResult
  mobileAnalysis: AnalysisResult
  totalTime: number
}> {
  const startTime = Date.now()

  moduleLogger.info("Starting parallel desktop + mobile analysis", {
    requestId,
    url
  })

  try {
    // Run both analyses in parallel
    const [desktopResult, mobileResult] = await Promise.all([
      analyzeCapture(url, { isMobile: false, requestId }),
      analyzeCapture(url, { isMobile: true, requestId })
    ])

    const totalTime = Date.now() - startTime

    moduleLogger.info("Parallel analysis completed", {
      requestId,
      totalTime,
      desktopTime: desktopResult.analysisTime,
      mobileTime: mobileResult.analysisTime
    })

    return {
      desktopAnalysis: desktopResult,
      mobileAnalysis: mobileResult,
      totalTime
    }

  } catch (error) {
    const totalTime = Date.now() - startTime
    moduleLogger.error("Parallel analysis failed", error as Error, {
      requestId,
      totalTime
    })
    throw error
  }
}
