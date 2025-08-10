// Click Prediction Model - Scoring Algorithm

import type { DOMElement, PageContext, ElementFeatures, ScoredElement } from "./types"
import { FEATURE_WEIGHTS, CONSTANTS } from "./constants"
import { FeatureExtractor } from "./features"
import { debugLogCategory } from "@/lib/utils/logger"

export class ElementScorer {
  private featureExtractor: FeatureExtractor

  constructor() {
    this.featureExtractor = new FeatureExtractor()
  }

  /**
   * Score a single DOM element
   */
  scoreElement(element: DOMElement, context: PageContext): ScoredElement {
    // Step 1: Extract features
    const features = this.featureExtractor.extractFeatures(element, context)

    // Step 2: Calculate weighted score
    let score = this.calculateWeightedScore(features)

    // Step 3: Apply visibility multiplier
    score *= element.isVisible ? 1.0 : 0.1

    // Step 4: Apply position multiplier
    score *= element.isAboveFold ? CONSTANTS.ABOVE_FOLD_MULTIPLIER : CONSTANTS.BELOW_FOLD_MULTIPLIER

    // Step 5: Apply element-specific modifiers
    score = this.applyElementModifiers(score, element)

    // Step 6: Ensure minimum score threshold
    score = Math.max(score, CONSTANTS.MIN_SCORE)

    return {
      element,
      features,
      score,
      adjustedScore: score, // Will be modified later by traffic modifiers
      probability: 0, // Will be calculated during distribution
    }
  }

  /**
   * Score multiple elements in batch
   */
  scoreElements(elements: DOMElement[], context: PageContext): ScoredElement[] {
    debugLogCategory("DEBUG SCORER", "scoreElements called with", elements.length, "elements")
    debugLogCategory(
      "DEBUG SCORER", "Sample elements:",
      elements.slice(0, 3).map((el) => ({
        id: el.id,
        tagName: el.tagName,
        text: el.text?.substring(0, 30),
        isVisible: el.isVisible,
        coordinates: el.coordinates,
      })),
    )
    debugLogCategory("DEBUG SCORER", "Context:", {
      url: context.url?.substring(0, 50),
      deviceType: context.deviceType,
      totalImpressions: context.totalImpressions,
    })

    const scoredElements = elements
      .slice(0, CONSTANTS.MAX_ELEMENTS)
      .map((element, index) => {
        const scored = this.scoreElement(element, context)
        debugLogCategory(`DEBUG SCORER`, `Element ${index + 1}/${elements.length} - ${element.id}:`, {
          tagName: element.tagName,
          text: element.text?.substring(0, 20),
          rawScore: scored.score,
          passesMinThreshold: scored.score > CONSTANTS.MIN_SCORE,
          minScoreThreshold: CONSTANTS.MIN_SCORE,
        })
        return scored
      })
      .filter((scored) => {
        const passes = scored.score > CONSTANTS.MIN_SCORE
        if (!passes) {
          debugLogCategory(
            `DEBUG SCORER`, `FILTERED OUT - ${scored.element.id} (score: ${scored.score} <= ${CONSTANTS.MIN_SCORE})`,
          )
        }
        return passes
      })

    debugLogCategory("DEBUG SCORER", "Final results:", {
      inputCount: elements.length,
      scoredCount: scoredElements.length,
      filteredOutCount: elements.length - scoredElements.length,
      minScoreThreshold: CONSTANTS.MIN_SCORE,
    })
    debugLogCategory(
      "DEBUG SCORER", "Surviving elements:",
      scoredElements.map((s) => ({
        id: s.element.id,
        score: s.score,
        tagName: s.element.tagName,
      })),
    )

    return scoredElements
  }

  /**
   * Score form elements with specialized logic
   */
  scoreFormElement(element: DOMElement, context: PageContext): ScoredElement {
    const baseScored = this.scoreElement(element, context)

    // Form-specific adjustments
    const formModifiers = this.calculateFormModifiers(element)

    let adjustedScore = baseScored.score
    for (const [modifier, value] of Object.entries(formModifiers)) {
      adjustedScore *= 1 + (value - 0.5) * 0.4 // ±20% adjustment
    }

    return {
      ...baseScored,
      score: adjustedScore,
      adjustedScore: adjustedScore,
    }
  }

  private calculateWeightedScore(features: ElementFeatures): number {
    let score = 0

    for (const [featureName, featureValue] of Object.entries(features)) {
      const weight = FEATURE_WEIGHTS[featureName as keyof typeof FEATURE_WEIGHTS]
      if (weight !== undefined) {
        score += featureValue * weight
      }
    }

    return score
  }

  private applyElementModifiers(score: number, element: DOMElement): number {
    let modifiedScore = score

    // Form field friction
    if (this.isFormField(element)) {
      modifiedScore *= 0.8
    }

    // Button styling boost
    if (element.hasButtonStyling) {
      modifiedScore *= 1.2
    }

    // Interactive element boost
    if (element.isInteractive) {
      modifiedScore *= 1.1
    }

    return modifiedScore
  }

  private calculateFormModifiers(element: DOMElement): Record<string, number> {
    return {
      fieldComplexity: this.calculateFieldComplexity(element),
      formPosition: element.isAboveFold ? 0.8 : 0.4,
      labelClarity: this.calculateLabelClarity(element),
      validationFeedback: this.hasValidation(element) ? 0.6 : 0.3,
      autoCompletion: element.hasAutocomplete ? 0.8 : 0.2,
    }
  }

  private calculateFieldComplexity(element: DOMElement): number {
    if (!this.isFormField(element)) return 0.5

    let complexity = 0.2 // Base complexity

    // Type-based complexity
    const typeComplexity: Record<string, number> = {
      text: 0.1,
      email: 0.3,
      password: 0.5,
      tel: 0.4,
      number: 0.2,
      date: 0.3,
      select: 0.2,
      textarea: 0.4,
      checkbox: 0.1,
      radio: 0.1,
    }

    complexity += typeComplexity[element.type || "text"] || 0.3

    if (element.required) complexity += 0.2
    if (element.pattern || element.minLength || element.maxLength) complexity += 0.1

    return Math.min(complexity, 1.0)
  }

  private calculateLabelClarity(element: DOMElement): number {
    let clarity = 0

    if (element.label) clarity += 0.5
    if (element.placeholder) clarity += 0.3

    const labelLength = element.label?.length || 0
    if (labelLength > 5 && labelLength < 20) clarity += 0.2

    return Math.min(clarity, 1.0)
  }

  private hasValidation(element: DOMElement): boolean {
    return !!(element.pattern || element.minLength || element.maxLength || element.required)
  }

  private isFormField(element: DOMElement): boolean {
    const formFieldTypes = ["input", "textarea", "select"]
    return formFieldTypes.includes(element.tagName.toLowerCase())
  }
}
