// Parallel Analysis Helper for Capture API
import { captureWebsite } from "./index"
import { analyzeCTA } from "@/lib/ai"
import { ClickPredictionEngine } from "@/lib/prediction/engine"
import { performUnifiedAnalysis } from "@/lib/ai/unified-analysis"
import { croAnalyzer } from "@/lib/cro/analyzer"
import { logger } from "@/lib/utils/logger"
import type { CaptureResult } from "../contracts/capture"

const moduleLogger = logger.module("parallel-analyzer")

// Enhanced debug logging with timing
const debugLog = (step: string, message: string, timing?: { start: number; duration?: number }, data?: any) => {
  const logData = {
    step,
    message,
    ...(timing && { 
      duration: timing.duration || (Date.now() - timing.start),
      timestamp: new Date().toISOString()
    }),
    ...(data && { data })
  }
  
  console.log(`🔍 [PARALLEL-ANALYZER] ${step}: ${message}`, logData)
  moduleLogger.info(`${step}: ${message}`, logData)
}

// Progress callback type for real-time updates
export type ProgressCallback = (deviceType: 'desktop' | 'mobile', step: string, progress: number, timing?: { duration: number }) => void

export interface AnalysisOptions {
  isMobile: boolean
  requestId: string
  progressCallback?: ProgressCallback
}

export interface AnalysisResult {
  captureResult: CaptureResult
  ctaInsight: any | null
  clickPredictions: any[] | null
  primaryCTAPrediction: any | null
  elements: any[]
  analysisTime: number
  deviceType: 'desktop' | 'mobile'
  unifiedAnalysis?: any // Include unified analysis results (contains OpenAI CRO data)
  internalCROAnalysis?: any // Include internal CRO analysis results
}

/**
 * Analyze a single capture result with CTA analysis and click predictions
 */
