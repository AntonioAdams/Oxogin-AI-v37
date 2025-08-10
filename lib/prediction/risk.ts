// Click Prediction Model - Risk Assessment Framework

import type { DOMElement, PageContext } from "./types"

export class RiskAssessment {
  /**
   * Generate risk factors for an element
   */
  generateRiskFactors(element: DOMElement, context: PageContext): string[] {
    const risks: string[] = []

    // Visibility risks
    if (!element.isVisible) {
      risks.push("Element is not visible")
    }

    if (!element.isAboveFold) {
      risks.push("Element is below the fold")
    }

    // Interactivity risks
    if (!element.isInteractive) {
      risks.push("Element is not interactive")
    }

    if (!element.hasButtonStyling && element.isInteractive) {
      risks.push("Poor visual affordance")
    }

    // Content risks
    if (!element.text || element.text.length < 3) {
      risks.push("Insufficient text content")
    }

    if (element.text && element.text.length > 50) {
      risks.push("Text content may be too long")
    }

    // Form-specific risks
    if (this.isFormField(element)) {
      if (element.required && !element.label) {
        risks.push("Required field without clear label")
      }

      if (element.type === "password" && !context.hasSSL) {
        risks.push("Password field without SSL")
      }

      if (this.isComplexField(element)) {
        risks.push("Complex field may cause abandonment")
      }
    }

    // Performance risks
    if (context.loadTime > 5.0) {
      risks.push("Slow page load time may affect engagement")
    }

    // Traffic source risks
    if (context.trafficSource === "social") {
      risks.push("Social traffic typically has lower engagement")
    }

    if (context.trafficSource === "paid" && context.adMessageMatch < 0.5) {
      risks.push("Poor ad-to-page message match")
    }

    // Device-specific risks
    if (context.deviceType === "mobile") {
      if (element.coordinates.width < 44 || element.coordinates.height < 44) {
        risks.push("Touch target too small for mobile")
      }
    }

    // Position risks
    if (element.distanceFromTop > 2000) {
      risks.push("Element requires significant scrolling")
    }

    // Link-specific risks
    if (element.href === "#" || element.href === "javascript:void(0)") {
      risks.push("Non-functional link")
    }

    // Credibility risks
    if (!context.hasSSL) {
      risks.push("Page lacks SSL security")
    }

    if (!context.hasTrustBadges && this.isConversionElement(element)) {
      risks.push("Lack of trust signals for conversion element")
    }

    return risks.slice(0, 5) // Limit to top 5 risks
  }

  /**
   * Calculate confidence level for predictions
   */
  calculateConfidenceLevel(element: DOMElement, score: number, context: PageContext): "high" | "medium" | "low" {
    let confidenceScore = 0

    // Score-based confidence
    if (score > 0.7) confidenceScore += 0.4
    else if (score > 0.4) confidenceScore += 0.2

    // Element type confidence
    if (element.isInteractive) confidenceScore += 0.3
    if (element.hasButtonStyling) confidenceScore += 0.2

    // Visibility confidence
    if (element.isVisible && element.isAboveFold) confidenceScore += 0.3

    // Data quality confidence
    if (context.totalImpressions > 1000) confidenceScore += 0.1
    if (context.trafficSource !== "unknown") confidenceScore += 0.1

    // Content quality confidence
    if (element.text && element.text.length > 5 && element.text.length < 30) {
      confidenceScore += 0.1
    }

    // Technical confidence
    if (context.hasSSL) confidenceScore += 0.05
    if (context.loadTime < 3.0) confidenceScore += 0.05

    // Industry-specific confidence
    if (context.industry) confidenceScore += 0.1

    // Penalties
    const riskCount = this.generateRiskFactors(element, context).length
    confidenceScore -= riskCount * 0.05

    if (confidenceScore >= 0.7) return "high"
    if (confidenceScore >= 0.4) return "medium"
    return "low"
  }

