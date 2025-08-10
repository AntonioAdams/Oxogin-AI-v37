import type { CreditBalance, CreditTransaction } from "./types"
import { supabase } from "@/lib/supabase/client"
import { logger } from "../utils/logger"

const creditLogger = logger.module("credits-supabase")

export class SupabaseCreditStorage {
  async getBalance(userId: string): Promise<CreditBalance | null> {
    try {
      const validUserId = this.ensureValidUserId(userId)
      
      const { data, error } = await supabase
        .from("credit_balances")
        .select("*")
        .eq("user_id", validUserId)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned - user doesn't have a balance yet
          creditLogger.info("No credit balance found for user", { userId })
          return null
        }
        creditLogger.error("Failed to fetch credit balance", error, { userId })
        // Return null instead of throwing to allow fallback
        return null
      }

      creditLogger.info("Credit balance retrieved from Supabase", {
        userId,
        remainingCredits: data.remaining_credits,
        totalCredits: data.total_credits,
      })

      return {
        userId: validUserId,
        totalCredits: data.total_credits,
        usedCredits: data.used_credits,
        remainingCredits: data.remaining_credits,
        lastUpdated: new Date(data.updated_at),
        resetDate: new Date(data.reset_date),
      }
    } catch (error) {
      creditLogger.error("Error fetching credit balance from Supabase", error, { userId })
      // Return null instead of throwing to allow fallback
      return null
    }
  }

  async setBalance(balance: CreditBalance): Promise<void> {
    try {
      const validUserId = this.ensureValidUserId(balance.userId)
      
      const { error } = await supabase
        .from("credit_balances")
        .upsert({
          user_id: validUserId,
          total_credits: balance.totalCredits,
          used_credits: balance.usedCredits,
          remaining_credits: balance.remainingCredits,
        })

      if (error) {
        creditLogger.error("Failed to update credit balance in Supabase", error, {
          userId: balance.userId,
          remainingCredits: balance.remainingCredits,
        })
        throw error
      }

      creditLogger.info("Credit balance updated in Supabase", {
        userId: balance.userId,
        remainingCredits: balance.remainingCredits,
        usedCredits: balance.usedCredits,
      })
    } catch (error) {
      creditLogger.error("Error updating credit balance in Supabase", error, { userId: balance.userId })
      throw error
    }
  }

  async getTransactions(userId: string): Promise<CreditTransaction[]> {
    try {
      const validUserId = this.ensureValidUserId(userId)
      
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", validUserId)
        .order("created_at", { ascending: false })

      if (error) {
        creditLogger.error("Failed to fetch credit transactions from Supabase", error, { userId })
        throw error
      }

      return data.map((tx) => ({
        id: tx.id,
        userId: tx.user_id,
        type: tx.transaction_type,
        amount: tx.amount,
        reason: tx.reason,
        timestamp: new Date(tx.created_at),
        metadata: tx.metadata,
      }))
    } catch (error) {
      creditLogger.error("Error fetching credit transactions from Supabase", error, { userId })
      throw error
    }
  }

  async addTransaction(transaction: CreditTransaction): Promise<void> {
    try {
      const validUserId = this.ensureValidUserId(transaction.userId)
      
      const { error } = await supabase
        .from("credit_transactions")
        .insert({
          user_id: validUserId,
          transaction_type: transaction.type,
          amount: transaction.amount,
          reason: transaction.reason,
          metadata: transaction.metadata,
        })

      if (error) {
        creditLogger.error("Failed to add credit transaction to Supabase", error, {
          userId: transaction.userId,
          amount: transaction.amount,
          reason: transaction.reason,
        })
        throw error
      }

      creditLogger.info("Credit transaction added to Supabase", {
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        reason: transaction.reason,
      })
    } catch (error) {
      creditLogger.error("Error adding credit transaction to Supabase", error, { userId: transaction.userId })
      throw error
    }
  }

  async clearUserData(userId: string): Promise<void> {
    try {
      const validUserId = this.ensureValidUserId(userId)
      
      // Delete transactions first (due to foreign key constraint)
      const { error: transactionError } = await supabase
        .from("credit_transactions")
        .delete()
        .eq("user_id", validUserId)

      if (transactionError) {
        creditLogger.error("Failed to delete credit transactions from Supabase", transactionError, { userId: validUserId })
        throw transactionError
      }

      // Delete balance
      const { error: balanceError } = await supabase
        .from("credit_balances")
        .delete()
        .eq("user_id", validUserId)

      if (balanceError) {
        creditLogger.error("Failed to delete credit balance from Supabase", balanceError, { userId })
        throw balanceError
      }

      creditLogger.info("User credit data cleared from Supabase", { userId })
    } catch (error) {
      creditLogger.error("Error clearing user credit data from Supabase", error, { userId })
      throw error
    }
  }

  async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      return user?.id || null
    } catch (error) {
      creditLogger.error("Error getting current user from Supabase", error)
      // For anonymous users, return null to use fallback system
      return null
    }
  }

  // Helper method to ensure we always have a valid UUID user ID
  private ensureValidUserId(userId: any): string {
    if (typeof userId === 'string' && userId.length > 0) {
      // Check if it's already a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (uuidRegex.test(userId)) {
        return userId
      }
    }
    
    // If userId is an object or invalid, generate a fallback UUID
    if (typeof userId === 'object' && userId !== null) {
      creditLogger.warn("Invalid userId object received, using fallback UUID", { userId })
      return this.generateUUID()
    }
    
    // If userId is null, undefined, or empty string, generate a UUID
    return this.generateUUID()
  }

  // Generate a valid UUID v4
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return !!session
    } catch (error) {
      creditLogger.error("Error checking authentication status", error)
      return false
    }
  }
}

export const supabaseCreditStorage = new SupabaseCreditStorage() 