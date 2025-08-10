import type { CreditBalance, CreditTransaction, CreditConfig, CreditCheckResult } from "./types"
import { supabaseCreditStorage } from "./supabase-storage"
import { fallbackCreditStorage } from "./fallback-storage"
import { logger } from "../utils/logger"

// Cookie utilities for persistent user identification
function setCookie(name: string, value: string, days = 30): void {
  if (typeof document === "undefined") return

  try {
    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
  } catch (error) {
    console.warn("Failed to set cookie:", error)
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null

  try {
    const nameEQ = name + "="
    const ca = document.cookie.split(";")
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === " ") c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
    }
    return null
  } catch (error) {
    console.warn("Failed to get cookie:", error)
    return null
  }
}

const creditLogger = logger.module("credits")

export class CreditManager {
  private config: CreditConfig = {
    defaultCredits: 10, // Default 10 credits per user
    captureCreditsRequired: 2, // 2 credits per analysis (1 desktop + 1 mobile)
    resetPeriod: "daily",
  }

  private userIdCache: string | null = null

  constructor(config?: Partial<CreditConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  private async generateUserId(): Promise<string> {
    // Return cached user ID if available
    if (this.userIdCache) {
      return this.userIdCache
    }

    // Try to get authenticated user from Supabase first
    try {
      const authenticatedUserId = await supabaseCreditStorage.getCurrentUserId()
      if (authenticatedUserId) {
        this.userIdCache = authenticatedUserId
        creditLogger.info("Retrieved authenticated user ID from Supabase", {
          userId: authenticatedUserId,
        })
        return authenticatedUserId
      }
    } catch (error) {
      creditLogger.warn("Failed to get authenticated user ID from Supabase", error)
    }

    // For anonymous users, use fallback storage (localStorage)
    try {
      const anonymousUserId = await fallbackCreditStorage.getCurrentUserId()
      if (anonymousUserId) {
        this.userIdCache = anonymousUserId
        creditLogger.info("Retrieved anonymous user ID from fallback storage", {
          userId: anonymousUserId,
        })
        return anonymousUserId
      }
    } catch (error) {
      creditLogger.warn("Failed to get anonymous user ID from fallback storage", error)
    }

    // Generate new anonymous user ID
    const newUserId = fallbackCreditStorage.generateUUID()
    this.userIdCache = newUserId
    
    // Store the new user ID in fallback storage
    try {
      await fallbackCreditStorage.setCurrentUserId(newUserId)
    } catch (error) {
      creditLogger.warn("Failed to store new user ID in fallback storage", error)
    }
    
    creditLogger.info("Generated new anonymous user ID", {
      userId: newUserId,
    })
    return newUserId
  }

  async getOrCreateBalance(userId?: string): Promise<CreditBalance> {
    const actualUserId = userId || await this.generateUserId()
    
    // Ensure we have a valid string user ID
    const validUserId = typeof actualUserId === 'string' ? actualUserId : fallbackCreditStorage.generateUUID()
    
    // Check if user is authenticated by trying Supabase first
    let isAuthenticated = false
    try {
      const authenticatedUserId = await supabaseCreditStorage.getCurrentUserId()
      isAuthenticated = authenticatedUserId === validUserId
    } catch (error) {
      // User is not authenticated, will use fallback storage
    }
    
    let balance: CreditBalance | null = null
    
    if (isAuthenticated) {
      // Try Supabase first (for authenticated users)
      balance = await supabaseCreditStorage.getBalance(validUserId)
      creditLogger.info("Checking Supabase for authenticated user", { userId: validUserId, found: !!balance })
    }
    
    // If not authenticated or Supabase fails, use fallback storage
    if (!balance) {
      balance = await fallbackCreditStorage.getBalance(validUserId)
      creditLogger.info("Checking fallback storage", { userId: validUserId, found: !!balance, isAuthenticated })
    }

    if (!balance) {
      balance = {
        userId: validUserId,
        totalCredits: this.config.defaultCredits,
        usedCredits: 0,
        remainingCredits: this.config.defaultCredits,
        lastUpdated: new Date(),
        resetDate: this.calculateNextResetDate(),
      }
      
      // Save to appropriate storage based on authentication status
      if (isAuthenticated) {
        try {
          await supabaseCreditStorage.setBalance(balance)
          creditLogger.info("Created new credit balance in Supabase", {
            userId: validUserId,
            initialCredits: this.config.defaultCredits,
          })
        } catch (error) {
          // Fallback to localStorage if Supabase fails
          await fallbackCreditStorage.setBalance(balance)
          creditLogger.info("Created new credit balance in fallback storage (Supabase failed)", {
            userId: validUserId,
            initialCredits: this.config.defaultCredits,
          })
        }
      } else {
        // Save to fallback storage for anonymous users
        await fallbackCreditStorage.setBalance(balance)
        creditLogger.info("Created new credit balance in fallback storage", {
          userId: validUserId,
          initialCredits: this.config.defaultCredits,
        })
      }
    } else {
      creditLogger.info("Retrieved existing credit balance", {
        userId: validUserId,
        remainingCredits: balance.remainingCredits,
        totalCredits: balance.totalCredits,
        storageType: isAuthenticated ? "supabase" : "fallback",
      })

      // Check if we need to migrate existing users to new credit limit
      if (balance.totalCredits === 100 && this.config.defaultCredits === 10) {
        // Migrate existing 100-credit users to 10-credit system
        const usageRatio = balance.usedCredits / balance.totalCredits
        balance.totalCredits = this.config.defaultCredits
        balance.usedCredits = Math.floor(usageRatio * this.config.defaultCredits)
        balance.remainingCredits = balance.totalCredits - balance.usedCredits
        balance.lastUpdated = new Date()

        // Save to appropriate storage
        if (isAuthenticated) {
          try {
            await supabaseCreditStorage.setBalance(balance)
          } catch (error) {
            await fallbackCreditStorage.setBalance(balance)
          }
        } else {
          await fallbackCreditStorage.setBalance(balance)
        }

        creditLogger.info("Migrated user to new credit system", {
          userId: validUserId,
          newTotalCredits: balance.totalCredits,
          newRemainingCredits: balance.remainingCredits,
        })
      }
    }

    // Check if credits should be reset based on reset date
    if (balance.resetDate && new Date() >= balance.resetDate) {
      balance = await this.resetCredits(validUserId)
    }

    return balance
  }

  async checkCredits(userId?: string, requiredCredits?: number): Promise<CreditCheckResult> {
    const required = requiredCredits || this.config.captureCreditsRequired
    const balance = await this.getOrCreateBalance(userId)

    const hasCredits = balance.remainingCredits >= required

    creditLogger.info("Credit check performed", {
      userId: balance.userId,
      remainingCredits: balance.remainingCredits,
      requiredCredits: required,
      hasCredits,
      storageType: "supabase",
    })

    return {
      hasCredits,
      remainingCredits: balance.remainingCredits,
      requiredCredits: required,
      message: hasCredits
        ? `${balance.remainingCredits} credits remaining`
        : `Insufficient credits. Need ${required}, have ${balance.remainingCredits}`,
    }
  }

  async deductCredits(userId?: string, amount?: number, metadata?: any): Promise<CreditBalance> {
    const actualUserId = userId || await this.generateUserId()
    const deductAmount = amount || this.config.captureCreditsRequired
    const balance = await this.getOrCreateBalance(actualUserId)

    if (balance.remainingCredits < deductAmount) {
      const error = `Insufficient credits. Need ${deductAmount}, have ${balance.remainingCredits}`
      creditLogger.error("Credit deduction failed", new Error(error), {
        userId: actualUserId,
        requestedAmount: deductAmount,
        availableCredits: balance.remainingCredits,
        storageType: "dual",
      })
      throw new Error(error)
    }

    // Perform deduction
    balance.usedCredits += deductAmount
    balance.remainingCredits -= deductAmount
    balance.lastUpdated = new Date()

    // Record transaction
    const transaction: CreditTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: actualUserId,
      type: "debit",
      amount: deductAmount,
      reason: "Website capture",
      timestamp: new Date(),
      metadata,
    }

    // Check if user is authenticated
    let isAuthenticated = false
    try {
      const authenticatedUserId = await supabaseCreditStorage.getCurrentUserId()
      isAuthenticated = authenticatedUserId === actualUserId
    } catch (error) {
      // User is not authenticated
    }

    // Save to appropriate storage based on authentication status
    if (isAuthenticated) {
      try {
        await supabaseCreditStorage.setBalance(balance)
        await supabaseCreditStorage.addTransaction(transaction)
        creditLogger.info("Credits deducted successfully in Supabase", {
          userId: actualUserId,
          amount: deductAmount,
          remainingCredits: balance.remainingCredits,
          transactionId: transaction.id,
          metadata,
        })
      } catch (error) {
        // Fallback to localStorage if Supabase fails
        await fallbackCreditStorage.setBalance(balance)
        await fallbackCreditStorage.addTransaction(transaction)
        creditLogger.info("Credits deducted successfully in fallback storage (Supabase failed)", {
          userId: actualUserId,
          amount: deductAmount,
          remainingCredits: balance.remainingCredits,
          transactionId: transaction.id,
          metadata,
        })
      }
    } else {
      // Save to fallback storage for anonymous users
      await fallbackCreditStorage.setBalance(balance)
      await fallbackCreditStorage.addTransaction(transaction)
      creditLogger.info("Credits deducted successfully in fallback storage", {
        userId: actualUserId,
        amount: deductAmount,
        remainingCredits: balance.remainingCredits,
        transactionId: transaction.id,
        metadata,
      })
    }

    return balance
  }

