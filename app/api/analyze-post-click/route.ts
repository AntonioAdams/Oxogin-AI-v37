import { NextRequest, NextResponse } from 'next/server'
import type { CaptureResult } from '@/app/page/types'
import {
  createStep2Prediction,
  analyzeFactorsFromCapture,
  predictStepRate,
  DEFAULT_POST_CLICK_CONFIG,
  type PostClickStep,
  type PostClickFactor,
  type AudienceWarmth,
  type PostClickPrediction
} from '@/lib/funnel/post-click-model'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      step1CaptureResult,
      step2CaptureResult,
      audienceWarmth = 'warm',
      stepConfig,
      customFactors,
      mode = 'multiplicative'
    } = body
    
    // Validate required inputs
    if (!step2CaptureResult || !step2CaptureResult.domData) {
      return NextResponse.json(
        { error: 'step2CaptureResult with domData is required' },
        { status: 400 }
      )
    }
    
    let prediction: PostClickPrediction
    
    if (step1CaptureResult) {
      // Two-step analysis: compare step 1 and step 2
      prediction = createStep2Prediction(
        step1CaptureResult,
        step2CaptureResult,
        audienceWarmth as AudienceWarmth
      )
    } else {
      // Single-step analysis: analyze step 2 only
      const analyzedFactors = customFactors || 
        analyzeFactorsFromCapture(step2CaptureResult)
      
      const step: PostClickStep = stepConfig || {
        step_name: 'Step 2 (Post-Click)',
        cold_base_rate: 0.10,
        audience: audienceWarmth as AudienceWarmth,
        upper_cap: 0.65
      }
      
      const config = {
        ...DEFAULT_POST_CLICK_CONFIG,
        mode: mode as 'multiplicative' | 'logit'
      }
      
      prediction = predictStepRate(step, config, analyzedFactors)
    }
    
    // Calculate additional metrics for funnel analysis
    const analysisResult = {
      prediction,
      metrics: {
        // Convert prediction rate to CTR percentage for consistency with existing system
        predictedCTR: prediction.predicted_rate * 100,
        
        // Calculate predicted clicks and conversions for 1000 visitors
        predictedClicks: Math.round(1000 * prediction.predicted_rate),
        
        // Factor breakdown for UI display
        factorImpacts: prediction.factors_analyzed.map(factor => ({
          factor: factor.factor,
          score: factor.score,
          maxLift: factor.max_lift,
          actualLift: factor.score * factor.max_lift,
          multiplier: 1 + (factor.score * factor.max_lift),
          note: factor.note
        })),
        
        // Summary statistics
        totalFactorLift: prediction.combined_factor_multiplier - 1,
        baseRateContribution: prediction.cold_base_rate,
        warmthContribution: prediction.warmth_multiplier_applied - 1,
        finalRate: prediction.predicted_rate,
        
        // Confidence indicators
        confidence: calculatePredictionConfidence(prediction),
        analysisTimestamp: new Date().toISOString()
      },
      
      // Provide factor recommendations for improvement
      recommendations: generateFactorRecommendations(prediction.factors_analyzed)
    }
    
    return NextResponse.json(analysisResult)
    
  } catch (error) {
    console.error('Post-click analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze post-click conversion factors' },
      { status: 500 }
    )
  }
}

/**
 * Calculate confidence score for the prediction
 */
function calculatePredictionConfidence(prediction: PostClickPrediction): number {
  let confidence = 0.7 // Base confidence
  
  // Higher confidence if more factors are well-implemented
  const wellImplementedFactors = prediction.factors_analyzed.filter(
    factor => factor.score > 0.7
  ).length
  
  confidence += (wellImplementedFactors / prediction.factors_analyzed.length) * 0.2
  
  // Lower confidence if prediction is at cap (less reliable)
  if (prediction.upper_cap && prediction.predicted_rate >= prediction.upper_cap) {
    confidence -= 0.15
  }
  
  // Adjust based on audience warmth (warmer = more predictable)
  if (prediction.audience === 'warm') {
    confidence += 0.05
  } else if (prediction.audience === 'cold') {
    confidence -= 0.10
  }
  
  return Math.max(0.3, Math.min(1.0, confidence))
}

/**
 * Generate improvement recommendations based on factor scores
 */
function generateFactorRecommendations(factors: PostClickFactor[]) {
  const recommendations = []
  
  // Sort factors by potential impact (low score × high max lift = high opportunity)
  const opportunities = factors
    .map(factor => ({
      ...factor,
      opportunity: (1 - factor.score) * factor.max_lift
    }))
    .sort((a, b) => b.opportunity - a.opportunity)
    .slice(0, 3) // Top 3 opportunities
  
  for (const factor of opportunities) {
    let recommendation = ''
    let priority: 'high' | 'medium' | 'low' = 'medium'
    
    switch (factor.factor) {
      case 'message_match_scent':
        recommendation = 'Improve messaging consistency between pages'
        priority = factor.opportunity > 0.15 ? 'high' : 'medium'
        break
        
      case 'form_friction_reduction':
        recommendation = 'Simplify form fields and add progress indicators'
        priority = factor.opportunity > 0.20 ? 'high' : 'medium'
        break
        
      case 'page_speed_ux':
        recommendation = 'Optimize page loading speed and performance'
        priority = factor.opportunity > 0.05 ? 'medium' : 'low'
        break
        
      case 'mobile_optimization':
        recommendation = 'Enhance mobile user experience and touch targets'
        priority = factor.opportunity > 0.10 ? 'high' : 'medium'
        break
        
      case 'cta_clarity_focus':
        recommendation = 'Clarify primary call-to-action and reduce distractions'
        priority = factor.opportunity > 0.12 ? 'high' : 'medium'
        break
        
      case 'trust_signals':
        recommendation = 'Add security badges and trust indicators'
        priority = factor.opportunity > 0.08 ? 'medium' : 'low'
        break
        
      case 'commitment_momentum':
        recommendation = 'Add progress indicators and build on user investment'
        priority = factor.opportunity > 0.10 ? 'medium' : 'low'
        break
        
      default:
        recommendation = `Optimize ${factor.factor.replace(/_/g, ' ')}`
        priority = 'low'
    }
    
    if (factor.opportunity > 0.05) { // Only include meaningful opportunities
      recommendations.push({
        factor: factor.factor,
        recommendation,
        priority,
        currentScore: factor.score,
        maxLift: factor.max_lift,
        opportunity: factor.opportunity,
        estimatedImpact: `+${(factor.opportunity * 100).toFixed(1)}% conversion lift`
      })
    }
  }
  
  return recommendations
}
