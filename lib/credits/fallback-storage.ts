import type { CreditBalance, CreditTransaction } from "./types"
import { logger } from "../utils/logger"

const creditLogger = logger.module("credits-fallback")

export class FallbackCreditStorage {
  private getStorageKey(key: string): string {
    return `cta-tool-credits-${key}`
  }

  private isStorageAvailable(): boolean {
    try {
      if (typeof window === "undefined") return false
      const testKey = "__storage_test__"
      localStorage.setItem(testKey, "test")
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  async getBalance(userId: string): Promise<CreditBalance | null> {
    try {
      if (!this.isStorageAvailable()) {
        creditLogger.warn("Local storage not available for fallback")
        return null
      }

      const balanceData = localStorage.getItem(this.getStorageKey(`balance-${userId}`))
      if (!balanceData) {
        return null
      }

      const balance = JSON.parse(balanceData)
      return {
        userId: balance.userId,
        totalCredits: balance.totalCredits,
        usedCredits: balance.usedCredits,
        remainingCredits: balance.remainingCredits,
        lastUpdated: new Date(balance.lastUpdated),
        resetDate: new Date(balance.resetDate),
      }
    } catch (error) {
      creditLogger.error("Error getting balance from fallback storage", error)
      return null
    }
  }

  async setBalance(balance: CreditBalance): Promise<void> {
    try {
      if (!this.isStorageAvailable()) {
        creditLogger.warn("Local storage not available for fallback")
        return
      }

      const balanceData = {
        userId: balance.userId,
        totalCredits: balance.totalCredits,
        usedCredits: balance.usedCredits,
        remainingCredits: balance.remainingCredits,
        lastUpdated: balance.lastUpdated.toISOString(),
        resetDate: balance.resetDate.toISOString(),
      }

      localStorage.setItem(this.getStorageKey(`balance-${balance.userId}`), JSON.stringify(balanceData))
      creditLogger.info("Balance saved to fallback storage", { userId: balance.userId, remainingCredits: balance.remainingCredits })
    } catch (error) {
      creditLogger.error("Error saving balance to fallback storage", error)
    }
  }

  async getTransactions(userId: string): Promise<CreditTransaction[]> {
    try {
      if (!this.isStorageAvailable()) {
        return []
      }

      const transactionsData = localStorage.getItem(this.getStorageKey(`transactions-${userId}`))
      if (!transactionsData) {
        return []
      }

      const transactions = JSON.parse(transactionsData)
      return transactions.map((tx: any) => ({
        id: tx.id,
        userId: tx.userId,
        type: tx.type,
        amount: tx.amount,
        reason: tx.reason,
        timestamp: new Date(tx.timestamp),
        metadata: tx.metadata,
      }))
    } catch (error) {
      creditLogger.error("Error getting transactions from fallback storage", error)
      return []
    }
  }

  async addTransaction(transaction: CreditTransaction): Promise<void> {
    try {
      if (!this.isStorageAvailable()) {
        creditLogger.warn("Local storage not available for fallback")
        return
      }

      const existingTransactions = await this.getTransactions(transaction.userId)
      existingTransactions.push(transaction)

      // Keep only last 50 transactions to avoid storage bloat
      const recentTransactions = existingTransactions.slice(-50)

      localStorage.setItem(
        this.getStorageKey(`transactions-${transaction.userId}`), 
        JSON.stringify(recentTransactions)
      )

      creditLogger.info("Transaction saved to fallback storage", { 
        userId: transaction.userId, 
        type: transaction.type, 
        amount: transaction.amount 
      })
    } catch (error) {
      creditLogger.error("Error saving transaction to fallback storage", error)
    }
  }

  async clearUserData(userId: string): Promise<void> {
    try {
      if (!this.isStorageAvailable()) {
        return
      }

      localStorage.removeItem(this.getStorageKey(`balance-${userId}`))
      localStorage.removeItem(this.getStorageKey(`transactions-${userId}`))
      creditLogger.info("User data cleared from fallback storage", { userId })
    } catch (error) {
      creditLogger.error("Error clearing user data from fallback storage", error)
    }
  }

  async getCurrentUserId(): Promise<string | null> {
    try {
      if (!this.isStorageAvailable()) {
        return null
      }

      // Try to get existing anonymous user ID
      const existingUserId = localStorage.getItem(this.getStorageKey("anonymous-user-id"))
      if (existingUserId) {
        return existingUserId
      }

      // Generate new anonymous user ID
      const newUserId = this.generateUUID()
      localStorage.setItem(this.getStorageKey("anonymous-user-id"), newUserId)
      return newUserId
    } catch (error) {
      creditLogger.error("Error getting current user ID from fallback storage", error)
      return null
    }
  }

  async setCurrentUserId(userId: string): Promise<void> {
    try {
      if (!this.isStorageAvailable()) {
        return
      }

      localStorage.setItem(this.getStorageKey("anonymous-user-id"), userId)
      creditLogger.info("User ID saved to fallback storage", { userId })
    } catch (error) {
      creditLogger.error("Error saving user ID to fallback storage", error)
    }
  }

  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}

export const fallbackCreditStorage = new FallbackCreditStorage() 