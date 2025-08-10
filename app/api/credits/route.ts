import { type NextRequest, NextResponse } from "next/server"
import { creditManager } from "@/lib/credits/manager"
import { logger } from "@/lib/utils/logger"

const apiLogger = logger.module("api-credits")

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    apiLogger.info("Fetching credit balance", { userId })

    // If no userId provided, return default balance
    if (!userId) {
      const defaultBalance = {
        userId: "anonymous",
        totalCredits: 10,
        usedCredits: 0,
        remainingCredits: 10,
        lastUpdated: new Date(),
        resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }

      return NextResponse.json({
        success: true,
        balance: defaultBalance,
      })
    }

    // Try to get the balance using the dual approach
    const balance = await creditManager.getOrCreateBalance(userId)

    apiLogger.info("Credit balance retrieved", {
      userId: balance.userId,
      remainingCredits: balance.remainingCredits,
      totalCredits: balance.totalCredits,
    })

    return NextResponse.json({
      success: true,
      balance: {
        userId: balance.userId,
        totalCredits: balance.totalCredits,
        usedCredits: balance.usedCredits,
        remainingCredits: balance.remainingCredits,
        lastUpdated: balance.lastUpdated,
        resetDate: balance.resetDate,
      },
    })
  } catch (error) {
    apiLogger.error("Failed to fetch credit balance", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch credit balance",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId } = body

    apiLogger.info("Credit operation requested", { action, userId })

    let result

    switch (action) {
      case "reset":
        result = await creditManager.forceResetCredits(userId)
        apiLogger.info("Credits reset", { userId: result.userId, newCredits: result.remainingCredits })
        break

      case "clear":
        await creditManager.forceResetUserData()
        result = await creditManager.getOrCreateBalance(userId)
        apiLogger.info("User data cleared and credits reset", { userId: result.userId, newCredits: result.remainingCredits })
        break

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
            message: `Action '${action}' is not supported. Use 'reset' or 'clear'.`,
          },
          { status: 400 },
        )
    }

    return NextResponse.json({
      success: true,
      balance: {
        userId: result.userId,
        totalCredits: result.totalCredits,
        usedCredits: result.usedCredits,
        remainingCredits: result.remainingCredits,
        lastUpdated: result.lastUpdated,
        resetDate: result.resetDate,
      },
    })
  } catch (error) {
    apiLogger.error("Credit operation failed", error)
    return NextResponse.json(
      {
        success: false,
        error: "Credit operation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
