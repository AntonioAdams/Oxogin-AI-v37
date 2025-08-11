import type { CaptureResult } from "@/app/page/types"
import type { FunnelData, FunnelStep, FunnelType, CtaAnalysisResult } from "./types"
import { determineIsFormRelated, type ScaledFormData } from "@/lib/form/boundary-detection"

/**
 * Create initial funnel data structure
 */
export function createInitialFunnelData(url: string = ""): FunnelData {
  return {
    url,
    type: 'none',
    step1: null,
    step2: null,
    n1: 1000,
    p1: 0,
    n2: 0,
    p2: 0,
    pTotal: 0,
    nConv: 0,
    isLoading: false,
    isStep2Loading: false,
    error: null
  }
}

/**
 * Get current user ID for API calls
 */
export function getCurrentUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Detect the primary CTA type from capture data - COORDINATE/BOUNDARY-BASED
 * Uses spatial relationship between CTA coordinates and form boundaries (overlap + proximity)
 */
export function detectPrimaryCtaType(captureResult: CaptureResult): FunnelType {
  const domData = captureResult.domData
  const imageSize = captureResult.imageSize || { width: 800, height: 600 }
  const displaySize = captureResult.containerSize || { width: 800, height: 600 }
  
  // Step 1: Check if any forms exist
  const actualFormsCount = domData.forms ? domData.forms.length : 0
  if (actualFormsCount === 0) {
    return 'non-form'  // No forms = definitely non-form
  }
  
  // Step 2: Extract primary CTA coordinates
  let ctaCoords = null
  if (captureResult.primaryCTAPrediction?.coordinates) {
    ctaCoords = captureResult.primaryCTAPrediction.coordinates
  } else if (captureResult.clickPredictions?.length > 0) {
    const predWithCoords = captureResult.clickPredictions.find(p => p.coordinates)
    if (predWithCoords) {
      ctaCoords = predWithCoords.coordinates
    }
  }
  
  if (!ctaCoords) {
    return 'non-form'  // No CTA coordinates = can't determine spatial relationship
  }
  
  // Step 3: Convert forms to boundary boxes (only above-fold forms)
  const formBoundaryBoxes: ScaledFormData[] = []
  domData.forms.forEach(form => {
    if (form.coordinates && form.isAboveFold) {
      formBoundaryBoxes.push({
        displayCoords: {
          x: form.coordinates.x,
          y: form.coordinates.y,
          width: form.coordinates.width,
          height: form.coordinates.height
        }
      })
    }
  })
  
  if (formBoundaryBoxes.length === 0) {
    return 'non-form'  // No above-fold forms = non-form
  }
  
  // Step 4: Use enhanced boundary detection (overlap + proximity)
  const isFormRelated = determineIsFormRelated(ctaCoords, formBoundaryBoxes, imageSize, displaySize)
  return isFormRelated ? 'form' : 'non-form'
}

/**
 * Extract primary CTA information from capture data - NO FALLBACKS
 */
