export interface CreditBalance {
  userId: string
  totalCredits: number
  usedCredits: number
  remainingCredits: number
  lastUpdated: Date
  resetDate?: Date
}

export interface CreditTransaction {
  id: string
  userId: string
  type: "debit" | "credit" | "reset"
  amount: number
  reason: string
  timestamp: Date
  metadata?: any
}

export interface CreditConfig {
  defaultCredits: number
  captureCreditsRequired: number
  resetPeriod: "daily" | "weekly" | "monthly"
}

export interface CreditCheckResult {
  hasCredits: boolean
  remainingCredits: number
  requiredCredits: number
  message: string
}
