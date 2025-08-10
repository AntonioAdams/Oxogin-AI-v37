// Click Prediction Model - Feature Extraction System

import type { DOMElement, PageContext, ElementFeatures } from "./types"
import { HIGH_INTENT_KEYWORDS, URGENCY_KEYWORDS, FIELD_TYPE_COMPLEXITY } from "./constants"

export class FeatureExtractor {
  /**
   * Extract all features for a DOM element
   */
  extractFeatures(element: DOMElement, context: PageContext): ElementFeatures {
    return {
      // Core interaction features
      visibilityScore: this.calculateVisibilityScore(element),
      informationScent: this.calculateInformationScent(element),
      frictionScore: this.calculateFrictionScore(element),
      interactivityScore: this.calculateInteractivityScore(element),
      heatmapAttention: this.calculateHeatmapAttention(element, context),

      // Content and credibility
      credibilityScore: this.calculateCredibilityScore(element, context),
      contentDepthScore: this.calculateContentDepthScore(element),
      intentScore: this.calculateIntentScore(element),
      visualAffordanceScore: this.calculateVisualAffordanceScore(element),
      scrollDepthScore: this.calculateScrollDepthScore(element, context),

      // Performance and technical
      performanceScore: this.calculatePerformanceScore(context),
      trustBoost: this.calculateTrustBoost(element, context),
      segmentModifier: this.calculateSegmentModifier(element, context),
      socialProofBoost: this.calculateSocialProofBoost(element, context),
      progressIndication: this.calculateProgressIndication(element),

      // Enhancement factors
      dynamicContentBoost: this.calculateDynamicContentBoost(element),
      urgencyBoost: this.calculateUrgencyBoost(element),
      autoCompletion: this.calculateAutoCompletion(element),
      fieldGrouping: this.calculateFieldGrouping(element),

      // Minor factors
      emotionalColorBoost: this.calculateEmotionalColorBoost(element),
      crossDevicePriming: this.calculateCrossDevicePriming(element, context),

      // Penalty factors
      deadClickRisk: this.calculateDeadClickRisk(element),
      cognitiveLoadPenalty: this.calculateCognitiveLoadPenalty(context),
      fieldComplexity: this.calculateFieldComplexity(element),
    }
  }

  // Core interaction features
  private calculateVisibilityScore(element: DOMElement): number {
    if (!element.isVisible) return 0.0
    return element.isAboveFold ? 0.8 : 0.4
  }

  private calculateInformationScent(element: DOMElement): number {
    const textLength = element.text?.length || 0
    const hasActionWords = this.hasActionWords(element.text)

    return Math.min((textLength / 50) * 0.7 + (hasActionWords ? 0.3 : 0.0), 1.0)
  }

  private calculateFrictionScore(element: DOMElement): number {
    let baseScore = 0.8

    // Form field penalty
    if (this.isFormField(element)) {
      baseScore -= 0.2
    }

    // Required input penalty
    if (element.required) {
      baseScore -= 0.15
    }

    // Complex action penalty
    if (this.hasComplexAction(element)) {
      baseScore -= 0.1
    }

    return Math.max(baseScore, 0.0)
  }

  private calculateInteractivityScore(element: DOMElement): number {
    if (!element.isInteractive) return 0.2
    return element.hasButtonStyling ? 0.8 : 0.6
  }

  private calculateHeatmapAttention(element: DOMElement, context: PageContext): number {
    if (element.isAboveFold) {
      return Math.max(0.3, 1.0 - element.distanceFromTop / 1000)
    } else {
      return Math.max(0.1, 0.5 - element.distanceFromTop / 2000)
    }
  }

  // Content and credibility features
  private calculateCredibilityScore(element: DOMElement, context: PageContext): number {
    let score = 0

    if (context.hasSSL) score += 0.2
    if (context.hasTrustBadges) score += 0.3
    if (context.hasTestimonials) score += 0.2
    score += context.brandRecognition * 0.3

    return Math.min(score, 1.0)
  }

  private calculateContentDepthScore(element: DOMElement): number {
    const textLength = element.text?.length || 0
    return Math.min(textLength / 100, 1.0)
  }

  private calculateIntentScore(element: DOMElement): number {
    let score = 0

    if (this.hasHighIntentKeywords(element.text)) {
      score += 0.4
    }

    if (this.isCallToAction(element)) {
      score += 0.6
    }

    return Math.min(score, 1.0)
  }