export function extractPrimaryCta(captureResult: CaptureResult): CtaAnalysisResult | null {
  // ONLY use AI CTA insight - no fallbacks to prevent incorrect CTA detection
  if (captureResult.ctaInsight) {
    const insight = captureResult.ctaInsight
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
  
  // If CTA is a button without href, try to find related links
  if (!cta.href) {
    const ctaText = cta.text.toLowerCase()
    const domData = captureResult.domData
    
    if (domData.links && domData.links.length > 0) {
      // Look for links that might be related to the CTA action
      const relatedLink = domData.links.find(link => {
        if (!link.href || !link.text) return false
        
        const linkText = link.text.toLowerCase()
        
        // Check for keyword matches
        const ctaKeywords = extractKeywords(ctaText)
        const linkKeywords = extractKeywords(linkText)
        
        // If CTA contains action words, look for category/product links
        if (ctaText.includes('buy') || ctaText.includes('shop') || ctaText.includes('purchase')) {
          return linkKeywords.some(keyword => 
            ['mac', 'ipad', 'iphone', 'product', 'store', 'shop'].includes(keyword)
          )
        }
        
        // Look for direct keyword overlap
        return ctaKeywords.some(keyword => linkKeywords.includes(keyword))
      })
      
      if (relatedLink && relatedLink.href) {
        let nextUrl = relatedLink.href
        
        // Handle relative URLs
        if (nextUrl.startsWith('/')) {
          try {
            const base = new URL(baseUrl)
            nextUrl = `${base.protocol}//${base.host}${nextUrl}`
          } catch (error) {
            return {
              nextUrl: baseUrl,
              reason: "Related link found but URL parsing failed"
            }
          }
        }
        
        try {
          const baseUrlObj = new URL(baseUrl)
          const nextUrlObj = new URL(nextUrl)
          
          // Allow same domain and subdomains (e.g., apple.com and www.apple.com)
          const baseDomain = baseUrlObj.hostname.replace(/^www\./, '')
          const nextDomain = nextUrlObj.hostname.replace(/^www\./, '')
          
          if (baseDomain !== nextDomain) {
            return {
              nextUrl: baseUrl,
              reason: `Related link "${relatedLink.text}" goes to external domain`
            }
          }
          
          return { 
            nextUrl, 
            reason: `Following related link: "${relatedLink.text}"` 
          }
        } catch (error) {
          return {
            nextUrl: baseUrl,
            reason: "Related link found but URL validation failed"
          }
        }
      }
    }
    
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
 * Extract keywords from text for matching
 */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'for', 'with', 'you', 'your', 'all', 'new', 'get', 'now'].includes(word))
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
 * Get comprehensive primary CTA performance data - PRIORITIZE AI INSIGHT
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
  
  // FIXED: Prioritize AI CTA insight text over prediction engine
  let ctaText = fallback.text
  if (captureResult.ctaInsight?.text) {
    ctaText = captureResult.ctaInsight.text
  }
  
  // Debug: Log what we're working with
  console.log("🔍 getPrimaryCTAPerformance Debug:", {
    aiCtaText: ctaText,
    clickPredictionsTexts: captureResult.clickPredictions?.map(p => p.text) || [],
    primaryCTAPrediction: captureResult.primaryCTAPrediction?.text
  })
  
  // Try to find performance data that matches the AI-detected CTA
  if (captureResult.clickPredictions && Array.isArray(captureResult.clickPredictions) && captureResult.clickPredictions.length > 0) {
    // Look for exact or partial match with AI CTA text
    const matchingPrediction = captureResult.clickPredictions.find(p => {
      if (!p.text || !ctaText) return false
      const pText = p.text.toLowerCase().trim()
      const ctaTextLower = ctaText.toLowerCase().trim()
      
      // More flexible matching for common variations
      const isExactMatch = pText === ctaTextLower
      const isPartialMatch = pText.includes(ctaTextLower) || ctaTextLower.includes(pText)
      const isApplyMatch = (ctaTextLower.includes('apply') && pText.includes('apply'))
      
      return isExactMatch || isPartialMatch || isApplyMatch
    })
    
    console.log(`🔍 Matching prediction result:`, matchingPrediction ? `Found: ${matchingPrediction.text}` : 'None found')
    
    if (matchingPrediction) {
      // Use clickProbability (decimal) converted to percentage when ctr is null
      const ctrValue = matchingPrediction.ctr || (matchingPrediction.clickProbability ? matchingPrediction.clickProbability * 100 : fallback.ctr)
      return {
        ctr: ctrValue,
        predictedClicks: matchingPrediction.predictedClicks || matchingPrediction.estimatedClicks || Math.round(1000 * (ctrValue / 100)),
        wastedSpend: matchingPrediction.wastedSpend || fallback.wastedSpend,
        wastedClicks: matchingPrediction.wastedClicks || fallback.wastedClicks,
        confidence: matchingPrediction.confidence || fallback.confidence,
        text: ctaText // Use AI text, not prediction text
      }
    }
    
    // If no exact match, use highest CTR prediction but keep AI text
    const highestCTR = captureResult.clickPredictions.reduce((max, current) => {
      const currentCTR = current.ctr || (current.clickProbability ? current.clickProbability * 100 : 0)
      const maxCTR = max.ctr || (max.clickProbability ? max.clickProbability * 100 : 0)
      return currentCTR > maxCTR ? current : max
    }, captureResult.clickPredictions[0])
    
    if (highestCTR) {
      const ctrValue = highestCTR.ctr || (highestCTR.clickProbability ? highestCTR.clickProbability * 100 : fallback.ctr)
      return {
        ctr: ctrValue,
        predictedClicks: highestCTR.predictedClicks || highestCTR.estimatedClicks || Math.round(1000 * (ctrValue / 100)),
        wastedSpend: highestCTR.wastedSpend || fallback.wastedSpend,
        wastedClicks: highestCTR.wastedClicks || fallback.wastedClicks,
        confidence: highestCTR.confidence || fallback.confidence,
        text: ctaText // Use AI text, not prediction text
      }
    }
  }
  
  // Final fallback with AI text
  return {
    ...fallback,
    text: ctaText
  }
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
