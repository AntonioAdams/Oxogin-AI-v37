// Click Prediction Model - Main Prediction Engine

import type { DOMElement, PageContext, ClickPredictionResult, FormBottleneckAnalysis } from "./types"
import { ElementScorer } from "./scoring"
import { ClickDistributor } from "./distribution"
import { FormAnalyzer } from "./forms"
import { RiskAssessment } from "./risk"
import { CONSTANTS } from "./constants"
import { CPCEstimator } from "./cpc-estimator"
import { WastedClickModelV53 } from "./wasted-click-model-v5-3"
import { debugLogCategory } from "@/lib/utils/logger"

export class ClickPredictionEngine {
  private elementScorer: ElementScorer
  private clickDistributor: ClickDistributor
  private formAnalyzer: FormAnalyzer
  private riskAssessment: RiskAssessment

  constructor() {
    debugLogCategory("DEBUG ENGINE", "Constructor called - initializing components")
    try {
      this.elementScorer = new ElementScorer()
      debugLogCategory("DEBUG ENGINE", "ElementScorer initialized")
      this.clickDistributor = new ClickDistributor()
      debugLogCategory("DEBUG ENGINE", "ClickDistributor initialized")
      this.formAnalyzer = new FormAnalyzer()
      debugLogCategory("DEBUG ENGINE", "FormAnalyzer initialized")
      this.riskAssessment = new RiskAssessment()
      debugLogCategory("DEBUG ENGINE", "RiskAssessment initialized")
      debugLogCategory("DEBUG ENGINE", "Constructor completed successfully")
    } catch (error) {
      debugLogCategory("DEBUG ENGINE", "Constructor FAILED:", error)
      throw error
    }
  }

  /**
   * Main prediction method - analyzes all elements and returns click predictions
   */
  async predictClicks(
    elements: DOMElement[],
    context: PageContext,
  ): Promise<{
    predictions: ClickPredictionResult[]
    formAnalysis?: FormBottleneckAnalysis
    wastedClickAnalysis?: any // NEW: Add wasted click analysis
    reliability: {
      overallReliability: "high" | "medium" | "low"
      reliabilityScore: number
      reliabilityFactors: string[]
    }
    warnings: string[]
    metadata: {
      totalElements: number
      interactiveElements: number
      formFields: number
      processingTime: number
      estimatedCPC: number
      cpcBreakdown?: any
    }
  }> {
    debugLogCategory("DEBUG ENGINE", "predictClicks method started")
    debugLogCategory("DEBUG ENGINE", "Input elements count:", elements.length)
    debugLogCategory("DEBUG ENGINE", "Input context:", { url: context.url, deviceType: context.deviceType })

    try {
      const startTime = Date.now()

      debugLogCategory("DEBUG ENGINE", "Step 0 - Starting CPC estimation")
      // Step 0: Enhance context with sophisticated CPC estimation
      let enhancedContext, cpcEstimation
      try {
        enhancedContext = CPCEstimator.estimateContext(context)
        debugLogCategory("DEBUG ENGINE", "Context estimated successfully")
        cpcEstimation = CPCEstimator.calculateEstimatedCPC(enhancedContext)
        debugLogCategory("DEBUG ENGINE", "CPC estimation completed")
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "CPC estimation FAILED:", error)
        throw error
      }

      debugLogCategory("DEBUG ENGINE", "Step 1 - Starting element filtering")
      // Step 1: Filter and validate elements
      let validElements
      try {
        validElements = this.filterValidElements(elements)
        debugLogCategory("DEBUG ENGINE", "Element filtering completed, valid count:", validElements.length)
        debugLogCategory(
          "DEBUG ENGINE", "Valid elements after filtering:",
          validElements.map((e) => ({ id: e.id, tagName: e.tagName, text: e.text?.substring(0, 50) })),
        )
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "Element filtering FAILED:", error)
        throw error
      }

