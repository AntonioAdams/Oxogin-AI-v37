import { type NextRequest, NextResponse } from "next/server"
import { creditManager } from "@/lib/credits/manager"
import { logger } from "@/lib/utils/logger"

const apiLogger = logger.module("api-test-credits")

export async function GET(request: NextRequest) {
  try {
    // Test with a simple mock to verify the endpoint works
    const testUserId = "test_user_123"
    
    apiLogger.info("Testing credit system endpoint", { testUserId })

    // Return a mock response to test the endpoint
    return NextResponse.json({
      success: true,
      message: "Credit system test endpoint working",
      testData: {
        userId: testUserId,
        totalCredits: 10,
        usedCredits: 0,
        remainingCredits: 10,
        testMode: true,
        note: "This is a test response - database integration pending"
      },
    })
  } catch (error) {
    apiLogger.error("Credit system test failed", error)
    return NextResponse.json(
      {
        success: false,
        error: "Credit system test failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, testUserId = "test_user_123" } = body

    apiLogger.info("Credit test operation requested", { action, testUserId })

    let result

    switch (action) {
      case "deduct":
        // Test deducting 2 credits
        result = await creditManager.deductCredits(testUserId, 2, {
          reason: "Test deduction",
          test: true,
        })
        apiLogger.info("Test credits deducted", { 
          testUserId, 
          remainingCredits: result.remainingCredits,
          deducted: 2
        })
        break

      case "reset":
        result = await creditManager.forceResetCredits(testUserId)
        apiLogger.info("Test credits reset", { 
          testUserId, 
          newCredits: result.remainingCredits 
        })
        break

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
            message: `Action '${action}' is not supported. Use 'deduct' or 'reset'.`,
          },
          { status: 400 },
        )
    }

    return NextResponse.json({
      success: true,
      message: `Credit test operation: ${action}`,
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
    apiLogger.error("Credit test operation failed", error)
    return NextResponse.json(
      {
        success: false,
        error: "Credit test operation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
} 