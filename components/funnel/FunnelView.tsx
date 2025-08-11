'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, TrendingUp, Users, MousePointerClick, CheckCircle2 } from 'lucide-react'
import type { FunnelViewProps } from '@/lib/funnel/types'

export function FunnelView({ 
  data, 
  title, 
  onExplore, 
  onRunFunnelAnalysis,
  showFunnelButton = false
}: FunnelViewProps) {
  
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num))
  }
  
  const formatPercentage = (num: number) => {
    // num is already in decimal format (0.05 = 5%), convert to percentage display
    return (num * 100).toFixed(1) + '%'
  }
  

  
  if (data.error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-4">
          <div className="text-center text-red-600">
            <p className="font-semibold">Analysis Error</p>
            <p className="text-sm">{data.error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (!data.step1) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="text-center text-gray-500">
            <p className="font-semibold">No Data</p>
            <p className="text-sm">Enter a URL to analyze funnel</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  const isFormFunnel = data.type === 'form'
  const isNonFormFunnel = data.type === 'non-form'
  const hasStep2 = data.step2 !== null
  const canRunAnalysis = isNonFormFunnel && !hasStep2 && !data.isStep2Loading
  
  return (
    <Card className="border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <div className="flex items-center gap-2">
            {canRunAnalysis && showFunnelButton && onRunFunnelAnalysis && (
              <Button
                size="sm"
                onClick={onRunFunnelAnalysis}
                disabled={data.isStep2Loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {data.isStep2Loading ? (
                  <>
                    <TrendingUp className="w-4 h-4 mr-1 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Funnel Analysis
                  </>
                )}
              </Button>
            )}
            {isFormFunnel && showFunnelButton && (
              <Button
                size="sm"
                disabled
                variant="outline"
                className="text-gray-400 cursor-not-allowed"
                title="Form detected — funnel complete"
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Form Detected
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onExplore}>
              Explore →
            </Button>
          </div>
        </div>
        
        {/* Funnel Type Indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            isFormFunnel 
              ? 'bg-green-100 text-green-800' 
              : hasStep2 
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isFormFunnel ? 'Form Detected' : hasStep2 ? 'Two-Step Funnel' : 'Non-Form CTA'}
          </div>
        </div>
        
        {/* 2-STEP FUNNEL (Form CTA) */}
        {isFormFunnel && (
          <div className="space-y-3">
            {/* Step 1: Sessions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-20">
                <Users className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Session</span>
              </div>
              <div className="flex-1 bg-green-100 rounded-full h-10 flex items-center px-4">
                <div className="flex-1 text-sm font-semibold text-green-800">
                  {formatNumber(data.n1)} users
                </div>
              </div>
            </div>
            
            {/* Step 2: Form Conversion */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-20">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Form</span>
              </div>
              <div className="flex-1 bg-blue-100 rounded-full h-10 flex items-center px-4">
                <div className="flex-1">
                  <span className="text-sm font-semibold text-blue-800">
                    {data.step1.ctaText}
                  </span>
                  <span className="text-xs text-blue-600 ml-2">
                    {formatPercentage(data.p1)} • {formatNumber(data.nConv)} conversions
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 3-STEP FUNNEL (Non-Form CTA) */}
        {isNonFormFunnel && (
          <div className="space-y-3">
            {/* Step 1: Sessions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-20">
                <Users className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Session</span>
              </div>
              <div className="flex-1 bg-green-100 rounded-full h-10 flex items-center px-4">
                <div className="flex-1 text-sm font-semibold text-green-800">
                  {formatNumber(data.n1)} users
                </div>
              </div>
            </div>
            
            {/* Step 2: Page 1 CTA */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-20">
                <MousePointerClick className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Page 1</span>
              </div>
              <div className="flex-1 bg-blue-100 rounded-full h-10 flex items-center px-4">
                <div className="flex-1">
                  <span className="text-sm font-semibold text-blue-800">
                    {data.step1.ctaText}
                  </span>
                  <span className="text-xs text-blue-600 ml-2">
                    {formatPercentage(data.p1)} • {formatNumber(data.n2)} clicks
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            
            {/* Step 3: Page 2 Conversion (if available) */}
            {hasStep2 && data.step2 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-20">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Page 2</span>
                </div>
                <div className="flex-1 bg-purple-100 rounded-full h-10 flex items-center px-4">
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-purple-800">
                      {data.step2.ctaText}
                    </span>
                    <span className="text-xs text-purple-600 ml-2">
                      {formatPercentage(data.p2)} • {formatNumber(data.nConv)} conversions
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Pending Step 3 */}
            {!hasStep2 && !data.isStep2Loading && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-20">
                  <CheckCircle2 className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-400">Page 2</span>
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-10 flex items-center px-4">
                  <div className="flex-1 text-sm text-gray-500">
                    Click "Funnel Analysis" to analyze next step
                  </div>
                </div>
              </div>
            )}
            
            {/* Loading Step 3 */}
            {data.isStep2Loading && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-20">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-sm font-medium text-blue-600">Page 2</span>
                </div>
                <div className="flex-1 bg-blue-50 rounded-full h-10 flex items-center px-4">
                  <div className="flex-1 text-sm text-blue-600">
                    Analyzing next step...
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Summary */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm font-medium text-gray-700">Conversion rate</span>
              <span className="ml-2 text-lg font-bold text-green-600">
                {formatPercentage(data.pTotal)}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Users who converted</span>
              <span className="ml-2 text-lg font-bold text-green-600">
                {formatNumber(data.nConv)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Funnel Type Badge */}
        <div className="flex justify-center pt-3">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            isFormFunnel 
              ? 'bg-green-100 text-green-800' 
              : hasStep2 
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isFormFunnel ? 'FORM FUNNEL' : hasStep2 ? 'THREE-STEP FUNNEL' : 'TWO-STEP PENDING'}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}