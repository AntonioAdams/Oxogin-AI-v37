// Internal CRO Analysis API Route - Replaces OpenAI CRO analysis
import { NextRequest, NextResponse } from "next/server";
import { croAnalyzer } from "@/lib/cro/analyzer";
import { CaptureData } from "@/lib/cro/types";

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { captureData, deviceType } = requestBody;

    // Validate required data
    if (!captureData) {
      return NextResponse.json(
        { success: false, error: "Capture data is required" },
        { status: 400 }
      );
    }

    console.log(`[Internal CRO] Starting analysis for ${captureData.domData?.url} (${deviceType || 'auto'})`);
    
    // Run CRO analysis
    const analysisResult = deviceType 
      ? await croAnalyzer.analyzeDevice(captureData, deviceType)
      : await croAnalyzer.analyze(captureData);

    console.log(`[Internal CRO] Analysis complete: ${analysisResult.summary.totalRecommendations} recommendations generated`);

    // Format response to match existing OpenAI CRO response structure
    // This ensures UI compatibility without changes
    const compatibleResponse = {
      success: true,
      analysis: {
        companyName: extractCompanyName(captureData.domData.url),
        url: captureData.domData.url,
        deviceType: analysisResult.metadata.deviceType,
        dateAnalyzed: new Date().toLocaleDateString(),
        
        // Main recommendations formatted as current UI expects
        recommendations: analysisResult.recommendations.map(rec => ({
          category: rec.category,
          title: rec.title,
          description: rec.description,
          effort: rec.effort,
          impact: rec.impact,
          priority: rec.priority,
          confidence: rec.confidence
        })),

        // Summary metrics
        summary: {
          totalRecommendations: analysisResult.summary.totalRecommendations,
          quickWins: analysisResult.summary.quickWins,
          formFixes: analysisResult.summary.formFixes,
          structuralChanges: analysisResult.summary.structuralChanges,
          estimatedUplift: `${analysisResult.summary.estimatedUpliftRange.min}-${analysisResult.summary.estimatedUpliftRange.max}%`
        },

        // For backward compatibility with existing UI
        currentPerformance: {
          primaryCTA: analysisResult.tokens.labels.primary_cta || "Main CTA",
          currentConversionRate: 2.3, // Default baseline
          projectedConversionRate: 2.3 + (analysisResult.summary.estimatedUpliftRange.min / 100 * 2.3),
          monthlyWastedSpend: 0, // Calculate if needed
          ctaType: "button",
          metricLabel: "Conversion Rate"
        },

        // Quick wins for immediate display
        quickWins: analysisResult.recommendations
          .filter(r => r.category === 'Quick Wins')
          .slice(0, 3)
          .map(r => ({
            title: r.title,
            description: r.description,
            impact: r.impact,
            effort: r.effort
          })),

        // Form recommendations 
        formOptimizations: analysisResult.recommendations
          .filter(r => r.category === 'Form Fixes')
          .slice(0, 3)
          .map(r => ({
            title: r.title,
            description: r.description,
            impact: r.impact,
            effort: r.effort
          })),

        // Structural changes
        structuralChanges: analysisResult.recommendations
          .filter(r => r.category === 'Structural Changes')
          .slice(0, 3)
          .map(r => ({
            title: r.title,
            description: r.description,
            impact: r.impact,
            effort: r.effort
          }))
      },

      // Include raw analysis data for debugging/future use
      rawAnalysis: analysisResult,
      
      // Metadata
      metadata: {
        analysisEngine: "internal",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        processingTime: Date.now() // Will be updated with actual timing
      }
    };

    return NextResponse.json(compatibleResponse);

  } catch (error) {
    console.error("[Internal CRO] Analysis failed:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Internal CRO analysis failed",
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Extract company name from URL
 */
function extractCompanyName(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const parts = domain.split('.');
    const companyName = parts[0];
    
    // Capitalize first letter
    return companyName.charAt(0).toUpperCase() + companyName.slice(1);
  } catch {
    return "Unknown Company";
  }
}

/**
 * GET method for health check
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "Internal CRO Analysis",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
}

