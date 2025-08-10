import { type NextRequest, NextResponse } from "next/server"
import { clickPredictionEngine } from "@/lib/prediction/engine"
import type { DOMElement, PageContext } from "@/lib/prediction/types"

// Add deduplication function before convertDOMData function
function deduplicateFormFields(formFields: any[]): any[] {
  if (!formFields || formFields.length === 0) return []

  const uniqueFields: any[] = []
  const seenFields = new Set<string>()

  for (const field of formFields) {
    // Create a unique key based on name and approximate coordinates
    const name = field.name || field.attributes?.name || field.attributes?.id || ""
    const type = field.type || "text"

    // Round coordinates to nearest 50px to catch near-duplicates
    const roundedX = Math.round((field.coordinates?.x || 0) / 50) * 50
    const roundedY = Math.round((field.coordinates?.y || 0) / 50) * 50

    // Create unique identifier
    const uniqueKey = `${name}-${type}-${roundedX}-${roundedY}`

    // Also check for exact name duplicates regardless of position
    const nameKey = `${name}-${type}`

    if (!seenFields.has(uniqueKey) && !seenFields.has(nameKey)) {
      uniqueFields.push(field)
      seenFields.add(uniqueKey)
      seenFields.add(nameKey)
    }
  }

  // Log deduplication results in development
  if (process.env.NODE_ENV === "development") {
    console.log(`🔄 Form field deduplication: ${formFields.length} → ${uniqueFields.length} fields`, {
      originalCount: formFields.length,
      deduplicatedCount: uniqueFields.length,
      removedDuplicates: formFields.length - uniqueFields.length,
      uniqueFieldNames: uniqueFields.map((f) => f.name || f.attributes?.name || "unnamed"),
    })
  }

  return uniqueFields
}

