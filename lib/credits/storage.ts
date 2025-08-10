import type { CreditBalance, CreditTransaction } from "./types"

class CreditStorage {
  private memoryStorage: Map<string, any> = new Map()
  private storageAvailable: boolean | null = null

  // Cookie utilities for fallback user ID persistence
  private setCookie(name: string, value: string, days = 30): void {
    if (typeof window === "undefined") return

    try {
      const expires = new Date()
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
      document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
    } catch (error) {
      console.warn("Failed to set cookie:", error)
    }
  }

  private getCookie(name: string): string | null {
    if (typeof window === "undefined") return null

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

  isStorageAvailable(): boolean {
    if (this.storageAvailable !== null) {
      return this.storageAvailable
    }

    try {
      if (typeof window === "undefined") {
        this.storageAvailable = false
        return false
      }

      const testKey = "__storage_test__"
      localStorage.setItem(testKey, "test")
      localStorage.removeItem(testKey)
      this.storageAvailable = true
      return true
    } catch {
      this.storageAvailable = false
      return false
    }
  }

  private getStorageKey(key: string): string {
    return `cta-tool-${key}`
  }

  getUserId(): string | null {
    try {
      // First try localStorage
      if (this.isStorageAvailable()) {
        const localStorageUserId = localStorage.getItem(this.getStorageKey("user-id"))
        if (localStorageUserId) {
          return localStorageUserId
        }
      }

      // Fallback to cookie
      const cookieUserId = this.getCookie("cta-tool-user-id")
      if (cookieUserId) {
        // Sync back to localStorage if available
        if (this.isStorageAvailable()) {
          try {
            localStorage.setItem(this.getStorageKey("user-id"), cookieUserId)
          } catch (error) {
            console.warn("Failed to sync cookie user ID to localStorage:", error)
          }
        }
        return cookieUserId
      }

      // Fallback to memory storage
      return this.memoryStorage.get("user-id") || null
    } catch {
      return this.memoryStorage.get("user-id") || null
    }
  }

  setUserId(userId: string): void {
    try {
      // Save to localStorage if available
      if (this.isStorageAvailable()) {
        localStorage.setItem(this.getStorageKey("user-id"), userId)
      }

      // Also save to cookie for cross-tab persistence
      this.setCookie("cta-tool-user-id", userId)

      // Fallback to memory storage
      this.memoryStorage.set("user-id", userId)
    } catch (error) {
      console.warn("Failed to set user ID:", error)
      // Always save to memory as final fallback
      this.memoryStorage.set("user-id", userId)
    }
  }

  async getBalance(userId: string): Promise<CreditBalance | null> {
    try {
      const key = this.getStorageKey(`balance-${userId}`)
      let data: string | null = null

      if (this.isStorageAvailable()) {
        data = localStorage.getItem(key)
      } else {
        data = this.memoryStorage.get(key) || null
      }

      if (!data) return null

      const balance = JSON.parse(data)
      // Convert date strings back to Date objects
      balance.lastUpdated = new Date(balance.lastUpdated)
      if (balance.resetDate) {
        balance.resetDate = new Date(balance.resetDate)
      }
      return balance
    } catch (error) {
      console.error("Failed to get balance:", error)
      return null
    }
  }

  async setBalance(balance: CreditBalance): Promise<void> {
    try {
      const key = this.getStorageKey(`balance-${balance.userId}`)
      const data = JSON.stringify(balance)

      if (this.isStorageAvailable()) {
        localStorage.setItem(key, data)
      } else {
        this.memoryStorage.set(key, data)
      }
    } catch (error) {
      console.error("Failed to set balance:", error)
      // Store in memory as fallback
      const key = this.getStorageKey(`balance-${balance.userId}`)
      this.memoryStorage.set(key, JSON.stringify(balance))
    }
  }

  async getTransactions(userId: string): Promise<CreditTransaction[]> {
    try {
      const key = this.getStorageKey(`transactions-${userId}`)
      let data: string | null = null

      if (this.isStorageAvailable()) {
        data = localStorage.getItem(key)
      } else {
        data = this.memoryStorage.get(key) || null
      }

      if (!data) return []

      const transactions = JSON.parse(data)
      // Convert date strings back to Date objects
      return transactions.map((t: any) => ({
        ...t,
        timestamp: new Date(t.timestamp),
      }))
    } catch (error) {
      console.error("Failed to get transactions:", error)
      return []
    }
  }

  async addTransaction(transaction: CreditTransaction): Promise<void> {
    try {
      const transactions = await this.getTransactions(transaction.userId)
      transactions.push(transaction)

      // Keep only the last 100 transactions
      const recentTransactions = transactions.slice(-100)

      const key = this.getStorageKey(`transactions-${transaction.userId}`)
      const data = JSON.stringify(recentTransactions)

      if (this.isStorageAvailable()) {
        localStorage.setItem(key, data)
      } else {
        this.memoryStorage.set(key, data)
      }
    } catch (error) {
      console.error("Failed to add transaction:", error)
      // Store in memory as fallback
      const key = this.getStorageKey(`transactions-${transaction.userId}`)
      this.memoryStorage.set(key, JSON.stringify([transaction]))
    }
  }

  async clearUserData(userId: string): Promise<void> {
    try {
      const balanceKey = this.getStorageKey(`balance-${userId}`)
      const transactionsKey = this.getStorageKey(`transactions-${userId}`)

      if (this.isStorageAvailable()) {
        localStorage.removeItem(balanceKey)
        localStorage.removeItem(transactionsKey)
      } else {
        this.memoryStorage.delete(balanceKey)
        this.memoryStorage.delete(transactionsKey)
      }
    } catch (error) {
      console.error("Failed to clear user data:", error)
    }
  }

  // Clear all CTA tool data from localStorage
  clearAllData(): void {
    try {
      if (this.isStorageAvailable()) {
        const keys = Object.keys(localStorage)
        keys.forEach((key) => {
          if (key.startsWith("cta-tool-")) {
            localStorage.removeItem(key)
          }
        })
      }
      this.memoryStorage.clear()
    } catch (error) {
      console.error("Failed to clear all data:", error)
    }
  }
}

export const creditStorage = new CreditStorage()