      debugLogCategory("DEBUG ENGINE", "Step 2 - Starting element classification")
      // Step 2: Classify elements
      let interactiveElements, formFields
      try {
        const classification = this.classifyElements(validElements)
        interactiveElements = classification.interactiveElements
        formFields = classification.formFields
        debugLogCategory("DEBUG ENGINE", "Element classification completed")
        debugLogCategory(
          "DEBUG ENGINE", "Interactive elements:",
          interactiveElements.map((e) => ({ id: e.id, tagName: e.tagName, text: e.text?.substring(0, 50) })),
        )
        debugLogCategory(
          "DEBUG ENGINE", "Form fields:",
          formFields.map((e) => ({ id: e.id, tagName: e.tagName, text: e.text?.substring(0, 50) })),
        )
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "Element classification FAILED:", error)
        throw error
      }

      debugLogCategory("DEBUG ENGINE", "Step 3 - Starting element scoring")
      // Step 3: Score all elements
      let scoredElements
      try {
        scoredElements = this.elementScorer.scoreElements(interactiveElements, enhancedContext)
        debugLogCategory("DEBUG ENGINE", "Element scoring completed, scored count:", scoredElements.length)
        debugLogCategory(
          "DEBUG ENGINE", "Scored elements:",
          scoredElements.map((se) => ({
            id: se.element.id,
            score: se.score,
            tagName: se.element.tagName,
            text: se.element.text?.substring(0, 50),
          })),
        )
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "Element scoring FAILED:", error)
        throw error
      }

      debugLogCategory("DEBUG ENGINE", "Step 4 - Starting click distribution")
      // Step 4: Distribute clicks
      let predictions
      try {
        predictions = this.clickDistributor.distributeClicks(scoredElements, enhancedContext)
        debugLogCategory("DEBUG ENGINE", "Click distribution completed, predictions count:", predictions.length)
        debugLogCategory(
          "DEBUG ENGINE", "Initial predictions:",
          predictions.map((p) => ({ elementId: p.elementId, predictedClicks: p.predictedClicks, ctr: p.ctr })),
        )
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "Click distribution FAILED:", error)
        throw error
      }

      debugLogCategory("DEBUG ENGINE", "Step 5 - Starting advanced distribution")
      // Step 5: Apply advanced distribution strategies
      try {
        predictions = this.clickDistributor.applyAdvancedDistribution(predictions, enhancedContext)
        debugLogCategory("DEBUG ENGINE", "Advanced distribution completed")
        debugLogCategory(
          "DEBUG ENGINE", "Advanced distribution predictions:",
          predictions.map((p) => ({ elementId: p.elementId, predictedClicks: p.predictedClicks, ctr: p.ctr })),
        )
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "Advanced distribution FAILED:", error)
        throw error
      }

      debugLogCategory("DEBUG ENGINE", "Step 6 - Starting form analysis")
      // Step 6: Analyze forms if present
      let formAnalysis: FormBottleneckAnalysis | undefined
      try {
        if (formFields.length > 0) {
          const totalClicks = predictions.reduce((sum, p) => sum + p.predictedClicks, 0)
          formAnalysis = this.formAnalyzer.calculateFormBottleneckCTR(formFields, enhancedContext, totalClicks)
          debugLogCategory("DEBUG ENGINE", "Form analysis completed")

          // Update form-related predictions
          predictions = this.updateFormPredictions(predictions, formAnalysis, formFields)
          debugLogCategory("DEBUG ENGINE", "Form predictions updated")
        } else {
          debugLogCategory("DEBUG ENGINE", "No form fields to analyze")
        }
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "Form analysis FAILED:", error)
        throw error
      }

      // NEW: Step 6.5 - Wasted Click Analysis using v5.3 Model
      debugLogCategory("DEBUG ENGINE", "Step 6.5 - Starting Wasted Click Analysis v5.3")
      let wastedClickAnalysis
      try {
        // Find primary CTA (highest predicted clicks)
        const primaryCTA = predictions.reduce((max, current) =>
          current.predictedClicks > max.predictedClicks ? current : max,
        )

        const primaryCTAElement = validElements.find((el) => el.id === primaryCTA.elementId)

        if (primaryCTAElement) {
          const wastedClickModel = new WastedClickModelV53(enhancedContext)
          wastedClickAnalysis = wastedClickModel.analyzeWastedClicks(validElements, primaryCTAElement, predictions)

          debugLogCategory("DEBUG ENGINE", "Wasted Click Analysis v5.3 completed:", {
            totalWastedElements: wastedClickAnalysis.totalWastedElements,
            averageWastedScore: wastedClickAnalysis.averageWastedScore,
            highRiskElements: wastedClickAnalysis.highRiskElements.length,
          })

          // Update predictions with wasted click data from v5.3 model
          predictions = this.updatePredictionsWithWastedClickData(
            predictions,
            wastedClickAnalysis,
            cpcEstimation.estimatedCPC,
          )
        }
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "Wasted Click Analysis v5.3 FAILED:", error)
        // Continue without wasted click analysis
      }

      debugLogCategory("DEBUG ENGINE", "Step 7 - Starting reliability assessment")
      // Step 7: Assess reliability
      let reliability
      try {
        reliability = this.riskAssessment.assessPredictionReliability(
          scoredElements.map((se) => ({ element: se.element, score: se.score })),
          enhancedContext,
        )
        debugLogCategory("DEBUG ENGINE", "Reliability assessment completed")
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "Reliability assessment FAILED:", error)
        throw error
      }

      debugLogCategory("DEBUG ENGINE", "Step 8 - Starting warning generation")
      // Step 8: Generate warnings
      let warnings
      try {
        warnings = this.riskAssessment.generatePredictionWarnings(
          scoredElements.map((se) => ({ element: se.element, score: se.score })),
          enhancedContext,
        )
        debugLogCategory("DEBUG ENGINE", "Warning generation completed")
      } catch (error) {
        debugLogCategory("DEBUG ENGINE", "Warning generation FAILED:", error)
        throw error
      }

      // ENHANCED: Ensure all predictions include human-readable text and element information
      debugLogCategory("DEBUG ENGINE", "Step 9 - Enhancing predictions with text labels")
      const enhancedPredictions = predictions.map((prediction) => {
        // Find the original element to get text and other properties
        const originalElement = validElements.find((el) => el.id === prediction.elementId)

        return {
          ...prediction,
          // Preserve human-readable text and element information
          text: originalElement?.text || prediction.elementId,
          elementType: originalElement?.tagName || "unknown",
          tagName: originalElement?.tagName,
          coordinates: originalElement?.coordinates,
        }
      })

      const processingTime = Date.now() - startTime
      debugLogCategory("DEBUG ENGINE", "Processing completed in", processingTime, "ms")
      debugLogCategory(
        "DEBUG ENGINE", "Final enhanced predictions being returned:",
        enhancedPredictions.map((p) => ({
          elementId: p.elementId,
          text: p.text,
          elementType: p.elementType,
          predictedClicks: p.predictedClicks,
          ctr: p.ctr,
          confidence: p.confidence,
          wastedClicks: p.wastedClicks,
          wastedSpend: p.wastedSpend,
        })),
      )

      const result = {
        predictions: enhancedPredictions.sort((a, b) => b.predictedClicks - a.predictedClicks),
        formAnalysis,
        wastedClickAnalysis, // NEW: Include wasted click analysis
        reliability,
        warnings,
        metadata: {
          totalElements: validElements.length,
          interactiveElements: interactiveElements.length,
          formFields: formFields.length,
          processingTime,
          estimatedCPC: cpcEstimation.estimatedCPC,
          cpcBreakdown: cpcEstimation.breakdown,
        },
      }

      debugLogCategory("DEBUG ENGINE", "Result object created, returning...")
      return result
    } catch (error) {
      debugLogCategory("DEBUG ENGINE", "predictClicks method FAILED with error:", error)
      debugLogCategory("DEBUG ENGINE", "Error message:", error instanceof Error ? error.message : "Unknown error")
      debugLogCategory("DEBUG ENGINE", "Error stack:", error instanceof Error ? error.stack : "No stack trace")
      throw error
    }
  }

  /**
   * NEW: Update predictions with wasted click data from v5.3 model
   */
  private updatePredictionsWithWastedClickData(
    predictions: ClickPredictionResult[],
    wastedClickAnalysis: any,
    estimatedCPC: number,
  ): ClickPredictionResult[] {
    return predictions.map((prediction) => {
      // Calculate total wasted clicks from high-risk elements
      const totalWastedClicks = wastedClickAnalysis.highRiskElements.reduce(
        (sum: number, element: any) => sum + Math.round(element.wastedClickScore * 100),
        0,
      )

      // Calculate wasted spend using actual estimated CPC
      const wastedSpend = totalWastedClicks * estimatedCPC

      return {
        ...prediction,
        wastedClicks: totalWastedClicks,
        wastedSpend: wastedSpend,
        wasteBreakdown: {
          totalWastedElements: wastedClickAnalysis.totalWastedElements,
          averageWastedScore: wastedClickAnalysis.averageWastedScore,
          highRiskElementsCount: wastedClickAnalysis.highRiskElements.length,
          projectedImprovements: wastedClickAnalysis.projectedImprovements,
        },
      }
    })
  }

  /**
   * Quick prediction for single element
   */
  predictSingleElement(element: DOMElement, context: PageContext): ClickPredictionResult {
    const scoredElement = this.elementScorer.scoreElement(element, context)
    const predictions = this.clickDistributor.distributeClicks([scoredElement], context)

    // Enhance single prediction with text information
    const prediction = predictions[0]
    return {
      ...prediction,
      text: element.text || prediction.elementId,
      elementType: element.tagName || "unknown",
      tagName: element.tagName,
      coordinates: element.coordinates,
    }
  }

  /**
   * Batch prediction for multiple pages
   */
  async predictBatch(batch: Array<{ elements: DOMElement[]; context: PageContext }>): Promise<
    Array<{
      predictions: ClickPredictionResult[]
      formAnalysis?: FormBottleneckAnalysis
      wastedClickAnalysis?: any
      reliability: any
      warnings: string[]
    }>
  > {
    const results = []

    for (const { elements, context } of batch) {
      try {
        const result = await this.predictClicks(elements, context)
        results.push(result)
      } catch (error) {
        console.error("Batch prediction error:", error)
        results.push({
          predictions: [],
          reliability: { overallReliability: "low" as const, reliabilityScore: 0, reliabilityFactors: [] },
          warnings: ["Prediction failed due to processing error"],
        })
      }
    }

    return results
  }

  // Private helper methods
  private filterValidElements(elements: DOMElement[]): DOMElement[] {
    debugLogCategory("DEBUG ENGINE", "filterValidElements called with", elements.length, "elements")
    try {
      const filtered = elements
        .filter((element) => {
          // Basic validation
          if (!element.coordinates) return false
          if (element.coordinates.width <= 0 || element.coordinates.height <= 0) return false

          // Keep all visible form fields regardless of interactive status
          if (this.isFormField(element) && element.isVisible) return true

          // Skip hidden elements unless they have special significance
          if (!element.isVisible && !element.isInteractive) return false

          return true
        })
        .slice(0, CONSTANTS.MAX_ELEMENTS) // Limit total elements

      debugLogCategory("DEBUG ENGINE", "filterValidElements returning", filtered.length, "elements")
      return filtered
    } catch (error) {
      debugLogCategory("DEBUG ENGINE", "filterValidElements FAILED:", error)
      throw error
    }
  }

  private classifyElements(elements: DOMElement[]): {
    interactiveElements: DOMElement[]
    formFields: DOMElement[]
    nonInteractiveElements: DOMElement[]
  } {
    debugLogCategory("DEBUG ENGINE", "classifyElements called with", elements.length, "elements")
    try {
      const interactiveElements: DOMElement[] = []
      const formFields: DOMElement[] = []
      const nonInteractiveElements: DOMElement[] = []

      for (const element of elements) {
        if (this.isFormField(element)) {
          formFields.push(element)
          // Also include form fields in interactive elements for scoring
          interactiveElements.push(element)
        } else if (element.isInteractive) {
          interactiveElements.push(element)
        } else {
          nonInteractiveElements.push(element)
        }
      }

      debugLogCategory("DEBUG ENGINE", "classifyElements completed:", {
        interactive: interactiveElements.length,
        formFields: formFields.length,
        nonInteractive: nonInteractiveElements.length,
      })

      return {
        interactiveElements,
        formFields: formFields.slice(0, CONSTANTS.MAX_FORM_FIELDS),
        nonInteractiveElements,
      }
    } catch (error) {
      debugLogCategory("DEBUG ENGINE", "classifyElements FAILED:", error)
      throw error
    }
  }

  private updateFormPredictions(
    predictions: ClickPredictionResult[],
    formAnalysis: FormBottleneckAnalysis,
    formFields: DOMElement[],
  ): ClickPredictionResult[] {
    return predictions.map((prediction) => {
      // Check if this prediction is for a form element
      const isFormElement = formFields.some(
        (field) => field.id === prediction.elementId || prediction.elementId.includes("form"),
      )

      if (isFormElement) {
        return {
          ...prediction,
          formCompletionRate: formAnalysis.bottleneckCTR,
          leadCount: Math.round(prediction.predictedClicks * formAnalysis.bottleneckCTR),
          bottleneckField: formAnalysis.bottleneckField,
        }
      }

      return prediction
    })
  }

  private isFormField(element: DOMElement): boolean {
    const formFieldTypes = ["input", "textarea", "select"]
    return formFieldTypes.includes(element.tagName.toLowerCase())
  }

  /**
   * Generate comprehensive analytics report
   */
  generateAnalyticsReport(
    predictions: ClickPredictionResult[],
    context: PageContext,
  ): {
    summary: {
      totalPredictedClicks: number
      averageCTR: number
      topPerformingElement: string
      totalWastedSpend: number
    }
    distribution: {
      aboveFoldClicks: number
      belowFoldClicks: number
      interactiveClicks: number
      formClicks: number
    }
    recommendations: string[]
  } {
    const totalPredictedClicks = predictions.reduce((sum, p) => sum + p.predictedClicks, 0)
    const averageCTR = predictions.reduce((sum, p) => sum + p.ctr, 0) / predictions.length
    const topPerforming = predictions.reduce((top, current) =>
      current.predictedClicks > top.predictedClicks ? current : top,
    )
    const totalWastedSpend = predictions.reduce((sum, p) => sum + p.wastedSpend, 0)

    // Generate recommendations
    const recommendations: string[] = []

    if (averageCTR < 1.0) {
      recommendations.push("Overall CTR is low - consider improving element visibility and messaging")
    }

    if (totalWastedSpend > totalPredictedClicks * 0.5) {
      recommendations.push("High wasted spend detected - optimize non-performing elements")
    }

    const lowConfidencePredictions = predictions.filter((p) => p.confidence === "low").length
    if (lowConfidencePredictions > predictions.length * 0.3) {
      recommendations.push("Many predictions have low confidence - consider gathering more data")
    }

    return {
      summary: {
        totalPredictedClicks,
        averageCTR,
        topPerformingElement: topPerforming.text || topPerforming.elementId,
        totalWastedSpend,
      },
      distribution: {
        aboveFoldClicks: 0, // Would be calculated based on element positions
        belowFoldClicks: 0,
        interactiveClicks: 0,
        formClicks: 0,
      },
      recommendations,
    }
  }
}

// Export singleton instance
export const clickPredictionEngine = new ClickPredictionEngine()
