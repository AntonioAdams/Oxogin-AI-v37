import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { compressScreenshotForOpenAI, validatePayloadSize, SIZE_LIMITS, handleOversizedPayload, createPayloadErrorResponse } from "@/lib/utils/screenshot-compression"

export async function POST(request: NextRequest) {
  try {
    const {
      primaryCTAId,
      primaryCTAText,
      deviceType,
      currentCTR,
      projectedCTR,
      improvementPotential,
      costSavings,
      screenshot, // Add screenshot field to accept base64 data directly
      captureResult, // Keep for backward compatibility
      bundledAnalysis,
      desktopData,
      mobileData,
    } = await request.json()

    console.log("[OpenAI CRO] Starting analysis for:", deviceType)

    // Check if this is a bundled analysis (both desktop and mobile)
    const isBundledAnalysis = bundledAnalysis && desktopData && mobileData

    if (isBundledAnalysis) {
      console.log("[OpenAI CRO] Processing bundled desktop + mobile analysis...")
      return await processBundledAnalysis(desktopData, mobileData)
    }

    // Single device analysis
    return await processSingleDeviceAnalysis({
      primaryCTAId,
      primaryCTAText,
      deviceType,
      currentCTR,
      projectedCTR,
      improvementPotential,
      costSavings,
      screenshot, // Pass screenshot directly
      captureResult, // Keep for backward compatibility
    })
  } catch (error) {
    console.error("[OpenAI CRO] Analysis error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "CRO analysis failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Bundled analysis for both desktop and mobile
async function processBundledAnalysis(desktopData: any, mobileData: any) {
  try {
    console.log("[OpenAI CRO] Processing bundled analysis...")

    // Extract data from both devices
    const desktopUrl = desktopData.captureResult?.domData?.url || "unknown"
    const mobileUrl = mobileData.captureResult?.domData?.url || "unknown"
    const url = desktopUrl || mobileUrl
    const companyName = url.includes("://") ? new URL(url).hostname.replace("www.", "") : url

    // Desktop metrics
    const desktopPrimaryCTA = desktopData.primaryCTAPrediction
    const desktopCurrentCTR = desktopPrimaryCTA?.ctr || desktopData.dynamicBaseline || 0.065
    const desktopProjectedCTR = desktopCurrentCTR * 1.4
    const desktopImprovementPotential = ((desktopProjectedCTR - desktopCurrentCTR) / desktopCurrentCTR) * 100
    const desktopCostSavings = desktopPrimaryCTA?.wastedSpend || Math.round(Math.random() * 2000 + 500)

    // Mobile metrics
    const mobilePrimaryCTA = mobileData.primaryCTAPrediction
    const mobileCurrentCTR = mobilePrimaryCTA?.ctr || mobileData.dynamicBaseline || 0.065
    const mobileProjectedCTR = mobileCurrentCTR * 1.4
    const mobileImprovementPotential = ((mobileProjectedCTR - mobileCurrentCTR) / mobileCurrentCTR) * 100
    const mobileCostSavings = mobilePrimaryCTA?.wastedSpend || Math.round(Math.random() * 2000 + 500)

    // Get compressed screenshots for both devices
    const desktopScreenshotBase64 = await getCompressedScreenshot(desktopData.captureResult?.screenshot, 'desktop')
    const mobileScreenshotBase64 = await getCompressedScreenshot(mobileData.captureResult?.screenshot, 'mobile')

    const prompt = `CRO Expert: Analyze desktop + mobile screenshots to increase conversions by removing friction.

MISSION: Remove distractions, simplify CTAs, reduce form complexity.
RULE: Only analyze visible elements. Don't speculate about backend.

Infer page goal (lead gen/signup/trial) and tailor recommendations.

JSON FORMAT:
{
  "companyName": "${companyName}",
  "url": "${url}",
  "dateAnalyzed": "${new Date().toLocaleDateString()}",
  "deviceComparison": {
    "desktop": {"currentConversionRate": ${(desktopCurrentCTR * 100).toFixed(1)}, "projectedConversionRate": ${(desktopProjectedCTR * 100).toFixed(1)}, "improvementPotential": ${desktopImprovementPotential.toFixed(0)}, "costSavings": ${desktopCostSavings}},
    "mobile": {"currentConversionRate": ${(mobileCurrentCTR * 100).toFixed(1)}, "projectedConversionRate": ${(mobileProjectedCTR * 100).toFixed(1)}, "improvementPotential": ${mobileImprovementPotential.toFixed(0)}, "costSavings": ${mobileCostSavings}}
  },
  "frictionPoints": [{"element": "Navigation", "type": "Distraction", "problem": "6 nav links before CTA", "impact": "20-30% focus reduction"}],
  "recommendedActions": {
    "phase1": {"title": "🟢 Quick Wins (1-2 hrs)", "description": "Remove visual distractions", "actions": ["Specific removal actions"], "teamOwner": ["Designer"], "timeToValue": "1-2 days", "estimatedTime": "1-2 hrs", "expectedGain": "+3-5%"},
    "phase2": {"title": "🟡 Form Fixes (3-5 hrs)", "description": "Reduce form friction", "actions": ["Specific form improvements"], "teamOwner": ["Developer"], "timeToValue": "2-4 days", "estimatedTime": "3-5 hrs", "expectedGain": "+5-8%"},
    "phase3": {"title": "🔴 Structural (1-2 days)", "description": "Align messaging/layout", "actions": ["Specific structural changes"], "teamOwner": ["Designer"], "timeToValue": "1-2 weeks", "estimatedTime": "1-2 days", "expectedGain": "+8-12%"}
  },
  "nextSteps": ["Remove distractions", "Simplify forms", "Align messaging", "Track performance"],
  "highlights": ["Page goal insight", "Key improvement opportunity"],
  "additionalNotes": "Specific, screenshot-verified recommendations only."
}`

    const messages: any[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ]

    // Add compressed screenshots if available
    if (desktopScreenshotBase64) {
      messages[0].content.push({
        type: "image",
        image: desktopScreenshotBase64,
      })
    }
    if (mobileScreenshotBase64) {
      messages[0].content.push({
        type: "image",
        image: mobileScreenshotBase64,
      })
    }

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      messages,
      temperature: 0.1,
    })

    console.log(`[OpenAI CRO] Bundled analysis response:`, result.text.substring(0, 500))

    // Parse the JSON response
    let executiveBrief
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        executiveBrief = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("No JSON found in response")
      }
    } catch (parseError) {
      console.error("[OpenAI CRO] Failed to parse bundled analysis response:", parseError)
      throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }

    console.log(`[OpenAI CRO] Bundled analysis completed successfully`)

    return NextResponse.json({
      success: true,
      ...executiveBrief,
      metadata: {
        deviceType: "bundled",
        independentAnalysis: true,
        hasDesktopScreenshot: !!desktopScreenshotBase64,
        hasMobileScreenshot: !!mobileScreenshotBase64,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("[OpenAI CRO] Bundled analysis error:", error)
    throw error
  }
}

// Single device analysis
async function processSingleDeviceAnalysis(data: any) {
  try {
    const {
      primaryCTAId,
      primaryCTAText,
      deviceType,
      currentCTR,
      projectedCTR,
      improvementPotential,
      costSavings,
      screenshot, // New direct screenshot parameter
      captureResult, // Keep for backward compatibility
    } = data

    // Get compressed screenshot - try new screenshot parameter first, then fallback to captureResult
    let screenshotBase64 = null
    if (screenshot) {
      // If screenshot is provided directly as base64, compress it
      screenshotBase64 = await compressScreenshotForOpenAI(screenshot, deviceType)
    } else if (captureResult?.screenshot) {
      // Fallback to captureResult.screenshot for backward compatibility
      screenshotBase64 = await getCompressedScreenshot(captureResult.screenshot, deviceType)
    }

    if (!screenshotBase64) {
      throw new Error("No screenshot provided for analysis")
    }

    const prompt = `CRO Expert: Analyze ${deviceType.toUpperCase()} screenshot to increase conversions.

MISSION: Remove distractions, reduce friction, focus users on primary CTA.
RULE: Only analyze visible elements. No speculation about backend.

Infer page intent (lead gen/signup/trial) and tailor recommendations:
- Form-based: reduce fields, simplify layout
- Non-form: improve visibility, hierarchy

JSON FORMAT:
{
  "companyName": "Company Name",
  "url": "https://example.com", 
  "deviceType": "${deviceType}",
  "dateAnalyzed": "${new Date().toLocaleDateString()}",
  "currentPerformance": {
    "primaryCTA": "${primaryCTAText}",
    "currentConversionRate": ${currentCTR},
    "projectedConversionRate": ${projectedCTR},
    "monthlyWastedSpend": ${costSavings},
    "ctaType": "form-based or non-form",
    "metricLabel": "Conversion Rate or CTR"
  },
  "frictionPoints": [{"element": "Element Name", "type": "Distraction/Friction/Visibility", "problem": "Specific issue", "impact": "Impact percentage"}],
  "recommendedActions": {
    "phase1": {"title": "🟢 Quick Wins (1-2 hrs)", "description": "Remove distractions", "actions": ["Specific actions"], "teamOwner": ["Designer"], "timeToValue": "1-2 days", "estimatedTime": "1-2 hrs", "expectedGain": "+3-5%"},
    "phase2": {"title": "🟡 Form Fixes (3-5 hrs)", "description": "Reduce friction", "actions": ["Specific improvements"], "teamOwner": ["Developer"], "timeToValue": "2-4 days", "estimatedTime": "3-5 hrs", "expectedGain": "+5-8%"},
    "phase3": {"title": "🔴 Structural (1-2 days)", "description": "Align messaging", "actions": ["Specific changes"], "teamOwner": ["Designer"], "timeToValue": "1-2 weeks", "estimatedTime": "1-2 days", "expectedGain": "+8-12%"}
  },
  "nextSteps": ["Remove distractions", "Simplify forms", "Align messaging", "Track performance"],
  "highlights": ["Page goal insight", "Key opportunity"],
  "additionalNotes": "Screenshot-verified recommendations only."
}`

    const messages: any[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ]

    // Add compressed screenshot if available
    if (screenshotBase64) {
      messages[0].content.push({
        type: "image",
        image: screenshotBase64,
      })
      console.log(`[OpenAI CRO] Added ${deviceType} compressed screenshot to analysis request`)
    }

    // Validate payload size before sending to OpenAI
    const requestPayload = {
      model: "gpt-4o-mini",
      messages,
      temperature: 0.1,
    }
    
    const validation = validatePayloadSize(requestPayload, SIZE_LIMITS.SAFE_PAYLOAD, `OpenAI CRO Analysis (${deviceType})`)
    
    if (!validation.isValid) {
      console.error(`[OpenAI CRO] ${validation.error}`)
      
      // Try emergency compression as fallback
      try {
        console.log(`[OpenAI CRO] Attempting emergency compression for ${deviceType}...`)
        const fallback = await handleOversizedPayload(screenshotBase64, deviceType, `CRO Analysis (${deviceType})`)
        
        if (fallback.applied !== 'none') {
          // Update the messages with emergency compressed screenshot
          messages[0].content = messages[0].content.filter(item => item.type !== 'image')
          messages[0].content.push({
            type: "image",
            image: fallback.compressedScreenshot,
          })
          
          // Re-validate with emergency compression
          const emergencyValidation = validatePayloadSize({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.1,
          }, SIZE_LIMITS.SAFE_PAYLOAD, `OpenAI CRO Analysis Emergency (${deviceType})`)
          
          if (!emergencyValidation.isValid) {
            throw new Error(`Even emergency compression failed: ${emergencyValidation.sizeKB}KB exceeds limits`)
          }
          
          console.warn(`[OpenAI CRO] Using emergency compression: ${fallback.applied}`)
        } else {
          throw new Error('Emergency compression failed')
        }
      } catch (emergencyError) {
        console.error(`[OpenAI CRO] Emergency compression failed:`, emergencyError)
        
        // Return graceful error response instead of throwing
        return NextResponse.json(
          createPayloadErrorResponse(validation, `CRO analysis for ${deviceType}`),
          { status: 413 }
        )
      }
    }

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      messages,
      temperature: 0.1,
    })

    console.log(`[OpenAI CRO] ${deviceType} analysis response:`, result.text.substring(0, 500))

    // Parse the JSON response
    let executiveBrief
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        executiveBrief = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("No JSON found in response")
      }
    } catch (parseError) {
      console.error("[OpenAI CRO] Failed to parse single device analysis response:", parseError)
      throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }

    console.log(`[OpenAI CRO] ${deviceType} analysis completed successfully`)

    return NextResponse.json({
      success: true,
      ...executiveBrief,
      metadata: {
        deviceType,
        independentAnalysis: true,
        hasScreenshot: !!screenshotBase64,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("[OpenAI CRO] Single device analysis error:", error)
    throw error
  }
}

async function getCompressedScreenshot(screenshotUrl: string | undefined, deviceType: 'desktop' | 'mobile' = 'desktop'): Promise<string | null> {
  if (!screenshotUrl) return null

  try {
    const response = await fetch(screenshotUrl)
    const blob = await response.blob()
    const bytes = await blob.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    
    // Compress the screenshot
    const compressedScreenshot = await compressScreenshotForOpenAI(base64, deviceType)
    return compressedScreenshot
  } catch (error) {
    console.warn("[OpenAI CRO] Failed to prepare compressed screenshot:", error)
    return null
  }
}
