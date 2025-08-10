import { NextRequest, NextResponse } from "next/server"
import { analysisStorage } from "@/lib/analysis/storage"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: "Analysis ID is required" },
        { status: 400 }
      )
    }

    // Load the analysis using the storage system
    const analysis = analysisStorage.getAnalysis(id)

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ...analysis,
      message: "Analysis loaded successfully"
    })

  } catch (error) {
    console.error("Test load analysis error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 