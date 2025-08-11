/**
 * Post-Click Conversion Prediction Model
 * 
 * Predicts PRIMARY CTA conversion rates for subsequent pages in multi-step funnels
 * using multiplicative factor analysis based on UX/CRO research.
 * 
 * Focus: Predicts likelihood of clicking/converting on the PRIMARY CTA of page 2+,
 * similar to how the existing system predicts primary CTA performance on page 1.
 */

import type { CaptureResult } from "@/app/page/types"

// Core Types
export type AudienceWarmth = 'cold' | 'mixed' | 'warm'
export type PredictionMode = 'multiplicative' | 'logit'

export interface PostClickFactor {
  factor: string
  score: number  // 0-1 scale of how well implemented
  max_lift: number  // Maximum relative lift this factor can provide
  note?: string
}

export interface PostClickStep {
  step_name: string
  cold_base_rate: number  // Base conversion rate for cold traffic
  audience: AudienceWarmth
  upper_cap?: number  // Optional cap on predicted rate
}

export interface PostClickConfig {
  mode: PredictionMode
  apply_cap: boolean
  audience_multipliers: {
    cold: number
    mixed: number
    warm: number
  }
}

export interface PostClickPrediction {
  step_name: string
  audience: AudienceWarmth
  cold_base_rate: number
  warmth_multiplier_applied: number
  combined_factor_multiplier: number
  upper_cap?: number
  predicted_rate: number
  factors_analyzed: PostClickFactor[]
}

// Default Configuration
export const DEFAULT_POST_CLICK_CONFIG: PostClickConfig = {
  mode: 'multiplicative',
  apply_cap: true,
  audience_multipliers: {
    cold: 1.0,
    mixed: 1.5,
    warm: 2.5
  }
}

// Default Factors with Research-Backed Ranges (Primary CTA Focused)
export const DEFAULT_POST_CLICK_FACTORS: PostClickFactor[] = [
  {
    factor: 'message_match_scent',
    score: 0.80,
    max_lift: 0.40,
    note: 'Primary CTA message consistency between pages (copy/design/offer)'
  },
  {
    factor: 'cta_form_friction',
    score: 0.60,
    max_lift: 0.70,
    note: 'Primary CTA friction: form fields, steps, validation ease'
  },
  {
    factor: 'page_speed_ux',
    score: 0.90,
    max_lift: 0.10,
    note: 'Page load speed affecting primary CTA accessibility'
  },
  {
    factor: 'mobile_cta_optimization',
    score: 0.70,
    max_lift: 0.20,
    note: 'Primary CTA mobile UX: touch targets, visibility'
  },
  {
    factor: 'cta_clarity_focus',
    score: 0.75,
    max_lift: 0.35,
    note: 'Primary CTA visual hierarchy and clarity vs distractions'
  },
  {
    factor: 'trust_signals_cta',
    score: 0.50,
    max_lift: 0.15,
    note: 'Trust elements near/in primary CTA (badges, security)'
  },
  {
    factor: 'commitment_momentum_cta',
    score: 0.50,
    max_lift: 0.25,
    note: 'Progress indication and momentum toward primary CTA'
  }
]

// Default Steps Configuration (Primary CTA Focused)
export const DEFAULT_POST_CLICK_STEPS: PostClickStep[] = [
  {
    step_name: 'Step 2 Primary CTA (Email Form)',
    cold_base_rate: 0.10, // Base rate for primary CTA clicks on email forms
    audience: 'warm',
    upper_cap: 0.65 // Realistic upper bound for primary CTA conversion
  }
]

/**
 * Calculate multiplicative factor impact
 */
export function calculateFactorMultiplier(score: number, maxLift: number): number {
  // Clamp score to [0, 1] range
  const clampedScore = Math.max(0, Math.min(1, score))
  return 1 + (maxLift * clampedScore)
}

/**
 * Calculate logit-space contribution (for logit mode)
 */
export function calculateLogitContribution(score: number, maxLift: number, referenceRate: number = 0.20): number {
  // Convert max_lift to logit space effect at reference rate
  const referenceLogit = Math.log(referenceRate / (1 - referenceRate))
  const targetRate = referenceRate * (1 + maxLift)
  const targetLogit = Math.log(targetRate / (1 - targetRate))
  const logitDelta = targetLogit - referenceLogit
  
  const clampedScore = Math.max(0, Math.min(1, score))
  return logitDelta * clampedScore
}