  async addCredits(userId: string, amount: number, reason: string): Promise<CreditBalance> {
    const balance = await this.getOrCreateBalance(userId)

    balance.totalCredits += amount
    balance.remainingCredits += amount
    balance.lastUpdated = new Date()

    await supabaseCreditStorage.setBalance(balance)

    // Record transaction
    const transaction: CreditTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type: "credit",
      amount,
      reason,
      timestamp: new Date(),
    }

    await supabaseCreditStorage.addTransaction(transaction)

    creditLogger.info("Credits added", {
      userId,
      amount,
      reason,
      newBalance: balance.remainingCredits,
      storageType: "supabase",
    })

    return balance
  }

  async resetCredits(userId: string): Promise<CreditBalance> {
    const balance = await this.getOrCreateBalance(userId)

    balance.totalCredits = this.config.defaultCredits
    balance.usedCredits = 0
    balance.remainingCredits = this.config.defaultCredits
    balance.lastUpdated = new Date()
    balance.resetDate = this.calculateNextResetDate()

    await supabaseCreditStorage.setBalance(balance)

    // Record transaction
    const transaction: CreditTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type: "reset",
      amount: this.config.defaultCredits,
      reason: "Periodic credit reset",
      timestamp: new Date(),
    }

    await supabaseCreditStorage.addTransaction(transaction)

    creditLogger.info("Credits reset", {
      userId,
      newCredits: this.config.defaultCredits,
    })

    return balance
  }

  // Manual credit reset for testing - this should only be used for testing
  async forceResetCredits(userId?: string): Promise<CreditBalance> {
    const actualUserId = userId || await this.generateUserId()

    const balance: CreditBalance = {
      userId: actualUserId,
      totalCredits: this.config.defaultCredits,
      usedCredits: 0,
      remainingCredits: this.config.defaultCredits,
      lastUpdated: new Date(),
      resetDate: this.calculateNextResetDate(),
    }

    // Save to fallback storage for anonymous users
    await fallbackCreditStorage.setBalance(balance)
    
    // Record transaction
    const transaction: CreditTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: actualUserId,
      type: "reset",
      amount: this.config.defaultCredits,
      reason: "Manual credit reset (testing)",
      timestamp: new Date(),
    }

    await fallbackCreditStorage.addTransaction(transaction)

    creditLogger.info("Credits force reset", {
      userId: actualUserId,
      newCredits: this.config.defaultCredits,
    })

    return balance
  }

  // Force reset all user data (useful for testing or clearing old data)
  async forceResetUserData(): Promise<void> {
    const userId = await this.generateUserId()
    
    // Clear from fallback storage for anonymous users
    try {
      await fallbackCreditStorage.clearUserData(userId)
    } catch (error) {
      creditLogger.warn("Failed to clear user data from fallback storage", error)
    }
    
    this.clearUserIdCache()

    creditLogger.info("Force reset user data", {
      userId,
    })
  }

  // Clear cached user ID (useful for testing or user logout)
  clearUserIdAndCookie(): void {
    this.userIdCache = null
    creditLogger.info("Cleared user ID cache")
  }

  private calculateNextResetDate(): Date {
    const now = new Date()
    const nextReset = new Date(now)

    switch (this.config.resetPeriod) {
      case "daily":
        nextReset.setDate(now.getDate() + 1)
        nextReset.setHours(0, 0, 0, 0)
        break
      case "weekly":
        nextReset.setDate(now.getDate() + (7 - now.getDay()))
        nextReset.setHours(0, 0, 0, 0)
        break
      case "monthly":
        nextReset.setMonth(now.getMonth() + 1, 1)
        nextReset.setHours(0, 0, 0, 0)
        break
    }

    return nextReset
  }

  async getTransactionHistory(userId?: string): Promise<CreditTransaction[]> {
    const actualUserId = userId || await this.generateUserId()
    return await supabaseCreditStorage.getTransactions(actualUserId)
  }

  // Get current user ID for client-side usage
  async getCurrentUserId(): Promise<string> {
    return await this.generateUserId()
  }

  // Clear cached user ID (useful for testing or user logout)
  clearUserIdCache(): void {
    this.userIdCache = null
  }
}

export const creditManager = new CreditManager()