export async function analyzeCapture(
  url: string, 
  options: AnalysisOptions
): Promise<AnalysisResult> {
  const startTime = Date.now()
  const deviceType = options.isMobile ? 'mobile' : 'desktop'
  const context = {
    file: "lib/capture/parallel-analyzer.ts",
    function: "analyzeCapture",
    metadata: { url, deviceType }
  }

  debugLog('INIT', `🚀 Starting ${deviceType} analysis`, { start: startTime }, { url, requestId: options.requestId })
  options.progressCallback?.(deviceType, `Initializing ${deviceType} capture...`, 0)

  try {
    // Step 1: Capture website (20% of total time)
    const captureStart = Date.now()
    debugLog('CAPTURE', `📸 Starting ${deviceType} website capture`, { start: captureStart })
    options.progressCallback?.(deviceType, `Capturing ${deviceType} screenshot...`, 10)
    
    const captureResult = await captureWebsite(url, { isMobile: options.isMobile })
    
    const captureDuration = Date.now() - captureStart
    debugLog('CAPTURE', `✅ ${deviceType} website capture completed`, { start: captureStart, duration: captureDuration }, {
      hasScreenshot: !!captureResult?.screenshot,
      hasDomData: !!captureResult?.domData,
      buttonsFound: captureResult?.domData?.buttons?.length || 0,
      linksFound: captureResult?.domData?.links?.length || 0,
      formsFound: captureResult?.domData?.forms?.length || 0,
      screenshotSize: captureResult?.screenshot ? Math.round(captureResult.screenshot.length / 1024) + 'KB' : 'N/A'
    })
    options.progressCallback?.(deviceType, `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} capture complete`, 20, { duration: captureDuration })

    // Validate capture result
    if (!captureResult || !captureResult.screenshot || !captureResult.domData) {
      const error = `Invalid capture result from service - missing required data`
      debugLog('CAPTURE', `❌ ${error}`, { start: captureStart, duration: captureDuration })
      throw new Error(error)
    }

    // Step 2: Element preparation (5% of total time)
    const elementStart = Date.now()
    debugLog('ELEMENTS', `🔧 Starting ${deviceType} element preparation`, { start: elementStart })
    options.progressCallback?.(deviceType, `Preparing ${deviceType} elements...`, 25)
    
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
      const elementDuration = Date.now() - elementStart
      debugLog('ELEMENTS', `✅ ${deviceType} element preparation completed`, { start: elementStart, duration: elementDuration }, {
        totalElements: elements.length,
        buttons: elements.filter(el => el.tagName === 'button').length,
        links: elements.filter(el => el.tagName === 'a').length,
        inputs: elements.filter(el => el.tagName === 'input').length,
        aboveFold: elements.filter(el => el.isAboveFold).length
      })
      options.progressCallback?.(deviceType, `${deviceType} elements prepared`, 30, { duration: elementDuration })
    } else {
      const elementDuration = Date.now() - elementStart
      debugLog('ELEMENTS', `❌ ${deviceType} element preparation failed`, { start: elementStart, duration: elementDuration }, {
        error: elementPreparationResult.reason
      })
    }

    // Step 3: Unified analysis (OpenAI CTA + Predictions) (40% of total time)
    let unifiedResult = null
    const unifiedStart = Date.now()
    
    try {
      if (captureResult.screenshot && captureResult.domData) {
        debugLog('UNIFIED', `🧠 Starting ${deviceType} unified analysis (OpenAI)`, { start: unifiedStart }, {
          screenshotSize: Math.round(captureResult.screenshot.length / 1024) + 'KB',
          elementsToAnalyze: elements.length,
          domDataSize: JSON.stringify(captureResult.domData).length
        })
        options.progressCallback?.(deviceType, `Running ${deviceType} AI analysis...`, 35)
        
        unifiedResult = await performUnifiedAnalysis({
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

        const unifiedDuration = Date.now() - unifiedStart
        debugLog('UNIFIED', `✅ ${deviceType} unified analysis completed`, { start: unifiedStart, duration: unifiedDuration }, {
          ctaText: ctaInsight?.text || 'None',
          ctaConfidence: ctaInsight?.confidence || 0,
          predictionsCount: clickPredictions?.length || 0,
          primaryCTAText: primaryCTAPrediction?.text || 'None',
          primaryCTAClicks: primaryCTAPrediction?.predictedClicks || 0,
          aiAnalysisTime: unifiedResult.metadata.analysisTime
        })
        options.progressCallback?.(deviceType, `${deviceType} AI analysis complete`, 70, { duration: unifiedDuration })
      }
    } catch (unifiedError) {
      const unifiedDuration = Date.now() - unifiedStart
      debugLog('UNIFIED', `❌ ${deviceType} unified analysis failed, falling back`, { start: unifiedStart, duration: unifiedDuration }, {
        error: (unifiedError as Error).message,
        errorType: (unifiedError as Error).name
      })
      options.progressCallback?.(deviceType, `${deviceType} AI analysis failed, using fallback...`, 40, { duration: unifiedDuration })

      // Fallback to individual CTA analysis
      const fallbackStart = Date.now()
      debugLog('FALLBACK', `🔄 Starting ${deviceType} fallback CTA analysis`, { start: fallbackStart })
      
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

          // Create fallback unified result structure
          unifiedResult = {
            cta: ctaInsight || {
              text: "Primary CTA",
              confidence: 0.5,
              hasForm: false,
              isFormAssociated: false,
              reasoning: "Fallback analysis",
              elementType: "button",
              alternativeTexts: []
            },
            predictions: {
              predictions: [],
              primaryCTA: null
            },
            metadata: {
              deviceType: options.isMobile ? 'mobile' : 'desktop',
              timestamp: new Date().toISOString(),
              analysisTime: 0,
              hasScreenshot: !!captureResult.screenshot,
              requestId: options.requestId
            }
          }

          const fallbackDuration = Date.now() - fallbackStart
          debugLog('FALLBACK', `✅ ${deviceType} fallback CTA analysis completed`, { start: fallbackStart, duration: fallbackDuration }, {
            ctaText: ctaInsight?.text || 'None',
            fallbackUsed: true
          })
          options.progressCallback?.(deviceType, `${deviceType} fallback analysis complete`, 50, { duration: fallbackDuration })
        }
      } catch (fallbackError) {
        const fallbackDuration = Date.now() - fallbackStart
        debugLog('FALLBACK', `❌ ${deviceType} fallback CTA analysis also failed`, { start: fallbackStart, duration: fallbackDuration }, {
          error: (fallbackError as Error).message
        })
        options.progressCallback?.(deviceType, `${deviceType} analysis failed, using defaults...`, 45, { duration: fallbackDuration })
        
        // Create minimal fallback unified result
        unifiedResult = {
          cta: {
            text: "Primary CTA",
            confidence: 0.5,
            hasForm: false,
            isFormAssociated: false,
            reasoning: "Analysis failed",
            elementType: "button",
            alternativeTexts: []
          },
          predictions: {
            predictions: [],
            primaryCTA: null
          },
          metadata: {
            deviceType: options.isMobile ? 'mobile' : 'desktop',
            timestamp: new Date().toISOString(),
            analysisTime: 0,
            hasScreenshot: !!captureResult.screenshot,
            requestId: options.requestId
          }
        }
      }
    }

    // Step 4: Internal CRO Analysis (20% of total time)
    let internalCROAnalysis = null
    const croStart = Date.now()
    
    try {
      if (captureResult.domData) {
        debugLog('CRO', `🔧 Starting ${deviceType} internal CRO analysis`, { start: croStart })
        options.progressCallback?.(deviceType, `Running ${deviceType} CRO analysis...`, 75)
        
        const captureData = {
          domData: captureResult.domData,
          screenshot: captureResult.screenshot || '',
          timestamp: new Date().toISOString(),
          isMobile: options.isMobile
        }
        
        internalCROAnalysis = await croAnalyzer.analyze(captureData)
        
        const croDuration = Date.now() - croStart
        debugLog('CRO', `✅ ${deviceType} internal CRO analysis completed`, { start: croStart, duration: croDuration }, {
          recommendationsCount: internalCROAnalysis.recommendations.length,
          quickWins: internalCROAnalysis.summary.quickWins,
          formFixes: internalCROAnalysis.summary.formFixes,
          estimatedUplift: `${internalCROAnalysis.summary.estimatedUpliftRange.min}-${internalCROAnalysis.summary.estimatedUpliftRange.max}%`,
          confidenceScore: internalCROAnalysis.summary.confidenceScore
        })
        options.progressCallback?.(deviceType, `${deviceType} CRO analysis complete`, 85, { duration: croDuration })
      }
    } catch (croError) {
      const croDuration = Date.now() - croStart
      debugLog('CRO', `❌ ${deviceType} internal CRO analysis failed`, { start: croStart, duration: croDuration }, {
        error: (croError as Error).message
      })
      options.progressCallback?.(deviceType, `${deviceType} CRO analysis failed`, 80, { duration: croDuration })
    }

    // Step 5: Fallback click predictions (only if unified analysis didn't provide them) (10% of total time)
    if (!clickPredictions && captureResult.domData && elements.length > 0) {
      const predictionStart = Date.now()
      debugLog('PREDICTIONS', `🎯 Starting ${deviceType} fallback click predictions`, { start: predictionStart })
      options.progressCallback?.(deviceType, `Generating ${deviceType} predictions...`, 90)
      
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

        const predictionDuration = Date.now() - predictionStart
        debugLog('PREDICTIONS', `✅ ${deviceType} fallback click predictions completed`, { start: predictionStart, duration: predictionDuration }, {
          predictionsCount: clickPredictions?.length || 0,
          primaryCTAText: primaryCTAPrediction?.text || 'None',
          highConfidencePredictions: clickPredictions?.filter(p => p.confidence === 'high').length || 0
        })
        options.progressCallback?.(deviceType, `${deviceType} predictions complete`, 95, { duration: predictionDuration })
      } catch (predictionError) {
        const predictionDuration = Date.now() - predictionStart
        debugLog('PREDICTIONS', `❌ ${deviceType} fallback click prediction failed`, { start: predictionStart, duration: predictionDuration }, {
          error: (predictionError as Error).message
        })
        options.progressCallback?.(deviceType, `${deviceType} predictions failed`, 90, { duration: predictionDuration })
      }
    }

    // Step 6: Final completion
    const analysisTime = Date.now() - startTime
    debugLog('COMPLETE', `🎉 ${deviceType} analysis completed`, { start: startTime, duration: analysisTime }, {
      hasCTAInsight: !!ctaInsight,
      hasClickPredictions: !!clickPredictions,
      hasPrimaryCTA: !!primaryCTAPrediction,
      hasUnifiedAnalysis: !!unifiedResult,
      hasInternalCRO: !!internalCROAnalysis,
      elementsProcessed: elements.length,
      totalTimeMs: analysisTime
    })
    options.progressCallback?.(deviceType, `${deviceType} analysis complete!`, 100, { duration: analysisTime })

    return {
      captureResult,
      ctaInsight,
      clickPredictions,
      primaryCTAPrediction,
      elements,
      analysisTime,
      deviceType: options.isMobile ? 'mobile' : 'desktop',
      unifiedAnalysis: unifiedResult, // Include unified analysis results (contains OpenAI CRO data)
      internalCROAnalysis // Include internal CRO analysis results
    }

  } catch (error) {
    const analysisTime = Date.now() - startTime
    debugLog('ERROR', `❌ ${deviceType} analysis failed`, { start: startTime, duration: analysisTime }, {
      error: (error as Error).message,
      errorType: (error as Error).name,
      stackTrace: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    })
    options.progressCallback?.(deviceType, `${deviceType} analysis failed`, 0, { duration: analysisTime })
    throw error
  }
}

