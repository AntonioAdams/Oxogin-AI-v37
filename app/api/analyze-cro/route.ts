import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { WastedClickModelV53 } from "@/lib/prediction/wasted-click-model-v5-3"
import { ClickPredictionEngine } from "@/lib/prediction/engine"

export async function POST(request: NextRequest) {
  console.log("=== CRO ANALYSIS ROUTE START ===")
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
      analysisMetadata,
    } = await request.json()

    console.log("=== CRO ANALYSIS COMPREHENSIVE REQUEST ===")
    console.log("CRO Analysis Request:", {
      primaryCTAId,
      deviceType,
      dynamicBaseline,
      isFormRelated,
      clickPredictionsCount: clickPredictions?.length || 0,
      hasMatchedElement: !!matchedElement,
      hasPrimaryPrediction: !!primaryCTAPrediction,
      allDOMElementsCount: {
        buttons: allDOMElements?.buttons?.length || 0,
        links: allDOMElements?.links?.length || 0,
        forms: allDOMElements?.forms?.length || 0,
        formFields: allDOMElements?.formFields?.length || 0,
      },
    })

    console.log("Using dynamic baseline:", dynamicBaseline)

    // Move this outside try-catch
    const allModelElements = []

    console.log("DEBUG ROUTE: Starting DOM element conversion...")

    // Helper function to create complete element structure
    const createCompleteElement = (baseElement: any, elementType: string, index: number) => {
      const elementId = `${elementType}-${baseElement.coordinates?.x || index}-${baseElement.coordinates?.y || index}`

      return {
        // Core identification
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

        // Content and styling
        text:
          baseElement.text ||
          baseElement.submitButtonText ||
          baseElement.attributes?.placeholder ||
          baseElement.name ||
          `${elementType} element`,
        className: baseElement.className || baseElement.attributes?.className || "",

        // Positioning and visibility
        coordinates: baseElement.coordinates || { x: 0, y: 0, width: 100, height: 40 },
        isVisible: baseElement.isVisible !== undefined ? baseElement.isVisible : true,
        isAboveFold:
          baseElement.isAboveFold !== undefined ? baseElement.isAboveFold : (baseElement.coordinates?.y || 0) < 800,
        distanceFromTop: baseElement.distanceFromTop || baseElement.coordinates?.y || 0,

        // Interaction properties
        isInteractive: true,
        hasButtonStyling: elementType === "button" || baseElement.hasButtonStyling || false,

        // Form-specific properties (required for FeatureExtractor)
        type: baseElement.type || (elementType === "field" ? "text" : "button"),
        required: baseElement.required || baseElement.attributes?.required || false,
        label: baseElement.label || baseElement.attributes?.label || null,
        placeholder: baseElement.placeholder || baseElement.attributes?.placeholder || null,
        hasAutocomplete: baseElement.hasAutocomplete || baseElement.attributes?.autocomplete || false,
        pattern: baseElement.pattern || baseElement.attributes?.pattern || null,
        minLength: baseElement.minLength || baseElement.attributes?.minLength || null,
        maxLength: baseElement.maxLength || baseElement.attributes?.maxLength || null,

        // Link-specific properties
        href: baseElement.href || null,

        // Additional properties for feature extraction
        formAction: baseElement.formAction || baseElement.action || null,
        style: baseElement.style || {},
        zIndex: baseElement.zIndex || "auto",

        // Enhanced properties for wasted clicks calculation
        clickableElementsCount: 1,
        primaryCTACount: elementId === primaryCTAId ? 1 : 0,
        hasHighContrast: true,
        isAutoRotating: false,
        isSticky: false,
        textLength: (baseElement.text || "").length,
        hasNearbyCTA: false,
        isDecorative: false,
        hasVisualNoise: false,
        hasMultipleCompetingElements: false,
        autoplay: false,
      }
    }

    // Add buttons with complete structure
    if (allDOMElements?.buttons) {
      console.log("DEBUG ROUTE: Processing", allDOMElements.buttons.length, "buttons")
      allDOMElements.buttons.forEach((button: any, index: number) => {
        if (button.isVisible && button.coordinates) {
          const completeElement = createCompleteElement(button, "button", index)
          allModelElements.push(completeElement)
          console.log(
            "DEBUG ROUTE: Added complete button element:",
            completeElement.id,
            "text:",
            completeElement.text?.substring(0, 30),
          )
        }
      })
    }

    // Add links with complete structure
    if (allDOMElements?.links) {
      console.log("DEBUG ROUTE: Processing", allDOMElements.links.length, "links")
      allDOMElements.links.forEach((link: any, index: number) => {
        if (link.isVisible && link.coordinates) {
          const completeElement = createCompleteElement(link, "link", index)
          completeElement.tagName = "a"
          completeElement.href = link.href || "#"
          allModelElements.push(completeElement)
          console.log(
            "DEBUG ROUTE: Added complete link element:",
            completeElement.id,
            "text:",
            completeElement.text?.substring(0, 30),
          )
        }
      })
    }

    // Add forms with complete structure
    if (allDOMElements?.forms) {
      console.log("DEBUG ROUTE: Processing", allDOMElements.forms.length, "forms")
      allDOMElements.forms.forEach((form: any, index: number) => {
        if (form.coordinates) {
          const completeElement = createCompleteElement(form, "form", index)
          completeElement.tagName = "form"
          completeElement.text = form.submitButtonText || "Submit"
          allModelElements.push(completeElement)
          console.log("DEBUG ROUTE: Added complete form element:", completeElement.id)
        }
      })
    }

    // Add form fields with complete structure
    if (allDOMElements?.formFields) {
      console.log("DEBUG ROUTE: Processing", allDOMElements.formFields.length, "form fields")
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
          console.log(
            "DEBUG ROUTE: Added complete form field element:",
            completeElement.id,
            "type:",
            completeElement.type,
          )
        }
      })
    }

    console.log("1. Total DOM elements converted for model:", allModelElements.length)
    console.log("2. Element breakdown:", {
      buttons: allModelElements.filter((e) => e.tagName === "button").length,
      links: allModelElements.filter((e) => e.tagName === "a").length,
      forms: allModelElements.filter((e) => e.tagName === "form").length,
      formFields: allModelElements.filter((e) => ["input", "textarea", "select"].includes(e.tagName)).length,
    })

    // Initialize Wasted Click Model with comprehensive data
    let wastedClickAnalysis = null
    let modelSuccess = false

    console.log("DEBUG ROUTE: Starting Wasted Click Model initialization...")

    try {
      console.log("=== INITIALIZING WASTED CLICK MODEL V5.3 ===")

      // Create comprehensive page context with all required properties
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
        allElements: [], // Will be populated below
        // NEW: Add form context detection
        isFormRelated: isFormRelated || false,
        formFieldCount: allDOMElements?.formFields?.length || 0,
      }

      // Add elements to page context
      pageContextData.allElements = allModelElements
      console.log("DEBUG ROUTE: Page context created with", pageContextData.allElements.length, "elements")

      // Create primary CTA element from matched data with complete structure
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
        // Add prediction data
        primaryCTAElement.predictedClicks = primaryCTAPrediction.estimatedClicks || 0
        primaryCTAElement.ctr = primaryCTAPrediction.ctr || dynamicBaseline
        primaryCTAElement.wastedClicks = primaryCTAPrediction.wastedClicks || 0
        primaryCTAElement.riskFactors = primaryCTAPrediction.riskFactors || []

        console.log("3. primaryCTAElement created:", !!primaryCTAElement)
        console.log("DEBUG ROUTE: Primary CTA element details:", {
          id: primaryCTAElement.id,
          tagName: primaryCTAElement.tagName,
          text: primaryCTAElement.text?.substring(0, 50),
          coordinates: primaryCTAElement.coordinates,
        })
      }

      // Initialize the model
      console.log("DEBUG ROUTE: About to initialize WastedClickModelV53...")
      const model = new WastedClickModelV53(pageContextData)
      console.log("DEBUG ROUTE: WastedClickModelV53 initialized successfully")

      // NEW: Log form context detection
      console.log("=== FORM CONTEXT DETECTION ===")
      console.log("Form-related analysis:", {
        isFormRelated: isFormRelated,
        formFieldCount: pageContextData.formFieldCount,
        primaryCTAText: primaryCTAElement?.text?.substring(0, 50),
        hasFormFields: pageContextData.formFieldCount > 0,
      })

      console.log("4. Model initialized, running analysis...")
      console.log("5. Primary CTA for analysis:", primaryCTAElement?.id)
      console.log("6. Total elements for analysis:", allModelElements.length)

      // Run the analysis
      if (primaryCTAElement && allModelElements.length > 0) {
        console.log("DEBUG ROUTE: About to call model.analyzeWastedClicks...")
        wastedClickAnalysis = model.analyzeWastedClicks(allModelElements, primaryCTAElement, clickPredictions)
        modelSuccess = true
        console.log("7. Wasted Click Analysis completed:", {
          totalWastedElements: wastedClickAnalysis.totalWastedElements,
          averageWastedScore: wastedClickAnalysis.averageWastedScore,
          highRiskCount: wastedClickAnalysis.highRiskElements.length,
          ctrImprovement: wastedClickAnalysis.projectedImprovements.ctrImprovement,
          revenueImpact: wastedClickAnalysis.projectedImprovements.revenueImpact,
        })
      } else {
        throw new Error(`Missing required data: primaryCTA=${!!primaryCTAElement}, elements=${allModelElements.length}`)
      }
    } catch (error) {
      console.log("8. Wasted Click Model failed, using fallback calculations:")
      console.log("Error details:", error)
      console.log("Error message:", error instanceof Error ? error.message : "Unknown error")
      console.log("Error stack:", error instanceof Error ? error.stack : "No stack trace")
      modelSuccess = false
    }

    // Step 8: Run optimized click prediction (NEW) - Only if we have high-risk elements
    let projectedPrimaryCTA = null
    let modelDrivenProjection = null
    const primaryCTAElement = null // Declare primaryCTAElement here

    // Add this debug logging right before the if condition check (around line 180)
    console.log("DEBUG: Checking condition values before optimized prediction:")
    console.log("DEBUG: modelSuccess:", modelSuccess)
    console.log("DEBUG: wastedClickAnalysis exists:", !!wastedClickAnalysis)
    console.log("DEBUG: wastedClickAnalysis.highRiskElements exists:", !!wastedClickAnalysis?.highRiskElements)
    console.log("DEBUG: wastedClickAnalysis.highRiskElements.length:", wastedClickAnalysis?.highRiskElements?.length)
    console.log(
      "DEBUG: Full condition result:",
      modelSuccess && wastedClickAnalysis && wastedClickAnalysis.highRiskElements.length > 0,
    )

    if (modelSuccess && wastedClickAnalysis && wastedClickAnalysis.highRiskElements.length > 0) {
      try {
        console.log("8. Running optimized click prediction...")
        console.log(
          "High-risk elements to remove:",
          wastedClickAnalysis.highRiskElements.map((el) => ({
            id: el.element.id,
            text: el.element.text?.substring(0, 30),
            type: el.type,
            wastedClickScore: el.wastedClickScore,
          })),
        )

        // Filter out high-waste elements BUT keep the primary CTA
        const highWasteElementIds = wastedClickAnalysis.highRiskElements.map((el) => el.element.id)
        const optimizedElements = allModelElements.filter(
          (el) => !highWasteElementIds.includes(el.id) || el.id === primaryCTAId,
        )

        console.log("9. Optimized elements count:", {
          original: allModelElements.length,
          highWasteRemoved: highWasteElementIds.length,
          remaining: optimizedElements.length,
          primaryCTAKept: optimizedElements.some((el) => el.id === primaryCTAId),
        })

        // FORCE PRIMARY CTA INCLUSION: Ensure primary CTA is always in optimized elements
        const primaryCTAInOptimized = optimizedElements.find((el) => el.id === primaryCTAId)
        if (!primaryCTAInOptimized && primaryCTAElement) {
          console.log("DEBUG: Primary CTA missing from optimized elements, force-adding it")
          const primaryCTAForOptimized = createCompleteElement(primaryCTAElement, "button", 0)
          primaryCTAForOptimized.id = primaryCTAElement.id
          primaryCTAForOptimized.tagName = primaryCTAElement.tagName
          primaryCTAForOptimized.text = primaryCTAElement.text
          primaryCTAForOptimized.className = primaryCTAElement.className || ""
          primaryCTAForOptimized.coordinates = primaryCTAElement.coordinates
          primaryCTAForOptimized.isVisible = primaryCTAElement.isVisible
          primaryCTAForOptimized.isAboveFold = primaryCTAElement.isAboveFold
          primaryCTAForOptimized.isInteractive = primaryCTAElement.isInteractive
          primaryCTAForOptimized.hasButtonStyling = primaryCTAElement.hasButtonStyling
          primaryCTAForOptimized.type = primaryCTAElement.type
          primaryCTAForOptimized.distanceFromTop = primaryCTAElement.coordinates?.y || 0

          optimizedElements.unshift(primaryCTAForOptimized) // Add to beginning
          console.log("DEBUG: Primary CTA force-added to optimized elements")
        }

        console.log("DEBUG: Final optimized elements verification:", {
          totalCount: optimizedElements.length,
          primaryCTAPresent: optimizedElements.some((el) => el.id === primaryCTAId),
          primaryCTAIndex: optimizedElements.findIndex((el) => el.id === primaryCTAId),
        })

        console.log(
          "DEBUG: optimizedElements IDs:",
          optimizedElements.map((el) => el.id),
        )

        console.log("DEBUG: Step 1 - About to dynamically import ClickPredictionEngine")

        let clickPredictionEngine = null
        try {
          console.log("DEBUG ROUTE: Starting dynamic import of prediction engine...")
          console.log("DEBUG ROUTE: Dynamic import successful, module keys:", Object.keys(ClickPredictionEngine))
          console.log("DEBUG ROUTE: ClickPredictionEngine extracted:", typeof ClickPredictionEngine)
          console.log("DEBUG: ClickPredictionEngine import successful")

          console.log("DEBUG ROUTE: About to instantiate ClickPredictionEngine...")
          console.log("DEBUG ROUTE: ClickPredictionEngine type check:", typeof ClickPredictionEngine)
          console.log("DEBUG ROUTE: ClickPredictionEngine constructor check:", ClickPredictionEngine?.constructor)

          // Fix constructor call with proper error handling
          if (typeof ClickPredictionEngine === "function") {
            console.log("DEBUG ROUTE: Calling new ClickPredictionEngine()...")
            clickPredictionEngine = new ClickPredictionEngine()
            console.log("DEBUG: Step 2 - ClickPredictionEngine initialized successfully")
            console.log("DEBUG ROUTE: Engine instance created:", !!clickPredictionEngine)
            console.log(
              "DEBUG ROUTE: Engine instance methods:",
              Object.getOwnPropertyNames(Object.getPrototypeOf(clickPredictionEngine)),
            )
          } else {
            throw new Error("ClickPredictionEngine is not a constructor function")
          }
        } catch (engineError) {
          console.log("DEBUG: Step 2 FAILED - ClickPredictionEngine initialization error:")
          console.log(
            "DEBUG: Engine error message:",
            engineError instanceof Error ? engineError.message : "Unknown error",
          )
          console.log("DEBUG: Engine error stack:", engineError instanceof Error ? engineError.stack : "No stack trace")
          console.log("DEBUG: ClickPredictionEngine type:", typeof ClickPredictionEngine)
          console.log("DEBUG: ClickPredictionEngine value:", ClickPredictionEngine)
          throw engineError
        }

        if (!clickPredictionEngine) {
          throw new Error("Failed to initialize ClickPredictionEngine")
        }

        console.log("DEBUG: Step 3 - About to call predictClicks with optimizedElements:", optimizedElements.length)
        console.log("DEBUG: Step 4 - Sample optimized element:", optimizedElements[0])

        // Create complete page context with all required properties for FeatureExtractor
        const pageContext = {
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
          allElements: optimizedElements, // Use optimized elements with complete structure
        }

        console.log("DEBUG: Step 5 - Page context prepared:", {
          url: pageContext.url,
          elementsCount: pageContext.allElements.length,
          deviceType: pageContext.deviceType,
        })

        // Run optimized prediction with proper error handling
        try {
          console.log("DEBUG: Step 6 - Calling predictClicks...")
          console.log("DEBUG ROUTE: About to call clickPredictionEngine.predictClicks...")
          console.log("DEBUG ROUTE: Method exists:", typeof clickPredictionEngine.predictClicks)

          const optimizedResults = await clickPredictionEngine.predictClicks(optimizedElements, pageContext)

          console.log("DEBUG: Click prediction engine completed successfully")
          console.log("DEBUG ROUTE: Prediction engine returned results")
          console.log("DEBUG: optimizedResults structure:", {
            hasPredictions: !!optimizedResults.predictions,
            predictionsCount: optimizedResults.predictions?.length || 0,
            hasMetadata: !!optimizedResults.metadata,
            hasReliability: !!optimizedResults.reliability,
          })

          // Find projected primary CTA performance
          console.log("DEBUG: Searching for primary CTA in optimized results...")
          console.log("DEBUG: primaryCTAId:", primaryCTAId)
          console.log("DEBUG: optimizedResults.predictions count:", optimizedResults.predictions.length)
          console.log(
            "DEBUG: All prediction elementIds:",
            optimizedResults.predictions.map((p) => p.elementId),
          )
          console.log(
            "DEBUG: optimizedElements IDs:",
            optimizedElements.map((el) => el.id),
          )

          projectedPrimaryCTA = optimizedResults.predictions.find((p) => p.elementId === primaryCTAId)
          console.log("DEBUG ROUTE: Primary CTA found in results:", !!projectedPrimaryCTA)
        } catch (predictionError) {
          console.log("DEBUG: Click prediction engine FAILED with error:")
          console.log(
            "DEBUG: Error message:",
            predictionError instanceof Error ? predictionError.message : "Unknown error",
          )
          console.log(
            "DEBUG: Error stack:",
            predictionError instanceof Error ? predictionError.stack : "No stack trace",
          )
          console.log("DEBUG: Error details:", predictionError)
          throw predictionError
        }

        if (projectedPrimaryCTA) {
          // Normalize projected CTR if it's a raw score (>1) by dividing by 100
          const normalizedProjectedCTR =
            projectedPrimaryCTA.ctr > 1 ? projectedPrimaryCTA.ctr / 100 : projectedPrimaryCTA.ctr

          modelDrivenProjection = {
            currentCTR: dynamicBaseline,
            projectedCTR: normalizedProjectedCTR,
            currentClicks: primaryCTAPrediction?.estimatedClicks || 0,
            projectedClicks: projectedPrimaryCTA.predictedClicks,
            improvementPercent: ((normalizedProjectedCTR - dynamicBaseline) / dynamicBaseline) * 100,
            additionalClicks: projectedPrimaryCTA.predictedClicks - (primaryCTAPrediction?.estimatedClicks || 0),
            elementsRemoved: highWasteElementIds.length,
            confidence: projectedPrimaryCTA.confidence || "medium",
          }

          console.log("10. Model-driven projection:", modelDrivenProjection)
        } else {
          console.log("10. Primary CTA not found in optimized results")
        }
      } catch (error) {
        console.log("Optimized prediction failed:", error)
        console.log("Error details:", error instanceof Error ? error.message : "Unknown error")
        console.log("Error stack:", error instanceof Error ? error.stack : "No stack trace")
      }
    } else {
      console.log("8. Skipping optimized prediction - conditions not met:", {
        modelSuccess,
        hasWastedClickAnalysis: !!wastedClickAnalysis,
        highRiskCount: wastedClickAnalysis?.highRiskElements?.length || 0,
      })
    }

    console.log("DEBUG ROUTE: Starting AI analysis generation...")

    // Generate AI analysis
    const { text: rawAnalysis } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Analyze this website for conversion rate optimization opportunities:

