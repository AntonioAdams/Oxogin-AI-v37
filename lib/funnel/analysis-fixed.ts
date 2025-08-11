import type { CaptureResult } from "@/app/page/types"
import type { FunnelData, FunnelStep, FunnelType, CtaAnalysisResult } from "./types"

/**
 * Detect the primary CTA type from capture data
 */
export function detectPrimaryCtaType(captureResult: CaptureResult): FunnelType {
  const domData = captureResult.domData
  
  // First try to get CTA analysis from AI if available
  if (captureResult.ctaInsight) {
    const isFormAssociated = (captureResult.ctaInsight as any).isFormAssociated
    const hasForm = captureResult.ctaInsight.hasForm
    
    // FIXED: Prioritize isFormAssociated over hasForm for primary CTA
    if (isFormAssociated === true || captureResult.ctaInsight.elementType === 'form') {
      return 'form'
    } else if (isFormAssociated === false || captureResult.ctaInsight.elementType === 'link' || captureResult.ctaInsight.elementType === 'button') {
      return 'non-form'
    }
  }
  
  // Fallback: Check if there are forms above the fold
  const hasAboveFoldForms = domData.forms && domData.forms.some(form => form.isAboveFold)
  
  if (hasAboveFoldForms) {
    return 'form'
  }
  
  // Check if there are buttons/links that could be CTAs
  const hasButtons = domData.buttons && domData.buttons.length > 0
  const hasLinks = domData.links && domData.links.length > 0
  
  if (hasButtons || hasLinks) {
    return 'non-form'
  }
  
  return 'none'
}

/**
 * Extract primary CTA information from capture data - NO FALLBACKS
 */
export function extractPrimaryCta(captureResult: CaptureResult): CtaAnalysisResult | null {
  // ONLY use AI CTA insight - no fallbacks to prevent incorrect CTA detection
  if (captureResult.ctaInsight) {
    const insight = captureResult.ctaInsight
    console.log("🎯 Using AI-detected CTA:", insight.text, "confidence:", insight.confidence)
    return {
      text: insight.text || "Unknown CTA",
      confidence: insight.confidence || 0.8,
      hasForm: insight.hasForm || false,
      isFormAssociated: (insight as any).isFormAssociated,
      reasoning: insight.reasoning || "AI detected primary CTA",
      elementType: insight.elementType as 'button' | 'link' | 'form',
      alternativeTexts: insight.alternativeTexts || [],
      href: (insight as any).href
    }
  }
  
  console.log("❌ No AI CTA insight available - funnel analysis requires AI detection")
  return null
}

/**
 * Follow primary CTA to get the next URL
 */
export function followPrimaryCta(
  captureResult: CaptureResult,
  baseUrl: string
): { nextUrl: string; reason: string } | null {
  const cta = extractPrimaryCta(captureResult)
  
  if (!cta) {
    return {
      nextUrl: baseUrl,
      reason: "No primary CTA detected for step 2"
    }
  }
  
  if (!cta.href) {
    return {
      nextUrl: baseUrl,
      reason: "Primary CTA is a button without target URL - manual entry required"
    }
  }
  
  let nextUrl = cta.href
  
  // Handle relative URLs
  if (nextUrl.startsWith('/')) {
    try {
      const base = new URL(baseUrl)
      nextUrl = `${base.protocol}//${base.host}${nextUrl}`
    } catch (error) {
      return null
    }
  }
  
  // Handle same-origin URLs only for now
  try {
    const baseUrlObj = new URL(baseUrl)
    const nextUrlObj = new URL(nextUrl)
    
    if (baseUrlObj.hostname !== nextUrlObj.hostname) {
      return {
        nextUrl,
        reason: "External domain - manual entry required"
      }
    }
  } catch (error) {
    return null
  }
  
  return {
    nextUrl,
    reason: "Following CTA link"
  }
}

/**
 * Get predicted CTR for a CTA element
 */
export function getPredictedCTR(captureResult: CaptureResult, ctaText: string): number {
  // First try primary CTA prediction (most reliable - same as competitor analysis)
  if (captureResult.primaryCTAPrediction) {
    const primaryCTA = captureResult.primaryCTAPrediction
    // Use primary CTA data directly - no conversion needed
    if (primaryCTA.ctr && (!ctaText || primaryCTA.text === ctaText)) {
      return primaryCTA.ctr // Already in percentage format from prediction engine
    }
  }
  
  // Try to find a matching prediction in click predictions array
  if (captureResult.clickPredictions && captureResult.clickPredictions.length > 0) {
    const prediction = captureResult.clickPredictions.find(p => 
      p.text && ctaText && 
      (p.text.toLowerCase().includes(ctaText.toLowerCase()) ||
       ctaText.toLowerCase().includes(p.text.toLowerCase()))
    )
    
    if (prediction) {
      return prediction.ctr // Already in percentage format from prediction engine
    }
    
    // Fallback to highest CTR prediction
    const highestPrediction = captureResult.clickPredictions.reduce((best, current) => 
      current.ctr > best.ctr ? current : best
    )
    return highestPrediction.ctr // Already in percentage format from prediction engine
  }
  
  // Default fallback based on element type
  if (ctaText.toLowerCase().includes('submit') || 
      ctaText.toLowerCase().includes('sign up') ||
      ctaText.toLowerCase().includes('register')) {
    return 2.5 // Form submission rate
  }
  
  return 5.0 // Default button CTR
}

/**
 * Get comprehensive primary CTA performance data
 */
