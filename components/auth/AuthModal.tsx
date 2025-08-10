"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase/client"
import { Chrome, User, Briefcase } from "lucide-react"
import { useHeapAnalytics } from "@/hooks/useHeapAnalytics"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const { trackEvent } = useHeapAnalytics()

  const handleSocialLogin = async (provider: "google" | "azure" | "linkedin_oidc") => {
    try {
      setLoading(provider)
      
      // Track login attempt
      trackEvent('Auth Login Attempted', {
        provider: provider,
        timestamp: new Date().toISOString()
      })
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error("Error signing in:", error.message)
        trackEvent('Auth Login Failed', {
          provider: provider,
          error: error.message
        })
      } else {
        trackEvent('Auth Login Initiated', {
          provider: provider
        })
      }
    } catch (error) {
      console.error("Error:", error)
      trackEvent('Auth Login Error', {
        provider: provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">Welcome to Oxogin AI</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-center text-gray-600 text-sm">
            {"Sign in, save your analysis history, and get personalized insights — all coming soon.\n\n"}
          </p>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-12 text-left justify-start gap-3 bg-transparent"
              onClick={() => handleSocialLogin("google")}
              disabled={loading === "google"}
            >
              <Chrome className="w-5 h-5 text-red-500" />
              {loading === "google" ? "Connecting..." : "Continue with Google"}
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-left justify-start gap-3 bg-transparent"
              onClick={() => handleSocialLogin("azure")}
              disabled={loading === "azure"}
            >
              <User className="w-5 h-5 text-blue-500" />
              {loading === "azure" ? "Connecting..." : "Continue with Microsoft"}
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-left justify-start gap-3 bg-transparent"
              onClick={() => handleSocialLogin("linkedin_oidc")}
              disabled={loading === "linkedin_oidc"}
            >
              <Briefcase className="w-5 h-5 text-blue-700" />
              {loading === "linkedin_oidc" ? "Connecting..." : "Continue with LinkedIn"}
            </Button>
          </div>

          <Separator />

          <p className="text-center text-xs text-gray-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
