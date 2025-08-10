import { type NextRequest, NextResponse } from "next/server"
import { analyzeCTA } from "@/lib/ai"
import { logger } from "@/lib/utils/logger"

const moduleLogger = logger.module("api-analyze-cta")

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File
    const domDataString = formData.get("domData") as string

    if (!imageFile) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    moduleLogger.info("Starting CTA analysis")

    const result = await analyzeCTA({
      image: imageFile,
      domData: domDataString ? JSON.parse(domDataString) : {}, // Keep for compatibility but not used
    })

    moduleLogger.info(`CTA analysis completed in ${result.processingTime}ms`)

    return NextResponse.json({
      success: true,
      primaryCTA: result.insight,
      result: result.insight, // Keep for backward compatibility
      processingTime: result.processingTime,
      model: result.model,
    })
  } catch (error) {
    // Always log errors (even in production)
    moduleLogger.error("Error analyzing CTA", error as Error)
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 })
  }
}