// Update convertDOMData function to use deduplicated form fields
function convertDOMData(domData: any): DOMElement[] {
  const elements: DOMElement[] = []

  // Convert buttons
  domData.buttons?.forEach((button: any, index: number) => {
    if (button.isVisible && button.text?.trim()) {
      elements.push({
        id: `button-${button.coordinates.x}-${button.coordinates.y}`,
        tagName: "button",
        text: button.text,
        className: button.className || "",
        coordinates: button.coordinates,
        isVisible: button.isVisible,
        isAboveFold: button.isAboveFold,
        isInteractive: true,
        hasButtonStyling: true,
        type: button.type,
        distanceFromTop: button.distanceFromTop,
        formAction: button.formAction,
      })
    }
  })

  // Convert links
  domData.links?.forEach((link: any, index: number) => {
    if (link.isVisible && link.text?.trim()) {
      elements.push({
        id: `link-${link.coordinates.x}-${link.coordinates.y}`,
        tagName: "a",
        text: link.text,
        className: link.className || "",
        coordinates: link.coordinates,
        isVisible: link.isVisible,
        isAboveFold: link.isAboveFold,
        isInteractive: true,
        hasButtonStyling: link.hasButtonStyling || false,
        distanceFromTop: link.distanceFromTop,
        href: link.href,
      })
    }
  })

  // Convert form containers
  domData.forms?.forEach((form: any, index: number) => {
    elements.push({
      id: `form-${form.coordinates.x}-${form.coordinates.y}`,
      tagName: "form",
      text: form.submitButtonText || "Submit",
      className: "",
      coordinates: form.coordinates,
      isVisible: true,
      isAboveFold: form.isAboveFold,
      isInteractive: true,
      hasButtonStyling: form.hasSubmitButton,
      distanceFromTop: form.distanceFromTop,
    })
  })

  // ENHANCED: Deduplicate form fields before processing
  const deduplicatedFormFields = deduplicateFormFields(domData.formFields || [])

  // Convert deduplicated form fields with human-readable labels
  deduplicatedFormFields.forEach((field: any, index: number) => {
    if (field.coordinates && field.coordinates.width > 0 && field.coordinates.height > 0) {
      // Create a meaningful label for the field
      let fieldLabel = field.attributes?.placeholder || field.name || field.attributes?.id || `${field.type} field`

      // Enhance label based on common patterns
      if (field.name) {
        if (field.name.toLowerCase().includes("first") || field.name.toLowerCase().includes("fname")) {
          fieldLabel = "First Name Field"
        } else if (field.name.toLowerCase().includes("last") || field.name.toLowerCase().includes("lname")) {
          fieldLabel = "Last Name Field"
        } else if (field.name.toLowerCase().includes("email")) {
          fieldLabel = "Email Field"
        } else if (field.name.toLowerCase().includes("phone") || field.name.toLowerCase().includes("tel")) {
          fieldLabel = "Phone Field"
        } else if (field.name.toLowerCase().includes("company") || field.name.toLowerCase().includes("organization")) {
          fieldLabel = "Company Field"
        } else if (field.name.toLowerCase().includes("country")) {
          fieldLabel = "Country Field"
        } else if (field.name.toLowerCase().includes("message") || field.name.toLowerCase().includes("description")) {
          fieldLabel = "Message Field"
        } else if (field.name.toLowerCase().includes("job") || field.name.toLowerCase().includes("title")) {
          fieldLabel = "Job Title Field"
        } else if (field.name.toLowerCase().includes("privacy") || field.name.toLowerCase().includes("optin")) {
          fieldLabel = "Privacy Consent"
        }
      }

      // Additional label enhancement based on placeholder text
      if (field.attributes?.placeholder && !fieldLabel.includes("Field")) {
        const placeholder = field.attributes.placeholder.toLowerCase()
        if (placeholder.includes("first name")) {
          fieldLabel = "First Name Field"
        } else if (placeholder.includes("last name")) {
          fieldLabel = "Last Name Field"
        } else if (placeholder.includes("email")) {
          fieldLabel = "Email Field"
        } else if (placeholder.includes("phone")) {
          fieldLabel = "Phone Field"
        } else if (placeholder.includes("company")) {
          fieldLabel = "Company Field"
        }
      }

      elements.push({
        id: `field-${field.coordinates.x}-${field.coordinates.y}-${field.type}`,
        tagName: field.type === "textarea" ? "textarea" : field.type === "select" ? "select" : "input",
        text: fieldLabel,
        className: field.attributes?.className || "",
        coordinates: field.coordinates,
        isVisible: true,
        isAboveFold: field.coordinates.y < 800, // Assume fold line at 800px
        isInteractive: true,
        hasButtonStyling: false,
        type: field.type,
        required: field.required,
        label: fieldLabel,
        placeholder: field.attributes?.placeholder,
        hasAutocomplete: !!field.attributes?.autocomplete,
        pattern: field.attributes?.pattern,
        minLength: field.attributes?.minlength ? Number.parseInt(field.attributes.minlength) : undefined,
        maxLength: field.attributes?.maxlength ? Number.parseInt(field.attributes.maxlength) : undefined,
        distanceFromTop: field.coordinates.y,
      })
    }
  })

  // Only log in development
  if (process.env.NODE_ENV === "development") {
    console.log(`🔄 Converted DOM data: ${elements.length} total elements`, {
      buttons: elements.filter((e) => e.tagName === "button").length,
      links: elements.filter((e) => e.tagName === "a").length,
      forms: elements.filter((e) => e.tagName === "form").length,
      formFields: elements.filter((e) => ["input", "textarea", "select"].includes(e.tagName)).length,
      deduplicatedFormFields: deduplicatedFormFields.length,
      originalFormFields: domData.formFields?.length || 0,
      sampleElements: elements.slice(0, 3).map((e) => ({ id: e.id, tagName: e.tagName, text: e.text })),
    })
  }

  return elements
}

// Create page context from request - ENHANCED: Added DOM content for industry detection
function createPageContext(domData: any, url?: string): PageContext {
  return {
    url: url || domData.url, // Use provided URL or fallback to domData
    title: domData.title,
    totalImpressions: 1000, // Default value - would come from analytics
    trafficSource: "unknown",
    deviceType: "desktop",
    loadTime: 3.0,
    adMessageMatch: 0.7,
    hasSSL: true,
    hasTrustBadges: false,
    hasTestimonials: false,
    brandRecognition: 0.5,
    pageComplexity: 50,
    viewportWidth: 1920,
    viewportHeight: 1080,
    foldLine: domData.foldLine?.position || 800,
    domContent: domData, // NEW: Pass DOM content for industry auto-detection
  }
}