/**
 * Combine all factor multipliers
 */
export function combineFactorMultipliers(factors: PostClickFactor[], mode: PredictionMode = 'multiplicative'): number {
  if (mode === 'multiplicative') {
    return factors.reduce((product, factor) => {
      const multiplier = calculateFactorMultiplier(factor.score, factor.max_lift)
      return product * multiplier
    }, 1.0)
  } else {
    // Logit mode - sum contributions in logit space
    const logitSum = factors.reduce((sum, factor) => {
      const contribution = calculateLogitContribution(factor.score, factor.max_lift)
      return sum + contribution
    }, 0)
    return logitSum
  }
}

/**
 * Predict step conversion rate
 */
export function predictStepRate(
  step: PostClickStep,
  config: PostClickConfig,
  factors: PostClickFactor[]
): PostClickPrediction {
  // Get audience multiplier
  const warmthMultiplier = config.audience_multipliers[step.audience]
  
  // Calculate adjusted base rate
  const adjustedBaseRate = step.cold_base_rate * warmthMultiplier
  
  let predictedRate: number
  let combinedFactorMultiplier: number
  
  if (config.mode === 'multiplicative') {
    // Multiplicative mode
    combinedFactorMultiplier = combineFactorMultipliers(factors, 'multiplicative')
    predictedRate = adjustedBaseRate * combinedFactorMultiplier
  } else {
    // Logit mode
    const logitSum = combineFactorMultipliers(factors, 'logit')
    const baseLogit = Math.log(adjustedBaseRate / (1 - adjustedBaseRate))
    const adjustedLogit = baseLogit + logitSum
    
    // Convert back from logit space
    predictedRate = Math.exp(adjustedLogit) / (1 + Math.exp(adjustedLogit))
    combinedFactorMultiplier = logitSum // Store logit sum for reference
  }
  
  // Apply cap if enabled
  if (config.apply_cap && step.upper_cap && predictedRate > step.upper_cap) {
    predictedRate = step.upper_cap
  }
  
  return {
    step_name: step.step_name,
    audience: step.audience,
    cold_base_rate: step.cold_base_rate,
    warmth_multiplier_applied: warmthMultiplier,
    combined_factor_multiplier: combinedFactorMultiplier,
    upper_cap: step.upper_cap,
    predicted_rate: predictedRate,
    factors_analyzed: factors
  }
}

/**
 * Predict all steps
 */
export function predictAllSteps(
  steps: PostClickStep[],
  config: PostClickConfig,
  factors: PostClickFactor[]
): PostClickPrediction[] {
  return steps.map(step => predictStepRate(step, config, factors))
}

/**
 * Analyze capture result to automatically score factors focused on PRIMARY CTA
 */
export function analyzeFactorsFromCapture(
  captureResult: CaptureResult,
  baseFactors: PostClickFactor[] = DEFAULT_POST_CLICK_FACTORS
): PostClickFactor[] {
  // Get primary CTA information for focused analysis
  const primaryCTA = captureResult.primaryCTAPrediction || captureResult.ctaInsight
  
  return baseFactors.map(factor => {
    let adjustedScore = factor.score
    
    switch (factor.factor) {
      case 'page_speed_ux':
        // Analyze page speed indicators affecting CTA accessibility
        adjustedScore = analyzePageSpeed(captureResult)
        break
        
      case 'mobile_cta_optimization':
        // Analyze mobile UX specifically for primary CTA
        adjustedScore = analyzeMobileCTAOptimization(captureResult, primaryCTA)
        break
        
      case 'cta_clarity_focus':
        // Analyze primary CTA clarity and focus
        adjustedScore = analyzePrimaryCTAClarity(captureResult, primaryCTA)
        break
        
      case 'trust_signals_cta':
        // Analyze trust indicators related to CTA area
        adjustedScore = analyzeTrustSignalsAroundCTA(captureResult, primaryCTA)
        break
        
      case 'cta_form_friction':
        // Analyze friction specifically for primary CTA (if it's a form CTA)
        adjustedScore = analyzeCTAFormFriction(captureResult, primaryCTA)
        break
        
      case 'message_match_scent':
        // This requires comparison between pages - keep default for now
        adjustedScore = factor.score
        break
        
      case 'commitment_momentum_cta':
        // Analyze momentum building toward primary CTA
        adjustedScore = analyzeCTACommitmentMomentum(captureResult, primaryCTA)
        break
        
      default:
        adjustedScore = factor.score
    }
    
    return {
      ...factor,
      score: Math.max(0, Math.min(1, adjustedScore))
    }
  })
}