  /**
   * Assess prediction reliability
   */
  assessPredictionReliability(
    elements: Array<{ element: DOMElement; score: number }>,
    context: PageContext,
  ): {
    overallReliability: "high" | "medium" | "low"
    reliabilityScore: number
    reliabilityFactors: string[]
  } {
    let reliabilityScore = 0.5 // Base reliability
    const factors: string[] = []

    // Data volume factor
    if (context.totalImpressions > 10000) {
      reliabilityScore += 0.2
      factors.push("High impression volume")
    } else if (context.totalImpressions < 100) {
      reliabilityScore -= 0.2
      factors.push("Low impression volume")
    }

    // Element quality factor
    const interactiveElements = elements.filter((e) => e.element.isInteractive).length
    const totalElements = elements.length
    const interactiveRatio = totalElements > 0 ? interactiveElements / totalElements : 0

    if (interactiveRatio > 0.7) {
      reliabilityScore += 0.15
      factors.push("High proportion of interactive elements")
    } else if (interactiveRatio < 0.3) {
      reliabilityScore -= 0.15
      factors.push("Low proportion of interactive elements")
    }

    // Score distribution factor
    const scores = elements.map((e) => e.score)
    const scoreVariance = this.calculateVariance(scores)

    if (scoreVariance > 0.1) {
      reliabilityScore += 0.1
      factors.push("Good score differentiation")
    } else {
      reliabilityScore -= 0.1
      factors.push("Poor score differentiation")
    }

    // Traffic source reliability
    const trafficReliability: Record<string, number> = {
      organic: 0.1,
      paid: 0.15,
      email: 0.1,
      direct: 0.05,
      social: -0.05,
      referral: 0.0,
      unknown: -0.1,
    }

    reliabilityScore += trafficReliability[context.trafficSource] || 0

    // Technical factors
    if (context.loadTime < 3.0) {
      reliabilityScore += 0.05
      factors.push("Fast page load time")
    } else if (context.loadTime > 5.0) {
      reliabilityScore -= 0.1
      factors.push("Slow page load time")
    }

    if (context.hasSSL) {
      reliabilityScore += 0.05
      factors.push("SSL security present")
    }

    // Clamp reliability score
    reliabilityScore = Math.max(0, Math.min(1, reliabilityScore))

    let overallReliability: "high" | "medium" | "low"
    if (reliabilityScore >= 0.7) overallReliability = "high"
    else if (reliabilityScore >= 0.4) overallReliability = "medium"
    else overallReliability = "low"

    return {
      overallReliability,
      reliabilityScore,
      reliabilityFactors: factors,
    }
  }

  /**
   * Generate prediction warnings
   */
  generatePredictionWarnings(elements: Array<{ element: DOMElement; score: number }>, context: PageContext): string[] {
    const warnings: string[] = []

    // Low data volume warning
    if (context.totalImpressions < 1000) {
      warnings.push("Low impression volume may affect prediction accuracy")
    }

    // High bounce rate warning
    if (context.trafficSource === "social" || context.trafficSource === "paid") {
      warnings.push("Traffic source typically has higher bounce rates")
    }

    // Performance warning
    if (context.loadTime > 5.0) {
      warnings.push("Slow page load may significantly impact actual performance")
    }

    // Mobile optimization warning
    if (context.deviceType === "mobile") {
      const smallElements = elements.filter(
        (e) => e.element.coordinates.width < 44 || e.element.coordinates.height < 44,
      ).length

      if (smallElements > 0) {
        warnings.push(`${smallElements} elements may be too small for mobile interaction`)
      }
    }

    // Content quality warning
    const poorContentElements = elements.filter((e) => !e.element.text || e.element.text.length < 3).length

    if (poorContentElements > elements.length * 0.3) {
      warnings.push("Many elements lack sufficient text content")
    }

    // Interactivity warning
    const nonInteractiveElements = elements.filter((e) => !e.element.isInteractive).length
    if (nonInteractiveElements > elements.length * 0.5) {
      warnings.push("High proportion of non-interactive elements detected")
    }

    return warnings.slice(0, 3) // Limit to top 3 warnings
  }

  // Helper methods
  private isFormField(element: DOMElement): boolean {
    const formFieldTypes = ["input", "textarea", "select"]
    return formFieldTypes.includes(element.tagName.toLowerCase())
  }

  private isComplexField(element: DOMElement): boolean {
    return (
      element.type === "password" ||
      element.type === "email" ||
      element.required ||
      !!(element.pattern || element.minLength || element.maxLength)
    )
  }

  private isConversionElement(element: DOMElement): boolean {
    if (!element.text) return false
    const conversionKeywords = ["buy", "purchase", "sign up", "subscribe", "download", "get started"]
    const lowerText = element.text.toLowerCase()
    return conversionKeywords.some((keyword) => lowerText.includes(keyword))
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0

    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length
    const squaredDiffs = numbers.map((num) => Math.pow(num - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length
  }
}
