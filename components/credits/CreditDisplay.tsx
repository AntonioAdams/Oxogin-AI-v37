"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, RefreshCw, History, ChevronDown, ChevronUp, RotateCcw, Trash2 } from "lucide-react"
import type { CreditBalance } from "@/lib/credits/types"
import { creditManager } from "@/lib/credits/manager"

interface CreditDisplayProps {
  onCreditsUpdate?: (balance: CreditBalance) => void
  refreshTrigger?: number // Keep this to maintain compatibility
  balance?: CreditBalance | null // Pass balance from parent
}

export function CreditDisplay({ onCreditsUpdate, refreshTrigger, balance: parentBalance }: CreditDisplayProps) {
  // Use parent balance or default to 10 credits
  const [balance, setBalance] = useState<CreditBalance>({
    userId: "anonymous",
    totalCredits: 10,
    usedCredits: 0,
    remainingCredits: 10,
    lastUpdated: new Date(),
    resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [lastTrigger, setLastTrigger] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  // Ensure we're on the client side and load initial balance
  useEffect(() => {
    setIsClient(true)
    loadInitialBalance()
  }, [])

  // Load initial balance from server API
  const loadInitialBalance = async () => {
    try {
      const userId = await creditManager.getCurrentUserId()
      const response = await fetch(`/api/credits?userId=${encodeURIComponent(userId)}`)
      const data = await response.json()
      
      if (data.success && data.balance) {
        setBalance(data.balance)
        onCreditsUpdate?.(data.balance)
        console.log("💳 Loaded initial balance from server:", data.balance.remainingCredits, "remaining")
      } else {
        throw new Error(data.error || 'Failed to fetch balance')
      }
    } catch (error) {
      console.error("Failed to load initial credit balance:", error)
      // Fallback to default balance
      const fallbackBalance = {
        userId: "anonymous",
        totalCredits: 10,
        usedCredits: 0,
        remainingCredits: 10,
        lastUpdated: new Date(),
        resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
      setBalance(fallbackBalance)
      onCreditsUpdate?.(fallbackBalance)
    }
  }

  // Update balance when parent balance changes
  useEffect(() => {
    if (parentBalance) {
      setBalance(parentBalance)
    }
  }, [parentBalance])

  // Handle trigger changes - refresh from storage
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > lastTrigger && isClient) {
      console.log("💳 Refresh triggered:", refreshTrigger)
      setLastTrigger(refreshTrigger)
      refreshBalance()
    }
  }, [refreshTrigger, lastTrigger, isClient])

  // Refresh balance from server API
  const refreshBalance = async () => {
    try {
      setIsLoading(true)
      const userId = await creditManager.getCurrentUserId()
      const response = await fetch(`/api/credits?userId=${encodeURIComponent(userId)}`)
      const data = await response.json()
      
      if (data.success && data.balance) {
        setBalance(data.balance)
        onCreditsUpdate?.(data.balance)
        console.log("💳 Refreshed balance from server:", data.balance.remainingCredits, "remaining")
      } else {
        throw new Error(data.error || 'Failed to fetch balance')
      }
    } catch (error) {
      console.error("Failed to refresh credit balance:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetCredits = async () => {
    if (!isClient) return

    try {
      setIsResetting(true)
      
      // Use server API to reset credits
      const userId = await creditManager.getCurrentUserId()
      const response = await fetch('/api/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reset',
          userId: userId
        })
      })
      
      const data = await response.json()
      if (data.success && data.balance) {
        setBalance(data.balance)
        onCreditsUpdate?.(data.balance)
        console.log("🔄 Credits reset to:", data.balance.remainingCredits)
      } else {
        throw new Error(data.error || 'Failed to reset credits')
      }
    } catch (error) {
      console.error("Error resetting credits:", error)
    } finally {
      setIsResetting(false)
    }
  }

  const clearUserData = async () => {
    if (!isClient) return

    try {
      setIsClearing(true)
      
      // Use server API to clear user data
      const userId = await creditManager.getCurrentUserId()
      const response = await fetch('/api/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear',
          userId: userId
        })
      })
      
      const data = await response.json()
      if (data.success && data.balance) {
        setBalance(data.balance)
        onCreditsUpdate?.(data.balance)
        console.log("🗑️ User data cleared, credits reset to:", data.balance.remainingCredits)
      } else {
        throw new Error(data.error || 'Failed to clear user data')
      }
    } catch (error) {
      console.error("Error clearing user data:", error)
    } finally {
      setIsClearing(false)
    }
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  const getStatusColor = (remaining: number) => {
    if (remaining > 5) return "bg-green-500"
    if (remaining > 2) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getStatusIndicatorColor = (remaining: number) => {
    if (remaining > 5) return "bg-green-400"
    if (remaining > 2) return "bg-yellow-400"
    return "bg-red-400"
  }

  // Show default balance immediately (no loading state)
  if (!isClient) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Credits</span>
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <Badge variant="secondary" className="bg-green-500 text-white text-xs px-2 py-0">
                10
              </Badge>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-700" />
          </div>
        </div>
      </div>
    )
  }

  const displayCredits = balance.remainingCredits
  const displayUsedCredits = balance.usedCredits
  const displayTotalCredits = balance.totalCredits

  // Collapsed view
  if (!isExpanded) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 transition-colors" onClick={toggleExpanded}>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Credits</span>
              <div className={`w-2 h-2 rounded-full ${getStatusIndicatorColor(displayCredits)}`} />
              <Badge variant="secondary" className={`${getStatusColor(displayCredits)} text-white text-xs px-2 py-0`}>
                {displayCredits}
              </Badge>
            </div>
            <div className="flex items-center space-x-1">
                          <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                refreshBalance()
              }}
              disabled={isLoading}
              className="h-6 w-6 p-0 text-gray-700 hover:text-gray-900"
              title="Refresh balance from server"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  // History functionality could be added later
                }}
                disabled={true}
                className="h-6 w-6 p-0 opacity-50 text-gray-700"
                title="Transaction history (coming soon)"
              >
                <History className="h-3 w-3" />
              </Button>
              <ChevronDown className="h-4 w-4 text-gray-700" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Expanded view
  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="pb-2 px-3 pt-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-4 w-4 text-gray-700" />
            <span className="text-gray-700">Credits</span>
            <div className={`w-2 h-2 rounded-full ${getStatusIndicatorColor(displayCredits)}`} />
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                refreshBalance()
              }}
              disabled={isLoading}
              className="h-6 w-6 p-0 text-gray-700 hover:text-gray-900"
              title="Refresh balance from server"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetCredits}
              disabled={isResetting}
              className="h-6 w-6 p-0 text-gray-700 hover:text-gray-900"
              title="Reset credits to default (10)"
            >
              <RotateCcw className={`h-3 w-3 ${isResetting ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearUserData}
              disabled={isClearing}
              className="h-6 w-6 p-0 text-gray-700 hover:text-gray-900"
              title="Clear user data and reset credits"
            >
              <Trash2 className={`h-3 w-3 ${isClearing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // History functionality could be added later
              }}
              disabled={true}
              className="h-6 w-6 p-0 opacity-50 text-gray-700"
              title="Transaction history (coming soon)"
            >
              <History className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleExpanded} className="h-6 w-6 p-0 text-gray-700 hover:text-gray-900">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Remaining</span>
            <Badge variant="secondary" className={`${getStatusColor(displayCredits)} text-white text-xs px-2 py-0`}>
              {displayCredits}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Used: {displayUsedCredits}</span>
            <span>Total: {displayTotalCredits}</span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${getStatusColor(displayCredits)}`}
              style={{
                width: `${Math.max(0, (displayCredits / displayTotalCredits) * 100)}%`,
              }}
            />
          </div>

          {balance.resetDate && (
            <div className="text-xs text-gray-500">
              Resets: {new Date(balance.resetDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