Title: ${domData?.title || "Unknown"}
Current CTR: ${(dynamicBaseline * 100).toFixed(1)}%
Device: ${deviceType}
Primary CTA: ${primaryCTAId}
Total Clickable Elements: ${clickPredictions?.length || 0}

Provide a comprehensive CRO analysis with:
1. Current performance assessment
2. Specific improvement opportunities  
3. Projected impact estimates
4. Implementation recommendations

Focus on actionable insights that can improve conversion rates.`,
    })

    console.log("DEBUG ROUTE: AI analysis completed")

    // Calculate final metrics with form context awareness
    let finalMetrics
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
      allElements: [], // Will be populated below
      // NEW: Add form context detection
      isFormRelated: isFormRelated || false,
      formFieldCount: allDOMElements?.formFields?.length || 0,
    }

    if (modelDrivenProjection) {
      // Use model-driven results with form context enhancement
      const formContextMultiplier = isFormRelated ? 1.3 : 1.1 // Form CTAs see higher improvements

      finalMetrics = {
        currentCTR: modelDrivenProjection.currentCTR,
        projectedCTR: modelDrivenProjection.projectedCTR,
        improvementPotential: modelDrivenProjection.improvementPercent * formContextMultiplier,
        revenueImpact: calculateRevenueImpactWithFormContext(
          modelDrivenProjection.currentCTR,
          clickPredictions,
          isFormRelated,
        ),
        implementationDifficulty: wastedClickAnalysis?.projectedImprovements?.implementationDifficulty || "easy",
        priorityScore: wastedClickAnalysis?.projectedImprovements?.priorityScore || 50,
        formContext: {
          isFormCTA: isFormRelated,
          formFieldCount: pageContextData.formFieldCount,
          contextType: isFormRelated ? "form-cta" : "non-form-cta",
        },
      }
      console.log("11. Using model-driven projection with form context for final metrics")
    } else if (modelSuccess && wastedClickAnalysis) {
      // Use model results with form context fallback calculations
      const improvements = wastedClickAnalysis.projectedImprovements
      const formContextMultiplier = isFormRelated ? 1.4 : 1.2 // Higher multiplier for form context

      finalMetrics = {
        currentCTR: dynamicBaseline,
        projectedCTR: improvements.projectedCTR || dynamicBaseline * (1 + improvements.ctrImprovement),
        improvementPotential: improvements.ctrImprovement * 100 * formContextMultiplier,
        revenueImpact: improvements.revenueImpact * formContextMultiplier,
        implementationDifficulty: improvements.implementationDifficulty,
        priorityScore: improvements.priorityScore,
        formContext: {
          isFormCTA: isFormRelated,
          formFieldCount: pageContextData.formFieldCount,
          contextType: isFormRelated ? "form-cta" : "non-form-cta",
        },
      }
      console.log("11. Using wasted click model results with form context for final metrics")
    } else {
      // Fallback calculations with form context
      const baseImprovementRate = isFormRelated ? 0.186 : 0.146 // Higher baseline for form CTAs
      const formContextMultiplier = isFormRelated ? 1.25 : 1.0

      finalMetrics = {
        currentCTR: dynamicBaseline,
        projectedCTR: dynamicBaseline * (1 + baseImprovementRate),
        improvementPotential: baseImprovementRate * 100,
        revenueImpact: calculateRevenueImpactWithFormContext(dynamicBaseline, clickPredictions, isFormRelated),
        implementationDifficulty: "easy" as const,
        priorityScore: calculatePriorityScoreWithFormContext(clickPredictions, dynamicBaseline, isFormRelated),
        formContext: {
          isFormCTA: isFormRelated,
          formFieldCount: pageContextData.formFieldCount,
          contextType: isFormRelated ? "form-cta" : "non-form-cta",
        },
      }
      console.log("11. Using fallback calculations with form context for final metrics")
    }

    console.log("12. CRO Analysis Result:", finalMetrics)

    // Generate recommendations
    const recommendations =
      modelSuccess && wastedClickAnalysis?.recommendations?.length > 0
        ? wastedClickAnalysis.recommendations
        : [
            {
              title: "Optimize Primary CTA Placement",
              description: "Move primary CTA above the fold for better visibility",
              impact: "High",
              effort: "Low",
            },
            {
              title: "Improve CTA Copy",
              description: "Use more action-oriented and benefit-focused language",
              impact: "Medium",
              effort: "Low",
            },
            {
              title: "Reduce Form Friction",
              description: "Minimize required fields and add progress indicators",
              impact: "High",
              effort: "Medium",
            },
          ]

    const response = {
      overview: finalMetrics,
      elements: {
        highRiskCount: modelSuccess ? wastedClickAnalysis?.highRiskElements?.length || 0 : 0,
        recommendations,
        formContext: finalMetrics.formContext,
        // NEW: Include specific high-risk elements for removal
        highRiskElements: modelSuccess
          ? wastedClickAnalysis?.highRiskElements?.map((el) => ({
              id: el.element.id,
              text: el.element.text || el.element.textContent || el.element.innerText || "Unknown element",
              type: el.type,
              wastedClickScore: el.wastedClickScore,
              recommendation: el.recommendation,
            })) || []
          : [],
      },
      actions: {
        quickWins: [
          {
            title: isFormRelated ? "Optimize Form Field Labels" : "Update CTA Button Color",
            description: isFormRelated
              ? "Improve form field labels and add helpful placeholder text"
              : "Change to high-contrast color for better visibility",
            difficulty: "easy",
            status: "pending",
          },
          {
            title: isFormRelated ? "Remove Form Distractions" : "Add Urgency Indicators",
            description: isFormRelated
              ? "Hide social links and non-essential navigation during form completion"
              : "Include time-sensitive language or countdown timers",
            difficulty: "easy",
            status: "pending",
          },
        ],
        longTermImprovements: [
          {
            title: isFormRelated ? "Implement Multi-Step Forms" : "Implement A/B Testing Framework",
            description: isFormRelated
              ? "Break long forms into multiple steps to reduce abandonment"
              : "Set up systematic testing for continuous optimization",
            difficulty: "hard",
            status: "pending",
          },
          {
            title: isFormRelated ? "Add Form Analytics" : "Redesign User Flow",
            description: isFormRelated
              ? "Track form field interactions and abandonment points"
              : "Streamline the conversion path based on user behavior data",
            difficulty: "hard",
            status: "pending",
          },
        ],
      },
      rawAnalysis,
      wastedClickAnalysis: modelSuccess ? wastedClickAnalysis : null,
      modelDrivenProjection, // Include the projection data for debugging
      formContextAnalysis: {
        // NEW: Detailed form context analysis
        ctaType: isFormRelated ? "form-cta" : "non-form-cta",
        formFieldCount: pageContextData.formFieldCount,
        expectedImprovementRange: isFormRelated ? "25-55%" : "15-35%",
        primaryOptimizationFocus: isFormRelated
          ? "Remove form completion distractions and improve field UX"
          : "Eliminate competing conversion paths and strengthen purchase intent",
      },
    }

    console.log("DEBUG ROUTE: Response prepared, returning...")
    return NextResponse.json(response)
  } catch (error) {
    console.error("CRO Analysis error:", error)
    console.log("DEBUG ROUTE: Top-level error occurred:", error instanceof Error ? error.message : "Unknown")
    console.log("DEBUG ROUTE: Top-level error stack:", error instanceof Error ? error.stack : "No stack")
    return NextResponse.json({ error: "Failed to analyze CRO opportunities" }, { status: 500 })
  }
}

// Helper functions with form context awareness
function calculateRevenueImpactWithFormContext(
  baselineRate: number,
  clickPredictions: any[],
  isFormRelated: boolean,
): number {
  const avgMonthlyTraffic = 10000
  const avgOrderValue = isFormRelated ? 200 : 150 // Form CTAs often have higher AOV
  const baseImprovementRate = baselineRate * (isFormRelated ? 0.186 : 0.146)
  const formMultiplier = isFormRelated ? 1.3 : 1.1 // Form optimizations typically see higher impact

  return avgMonthlyTraffic * baseImprovementRate * avgOrderValue * formMultiplier
}

function calculatePriorityScoreWithFormContext(
  clickPredictions: any[],
  baselineRate: number,
  isFormRelated: boolean,
): number {
  const baseScore = Math.min(baselineRate * 1000, 100)
  const riskPenalty = Math.min((clickPredictions?.length || 0) * 2, 50)
  const formBonus = isFormRelated ? 15 : 0 // Form CTAs get priority bonus

  return Math.max(0, Math.min(100, baseScore - riskPenalty + formBonus))
}
