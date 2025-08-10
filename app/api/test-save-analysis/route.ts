import { NextRequest, NextResponse } from "next/server"
import { analysisStorage } from "@/lib/analysis/storage"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, desktopData, mobileData } = body

    if (!url || !desktopData || !mobileData) {
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      )
    }

    // Save the analysis using the storage system
    const analysisId = await analysisStorage.saveAnalysis(url, desktopData, mobileData)

    if (!analysisId) {
      return NextResponse.json(
        { error: "Failed to save analysis" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      analysisId,
      url,
      timestamp: new Date().toISOString(),
      message: "Analysis saved successfully"
    })

  } catch (error) {
    console.error("Test save analysis error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 