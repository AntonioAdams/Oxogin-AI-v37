'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Target, Globe, Eye, TrendingUp, FileDown } from 'lucide-react'
import { CreditDisplay } from '@/components/credits/CreditDisplay'
import { PDFExportButton } from '@/components/ui/pdf-export-button'
import { useAuth } from '@/lib/auth/context'
import { UserProfile } from '@/components/auth/UserProfile'
import type { CreditBalance } from '@/lib/credits/types'
import Link from 'next/link'
import { FunnelAnalysis } from '@/components/funnel/FunnelAnalysis'
import { analysisStorage } from '@/lib/analysis/storage'
import type { CaptureResult } from '@/app/page/types'

function FunnelPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialUrl = searchParams.get('url') || ''
  const { user } = useAuth()
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null)
  const [existingCaptureData, setExistingCaptureData] = useState<CaptureResult | undefined>(undefined)

  const handleBack = () => {
    router.push('/')
  }

  // Try to get existing analysis data for this URL
  useEffect(() => {
    if (initialUrl) {
      const analyses = analysisStorage.getAnalyses()
      const existingAnalysis = analyses.find(analysis => analysis.url === initialUrl)
      
      if (existingAnalysis) {
        // Use desktop capture data as primary, fall back to mobile
        const captureResult = existingAnalysis.desktopCaptureResult || existingAnalysis.mobileCaptureResult
        const primaryCTAPrediction = existingAnalysis.desktopPrimaryCTAPrediction || existingAnalysis.mobilePrimaryCTAPrediction
        const clickPredictions = existingAnalysis.desktopClickPredictions || existingAnalysis.mobileClickPredictions
        
        if (captureResult) {
          const enhancedCaptureData: CaptureResult = {
            ...captureResult,
            primaryCTAPrediction,
            clickPredictions
          }
          
          console.log("🔧 Found existing analysis data for funnel:", {
            url: initialUrl,
            hasDesktop: !!existingAnalysis.desktopCaptureResult,
            hasMobile: !!existingAnalysis.mobileCaptureResult,
            hasPrimaryCTA: !!primaryCTAPrediction,
            primaryCTAText: primaryCTAPrediction?.text,
            primaryCTACTR: primaryCTAPrediction?.ctr
          })
          
          setExistingCaptureData(enhancedCaptureData)
        }
      }
    }
  }, [initialUrl])
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header - Only visible on mobile */}
      <div className="lg:hidden bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">Oxogin AI</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditDisplay 
              onCreditsUpdate={setCreditBalance} 
              refreshTrigger={0}
              balance={creditBalance}
            />
            {user ? (
              <div className="text-xs text-gray-600 truncate max-w-20">
                {user.user_metadata?.full_name || user.email}
              </div>
            ) : (
              <div className="text-xs text-gray-600">Guest</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:flex w-80 bg-white border-r border-gray-200 p-8 flex-col shadow-sm">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-semibold text-gray-900">Oxogin AI</span>
          </div>

          {/* Navigation */}
          <div className="space-y-2 mb-8">
            <Link href="/" className="w-full">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg h-12"
              >
                <Target className="w-5 h-5" />
                Analyze Website
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg h-12"
              onClick={handleBack}
            >
              <Globe className="w-5 h-5" />
              New Analysis
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-400 cursor-not-allowed rounded-lg h-12"
              disabled
            >
              <Eye className="w-5 h-5" />
              Competitor Intel
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-blue-700 bg-blue-50 rounded-lg h-12"
              disabled
            >
              <TrendingUp className="w-5 h-5" />
              Funnel
            </Button>
            <div className="pt-2">
              <PDFExportButton 
                analysisElementId="funnel-analysis-content"
                filename={`oxogin-funnel-analysis-${new Date().toISOString().split('T')[0]}.pdf`}
                variant="sidebar"
                className=""
              />
            </div>
          </div>

          {/* Credits Section */}
          <div className="mb-8">
            <CreditDisplay 
              onCreditsUpdate={setCreditBalance}
              refreshTrigger={0}
              balance={creditBalance}
            />
          </div>

          {/* User Profile */}
          <div className="mt-auto">
            <UserProfile />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <FunnelAnalysis 
            initialUrl={initialUrl}
            initialCaptureData={existingCaptureData} // Pass existing capture data from storage
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  )
}

export default function FunnelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading Funnel Analysis...</p>
        </div>
      </div>
    }>
      <FunnelPageContent />
    </Suspense>
  )
}