export async function POST(request: NextRequest) {
  try {
    const { domData, url } = await request.json()

    if (!domData) {
      return NextResponse.json({ error: "DOM data is required" }, { status: 400 })
    }

    // Only log processing details in development
    if (process.env.NODE_ENV === "development") {
      console.log(`📊 Processing click predictions for:`, {
        buttons: domData.buttons?.length || 0,
        links: domData.links?.length || 0,
        forms: domData.forms?.length || 0,
        formFields: domData.formFields?.length || 0,
      })
    }

    // Convert DOM data to prediction engine format
    const elements = convertDOMData(domData)
    const context = createPageContext(domData, url)

    // Add all elements to context for cross-element analysis
    context.allElements = elements

    // Generate predictions using the sophisticated model
    const result = await clickPredictionEngine.predictClicks(elements, context)

    // ENHANCED: Convert to expected format while preserving human-readable text
    const predictions = result.predictions.map((prediction) => ({
      elementId: prediction.elementId,
      ctr: prediction.ctr / 100, // Convert percentage to decimal
      estimatedClicks: prediction.estimatedClicks,
      clickShare: prediction.clickShare / 100, // Convert percentage to decimal
      wastedClicks: prediction.wastedClicks,
      wastedSpend: prediction.wastedSpend,
      avgCPC: prediction.avgCPC,
      confidence: prediction.confidence, // Keep as string
      riskFactors: prediction.riskFactors,
      formCompletionRate: prediction.formCompletionRate,
      leadCount: prediction.leadCount,
      bottleneckField: prediction.bottleneckField,
      // ENHANCED: Preserve human-readable text and element information
      text: prediction.text,
      elementType: prediction.elementType,
      tagName: prediction.tagName,
      coordinates: prediction.coordinates,
      wasteBreakdown: prediction.wasteBreakdown,
    }))

    // Only log prediction results in development
    if (process.env.NODE_ENV === "development") {
      console.log(`✅ Generated ${predictions.length} click predictions`, {
        formFieldPredictions: predictions.filter((p) => p.elementId.includes("field-")).length,
        buttonPredictions: predictions.filter((p) => p.elementId.includes("button-")).length,
        linkPredictions: predictions.filter((p) => p.elementId.includes("link-")).length,
        formPredictions: predictions.filter((p) => p.elementId.includes("form-")).length,
        detectedIndustry: context.industry,
        detectedBusinessType: context.businessType,
        estimatedCPC: result.metadata?.estimatedCPC,
        wastedClickAnalysis: result.wastedClickAnalysis
          ? {
              totalWastedElements: result.wastedClickAnalysis.totalWastedElements,
              averageWastedScore: result.wastedClickAnalysis.averageWastedScore,
              highRiskElements: result.wastedClickAnalysis.highRiskElements.length,
            }
          : null,
        samplePredictionWithText: predictions[0]
          ? {
              elementId: predictions[0].elementId,
              text: predictions[0].text,
              elementType: predictions[0].elementType,
              wastedClicks: predictions[0].wastedClicks,
              wastedSpend: predictions[0].wastedSpend,
              confidence: predictions[0].confidence,
            }
          : null,
      })
    }

    return NextResponse.json({
      success: true,
      predictions,
      formAnalysis: result.formAnalysis,
      wastedClickAnalysis: result.wastedClickAnalysis, // NEW: Include wasted click analysis
      reliability: result.reliability,
      warnings: result.warnings,
      metadata: {
        ...result.metadata,
        individualFormFields: predictions.filter((p) => p.elementId.includes("field-")).length,
        detectedIndustry: context.industry,
        detectedBusinessType: context.businessType,
        totalElementsProcessed: elements.length,
        domElementsBreakdown: {
          buttons: elements.filter((e) => e.tagName === "button").length,
          links: elements.filter((e) => e.tagName === "a").length,
          forms: elements.filter((e) => e.tagName === "form").length,
          formFields: elements.filter((e) => ["input", "textarea", "select"].includes(e.tagName)).length,
        },
        enhancedTextLabels: true, // Flag to indicate enhanced text is available
        wastedClickModelV53: !!result.wastedClickAnalysis, // Flag to indicate v5.3 model was used
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // Always log errors (even in production)
    console.error("Error generating click predictions:", error)
    return NextResponse.json(
      {
        error: "Failed to generate predictions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