export function getPrimaryCTAPerformance(captureResult: CaptureResult): {
  ctr: number;
  predictedClicks: number;
  wastedSpend: number;
  wastedClicks: number;
  confidence: string;
  text: string;
} {
  const fallback = {
    ctr: 5.0,
    predictedClicks: 50,
    wastedSpend: 0,
    wastedClicks: 0,
    confidence: 'low',
    text: 'Unknown CTA'
  }
  
  // Use primary CTA prediction if available (same as competitor analysis)
  if (captureResult.primaryCTAPrediction) {
    const primary = captureResult.primaryCTAPrediction
    return {
      ctr: primary.ctr || fallback.ctr,
      predictedClicks: primary.predictedClicks || primary.estimatedClicks || fallback.predictedClicks,
      wastedSpend: primary.wastedSpend || fallback.wastedSpend,
      wastedClicks: primary.wastedClicks || fallback.wastedClicks,
      confidence: primary.confidence || fallback.confidence,
      text: primary.text || fallback.text
    }
  }
  
  // Fallback to highest CTR from click predictions (same as competitor analysis)
  if (captureResult.clickPredictions && Array.isArray(captureResult.clickPredictions) && captureResult.clickPredictions.length > 0) {
    const highestCTR = captureResult.clickPredictions.reduce((max, current) => 
      (current.ctr > max.ctr) ? current : max, captureResult.clickPredictions[0]
    )
    
    if (highestCTR) {
      return {
        ctr: highestCTR.ctr || fallback.ctr,
        predictedClicks: highestCTR.predictedClicks || highestCTR.estimatedClicks || fallback.predictedClicks,
        wastedSpend: highestCTR.wastedSpend || fallback.wastedSpend,
        wastedClicks: highestCTR.wastedClicks || fallback.wastedClicks,
        confidence: highestCTR.confidence || fallback.confidence,
        text: highestCTR.text || fallback.text
      }
    }
  }
  
  return fallback
}

/**
 * Calculate funnel metrics based on step data
 */
export function calculateFunnelMetrics(
  step1: FunnelStep | null,
  step2: FunnelStep | null,
  initialVisitors: number = 1000
): {
  n1: number;
  p1: number;
  n2: number;
  p2: number;
  pTotal: number;
  nConv: number;
} {
  const n1 = initialVisitors
  
  if (!step1) {
    return { n1, p1: 0, n2: 0, p2: 0, pTotal: 0, nConv: 0 }
  }
  
  // CTR values from prediction engine are already in percentage format (e.g., 20.2)
  // Convert to decimal for calculations (20.2 -> 0.202)
  const p1Decimal = step1.predictedCTR / 100
  const n2 = Math.round(n1 * p1Decimal)
  
  if (!step2) {
    // Single-step funnel (form or single CTA)
    const nConv = Math.round(n1 * p1Decimal)
    return { 
      n1, 
      p1: p1Decimal, // Return as decimal for FunnelView (it will convert back to percentage)
      n2: n1, // For single step, n2 = n1 (all users see the form/CTA)
      p2: p1Decimal, // Same rate for single step
      pTotal: p1Decimal, // Total conversion rate
      nConv 
    }
  }
  
  // Two-step funnel
  const p2Decimal = step2.predictedCTR / 100
  const pTotal = p1Decimal * p2Decimal
  const nConv = Math.round(n2 * p2Decimal)
  
  return { 
    n1, 
    p1: p1Decimal, 
    n2, 
    p2: p2Decimal, 
    pTotal, 
    nConv 
  }
}

/**
 * Analyze funnel from capture data
 */
export function analyzeFunnelFromCapture(
  captureResult: CaptureResult,
  url: string,
  initialVisitors: number = 1000
): FunnelData {
  const ctaType = detectPrimaryCtaType(captureResult)
  const primaryCta = extractPrimaryCta(captureResult)
  
  if (!primaryCta) {
    return {
      url,
      type: 'none',
      step1: null,
      step2: null,
      n1: initialVisitors,
      p1: 0,
      n2: 0,
      p2: 0,
      pTotal: 0,
      nConv: 0,
      isLoading: false,
      isStep2Loading: false,
      error: "No primary CTA detected"
    }
  }
  
  // Get actual performance data from capture results (same as competitor analysis)
  const performance = getPrimaryCTAPerformance(captureResult)
  
  console.log("🔧 Performance data extracted:", {
    text: performance.text,
    ctr: performance.ctr,
    predictedClicks: performance.predictedClicks,
    confidence: performance.confidence
  })
  
  const step1: FunnelStep = {
    url,
    captureResult,
    ctaText: performance.text,
    ctaType: primaryCta.elementType,
    predictedCTR: performance.ctr, // Use actual CTR from prediction engine
    predictedClicks: Math.round(initialVisitors * (performance.ctr / 100)) // Calculate based on actual CTR
  }
  
  // Calculate metrics using real performance data
  const metrics = calculateFunnelMetrics(step1, null, initialVisitors)
  
  console.log("🔧 Calculated funnel metrics:", metrics)
  
  return {
    url,
    type: ctaType,
    step1,
    step2: null,
    n1: metrics.n1,
    p1: metrics.p1,
    n2: metrics.n2,
    p2: metrics.p2,
    pTotal: metrics.pTotal,
    nConv: metrics.nConv,
    isLoading: false,
    isStep2Loading: false,
    error: null
  }
}

/**
 * Update funnel data with step 2 results
 */
export function updateFunnelWithStep2(
  currentFunnel: FunnelData,
  step2: FunnelStep
): FunnelData {
  if (!currentFunnel.step1) {
    return currentFunnel
  }
  
  const metrics = calculateFunnelMetrics(currentFunnel.step1, step2, currentFunnel.n1)
  
  return {
    ...currentFunnel,
    step2,
    type: 'non-form', // Two-step funnel
    n2: metrics.n2,
    p2: metrics.p2,
    pTotal: metrics.pTotal,
    nConv: metrics.nConv
  }
}

