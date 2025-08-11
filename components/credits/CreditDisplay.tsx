"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, RefreshCw, History, ChevronDown, ChevronUp, RotateCcw, Trash2 } from "lucide-react"
import type { CreditBalance } from "@/lib/credits/types"
import { globalCreditStore } from "@/lib/credits/global-store"

interface CreditDisplayProps {
  // No props needed - component manages its own state via global store
}

export function CreditDisplay({}: CreditDisplayProps) {
  // Get initial balance from global store
  const [balance, setBalance] = useState<CreditBalance>(globalCreditStore.getBalance())
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  // Subscribe to global store updates
  useEffect(() => {
    setIsClient(true)
    
    // Subscribe to balance changes from global store
    const unsubscribe = globalCreditStore.subscribe((newBalance) => {
      setBalance(newBalance)
    })
    
    // Cleanup subscription
    return unsubscribe
  }, [])

  // Global store handles initial loading automatically

  // No longer needed - global store handles all updates

  // Refresh balance via global store
  const refreshBalance = async () => {
    try {
      setIsLoading(true)
      await globalCreditStore.refresh()
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
      await globalCreditStore.reset()
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
      await globalCreditStore.clear()
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