/**
 * Analyze page speed factors from capture data
 */
function analyzePageSpeed(captureResult: CaptureResult): number {
  // Base score - assume reasonable performance unless we detect issues
  let score = 0.80
  
  // Check for performance indicators in DOM
  const domData = captureResult.domData
  
  // Check for heavy elements that might slow down page
  if (domData.images && domData.images.length > 20) {
    score -= 0.15 // Too many images
  }
  
  if (domData.scripts && domData.scripts.length > 15) {
    score -= 0.10 // Too many scripts
  }
  
  // Check for optimization indicators
  if (domData.images?.some(img => img.loading === 'lazy')) {
    score += 0.05 // Lazy loading implemented
  }
  
  return Math.max(0.3, Math.min(1.0, score))
}

/**
 * Analyze mobile optimization specifically for primary CTA
 */
function analyzeMobileCTAOptimization(captureResult: CaptureResult, primaryCTA: any): number {
  let score = 0.70
  
  const domData = captureResult.domData
  
  // Check for mobile viewport meta tag
  if (domData.meta?.some(meta => meta.name === 'viewport')) {
    score += 0.15
  }
  
  // Check for responsive design indicators
  if (domData.styles?.some(style => style.includes('media') && style.includes('max-width'))) {
    score += 0.10
  }
  
  // Focus on primary CTA touch target size
  if (primaryCTA?.coordinates) {
    const ctaWidth = primaryCTA.coordinates.width || 0
    const ctaHeight = primaryCTA.coordinates.height || 0
    
    // Apple's recommended minimum touch target is 44x44pt
    if (ctaWidth >= 44 && ctaHeight >= 44) {
      score += 0.15 // Good touch target size
    } else if (ctaWidth < 32 || ctaHeight < 32) {
      score -= 0.20 // Too small for mobile
    }
  }
  
  // Check if other buttons are too small (distracts from primary CTA)
  const hasSmallButtons = domData.buttons?.some(btn => 
    btn.coordinates && 
    btn !== primaryCTA && 
    (btn.coordinates.width < 44 || btn.coordinates.height < 44)
  )
  
  if (hasSmallButtons) {
    score -= 0.10 // Small secondary buttons reduce mobile UX
  }
  
  return Math.max(0.2, Math.min(1.0, score))
}

/**
 * Analyze PRIMARY CTA clarity and focus against competing elements
 */
function analyzePrimaryCTAClarity(captureResult: CaptureResult, primaryCTA: any): number {
  let score = 0.60
  
  const domData = captureResult.domData
  const buttonCount = domData.buttons?.length || 0
  const linkCount = domData.links?.length || 0
  
  // Fewer competing CTAs = better primary CTA clarity
  const totalCTAs = buttonCount + linkCount
  if (totalCTAs <= 3) {
    score += 0.20 // Very focused on primary CTA
  } else if (totalCTAs <= 7) {
    score += 0.10 // Moderately focused
  } else if (totalCTAs > 15) {
    score -= 0.20 // Too many distractions from primary CTA
  }
  
  // Check for primary CTA detection confidence (how well it stands out)
  if (primaryCTA?.confidence && primaryCTA.confidence > 0.8) {
    score += 0.15 // Primary CTA clearly dominates
  } else if (primaryCTA?.confidence && primaryCTA.confidence < 0.5) {
    score -= 0.15 // Primary CTA doesn't stand out well
  }
  
  // Check primary CTA text clarity
  if (primaryCTA?.text) {
    const ctaText = primaryCTA.text.toLowerCase()
    const actionWords = ['submit', 'continue', 'next', 'complete', 'finish', 'proceed', 'confirm']
    if (actionWords.some(word => ctaText.includes(word))) {
      score += 0.10 // Clear action-oriented text
    }
  }
  
  return Math.max(0.2, Math.min(1.0, score))
}

