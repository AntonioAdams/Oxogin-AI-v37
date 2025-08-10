import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      )
    }

    console.log("🔍 Starting competitor research for:", url)

    // Normalize URL and extract domain
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    let domain: string
    let companyName: string
    try {
      const urlObj = new URL(normalizedUrl)
      domain = urlObj.hostname.replace('www.', '')
      companyName = domain.split('.')[0]
      console.log("📋 Parsed domain:", domain, "Company:", companyName)
    } catch (parseError) {
      console.error("❌ Invalid URL format:", url)
      return NextResponse.json(
        { error: `Invalid URL format: ${url}` },
        { status: 400 }
      )
    }

    const prompt = `You are a competitive intelligence expert. Given a website URL, find the #1 direct competitor.

Website URL: ${url}
Company/Domain: ${domain}

Instructions:
1. Identify the industry and business model of this company
2. Find their primary direct competitor (not just similar companies, but actual competitors)
3. Return ONLY the competitor's main website URL
4. The competitor should be:
   - Similar size or market position
   - Same target audience
   - Direct business overlap
   - Well-known/established

Return format: Just the URL, nothing else. Example: https://competitor.com

If you cannot find a clear direct competitor, return: NO_COMPETITOR_FOUND`

    const result = await generateText({
      model: openai("gpt-4o-mini"), // Use gpt-4o-mini for faster, more reliable responses
      messages: [
        {
          role: "system",
          content: "You are a competitive intelligence expert who finds direct business competitors."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      maxTokens: 100,
      temperature: 0.1, // Low temperature for consistent results
    })

    const competitorResponse = result.text?.trim()

    if (!competitorResponse || competitorResponse === "NO_COMPETITOR_FOUND") {
      return NextResponse.json(
        { error: "No clear competitor found for this website" },
        { status: 404 }
      )
    }

    // Validate that the response is a URL
    let competitorUrl: string
    try {
      // Clean up the response and ensure it's a valid URL
      let cleanUrl = competitorResponse.replace(/['"]/g, '').trim()
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl
      }
      
      const urlObj = new URL(cleanUrl)
      competitorUrl = urlObj.toString()
    } catch (error) {
      console.error("Invalid URL returned from OpenAI:", competitorResponse)
      return NextResponse.json(
        { error: "Invalid competitor URL returned" },
        { status: 500 }
      )
    }

    console.log("✅ Competitor found:", competitorUrl)

    return NextResponse.json({
      success: true,
      competitor: {
        url: competitorUrl,
        domain: new URL(competitorUrl).hostname.replace('www.', ''),
        discoveredAt: new Date().toISOString()
      },
      originalUrl: url
    })

  } catch (error) {
    console.error("❌ Competitor research error:", error)
    
    // Handle specific AI SDK errors
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      
      // Handle quota/rate limit errors
      if (error.message.includes('insufficient_quota') || 
          error.message.includes('rate_limit') ||
          error.message.includes('quota_exceeded')) {
        return NextResponse.json(
          { error: "OpenAI API quota exceeded. Please try again later." },
          { status: 429 }
        )
      }
      
      // Handle timeout errors
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        return NextResponse.json(
          { error: "Request timed out. OpenAI is taking too long to respond." },
          { status: 408 }
        )
      }
      
      // Handle authentication errors
      if (error.message.includes('authentication') || error.message.includes('invalid_api_key')) {
        return NextResponse.json(
          { error: "OpenAI API key configuration error." },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { 
        error: "Failed to research competitor",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}