/**
 * Run parallel analysis for both desktop and mobile
 */
export async function runParallelAnalysis(
  url: string,
  requestId: string,
  progressCallback?: (deviceType: 'desktop' | 'mobile', step: string, progress: number, timing?: { duration: number }) => void
): Promise<{
  desktopAnalysis: AnalysisResult
  mobileAnalysis: AnalysisResult
  totalTime: number
}> {
  const startTime = Date.now()

  debugLog('PARALLEL', `🚀 Starting parallel desktop + mobile analysis`, { start: startTime }, {
    url,
    requestId
  })

  try {
    // Run both analyses in parallel with progress callbacks
    const [desktopResult, mobileResult] = await Promise.all([
      analyzeCapture(url, { 
        isMobile: false, 
        requestId,
        progressCallback
      }),
      analyzeCapture(url, { 
        isMobile: true, 
        requestId,
        progressCallback
      })
    ])

    const totalTime = Date.now() - startTime

    debugLog('PARALLEL', `🎉 Parallel analysis completed`, { start: startTime, duration: totalTime }, {
      desktopTime: desktopResult.analysisTime,
      mobileTime: mobileResult.analysisTime,
      desktopSuccess: !!desktopResult.captureResult,
      mobileSuccess: !!mobileResult.captureResult,
      desktopCTA: desktopResult.ctaInsight?.text || 'None',
      mobileCTA: mobileResult.ctaInsight?.text || 'None',
      desktopPredictions: desktopResult.clickPredictions?.length || 0,
      mobilePredictions: mobileResult.clickPredictions?.length || 0
    })

    return {
      desktopAnalysis: desktopResult,
      mobileAnalysis: mobileResult,
      totalTime
    }

  } catch (error) {
    const totalTime = Date.now() - startTime
    debugLog('PARALLEL', `❌ Parallel analysis failed`, { start: startTime, duration: totalTime }, {
      error: (error as Error).message,
      errorType: (error as Error).name
    })
    throw error
  }
}
