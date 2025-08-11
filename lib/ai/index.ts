// Public interface for the AI module
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import { z } from "zod"
import { logger } from "@/lib/utils/logger"
import { compressScreenshotForOpenAI } from "@/lib/utils/screenshot-compression"
import { debugLogCategory } from "@/lib/utils/logger"
import { validatePayloadSize, SIZE_LIMITS } from "@/lib/utils/screenshot-compression"

// Re-export types from feature-specific contracts
export type {
  CTAInsight,
  MatchedElement,
  DebugMatch,
  AIAnalysisOptions,
  AIAnalysisResult,
  MatchingOptions,
  MatchingResult,
} from "../contracts/cta"

const moduleLogger = logger.module("ai")

// More flexible schema with better defaults for GPT-4o-mini
const ctaSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe(
      "The EXACT text content of the primary CTA button/element - not form titles or headings. Must be at least 1 character.",
    ),
  confidence: z.number().min(0).max(1).default(0.5).describe("Confidence score from 0 to 1"),
  hasForm: z.boolean().default(false).describe("Whether a form is present and associated with this CTA"),
  reasoning: z
    .string()
    .min(10)
    .describe("Explanation of why this element was identified as the primary CTA. Must be at least 10 characters."),
  elementType: z
    .enum(["button", "link", "form"])
    .default("button")
    .describe("Type of element identified as primary CTA"),
  alternativeTexts: z
    .array(z.string())
    .default([])
    .describe("Any alternative text variations you see that might be the same CTA"),
})

interface ImageCompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: "jpeg" | "png" | "webp"
}