/**
 * Analyze trust signals specifically around the primary CTA area
 */
function analyzeTrustSignalsAroundCTA(captureResult: CaptureResult, primaryCTA: any): number {
  let score = 0.40 // Base conservative score
  
  const domData = captureResult.domData
  const allText = [
    ...(domData.buttons?.map(b => b.text) || []),
    ...(domData.links?.map(l => l.text) || []),
    ...(domData.headings?.map(h => h.text) || [])
  ].join(' ').toLowerCase()
  
  // Look for trust indicators anywhere on the page
  const trustKeywords = [
    'secure', 'ssl', 'guarantee', 'certified', 'verified', 'trusted',
    'testimonial', 'review', 'award', 'badge', 'privacy', 'security'
  ]
  
  trustKeywords.forEach(keyword => {
    if (allText.includes(keyword)) {
      score += 0.08
    }
  })
  
  // Extra credit for trust signals near the primary CTA
  if (primaryCTA?.text) {
    const ctaText = primaryCTA.text.toLowerCase()
    if (ctaText.includes('secure') || ctaText.includes('protected')) {
      score += 0.10 // Trust language in CTA itself
    }
  }
  
  // Check for images that might be trust badges
  if (domData.images?.some(img => 
    img.alt?.toLowerCase().includes('badge') || 
    img.alt?.toLowerCase().includes('secure') ||
    img.alt?.toLowerCase().includes('certified')
  )) {
    score += 0.10
  }
  
  return Math.max(0.1, Math.min(1.0, score))
}

/**
 * Analyze friction specifically for primary CTA (if it's a form CTA)
 */
function analyzeCTAFormFriction(captureResult: CaptureResult, primaryCTA: any): number {
  let score = 0.70 // Base score
  
  const domData = captureResult.domData
  
  // If primary CTA is not form-related, analyze page simplicity instead
  if (!primaryCTA?.isFormRelated && !primaryCTA?.hasForm) {
    // For non-form CTAs, analyze page simplicity that affects CTA focus
    const buttonCount = domData.buttons?.length || 0
    const linkCount = domData.links?.length || 0
    const totalInteractiveElements = buttonCount + linkCount
    
    if (totalInteractiveElements <= 5) {
      score += 0.15 // Simple, focused page
    } else if (totalInteractiveElements > 15) {
      score -= 0.15 // Too many distractions
    }
    
    return Math.max(0.3, Math.min(1.0, score))
  }
  
  // Analyze form friction for form-related primary CTAs
  if (!domData.forms || domData.forms.length === 0) {
    return score // No forms to analyze
  }
  
  // Find the form most likely associated with primary CTA
  const primaryForm = domData.forms[0] // Assume first form is primary
  const fieldCount = primaryForm.inputs?.length || 0
  
  // Score based on field count (primary CTA form)
  if (fieldCount <= 2) {
    score += 0.20 // Very simple - great for primary CTA conversion
  } else if (fieldCount <= 4) {
    score += 0.10 // Reasonably simple
  } else if (fieldCount > 8) {
    score -= 0.25 // Too complex for good primary CTA conversion
  }
  
  // Check for friction reduction features
  const hasRequiredFields = primaryForm.inputs?.some(input => input.required)
  if (hasRequiredFields) {
    score -= 0.05 // Required fields add friction to primary CTA
  }
  
  // Check for helpful UX features
  const hasPlaceholders = primaryForm.inputs?.some(input => input.placeholder)
  if (hasPlaceholders) {
    score += 0.05 // Helpful guidance improves primary CTA conversion
  }
  
  // Check for progress indicators (multi-step forms)
  const hasStepIndicators = domData.headings?.some(h => 
    h.text?.toLowerCase().includes('step') || 
    h.text?.toLowerCase().includes('progress')
  )
  if (hasStepIndicators) {
    score += 0.10 // Progress indication reduces form abandonment
  }
  
  return Math.max(0.2, Math.min(1.0, score))
}

/**
 * Analyze commitment momentum building toward primary CTA
 */