  private calculateVisualAffordanceScore(element: DOMElement): number {
    let score = 0

    if (element.hasButtonStyling) score += 0.4
    if (this.hasHoverEffects(element)) score += 0.2
    if (this.hasClickCursor(element)) score += 0.2
    if (this.hasVisualCues(element)) score += 0.2

    return Math.min(score, 1.0)
  }

  private calculateScrollDepthScore(element: DOMElement, context: PageContext): number {
    if (element.isAboveFold) return 1.0
    return Math.max(0.2, 1.0 - element.distanceFromTop / 3000)
  }

  // Performance and technical features
  private calculatePerformanceScore(context: PageContext): number {
    return Math.max(0, 1.0 - (context.loadTime - 2.0) / 10.0)
  }

  private calculateTrustBoost(element: DOMElement, context: PageContext): number {
    let boost = 1.0

    if (this.hasSecurityBadges(element)) boost *= 1.2
    if (this.hasGuarantee(element)) boost *= 1.15
    if (this.hasContactInfo(element)) boost *= 1.1

    return boost
  }

  private calculateSegmentModifier(element: DOMElement, context: PageContext): number {
    // Simplified segment matching
    const isTargetAudience = true // Would be determined by actual targeting logic
    const matchesPersona = true // Would be determined by persona matching

    return (isTargetAudience ? 1.2 : 0.8) * (matchesPersona ? 1.1 : 0.9)
  }

  private calculateSocialProofBoost(element: DOMElement, context: PageContext): number {
    let boost = 1.0

    if (this.hasReviews(element)) boost *= 1.2
    if (this.hasUserCount(element)) boost *= 1.1
    if (this.hasSocialSharing(element)) boost *= 1.05

    return boost
  }

  private calculateProgressIndication(element: DOMElement): number {
    let score = 0

    if (this.hasProgressBar(element)) score += 0.5
    if (this.hasStepIndicator(element)) score += 0.5

    return Math.min(score, 1.0)
  }

  // Enhancement factors
  private calculateDynamicContentBoost(element: DOMElement): number {
    let boost = 1.0

    if (this.isPersonalized(element)) boost *= 1.3
    if (this.isTimeSensitive(element)) boost *= 1.2

    return boost
  }

  private calculateUrgencyBoost(element: DOMElement): number {
    let boost = 1.0

    if (this.hasUrgencyWords(element.text)) boost *= 1.3
    if (this.hasCountdown(element)) boost *= 1.4
    if (this.hasLimitedTime(element)) boost *= 1.2

    return boost
  }

  private calculateAutoCompletion(element: DOMElement): number {
    return element.hasAutocomplete ? 0.8 : 0.2
  }

  private calculateFieldGrouping(element: DOMElement): number {
    return this.isGrouped(element) ? 0.7 : 0.3
  }

  // Minor factors
  private calculateEmotionalColorBoost(element: DOMElement): number {
    let boost = 1.0

    if (this.hasRedColor(element)) boost *= 1.1
    if (this.hasOrangeColor(element)) boost *= 1.05
    if (this.hasGreenColor(element)) boost *= 1.03

    return boost
  }

  private calculateCrossDevicePriming(element: DOMElement, context: PageContext): number {
    let boost = 1.0

    if (this.isMobileOptimized(element, context)) boost *= 1.1
    if (this.isResponsive(element)) boost *= 1.05

    return boost
  }

  // Penalty factors
  private calculateDeadClickRisk(element: DOMElement): number {
    let risk = 0

    if (!element.isInteractive) risk += 0.7
    if (this.isBrokenLink(element)) risk += 0.3

    return risk
  }

  private calculateCognitiveLoadPenalty(context: PageContext): number {
    return Math.max(0.5, 1.0 - context.pageComplexity / 100)
  }

  private calculateFieldComplexity(element: DOMElement): number {
    if (!this.isFormField(element)) return 0

    let complexity = 0.2 // Base complexity

    // Input type complexity
    const typeComplexity = FIELD_TYPE_COMPLEXITY[element.type as keyof typeof FIELD_TYPE_COMPLEXITY] || 0.3
    complexity += typeComplexity

    // Required field penalty
    if (element.required) {
      complexity += 0.2
    }

    // Validation complexity
    if (element.pattern || element.minLength || element.maxLength) {
      complexity += 0.1
    }

    return Math.min(complexity, 1.0)
  }

