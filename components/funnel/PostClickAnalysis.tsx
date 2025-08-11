"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Info, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import type { PostClickPrediction } from '@/lib/funnel/post-click-model'

interface PostClickAnalysisProps {
  prediction: PostClickPrediction
  className?: string
  showFactorBreakdown?: boolean
}

export function PostClickAnalysis({ 
  prediction, 
  className = "", 
  showFactorBreakdown = true 
}: PostClickAnalysisProps) {
  // Calculate total potential lift
  const totalPotentialLift = prediction.factors_analyzed.reduce(
    (sum, factor) => sum + factor.max_lift,
    0
  )
  
  const actualLift = prediction.combined_factor_multiplier - 1
  const liftPercentage = totalPotentialLift > 0 ? (actualLift / totalPotentialLift) * 100 : 0
  
  // Categorize factors by performance
  const excellentFactors = prediction.factors_analyzed.filter(f => f.score >= 0.8)
  const goodFactors = prediction.factors_analyzed.filter(f => f.score >= 0.6 && f.score < 0.8)
  const poorFactors = prediction.factors_analyzed.filter(f => f.score < 0.6)
  
  const getFactorDisplayName = (factor: string): string => {
    const names: Record<string, string> = {
      'message_match_scent': 'Message Match',
      'form_friction_reduction': 'Form Simplicity',
      'page_speed_ux': 'Page Speed',
      'mobile_optimization': 'Mobile UX',
      'cta_clarity_focus': 'CTA Clarity',
      'trust_signals': 'Trust Signals',
      'commitment_momentum': 'User Momentum'
    }
    return names[factor] || factor.replace(/_/g, ' ')
  }
  
  const getFactorIcon = (score: number) => {
    if (score >= 0.8) return <CheckCircle className="w-3 h-3 text-green-500" />
    if (score >= 0.6) return <Info className="w-3 h-3 text-blue-500" />
    return <AlertTriangle className="w-3 h-3 text-orange-500" />
  }
  
  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-blue-600'
    return 'text-orange-600'
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Post-Click Conversion Factors
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {prediction.mode === 'multiplicative' ? 'Multiplicative' : 'Logit'} Model
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Prediction Summary */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Predicted Conversion</div>
            <div className="text-lg font-bold text-blue-600">
              {(prediction.predicted_rate * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">
              {prediction.audience} audience
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Factor Optimization</div>
            <div className="text-lg font-bold text-green-600">
              {liftPercentage.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500">
              of potential achieved
            </div>
          </div>
        </div>

        {/* Optimization Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600">Base Rate ({prediction.audience})</span>
            <span className="font-medium">
              {(prediction.cold_base_rate * prediction.warmth_multiplier_applied * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600">Factor Multiplier</span>
            <span className="font-medium text-green-600">
              ×{prediction.combined_factor_multiplier.toFixed(2)}
            </span>
          </div>
          {prediction.upper_cap && prediction.predicted_rate >= prediction.upper_cap && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600">Applied Cap</span>
              <span className="font-medium text-orange-600">
                {(prediction.upper_cap * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Factor Breakdown */}
        {showFactorBreakdown && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-700 border-b pb-1">
              Conversion Factors Analysis
            </div>
            
            <div className="space-y-2">
              {prediction.factors_analyzed.map((factor, index) => {
                const multiplier = 1 + (factor.score * factor.max_lift)
                const impact = factor.score * factor.max_lift * 100
                
                return (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 flex-1">
                      {getFactorIcon(factor.score)}
                      <span className="text-gray-700">
                        {getFactorDisplayName(factor.factor)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            factor.score >= 0.8 ? 'bg-green-500' : 
                            factor.score >= 0.6 ? 'bg-blue-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${factor.score * 100}%` }}
                        />
                      </div>
                      <span className={`font-medium w-8 text-right ${getScoreColor(factor.score)}`}>
                        {(factor.score * 100).toFixed(0)}%
                      </span>
                      <span className="text-gray-500 w-12 text-right">
                        +{impact.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick Summary */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-xs text-green-600 font-medium">
              {excellentFactors.length}
            </div>
            <div className="text-xs text-gray-500">Excellent</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-blue-600 font-medium">
              {goodFactors.length}
            </div>
            <div className="text-xs text-gray-500">Good</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-orange-600 font-medium">
              {poorFactors.length}
            </div>
            <div className="text-xs text-gray-500">Needs Work</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface PostClickFactorCardProps {
  factor: {
    factor: string
    score: number
    max_lift: number
    note?: string
  }
  className?: string
}

export function PostClickFactorCard({ factor, className = "" }: PostClickFactorCardProps) {
  const multiplier = 1 + (factor.score * factor.max_lift)
  const impact = factor.score * factor.max_lift * 100
  const potential = (1 - factor.score) * factor.max_lift * 100
  
  const getScoreLevel = (score: number): { level: string; color: string } => {
    if (score >= 0.8) return { level: 'Excellent', color: 'text-green-600' }
    if (score >= 0.6) return { level: 'Good', color: 'text-blue-600' }
    if (score >= 0.4) return { level: 'Fair', color: 'text-orange-600' }
    return { level: 'Poor', color: 'text-red-600' }
  }
  
  const scoreLevel = getScoreLevel(factor.score)
  
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">
              {factor.factor.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h4>
            <Badge variant="outline" className={`text-xs ${scoreLevel.color}`}>
              {scoreLevel.level}
            </Badge>
          </div>
          
          {factor.note && (
            <p className="text-xs text-gray-600">
              {factor.note}
            </p>
          )}
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Current Implementation</span>
              <span className="font-medium">{(factor.score * 100).toFixed(0)}%</span>
            </div>
            <Progress value={factor.score * 100} className="h-2" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2 border-t text-xs">
            <div>
              <div className="text-gray-600">Current Impact</div>
              <div className="font-medium text-green-600">+{impact.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-gray-600">Remaining Potential</div>
              <div className="font-medium text-orange-600">+{potential.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
