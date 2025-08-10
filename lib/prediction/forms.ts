// Click Prediction Model - Form Analysis Engine

import type { DOMElement, PageContext, FormBottleneckAnalysis } from "./types"
import { CONSTANTS, INDUSTRY_MODIFIERS } from "./constants"

export class FormAnalyzer {
  /**
   * Calculate form bottleneck CTR and identify the problematic field
   */
  calculateFormBottleneckCTR(
    formFields: DOMElement[],
    context: PageContext,
    totalClicks: number,
  ): FormBottleneckAnalysis {
    // Step 1: Calculate completion rates for each field
    const fieldCompletionRates = formFields.map((field) => {
      const complexity = this.calculateFieldComplexity(field)
      const position = field.isAboveFold ? 0.9 : 0.6
      const clarity = this.calculateLabelClarity(field)

      // Base completion rate formula
      const completionRate = Math.max(0.1, 0.9 - complexity * 0.3 - (1 - position) * 0.2 - (1 - clarity) * 0.1)

      return {
        fieldId: field.id || `field-${field.tagName}-${field.type}`,
        completionRate,
        dropoffRate: 1 - completionRate,
      }
    })

    // Step 2: Find bottleneck (lowest completion rate)
    const bottleneck = fieldCompletionRates.reduce((min, current) =>
      current.completionRate < min.completionRate ? current : min,
    )

    // Step 3: Calculate cumulative completion rate
    const cumulativeCompletionRate = fieldCompletionRates.reduce(
      (product, field) => product * field.completionRate,
      1.0,
    )

    // Step 4: Apply industry modifiers (this becomes our final conversion rate)
    const industryAdjustedRate = context.industry
      ? cumulativeCompletionRate * INDUSTRY_MODIFIERS[context.industry].formCompletionRate
      : cumulativeCompletionRate

    return {
      bottleneckCTR: industryAdjustedRate, // Use industry-adjusted rate as final conversion rate
      bottleneckField: bottleneck.fieldId,
      totalClicks: totalClicks * CONSTANTS.FORM_CLICK_ALLOCATION,
      fieldBreakdown: fieldCompletionRates,
      foldSeparation: this.calculateFoldSeparation(formFields),
    }
  }

  /**
   * Analyze form field complexity
   */
  calculateFieldComplexity(field: DOMElement): number {
    let complexity = 0.2 // Base complexity

    // Input type complexity
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

    complexity += typeComplexity[field.type || "text"] || 0.3

    // Required field penalty
    if (field.required) {
      complexity += 0.2
    }

    // Validation complexity
    if (field.pattern || field.minLength || field.maxLength) {
      complexity += 0.1
    }

    return Math.min(complexity, 1.0)
  }

  /**
   * Calculate label clarity score
   */
  calculateLabelClarity(field: DOMElement): number {
    let clarity = 0

    if (field.label) clarity += 0.5
    if (field.placeholder) clarity += 0.3

    const labelLength = field.label?.length || 0
    if (labelLength > 5 && labelLength < 20) clarity += 0.2

    return Math.min(clarity, 1.0)
  }

  /**
   * Calculate fold separation metrics
   */
  calculateFoldSeparation(formFields: DOMElement[]): {
    aboveFold: number
    belowFold: number
  } {
    const aboveFold = formFields.filter((field) => field.isAboveFold).length
    const belowFold = formFields.filter((field) => !field.isAboveFold).length

    return { aboveFold, belowFold }
  }

  /**
   * Predict form abandonment points
   */
  predictAbandonmentPoints(formFields: DOMElement[]): Array<{
    fieldId: string
    abandonmentRate: number
    reasons: string[]
  }> {
    return formFields.map((field) => {
      const complexity = this.calculateFieldComplexity(field)
      const clarity = this.calculateLabelClarity(field)
      const position = field.isAboveFold ? 0.1 : 0.3

      const abandonmentRate = complexity * 0.4 + (1 - clarity) * 0.3 + position * 0.3

      const reasons: string[] = []
      if (complexity > 0.6) reasons.push("High field complexity")
      if (clarity < 0.4) reasons.push("Poor label clarity")
      if (!field.isAboveFold) reasons.push("Below fold position")
      if (field.required && !field.label) reasons.push("Required field without label")

      return {
        fieldId: field.id || `field-${field.tagName}-${field.type}`,
        abandonmentRate,
        reasons,
      }
    })
  }

  /**
   * Calculate form conversion funnel
   */
  calculateConversionFunnel(
    formFields: DOMElement[],
    context: PageContext,
  ): {
    stepCompletionRates: number[]
    overallConversionRate: number
    dropoffPoints: Array<{ step: number; dropoffRate: number }>
  } {
    const stepCompletionRates: number[] = []
    const dropoffPoints: Array<{ step: number; dropoffRate: number }> = []

    let cumulativeRate = 1.0

    formFields.forEach((field, index) => {
      const fieldComplexity = this.calculateFieldComplexity(field)
      const stepCompletionRate = Math.max(0.1, 1.0 - fieldComplexity * 0.5)

      stepCompletionRates.push(stepCompletionRate)
      cumulativeRate *= stepCompletionRate

      const dropoffRate = 1 - stepCompletionRate
      if (dropoffRate > 0.3) {
        // Significant dropoff
        dropoffPoints.push({ step: index + 1, dropoffRate })
      }
    })

    return {
      stepCompletionRates,
      overallConversionRate: cumulativeRate,
      dropoffPoints,
    }
  }

  /**
   * Generate form optimization recommendations
   */
  generateFormOptimizations(formFields: DOMElement[]): Array<{
    fieldId: string
    recommendations: string[]
    priority: "high" | "medium" | "low"
  }> {
    return formFields.map((field) => {
      const recommendations: string[] = []
      let priority: "high" | "medium" | "low" = "low"

      const complexity = this.calculateFieldComplexity(field)
      const clarity = this.calculateLabelClarity(field)

      if (complexity > 0.6) {
        recommendations.push("Simplify field requirements")
        priority = "high"
      }

      if (clarity < 0.4) {
        recommendations.push("Add clear field labels")
        if (priority !== "high") priority = "medium"
      }

      if (!field.isAboveFold) {
        recommendations.push("Move field above the fold")
        if (priority === "low") priority = "medium"
      }

      if (field.required && !field.label) {
        recommendations.push("Add label to required field")
        priority = "high"
      }

      if (!field.hasAutocomplete && (field.type === "email" || field.type === "tel")) {
        recommendations.push("Enable autocomplete for better UX")
        if (priority === "low") priority = "medium"
      }

      return {
        fieldId: field.id || `field-${field.tagName}-${field.type}`,
        recommendations,
        priority,
      }
    })
  }
}