  // Helper methods
  private hasActionWords(text: string): boolean {
    if (!text) return false
    const lowerText = text.toLowerCase()
    return HIGH_INTENT_KEYWORDS.some((keyword) => lowerText.includes(keyword))
  }

  private isFormField(element: DOMElement): boolean {
    const formFieldTypes = ["input", "textarea", "select"]
    return formFieldTypes.includes(element.tagName.toLowerCase())
  }

  private hasComplexAction(element: DOMElement): boolean {
    // Simplified logic - would be more sophisticated in practice
    return element.formAction !== null || element.type === "submit"
  }

  private hasHighIntentKeywords(text: string): boolean {
    if (!text) return false
    const lowerText = text.toLowerCase()
    return HIGH_INTENT_KEYWORDS.some((keyword) => lowerText.includes(keyword))
  }

  private isCallToAction(element: DOMElement): boolean {
    if (!element.text) return false
    const lowerText = element.text.toLowerCase()
    const ctaPatterns = ["get", "start", "try", "buy", "sign up", "download", "learn more"]
    return ctaPatterns.some((pattern) => lowerText.includes(pattern))
  }

  private hasUrgencyWords(text: string): boolean {
    if (!text) return false
    const lowerText = text.toLowerCase()
    return URGENCY_KEYWORDS.some((keyword) => lowerText.includes(keyword))
  }

  // Simplified helper methods (would be more sophisticated in practice)
  private hasHoverEffects(element: DOMElement): boolean {
    return element.className.includes("hover") || element.hasButtonStyling
  }

  private hasClickCursor(element: DOMElement): boolean {
    return element.isInteractive
  }

  private hasVisualCues(element: DOMElement): boolean {
    return element.hasButtonStyling || element.className.includes("cta")
  }

  private hasSecurityBadges(element: DOMElement): boolean {
    return element.text?.toLowerCase().includes("secure") || false
  }

  private hasGuarantee(element: DOMElement): boolean {
    return element.text?.toLowerCase().includes("guarantee") || false
  }

  private hasContactInfo(element: DOMElement): boolean {
    return element.text?.toLowerCase().includes("contact") || false
  }

  private hasReviews(element: DOMElement): boolean {
    return element.text?.toLowerCase().includes("review") || false
  }

  private hasUserCount(element: DOMElement): boolean {
    return /\d+.*users?/i.test(element.text || "")
  }

  private hasSocialSharing(element: DOMElement): boolean {
    return element.className.includes("share") || element.className.includes("social")
  }

  private hasProgressBar(element: DOMElement): boolean {
    return element.className.includes("progress")
  }

  private hasStepIndicator(element: DOMElement): boolean {
    return element.className.includes("step")
  }

  private isPersonalized(element: DOMElement): boolean {
    return element.text?.includes("your") || element.text?.includes("you") || false
  }

  private isTimeSensitive(element: DOMElement): boolean {
    return this.hasUrgencyWords(element.text || "")
  }

  private hasCountdown(element: DOMElement): boolean {
    return element.className.includes("countdown") || /\d+:\d+/.test(element.text || "")
  }

  private hasLimitedTime(element: DOMElement): boolean {
    return element.text?.toLowerCase().includes("limited") || false
  }

  private isGrouped(element: DOMElement): boolean {
    return element.className.includes("group") || element.className.includes("fieldset")
  }

  private hasRedColor(element: DOMElement): boolean {
    return element.className.includes("red") || element.className.includes("danger")
  }

  private hasOrangeColor(element: DOMElement): boolean {
    return element.className.includes("orange") || element.className.includes("warning")
  }

  private hasGreenColor(element: DOMElement): boolean {
    return element.className.includes("green") || element.className.includes("success")
  }

  private isMobileOptimized(element: DOMElement, context: PageContext): boolean {
    return context.deviceType === "mobile" && element.coordinates.width >= 44 // Minimum touch target
  }

  private isResponsive(element: DOMElement): boolean {
    return element.className.includes("responsive") || element.className.includes("mobile")
  }

  private isBrokenLink(element: DOMElement): boolean {
    return element.href === "#" || element.href === "javascript:void(0)"
  }
}
