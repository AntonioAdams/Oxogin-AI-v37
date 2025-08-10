import { type NextRequest, NextResponse } from "next/server"
import { WastedClickModelV53 } from "@/lib/prediction/wasted-click-model-v5-3"
import { singleCRORecommendationEngine } from "@/lib/cro/single-recommendation-engine"

export async function POST(request: NextRequest) {
  console.log("=== SINGLE CRO RECOMMENDATION ROUTE START ===")

  try {
    const {
      domData,
      clickPredictions,
      primaryCTAId,
      deviceType,
      dynamicBaseline,
      isFormRelated,
      primaryCTAPrediction,
      matchedElement,
      allDOMElements,
      existingCROAnalysis,
    } = await request.json()

    console.log("Single CRO Analysis Request:", {
      primaryCTAId,
      deviceType,
      dynamicBaseline,
      isFormRelated,
      clickPredictionsCount: clickPredictions?.length || 0,
      hasMatchedElement: !!matchedElement,
      hasPrimaryPrediction: !!primaryCTAPrediction,
    })

    // Create complete DOM elements for the model
    const allModelElements = []

    // Helper function to create complete element structure
    const createCompleteElement = (baseElement: any, elementType: string, index: number) => {
      const elementId = `${elementType}-${baseElement.coordinates?.x || index}-${baseElement.coordinates?.y || index}`

      // Better text extraction
      const elementText =
        baseElement.text ||
        baseElement.textContent ||
        baseElement.innerText ||
        baseElement.submitButtonText ||
        baseElement.attributes?.placeholder ||
        baseElement.name ||
        baseElement.href?.split("/").pop() ||
        `${elementType} element`

      return {
        id: elementId,
        tagName:
          baseElement.tagName ||
          (elementType === "field"
            ? "input"
            : elementType === "form"
              ? "form"
              : elementType === "link"
                ? "a"
                : "button"),
        text: elementText,
        textContent: elementText, // Add this for better text access
        innerText: elementText, // Add this for better text access
        className: baseElement.className || baseElement.attributes?.className || "",
        coordinates: baseElement.coordinates || { x: 0, y: 0, width: 100, height: 40 },
        isVisible: baseElement.isVisible !== undefined ? baseElement.isVisible : true,
        isAboveFold:
          baseElement.isAboveFold !== undefined ? baseElement.isAboveFold : (baseElement.coordinates?.y || 0) < 800,
        distanceFromTop: baseElement.distanceFromTop || baseElement.coordinates?.y || 0,
        isInteractive: true,
        hasButtonStyling: elementType === "button" || baseElement.hasButtonStyling || false,
        type: baseElement.type || (elementType === "field" ? "text" : "button"),
        required: baseElement.required || baseElement.attributes?.required || false,
        label: baseElement.label || baseElement.attributes?.label || null,
        placeholder: baseElement.placeholder || baseElement.attributes?.placeholder || null,
        hasAutocomplete: baseElement.hasAutocomplete || baseElement.attributes?.autocomplete || false,
        pattern: baseElement.pattern || baseElement.attributes?.pattern || null,
        minLength: baseElement.minLength || baseElement.attributes?.minLength || null,
        maxLength: baseElement.maxLength || baseElement.attributes?.maxLength || null,
        href: baseElement.href || null,
        formAction: baseElement.formAction || baseElement.action || null,
        style: baseElement.style || {},
        zIndex: baseElement.zIndex || "auto",
        clickableElementsCount: 1,
        primaryCTACount: elementId === primaryCTAId ? 1 : 0,
        hasHighContrast: true,
        isAutoRotating: false,
        isSticky: false,
        textLength: elementText.length,
        hasNearbyCTA: false,
        isDecorative: false,
        hasVisualNoise: false,
        hasMultipleCompetingElements: false,
        autoplay: false,
      }
    }

    // Process all DOM elements
    if (allDOMElements?.buttons) {
      allDOMElements.buttons.forEach((button: any, index: number) => {
        if (button.isVisible && button.coordinates) {
          allModelElements.push(createCompleteElement(button, "button", index))
        }
      })
    }

    if (allDOMElements?.links) {
      allDOMElements.links.forEach((link: any, index: number) => {
        if (link.isVisible && link.coordinates) {
          const completeElement = createCompleteElement(link, "link", index)
          completeElement.tagName = "a"
          completeElement.href = link.href || "#"
          allModelElements.push(completeElement)
        }
      })
    }

    if (allDOMElements?.forms) {
      allDOMElements.forms.forEach((form: any, index: number) => {
        if (form.coordinates) {
          const completeElement = createCompleteElement(form, "form", index)
          completeElement.tagName = "form"
          completeElement.text = form.submitButtonText || "Submit"
          allModelElements.push(completeElement)
        }
      })
    }

    if (allDOMElements?.formFields) {
      allDOMElements.formFields.forEach((field: any, index: number) => {
        if (field.coordinates && field.coordinates.width > 0 && field.coordinates.height > 0) {
          const completeElement = createCompleteElement(field, "field", index)
          completeElement.tagName =
            field.type === "textarea" ? "textarea" : field.type === "select" ? "select" : "input"
          completeElement.type = field.type || "text"
          completeElement.required = field.attributes?.required || field.required || false
          completeElement.placeholder = field.attributes?.placeholder || field.placeholder || null
          completeElement.label = field.label || field.name || null
          allModelElements.push(completeElement)
        }
      })
    }

    // Process navigation elements if they exist
    if (allDOMElements?.navigation) {
      allDOMElements.navigation.forEach((nav: any, index: number) => {
        if (nav.isVisible && nav.coordinates) {
          const completeElement = createCompleteElement(nav, "navigation", index)
          completeElement.tagName = "a"
          completeElement.href = nav.href || "#"
          allModelElements.push(completeElement)
        }
      })
    }

    // Process any additional clickable elements
    if (allDOMElements?.clickableElements) {
      allDOMElements.clickableElements.forEach((element: any, index: number) => {
        if (element.isVisible && element.coordinates) {
          allModelElements.push(createCompleteElement(element, "clickable", index))
        }
      })
    }

    console.log("Total DOM elements for analysis:", allModelElements.length)

    // Create page context
    const pageContextData = {
      url: domData?.url || "unknown",
      title: domData?.title || "Unknown Page",
      totalImpressions: 10000,
      trafficSource: "unknown" as const,
      deviceType: deviceType === "mobile" ? ("mobile" as const) : ("desktop" as const),
      industry: "technology" as const,
      businessType: "b2c" as const,
      timeOfDay: "afternoon" as const,
      dayOfWeek: "weekday" as const,
      seasonality: "medium" as const,
      competitorPresence: false,
      brandRecognition: 0.5,
      loadTime: 3.0,
      adMessageMatch: 0.8,
      hasSSL: true,
      hasTrustBadges: false,
      hasTestimonials: false,
      pageComplexity: 50,
      viewportWidth: deviceType === "mobile" ? 375 : 1920,
      viewportHeight: deviceType === "mobile" ? 667 : 1080,
      foldLine: deviceType === "mobile" ? 667 : 800,
      networkType: "search" as const,
      geoTier: "tier1" as const,
      competitionLevel: "medium" as const,
      qualityScore: "good" as const,
      allElements: allModelElements,
      isFormRelated: isFormRelated || false,
      formFieldCount: allDOMElements?.formFields?.length || 0,
    }

    // Create primary CTA element
    let primaryCTAElement = null
    if (primaryCTAPrediction && matchedElement) {
      primaryCTAElement = createCompleteElement(matchedElement, "button", 0)
      primaryCTAElement.id = primaryCTAId
      primaryCTAElement.tagName = matchedElement.tagName || "button"
      primaryCTAElement.text = matchedElement.text || ""
      primaryCTAElement.className = matchedElement.className || ""
      primaryCTAElement.coordinates = matchedElement.coordinates || { x: 0, y: 0, width: 100, height: 40 }
      primaryCTAElement.isVisible = true
      primaryCTAElement.isAboveFold = matchedElement.isAboveFold || true
      primaryCTAElement.isInteractive = true
      primaryCTAElement.hasButtonStyling = true
      primaryCTAElement.predictedClicks = primaryCTAPrediction.estimatedClicks || 0
      primaryCTAElement.ctr = primaryCTAPrediction.ctr || dynamicBaseline
      primaryCTAElement.wastedClicks = primaryCTAPrediction.wastedClicks || 0
      primaryCTAElement.riskFactors = primaryCTAPrediction.riskFactors || []
    }

    if (!primaryCTAElement) {
      throw new Error("Primary CTA element is required for analysis")
    }

    console.log("Running Wasted Click Analysis...")

    // Initialize and run Wasted Click Model
    const model = new WastedClickModelV53(pageContextData)
    const wastedClickAnalysis = model.analyzeWastedClicks(allModelElements, primaryCTAElement, clickPredictions)

    console.log("Wasted Click Analysis completed:", {
      totalWastedElements: wastedClickAnalysis.totalWastedElements,
      averageWastedScore: wastedClickAnalysis.averageWastedScore,
      highRiskCount: wastedClickAnalysis.highRiskElements.length,
      highRiskElementDetails: wastedClickAnalysis.highRiskElements.map((el) => ({
        id: el.element.id,
        text: el.element.text?.substring(0, 30),
        type: el.type,
        wastedClickScore: el.wastedClickScore.toFixed(3),
      })),
    })

    // Generate single high-impact recommendation
    const croAnalysisData = existingCROAnalysis || {
      currentCTR: dynamicBaseline,
      projectedCTR: dynamicBaseline * 1.5,
      ctrLabel: isFormRelated ? "Conversion Rate" : "CTR",
    }

    const recommendation = singleCRORecommendationEngine.generateRecommendation(
      wastedClickAnalysis,
      primaryCTAElement.text || "Primary CTA",
      croAnalysisData,
      isFormRelated,
      deviceType,
    )

    console.log("Single recommendation generated:", {
      title: recommendation.title,
      improvementPercent: recommendation.improvementPercent,
      elementsToRemove: recommendation.elementsToRemove,
      difficulty: recommendation.difficulty,
    })

    // Return the single recommendation
    const response = {
      recommendation,
      analysis: {
        wastedElementsFound: wastedClickAnalysis.totalWastedElements,
        averageWasteScore: wastedClickAnalysis.averageWastedScore,
        highRiskElements: wastedClickAnalysis.highRiskElements.length,
        // NEW: Include specific elements that were identified for removal
        elementsToRemove: wastedClickAnalysis.highRiskElements.map((el) => ({
          id: el.element.id,
          text: el.element.text || el.element.textContent || el.element.innerText || "Unknown element",
          type: el.type,
          wastedClickScore: el.wastedClickScore,
          classification: el.classification,
        })),
      },
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        deviceType,
        isFormRelated,
        primaryCTAText: primaryCTAElement.text,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Single CRO Analysis error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate CRO recommendation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