// Create OpenAI client
const openaiClient = openai({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function compressImageForAI(
  imageUrl: string,
  options: ImageCompressionOptions = {},
): Promise<string | null> {
  // For server-side, we'll skip compression and return the original URL
  // Browser-side compression can be implemented separately if needed
  debugLogCategory("AI Image", "Skipping compression on server-side, using original image")
  return imageUrl
}

export async function analyzeCTA(
  options: import("../contracts/cta").AIAnalysisOptions,
): Promise<import("../contracts/cta").AIAnalysisResult> {
  const startTime = Date.now()
  const model = options.model || "gpt-4o-mini"

  moduleLogger.info("Starting CTA analysis", { model })

  try {
    // Convert image to base64
    const bytes = await options.image.arrayBuffer()
    const originalBase64 = Buffer.from(bytes).toString("base64")

    moduleLogger.info("Image prepared for AI analysis", {
      originalSize: bytes.byteLength,
    })

    // Use direct OpenAI API - only send compressed screenshot, no DOM data
    const { analyzeCTADirect } = await import("./openai-direct")
    
    const result = await analyzeCTADirect(originalBase64, 'desktop', model)

    const processingTime = Date.now() - startTime

    moduleLogger.info(`CTA analysis completed successfully`, {
      processingTime,
      confidence: result.confidence,
      elementType: result.elementType,
      modelUsed: model,
    })

    return {
      insight: result as import("../contracts/cta").CTAInsight,
      processingTime,
      model,
    }
  } catch (error) {
    moduleLogger.error("CTA analysis failed", error)
    throw error
  }
}

export async function analyzeCTAWithAI(screenshot?: string, deviceType: 'desktop' | 'mobile' = 'desktop'): Promise<any> {
  try {
    debugLogCategory("AI", "Starting CTA analysis with AI")
    debugLogCategory("AI", "Screenshot available:", !!screenshot)

    const prompt = `Analyze this website screenshot and identify the primary Call-to-Action (CTA) element.

CRITICAL: You MUST respond with valid JSON that matches this exact schema. Do not include any text outside of the JSON response.

Required JSON format:
{
  "text": "exact button text here",
  "confidence": 0.8,
  "hasForm": true,
  "isFormAssociated": true,
  "reasoning": "detailed explanation here",
  "elementType": "button",
  "alternativeTexts": ["alternative1", "alternative2"]
}

The response must be valid JSON only. No additional text or explanations outside the JSON structure.

🎯 **STRICT FOLD-PRIORITY RULES** - Follow these rules in exact order:

0: Section prioritization recap: Always prefer CTAs found in the Hero section first, then Header section before other sections.
1. ✅ **PRIORITIZE FORMS** only if the **ENTIRE FORM IS ABOVE THE FOLD** (within first 800px)
2. ✅ If no forms are above the fold, identify the **MOST VISUALLY PROMINENT CTA BUTTON ABOVE THE FOLD** (1st priority: Hero Section, second only if no primary CTA in the hero section, in the top header's traditional top right header area, third only if the other two are unavailable: banner at the top center).
3. ❌ **IGNORE** any CTA buttons or forms that are fully or mostly **BELOW THE FOLD** (beyond 800px)
4. ✅ Consider text intent, **VISUAL PROMINENCE**, location, and uniqueness for above-fold elements only
5: Ignore search bars, icons, or search buttons commonly found in navigation — these are not primary CTAs.
6: ❌ **IGNORE** cookies, privacy banners, terms of service banners, and legal compliance elements — these are required site elements but not primary CTAs. **LOOK BEYOND** consent, cookie, and privacy banners to find the actual primary CTA on the page.
6.1: ❌ **IGNORE** cookie acceptance buttons like "Accept all cookies", "Manage cookies", and similar privacy compliance CTAs.
7: ✅ **PRIORITIZE ACTION-ORIENTED CTAs** over navigation: For example, on Apple's website, "Shop" or "Buy" buttons in the hero section should be prioritized over header navigation items like "Mac", "iPad", "iPhone" which are category navigation, not conversion actions.
8: Fallback proximity search: If no above-the-fold forms or buttons are detected, select the nearest form or button just above the fold (smallest distanceFromTop) as the primary CTA.
9: Visibility requirement: Ensure the selected element is visibly rendered in the screenshot; if the candidate is not visible upon visual analysis, it must be excluded and a fallback chosen.
10: Section prioritization recap: Always prefer CTAs found in the Hero section first, then Header section before other sections.

🎯 **VISUAL PROMINENCE ANALYSIS** - Critical for Primary CTA Detection:

When analyzing the screenshot, carefully assess these visual prominence factors:

1. **SIZE & SCALE**: Look for buttons that are significantly larger than other elements
   - Large buttons (>100px width/height) are likely primary CTAs
   - Small buttons (<50px) are likely secondary actions
   - Compare relative sizes - the biggest button is often the primary CTA

2. **COLOR & CONTRAST**: Identify elements that stand out visually
   - Bright, contrasting colors (purple, blue, green buttons on light backgrounds)
   - Unique colors that don't match the general page theme
   - High contrast elements that immediately draw the eye

3. **POSITIONING & CENTERING**: Note element placement on the page
   - Centered elements in hero sections are typically primary CTAs
   - Elements with significant whitespace around them
   - Buttons positioned at natural eye-flow endpoints (center, right side)

4. **STYLING & DESIGN**: Look for prominent design elements
   - Rounded corners, shadows, gradients indicating button styling
   - Bold, larger text within buttons
   - Elements that look "clickable" and prominent

5. **SUPPORTING ELEMENTS**: Check for trust signals and supporting text
   - Text like "No credit card required", "Free forever", "Cancel anytime"
   - Icons or badges near the CTA
   - Value propositions directly above/below the CTA

Focus on finding the ONE action users are most likely to take for conversion, prioritizing visually prominent elements that stand out in the screenshot.

🎯 **APPLE.COM EXAMPLE** - Navigation vs. Action CTAs:
- ❌ "Mac" (header navigation) = Category browsing, not conversion action
- ❌ "iPad" (header navigation) = Category browsing, not conversion action  
- ✅ "Shop" (hero section) = Direct purchase action, primary CTA
- ✅ "Buy" (hero section) = Direct purchase action, primary CTA
- ✅ "Learn more" (hero product section) = Product engagement, secondary CTA

Remember: Navigation items help users browse, but action-oriented CTAs drive conversions.

🎯 **FORM ASSOCIATION DETECTION** - Critical for Funnel Analysis:

When identifying the primary CTA, determine if it's associated with a VISIBLE form on the CURRENT page:

**isFormAssociated: true** ONLY when:
- The CTA is a form submit button (e.g., "Submit", "Get Started", "Sign Up") 
- AND there are visible form fields (email, name, phone) on the current page
- AND the CTA is positioned within or directly adjacent to those visible form fields
- The CTA's purpose is to submit form data that is visible on this page
- Examples: "Get the Guide" next to email input, "Apply Now" with application form, "Subscribe" with email field

**isFormAssociated: false** when:
- The CTA is a navigation link that goes to another page (e.g., "Learn More", "About", "View Products")
- The CTA is for purchasing/commerce (e.g., "Buy Now", "Shop", "Add to Cart", "Purchase")
- The CTA leads to another page, even if that other page might have forms
- No form fields are visible on the current page in the CTA area
- The CTA is for browsing, downloading, or informational purposes
- Examples: "Buy iPhone", "Shop Mac", "Learn More", "View Details", "Download"

**CRITICAL RULE**: Do NOT guess about forms on other pages. Only consider visible elements on the current screenshot.

**hasForm: true/false** indicates if ANY form exists on the current page
**isFormAssociated: true/false** indicates if the PRIMARY CTA submits a form visible on the current page

This distinction is critical:
- FORM funnel (isFormAssociated=true) = Single-step conversion with visible form submission
- NON-FORM funnel (isFormAssociated=false) = Multi-step conversion requiring navigation to another page`

    // Prepare messages for OpenAI
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
    if (screenshot) {
      try {
        debugLogCategory("AI", "Processing screenshot for analysis...")

        // Fetch and compress screenshot
        const response = await fetch(screenshot)
        const blob = await response.blob()
        const bytes = await blob.arrayBuffer()
        const base64 = Buffer.from(bytes).toString("base64")
        
        // Compress the screenshot
        const compressedScreenshot = await compressScreenshotForOpenAI(base64, deviceType)

        debugLogCategory("AI", "Screenshot compressed for analysis")

        messages[0].content.push({
          type: "image",
          image: compressedScreenshot,
        })
      } catch (error) {
        debugLogCategory("AI", "Failed to process screenshot:", error)
      }
    }

    debugLogCategory("AI", "Sending request to OpenAI...")

    // Validate payload size before sending to OpenAI
    const requestPayload = {
      model: "gpt-4o-mini",
      messages,
      temperature: 0.1,
      maxTokens: 1500,
    }
    
    const validation = validatePayloadSize(requestPayload, SIZE_LIMITS.SAFE_PAYLOAD, `CTA Analysis (${deviceType})`)
    
    if (!validation.isValid) {
      debugLogCategory("AI", `Payload validation failed: ${validation.error}`)
      throw new Error(`Payload too large: ${validation.sizeKB}KB exceeds ${validation.limitKB}KB limit. Screenshot compression may have failed.`)
    }

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      messages,
      temperature: 0.1,
      maxTokens: 1500,
    })

    debugLogCategory("AI", "OpenAI analysis completed")
    debugLogCategory("AI", "Response preview:", result.text.substring(0, 200))

    // Parse the response
    try {
      // Extract JSON from the response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0])
        debugLogCategory("AI", "Successfully parsed analysis:", {
          primaryCTA: analysis.primaryCTA,
          confidence: analysis.confidence,
          hasForm: analysis.hasForm,
        })
        return analysis
      } else {
        throw new Error("No JSON found in response")
      }
    } catch (parseError) {
      debugLogCategory("AI", "Failed to parse OpenAI response:", parseError)
      debugLogCategory("AI", "Raw response:", result.text)

      // Return a fallback response
      return {
        primaryCTA: "Unable to identify",
        confidence: 0.1,
        hasForm: false,
        coordinates: { x: 0, y: 0, width: 0, height: 0 },
        reasoning: "Failed to parse AI response",
        error: "Analysis parsing failed",
      }
    }
  } catch (error) {
    debugLogCategory("AI", "CTA analysis failed:", error)
    throw new Error(`Failed to analyze CTA: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