function analyzeCTACommitmentMomentum(captureResult: CaptureResult, primaryCTA: any): number {
  let score = 0.40 // Base score
  
  const domData = captureResult.domData
  const allText = [
    ...(domData.headings?.map(h => h.text) || []),
    ...(domData.buttons?.map(b => b.text) || [])
  ].join(' ').toLowerCase()
  
  // Look for progress/step indicators that build momentum toward primary CTA
  const progressKeywords = [
    'step', 'progress', 'complete', 'finish', 'continue', 'next',
    'almost', 'final', 'last', 'stage', 'phase'
  ]
  
  progressKeywords.forEach(keyword => {
    if (allText.includes(keyword)) {
      score += 0.08 // Progress indication builds commitment
    }
  })
  
  // Check primary CTA text for momentum language
  if (primaryCTA?.text) {
    const ctaText = primaryCTA.text.toLowerCase()
    const momentumWords = ['continue', 'next', 'complete', 'finish', 'finalize', 'proceed']
    if (momentumWords.some(word => ctaText.includes(word))) {
      score += 0.15 // Primary CTA builds on previous steps
    }
  }
  
  // Check for multi-step form indicators (builds commitment through progressive disclosure)
  if (domData.forms?.some(form => 
    form.method === 'POST' || 
    (Array.isArray(form.inputs) && form.inputs.some(input => input.type === 'hidden'))
  )) {
    score += 0.10 // Indicates state preservation and step progression
  }
  
  // Check for investment indicators (time spent, information provided)
  const investmentKeywords = ['review', 'confirm', 'summary', 'details', 'information']
  investmentKeywords.forEach(keyword => {
    if (allText.includes(keyword)) {
      score += 0.05 // User has invested time/information
    }
  })
  
  return Math.max(0.1, Math.min(1.0, score))
}

/**
 * Create a prediction for funnel step 2 based on capture analysis
 */
export function createStep2Prediction(
  step1CaptureResult: CaptureResult,
  step2CaptureResult: CaptureResult,
  audienceWarmth: AudienceWarmth = 'warm'
): PostClickPrediction {
  // Analyze factors from step 2 capture
  const analyzedFactors = analyzeFactorsFromCapture(step2CaptureResult)
  
  // Add message match analysis by comparing step 1 and step 2
  const messageMatchScore = analyzeMessageMatch(step1CaptureResult, step2CaptureResult)
  const updatedFactors = analyzedFactors.map(factor => 
    factor.factor === 'message_match_scent' 
      ? { ...factor, score: messageMatchScore }
      : factor
  )
  
  // Create step configuration
  const step: PostClickStep = {
    step_name: 'Step 2 (Post-Click)',
    cold_base_rate: 0.10, // Default base rate for email forms
    audience: audienceWarmth,
    upper_cap: 0.65
  }
  
  // Use default config
  const config = DEFAULT_POST_CLICK_CONFIG
  
  // Generate prediction
  return predictStepRate(step, config, updatedFactors)
}

/**
 * Analyze message match between two pages
 */
function analyzeMessageMatch(
  step1Capture: CaptureResult,
  step2Capture: CaptureResult
): number {
  let score = 0.60 // Base score
  
  // Get primary CTA text from step 1
  const step1CtaText = step1Capture.primaryCTAPrediction?.text || 
                       step1Capture.ctaInsight?.text || ''
  
  // Get page content from both steps
  const step1Content = [
    ...(step1Capture.domData.headings?.map(h => h.text) || []),
    ...(step1Capture.domData.buttons?.map(b => b.text) || [])
  ].join(' ').toLowerCase()
  
  const step2Content = [
    ...(step2Capture.domData.headings?.map(h => h.text) || []),
    ...(step2Capture.domData.buttons?.map(b => b.text) || [])
  ].join(' ').toLowerCase()
  
  // Extract keywords from step 1 CTA and content
  const step1Keywords = extractKeywords(step1CtaText + ' ' + step1Content)
  const step2Keywords = extractKeywords(step2Content)
  
  // Calculate keyword overlap
  const overlap = step1Keywords.filter(keyword => step2Keywords.includes(keyword))
  const overlapRatio = overlap.length / Math.max(step1Keywords.length, 1)
  
  // Adjust score based on overlap
  score += Math.min(0.30, overlapRatio * 0.40)
  
  return Math.max(0.2, Math.min(1.0, score))
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
    'her', 'its', 'our', 'their'
  ])
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10) // Limit to top 10 keywords
}
