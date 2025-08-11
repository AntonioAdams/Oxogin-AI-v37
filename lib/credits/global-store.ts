/**
 * Global Credit State Manager
 * 
 * Manages credit state outside the React component tree to prevent
 * credit updates from triggering component re-renders that cause
 * the funnel analysis state reset issue.
 */

import { CreditBalance } from './types'

type CreditListener = (balance: CreditBalance) => void

class GlobalCreditStore {
  private balance: CreditBalance = {
    userId: "anonymous",
    totalCredits: 10,
    usedCredits: 0,
    remainingCredits: 10,
    lastUpdated: new Date(),
    resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }

  private listeners = new Set<CreditListener>()
  private isInitialized = false

  /**
   * Subscribe to credit balance changes
   */
  subscribe(listener: CreditListener): () => void {
    this.listeners.add(listener)
    
    // Immediately notify with current balance
    listener(this.balance)
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Get current credit balance (synchronous)
   */
  getBalance(): CreditBalance {
    return { ...this.balance }
  }

  /**
   * Update credit balance and notify all subscribers
   */
  updateBalance(newBalance: CreditBalance): void {
    this.balance = { ...newBalance }
    
    // Notify all subscribers
    this.listeners.forEach(listener => {
      try {
        listener(this.balance)
      } catch (error) {
        console.error('Error in credit balance listener:', error)
      }
    })
    
    console.log('💳 Global credit store updated:', this.balance.remainingCredits, 'remaining')
  }

  /**
   * Initialize balance from server (call once on app start)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    try {
      const { creditManager } = await import('./manager')
      const userId = await creditManager.getCurrentUserId()
      const response = await fetch(`/api/credits?userId=${encodeURIComponent(userId)}`)
      const data = await response.json()
      
      if (data.success && data.balance) {
        this.updateBalance(data.balance)
        console.log('💳 Global credit store initialized from server')
      } else {
        throw new Error(data.error || 'Failed to fetch balance')
      }
    } catch (error) {
      console.error('Failed to initialize global credit store:', error)
      // Keep default balance
    } finally {
      this.isInitialized = true
    }
  }

  /**
   * Refresh balance from server
   */
  async refresh(): Promise<void> {
    try {
      const { creditManager } = await import('./manager')
      const userId = await creditManager.getCurrentUserId()
      const response = await fetch(`/api/credits?userId=${encodeURIComponent(userId)}`)
      const data = await response.json()
      
      if (data.success && data.balance) {
        this.updateBalance(data.balance)
        console.log('💳 Global credit store refreshed from server')
      } else {
        throw new Error(data.error || 'Failed to fetch balance')
      }
    } catch (error) {
      console.error('Failed to refresh global credit store:', error)
    }
  }

  /**
   * Reset credits (for testing)
   */
  async reset(): Promise<void> {
    try {
      const { creditManager } = await import('./manager')
      const userId = await creditManager.getCurrentUserId()
      const response = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', userId })
      })
      const data = await response.json()
      
      if (data.success && data.balance) {
        this.updateBalance(data.balance)
        console.log('💳 Global credit store reset')
      } else {
        throw new Error(data.error || 'Failed to reset credits')
      }
    } catch (error) {
      console.error('Failed to reset global credit store:', error)
    }
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    try {
      const { creditManager } = await import('./manager')
      await creditManager.clearAllData()
      
      // Reset to default balance
      const defaultBalance: CreditBalance = {
        userId: "anonymous",
        totalCredits: 10,
        usedCredits: 0,
        remainingCredits: 10,
        lastUpdated: new Date(),
        resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
      
      this.updateBalance(defaultBalance)
      console.log('💳 Global credit store cleared')
    } catch (error) {
      console.error('Failed to clear global credit store:', error)
    }
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized
  }
}

// Export singleton instance
export const globalCreditStore = new GlobalCreditStore()

// Auto-initialize when imported (only in browser)
if (typeof window !== 'undefined') {
  globalCreditStore.initialize()
}
