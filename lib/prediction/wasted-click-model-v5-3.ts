// Wasted Click Prediction Model v5.3
// Purpose: Identifies and scores user interactions that do not directly support the Primary CTA

import type { DOMElement, PageContext, ClickPredictionResult } from "./types"

export type CTAType = "form-cta" | "non-form-cta" | "unknown"

export interface FormContext {
  ctaType: CTAType
  isFormRelated: boolean
  formFieldCount: number
  primaryFormAction: string | null
}

export interface WastedClickElement {
  element: DOMElement
  wastedClickScore: number
  type: WastedClickType
  distractionFactors: string[]
  recommendation: string
  classification: ElementClassification
  scoringBreakdown: ScoringBreakdown
}

export type WastedClickType =
  | "blog-link"
  | "social-link"
  | "navigation"
  | "additional-cta"
  | "external-link"
  | "resource-link"
  | "modal-trigger"
  | "chat-widget"
  | "download-link"
  | "footer-link"
  | "sidebar-link"

export type ElementClassification =
  | "supportive-click" // Same destination and label as Primary CTA
  | "neutral-click" // Does not help or hurt conversion
  | "wasted-click" // Redirects, delays, or distracts from Primary CTA

export interface ScoringBreakdown {
  distractionScore: number
  visibilityWeight: number
  interactionAttractiveness: number
  intentMismatchPenalty: number
  pathLoopPenalty: number
  clarityPenalty: number
  timingPenalty: number
  foldWeight: number
  ctaDuplicationBoost: number
  directResponsePenalty: number
  clickDistractionIndex: number
  clickBudgetRisk: number
  loopbackPenalty: number
  userBehaviorMultiplier: number
}

export interface WastedClickAnalysis {
  totalWastedElements: number
  averageWastedScore: number
  highRiskElements: WastedClickElement[]
  recommendations: string[]
  projectedImprovements: {
    ctrImprovement: number
    fcrImprovement: number
    revenueImpact: number
    implementationDifficulty: "easy" | "moderate" | "hard"
    priorityScore: number
  }
}

export class WastedClickModelV53 {
  private primaryCTA: DOMElement | null = null
  private pageContext: PageContext
  private foldLine: number

  constructor(pageContext: PageContext) {
    this.pageContext = pageContext
    this.foldLine = pageContext.deviceType === "mobile" ? 650 : 1000
  }

  /**
   * Detect if the primary CTA is form-related and create form context
   */
  private detectFormContext(primaryCTA: DOMElement, allElements: DOMElement[]): FormContext {
    const ctaText = primaryCTA.text?.toLowerCase() || ""
    const ctaHref = primaryCTA.href?.toLowerCase() || ""
    const formFields = allElements.filter((el) => this.isFormField(el))

    // Form CTA indicators
    const formCTAKeywords = [
      "sign up",
      "register",
      "subscribe",
      "join",
      "create account",
      "get started",
      "submit",
      "send",
      "contact us",
      "request",
      "apply",
      "book",
      "schedule",
      "reserve",
    ]

    // Non-form CTA indicators
    const nonFormCTAKeywords = [
      "buy",
      "purchase",
      "add to cart",
      "checkout",
      "order",
      "download",
      "install",
      "watch",
      "play",
      "read more",
      "learn more",
      "view",
      "browse",
      "explore",
    ]

    const isFormCTA =
      formCTAKeywords.some((keyword) => ctaText.includes(keyword)) ||
      ctaHref.includes("signup") ||
      ctaHref.includes("register") ||
      ctaHref.includes("contact") ||
      ctaHref.includes("subscribe")

    const isNonFormCTA =
      nonFormCTAKeywords.some((keyword) => ctaText.includes(keyword)) ||
      ctaHref.includes("buy") ||
      ctaHref.includes("purchase") ||
      ctaHref.includes("cart") ||
      ctaHref.includes("checkout")

    let ctaType: CTAType = "unknown"
    if (isFormCTA || formFields.length > 2) {
      ctaType = "form-cta"
    } else if (isNonFormCTA) {
      ctaType = "non-form-cta"
    } else if (formFields.length > 0) {
      ctaType = "form-cta" // Default to form if any form fields present
    } else {
      ctaType = "non-form-cta" // Default to non-form if no forms
    }

    return {
      ctaType,
      isFormRelated: ctaType === "form-cta",
      formFieldCount: formFields.length,
      primaryFormAction: primaryCTA.formAction || primaryCTA.href || null,
    }
  }

  private isFormField(element: DOMElement): boolean {
    const formFieldTypes = ["input", "textarea", "select"]
    return formFieldTypes.includes(element.tagName.toLowerCase())
  }

  /**
   * Main analysis method - identifies Primary CTA and analyzes all other elements for waste
   */
  analyzeWastedClicks(
    elements: DOMElement[],
    primaryCTA: DOMElement | null,
    clickPredictions?: ClickPredictionResult[],
  ): WastedClickAnalysis {
    this.primaryCTA = primaryCTA

    if (!primaryCTA) {
      throw new Error("Primary CTA must be identified before analyzing wasted clicks")
    }

    // NEW: Detect form context for sophisticated analysis
    const formContext = this.detectFormContext(primaryCTA, elements)
    console.log("Form context detected:", formContext)

    // Filter out the primary CTA from analysis
    const elementsToAnalyze = elements.filter(
      (el) => el.id !== primaryCTA.id && !this.isSameCTADestination(el, primaryCTA),
    )

    // Analyze each element for waste with form context
    const wastedElements: WastedClickElement[] = []

    for (const element of elementsToAnalyze) {
      if (this.isClickableElement(element)) {
        const wastedClickElement = this.analyzeElementWithFormContext(element, formContext, clickPredictions)
        wastedElements.push(wastedClickElement)
      }
    }

    // Sort by waste score (highest first)
    wastedElements.sort((a, b) => b.wastedClickScore - a.wastedClickScore)

    // Generate analysis summary with form context
    return this.generateAnalysisSummaryWithFormContext(wastedElements, formContext)
  }

  /**
   * Analyze individual element for wasted click potential with form context awareness
   */
  private analyzeElementWithFormContext(
    element: DOMElement,
    formContext: FormContext,
    clickPredictions?: ClickPredictionResult[],
  ): WastedClickElement {
    const classification = this.classifyElementWithFormContext(element, formContext)
    const scoringBreakdown = this.calculateScoringBreakdownWithFormContext(element, formContext, clickPredictions)

    // Calculate final Wasted Click Score (WCS) with form context
    const wastedClickScore = this.calculateWastedClickScoreWithFormContext(scoringBreakdown, formContext)

    const type = this.determineElementType(element)
    const distractionFactors = this.identifyDistractionFactorsWithFormContext(element, scoringBreakdown, formContext)
    const recommendation = this.generateRecommendationWithFormContext(element, type, wastedClickScore, formContext)

    return {
      element,
      wastedClickScore,
      type,
      distractionFactors,
      recommendation,
      classification,
      scoringBreakdown,
    }
  }

  /**
   * Classify element with form context awareness
   */
  private classifyElementWithFormContext(element: DOMElement, formContext: FormContext): ElementClassification {
    if (!this.primaryCTA) return "wasted-click"

    // Check if it's supportive (same destination and label)
    if (this.isSameCTADestination(element, this.primaryCTA) && element.text === this.primaryCTA.text) {
      return "supportive-click"
    }

    // NEW: Form-context-aware classification
    if (formContext.ctaType === "form-cta") {
      // For form CTAs, form fields are supportive
      if (this.isFormField(element)) {
        return "supportive-click"
      }
      // Trust indicators are more valuable for forms
      if (this.isTrustIndicator(element)) {
        return "supportive-click"
      }
    } else if (formContext.ctaType === "non-form-cta") {
      // For non-form CTAs, form fields are competing
      if (this.isFormField(element)) {
        return "wasted-click"
      }
    }

    // Check if it's neutral (legal, privacy, etc.)
    if (this.isNeutralElement(element)) {
      return "neutral-click"
    }

    return "wasted-click"
  }

  /**
   * Calculate comprehensive scoring breakdown with form context awareness
   */
  private calculateScoringBreakdownWithFormContext(
    element: DOMElement,
    formContext: FormContext,
    clickPredictions?: ClickPredictionResult[],
  ): ScoringBreakdown {
    const baseBreakdown = this.calculateScoringBreakdown(element, clickPredictions)

    // Apply form context modifiers
    if (formContext.ctaType === "form-cta") {
      // Form CTA context - form fields are supportive
      if (this.isFormField(element)) {
        baseBreakdown.distractionScore *= 0.2 // Reduce distraction for form fields
        baseBreakdown.directResponsePenalty *= 0.3 // Reduce penalty for form fields
        baseBreakdown.intentMismatchPenalty *= 0.1 // Form fields support form completion
      } else {
        // Non-form elements get higher penalties in form context
        baseBreakdown.distractionScore *= 1.3
        baseBreakdown.directResponsePenalty *= 1.4
        if (this.isSocialLink(element)) {
          baseBreakdown.directResponsePenalty *= 1.6 // Social links are major distractions from forms
        }
      }

      // Trust indicators are more valuable for forms
      if (this.isTrustIndicator(element)) {
        baseBreakdown.distractionScore *= 0.1
        baseBreakdown.directResponsePenalty *= 0.2
      }
    } else if (formContext.ctaType === "non-form-cta") {
      // Non-form CTA context - form fields compete
      if (this.isFormField(element)) {
        baseBreakdown.distractionScore *= 1.8 // Form fields are major distractions
        baseBreakdown.directResponsePenalty *= 2.0 // High penalty for competing forms
        baseBreakdown.intentMismatchPenalty *= 1.5 // Different conversion goal
      }

      // Navigation might be more acceptable for non-form CTAs
      if (this.isInternalNavigation(element, this.pageContext)) {
        baseBreakdown.directResponsePenalty *= 0.8
      }
    }

    return baseBreakdown
  }

  /**
   * Calculate base scoring breakdown - FIXED: This method was missing
   */
  private calculateScoringBreakdown(element: DOMElement, clickPredictions?: ClickPredictionResult[]): ScoringBreakdown {
    return {
      distractionScore: this.calculateDistractionScore(element),
      visibilityWeight: this.calculateVisibilityWeight(element),
      interactionAttractiveness: this.calculateInteractionAttractiveness(element),
      intentMismatchPenalty: this.calculateIntentMismatchPenalty(element),
      pathLoopPenalty: this.calculatePathLoopPenalty(element),
      clarityPenalty: this.calculateClarityPenalty(element),
      timingPenalty: this.calculateTimingPenalty(element),
      foldWeight: this.calculateFoldWeight(element),
      ctaDuplicationBoost: this.calculateCTADuplicationBoost(element),
      directResponsePenalty: this.calculateDirectResponsePenalty(element),
      clickDistractionIndex: this.calculateClickDistractionIndex(element, clickPredictions),
      clickBudgetRisk: this.calculateClickBudgetRisk(),
      loopbackPenalty: this.calculateLoopbackPenalty(element),
      userBehaviorMultiplier: this.calculateUserBehaviorMultiplier(),
    }
  }

  /**
   * Calculate final Wasted Click Score with form context weighting
   */
  private calculateWastedClickScoreWithFormContext(breakdown: ScoringBreakdown, formContext: FormContext): number {
    // Calculate base score using existing method
    const baseScore = this.calculateWastedClickScore(breakdown)

    // Apply form context weighting
    let contextMultiplier = 1.0

    if (formContext.ctaType === "form-cta") {
      // Form CTAs benefit from reduced overall waste due to focused user intent
      contextMultiplier = 0.75

      // Additional reduction if many form fields (indicates dedicated form page)
      if (formContext.formFieldCount > 3) {
        contextMultiplier *= 0.85
      }
    } else if (formContext.ctaType === "non-form-cta") {
      // Non-form CTAs have standard waste calculation
      contextMultiplier = 1.0

      // Slight increase if competing forms present
      if (formContext.formFieldCount > 0) {
        contextMultiplier *= 1.1
      }
    }

    const finalScore = baseScore * contextMultiplier
    return Math.min(Math.max(finalScore, 0), 1)
  }

  /**
   * Calculate final Wasted Click Score - FIXED: This method was missing
   */
  private calculateWastedClickScore(breakdown: ScoringBreakdown): number {
    // Weighted combination of all scoring factors
    const score =
      breakdown.distractionScore * 0.25 * breakdown.visibilityWeight +
      breakdown.interactionAttractiveness * 0.15 +
      (breakdown.intentMismatchPenalty - 1) * 0.2 +
      (breakdown.pathLoopPenalty - 1) * 0.1 +
      (breakdown.clarityPenalty - 1) * 0.1 +
      (breakdown.timingPenalty - 1) * 0.05 +
      breakdown.clickDistractionIndex * 0.3 +
      (breakdown.clickBudgetRisk - 1) * 0.1 +
      (breakdown.loopbackPenalty - 1) * 0.05 +
      (breakdown.userBehaviorMultiplier - 1) * 0.1

    // Apply fold weight and CTA duplication boost
    const adjustedScore = score * breakdown.foldWeight * breakdown.ctaDuplicationBoost

    // Apply direct response penalty
    const finalScore = adjustedScore * breakdown.directResponsePenalty

    // Normalize to 0-1 range
    return Math.min(Math.max(finalScore, 0), 1)
  }

  /**
   * Identify distraction factors with form context awareness
   */
  private identifyDistractionFactorsWithFormContext(
    element: DOMElement,
    breakdown: ScoringBreakdown,
    formContext: FormContext,
  ): string[] {
    const factors = this.identifyDistractionFactors(element, breakdown)

    // Add form-context-specific factors
    if (formContext.ctaType === "form-cta") {
      if (this.isFormField(element)) {
        factors.push("form field supports conversion")
      } else if (this.isSocialLink(element)) {
        factors.push("social link disrupts form completion")
      } else if (this.isNavigationElement(element)) {
        factors.push("navigation competes with form focus")
      }
    } else if (formContext.ctaType === "non-form-cta") {
      if (this.isFormField(element)) {
        factors.push("form field competes with purchase intent")
      }
    }

    return factors
  }

  /**
   * Generate recommendation with form context awareness
   */
  private generateRecommendationWithFormContext(
    element: DOMElement,
    type: WastedClickType,
    score: number,
    formContext: FormContext,
  ): string {
    if (score < 0.05) return "Low priority - monitor for changes"

    let baseRec = ""

    if (formContext.ctaType === "form-cta") {
      // Form CTA specific recommendations
      const formRecommendations: Record<WastedClickType, string> = {
        "blog-link": "Remove blog links from form pages - major distraction from completion",
        "social-link": "Hide social links during form completion - save for thank you page",
        navigation: "Minimize navigation on form pages - use breadcrumbs instead",
        "additional-cta": "Remove competing CTAs from form pages - focus on single conversion",
        "external-link": "Remove all external links from form pages",
        "resource-link": "Move resources to post-form completion",
        "modal-trigger": "Avoid modals during form completion",
        "chat-widget": "Make chat less prominent during form completion",
        "download-link": "Offer downloads after form completion",
        "footer-link": "Minimize footer links on form pages",
        "sidebar-link": "Remove sidebar distractions from form pages",
      }
      baseRec = formRecommendations[type] || "Review element necessity for form completion flow"
    } else if (formContext.ctaType === "non-form-cta") {
      // Non-form CTA specific recommendations
      const nonFormRecommendations: Record<WastedClickType, string> = {
        "blog-link": "Move blog links to post-purchase or separate section",
        "social-link": "Relocate social links to footer - don't compete with purchase",
        navigation: "Streamline navigation to support purchase decision",
        "additional-cta": "Remove competing CTAs that don't support purchase intent",
        "external-link": "Remove external links that take users away from purchase",
        "resource-link": "Provide resources that support purchase decision only",
        "modal-trigger": "Use modals for purchase support, not distractions",
        "chat-widget": "Position chat to support purchase questions",
        "download-link": "Offer downloads that support purchase decision",
        "footer-link": "Keep essential links only in footer",
        "sidebar-link": "Use sidebar for purchase-supporting content only",
      }
      baseRec = nonFormRecommendations[type] || "Review element impact on purchase intent"
    } else {
      // Fallback to original recommendations
      baseRec = this.generateRecommendation(element, type, score)
    }

    // Add priority based on score and context
    if (score > 0.3) {
      baseRec = `CRITICAL (${formContext.ctaType.toUpperCase()}): ${baseRec}`
    } else if (score > 0.15) {
      baseRec = `HIGH PRIORITY (${formContext.ctaType.toUpperCase()}): ${baseRec}`
    } else if (score > 0.08) {
      baseRec = `MEDIUM PRIORITY (${formContext.ctaType.toUpperCase()}): ${baseRec}`
    }

    return baseRec
  }

  /**
   * Generate analysis summary with form context awareness
   */
  private generateAnalysisSummaryWithFormContext(
    wastedElements: WastedClickElement[],
    formContext: FormContext,
  ): WastedClickAnalysis {
    const baseSummary = this.generateAnalysisSummary(wastedElements)

    // Enhance recommendations with form context
    const contextRecommendations = this.generateFormContextRecommendations(wastedElements, formContext)

    // Adjust projected improvements based on form context
    const adjustedImprovements = this.adjustProjectedImprovementsForFormContext(
      baseSummary.projectedImprovements,
      formContext,
      wastedElements,
    )

    return {
      ...baseSummary,
      recommendations: [...baseSummary.recommendations, ...contextRecommendations],
      projectedImprovements: adjustedImprovements,
    }
  }

  /**
   * Generate form-context-specific recommendations
   */
  private generateFormContextRecommendations(wastedElements: WastedClickElement[], formContext: FormContext): string[] {
    const recommendations: string[] = []

    if (formContext.ctaType === "form-cta") {
      const socialElements = wastedElements.filter((el) => el.type === "social-link")
      const navElements = wastedElements.filter((el) => el.type === "navigation")

      if (socialElements.length > 0) {
        recommendations.push("FORM OPTIMIZATION: Remove social media links from form pages to reduce abandonment")
      }

      if (navElements.length > 2) {
        recommendations.push(
          "FORM OPTIMIZATION: Simplify navigation during form completion - use progress indicators instead",
        )
      }

      if (formContext.formFieldCount > 5) {
        recommendations.push("FORM OPTIMIZATION: Consider multi-step form to reduce cognitive load")
      }
    } else if (formContext.ctaType === "non-form-cta") {
      const formElements = wastedElements.filter((el) => el.type === "additional-cta" && this.isFormField(el.element))

      if (formElements.length > 0) {
        recommendations.push("PURCHASE OPTIMIZATION: Remove competing newsletter/contact forms from purchase pages")
      }

      if (formContext.formFieldCount > 0) {
        recommendations.push("PURCHASE OPTIMIZATION: Move secondary forms (newsletter, contact) to post-purchase flow")
      }
    }

    return recommendations
  }

  /**
   * Adjust projected improvements based on form context
   */
  private adjustProjectedImprovementsForFormContext(
    baseImprovements: WastedClickAnalysis["projectedImprovements"],
    formContext: FormContext,
    wastedElements: WastedClickElement[],
  ): WastedClickAnalysis["projectedImprovements"] {
    let ctrMultiplier = 1.0
    let fcrMultiplier = 1.0
    let revenueMultiplier = 1.0

    if (formContext.ctaType === "form-cta") {
      // Form CTAs typically see higher improvements when distractions are removed
      ctrMultiplier = 1.4
      fcrMultiplier = 1.6 // Form completion rates improve significantly
      revenueMultiplier = 1.3

      // Additional boost if many high-waste non-form elements
      const nonFormWasteElements = wastedElements.filter(
        (el) => !this.isFormField(el.element) && el.wastedClickScore > 0.2,
      )
      if (nonFormWasteElements.length > 3) {
        ctrMultiplier *= 1.2
        fcrMultiplier *= 1.3
      }
    } else if (formContext.ctaType === "non-form-cta") {
      // Non-form CTAs see moderate improvements
      ctrMultiplier = 1.1
      fcrMultiplier = 1.2
      revenueMultiplier = 1.15

      // Penalty if competing forms present
      if (formContext.formFieldCount > 0) {
        const formWasteElements = wastedElements.filter(
          (el) => this.isFormField(el.element) && el.wastedClickScore > 0.15,
        )
        if (formWasteElements.length > 0) {
          ctrMultiplier *= 1.25 // Higher improvement potential by removing competing forms
          revenueMultiplier *= 1.2
        }
      }
    }

    return {
      ctrImprovement: Math.min(baseImprovements.ctrImprovement * ctrMultiplier, 0.8), // Cap at 80%
      fcrImprovement: Math.min(baseImprovements.fcrImprovement * fcrMultiplier, 0.7), // Cap at 70%
      revenueImpact: baseImprovements.revenueImpact * revenueMultiplier,
      implementationDifficulty: baseImprovements.implementationDifficulty,
      priorityScore: Math.min(Math.round((baseImprovements.priorityScore * (ctrMultiplier + fcrMultiplier)) / 2), 100),
    }
  }

  // Scoring Factor Calculations

  private calculateDistractionScore(element: DOMElement): number {
    let score = 0.1 // Base score

    // Visual dominance factors
    if (element.hasHighContrast) score += 0.2
    if (element.coordinates.width > 200 || element.coordinates.height > 50) score += 0.15
    if (element.hasButtonStyling) score += 0.1
    if (element.style?.fontWeight === "bold") score += 0.1
    if (element.style?.fontSize && Number.parseInt(element.style.fontSize) > 16) score += 0.1

    // Position-based distraction
    if (element.coordinates.y < 500) score += 0.2 // Above fold prominence
    if (element.isSticky) score += 0.15

    return Math.min(score, 1.0)
  }

  private calculateVisibilityWeight(element: DOMElement): number {
    const isAboveFold = element.coordinates.y < this.foldLine
    let weight = isAboveFold ? 1.0 : 0.7

    if (element.isSticky) weight = Math.min(weight * 1.2, 1.0)

    return weight
  }

  private calculateInteractionAttractiveness(element: DOMElement): number {
    let score = 0.3 // Base attractiveness

    if (element.hasButtonStyling) score += 0.3
    if (element.style?.cursor === "pointer") score += 0.2
    if (element.isAutoRotating) score += 0.2 // Animations attract attention

    return Math.min(score, 1.0)
  }

  private calculateIntentMismatchPenalty(element: DOMElement): number {
    let penalty = 1.0

    const text = element.text?.toLowerCase() || ""
    const href = element.href?.toLowerCase() || ""

    // Check for common intent mismatches
    if (text.includes("pricing") && (href.includes("blog") || href.includes("about"))) {
      penalty += 0.5
    }
    if (text.includes("demo") && href.includes("contact")) {
      penalty += 0.4
    }
    if (text.includes("buy") && !href.includes("checkout") && !href.includes("purchase")) {
      penalty += 0.3
    }

    return Math.min(penalty, 1.5)
  }

  private calculatePathLoopPenalty(element: DOMElement): number {
    // Estimate path complexity based on element type and destination
    let penalty = 1.0
    const href = element.href || ""

    // Navigation links typically add steps
    if (href.includes("/about") || href.includes("/contact") || href.includes("/blog")) {
      penalty += 0.1
    }

    // External links definitely add steps
    if (href.startsWith("http") && typeof window !== "undefined" && !href.includes(window.location.hostname)) {
      penalty += 0.2
    }

    return penalty
  }

  private calculateClarityPenalty(element: DOMElement): number {
    let penalty = 1.0
    const text = element.text || ""

    // Icon-only buttons
    if (text.length < 2) penalty += 0.3

    // Vague labels
    const vagueTerms = ["click here", "learn more", "read more", "continue"]
    if (vagueTerms.some((term) => text.toLowerCase().includes(term))) {
      penalty += 0.2
    }

    return Math.min(penalty, 1.3)
  }

  private calculateTimingPenalty(element: DOMElement): number {
    let penalty = 1.0

    // Exit-intent popups and overlays
    if (element.className?.includes("modal") || element.className?.includes("popup")) {
      penalty += 0.2
    }

    // Sticky elements that appear after scroll
    if (element.isSticky && element.coordinates.y > this.foldLine) {
      penalty += 0.15
    }

    return Math.min(penalty, 1.25)
  }

  private calculateFoldWeight(element: DOMElement): number {
    return element.coordinates.y >= this.foldLine ? 0.7 : 1.0
  }

  private calculateCTADuplicationBoost(element: DOMElement): number {
    if (!this.primaryCTA) return 1.0

    const isSameDestination = element.href === this.primaryCTA.href
    const isSameText = element.text === this.primaryCTA.text

    if (isSameDestination && isSameText) {
      return 0.85 // Supportive duplicate
    }

    return 1.0 // Default (potentially wasted)
  }

  private calculateDirectResponsePenalty(element: DOMElement): number {
    let penalty = 1.0

    // Additional CTAs
    if (this.isAdditionalCTA(element)) penalty += 0.35

    // Social links
    if (this.isSocialLink(element)) penalty += 0.4

    // Top navigation
    if (this.isTopNavigation(element)) penalty += 0.4

    // Generic/non-personalized elements
    if (this.isGenericElement(element)) penalty += 0.3

    // UX friction elements
    if (this.causesUXFriction(element)) penalty += 0.4

    return Math.min(penalty, 1.75)
  }

  private calculateClickDistractionIndex(element: DOMElement, clickPredictions?: ClickPredictionResult[]): number {
    if (!clickPredictions) return 0.5 // Default moderate distraction

    const elementPrediction = clickPredictions.find((p) => p.elementId === element.id)
    if (!elementPrediction) return 0.3

    const totalClicks = clickPredictions.reduce((sum, p) => sum + p.predictedClicks, 0)
    const clickShare = elementPrediction.predictedClicks / totalClicks
    const conversionContribution = 0 // Assume non-primary CTA elements don't contribute to conversion

    return clickShare * (1 - conversionContribution)
  }

  private calculateClickBudgetRisk(): number {
    const industryClickBudget = this.getIndustryClickBudget()
    return industryClickBudget < 2.0 ? 1.3 : 1.0
  }

  private calculateLoopbackPenalty(element: DOMElement): number {
    // Check if element leads to a prior page in the funnel
    const href = element.href || ""
    const currentPath = typeof window !== "undefined" ? window.location.pathname : ""

    // Simple heuristic: if href is "up" in the hierarchy
    if (href.length < currentPath.length && currentPath.startsWith(href)) {
      return 1.2
    }

    return 1.0
  }

  private calculateUserBehaviorMultiplier(): number {
    // Default behavior multiplier - could be enhanced with actual user data
    const userArchetype = this.getUserArchetype()

    switch (userArchetype) {
      case "Explorer":
        return 1.15
      case "Skimmer":
        return 1.1
      default:
        return 1.0
    }
  }

  // Helper Methods

  private classifyElement(element: DOMElement): ElementClassification {
    if (!this.primaryCTA) return "wasted-click"

    // Check if it's supportive (same destination and label)
    if (this.isSameCTADestination(element, this.primaryCTA) && element.text === this.primaryCTA.text) {
      return "supportive-click"
    }

    // Check if it's neutral (legal, privacy, etc.)
    if (this.isNeutralElement(element)) {
      return "neutral-click"
    }

    return "wasted-click"
  }

  private isSameCTADestination(element: DOMElement, primaryCTA: DOMElement): boolean {
    return element.href === primaryCTA.href
  }

  private isNeutralElement(element: DOMElement): boolean {
    const text = element.text?.toLowerCase() || ""
    const neutralTerms = ["privacy", "terms", "legal", "disclaimer", "cookie"]
    return neutralTerms.some((term) => text.includes(term))
  }

  private isClickableElement(element: DOMElement): boolean {
    const clickableTags = ["a", "button", "input"]
    return (
      clickableTags.includes(element.tagName.toLowerCase()) ||
      element.isInteractive ||
      element.style?.cursor === "pointer"
    )
  }

  private determineElementType(element: DOMElement): WastedClickType {
    const href = element.href?.toLowerCase() || ""
    const text = element.text?.toLowerCase() || ""
    const className = element.className?.toLowerCase() || ""

    if (href.includes("blog") || href.includes("article")) return "blog-link"
    if (this.isSocialLink(element)) return "social-link"
    if (className.includes("nav") || element.tagName === "nav") return "navigation"
    if (this.isAdditionalCTA(element)) return "additional-cta"
    if (href.startsWith("http") && typeof window !== "undefined" && !href.includes(window.location.hostname))
      return "external-link"
    if (href.includes("download") || text.includes("download")) return "download-link"
    if (className.includes("modal") || className.includes("popup")) return "modal-trigger"
    if (className.includes("chat") || text.includes("chat")) return "chat-widget"
    if (className.includes("footer")) return "footer-link"
    if (className.includes("sidebar")) return "sidebar-link"

    return "resource-link"
  }

  private isSocialLink(element: DOMElement): boolean {
    const href = element.href?.toLowerCase() || ""
    const socialDomains = ["facebook.com", "twitter.com", "linkedin.com", "instagram.com", "youtube.com"]
    return socialDomains.some((domain) => href.includes(domain))
  }

  private isAdditionalCTA(element: DOMElement): boolean {
    const text = element.text?.toLowerCase() || ""
    const ctaTerms = ["sign up", "get started", "try now", "buy now", "subscribe", "register"]
    return ctaTerms.some((term) => text.includes(term)) && element.id !== this.primaryCTA?.id
  }

  private isTopNavigation(element: DOMElement): boolean {
    return element.coordinates.y < 100 && (element.className?.includes("nav") || element.tagName === "nav")
  }

  private isGenericElement(element: DOMElement): boolean {
    const text = element.text?.toLowerCase() || ""
    const genericTerms = ["click here", "learn more", "read more", "continue", "next"]
    return genericTerms.some((term) => text.includes(term))
  }

  private causesUXFriction(element: DOMElement): boolean {
    // Elements that slow down UX or cause friction
    const className = element.className?.toLowerCase() || ""
    return (
      className.includes("popup") ||
      className.includes("modal") ||
      element.isAutoRotating ||
      (element.href && element.href.startsWith("mailto:"))
    )
  }

  private identifyDistractionFactors(element: DOMElement, breakdown: ScoringBreakdown): string[] {
    const factors: string[] = []

    if (breakdown.distractionScore > 0.5) factors.push("high visual prominence")
    if (breakdown.intentMismatchPenalty > 1.2) factors.push("intent mismatch")
    if (breakdown.pathLoopPenalty > 1.1) factors.push("off-path click")
    if (breakdown.directResponsePenalty > 1.3) factors.push("direct response violation")
    if (breakdown.clickDistractionIndex > 0.3) factors.push("high click attraction")
    if (element.isSticky) factors.push("sticky positioning")
    if (element.coordinates.y < this.foldLine) factors.push("above fold competition")

    return factors
  }

  private generateRecommendation(element: DOMElement, type: WastedClickType, score: number): string {
    if (score < 0.05) return "Low priority - monitor for changes"

    const recommendations: Record<WastedClickType, string> = {
      "blog-link": "Move blog links to footer or remove from primary flow",
      "social-link": "Relocate social links to footer or sidebar",
      navigation: "Simplify navigation or make less prominent",
      "additional-cta": "Remove competing CTAs or merge with primary CTA",
      "external-link": "Remove external links or open in new tab with warning",
      "resource-link": "Move resources to dedicated section",
      "modal-trigger": "Replace modal with inline content",
      "chat-widget": "Make chat widget less intrusive",
      "download-link": "Move downloads to post-conversion flow",
      "footer-link": "Acceptable in footer, consider removing if above fold",
      "sidebar-link": "Reduce sidebar prominence or remove",
    }

    let baseRec = recommendations[type] || "Review element necessity and placement"

    if (score > 0.2) {
      baseRec = `HIGH PRIORITY: ${baseRec}`
    } else if (score > 0.1) {
      baseRec = `MEDIUM PRIORITY: ${baseRec}`
    }

    return baseRec
  }

  private generateAnalysisSummary(wastedElements: WastedClickElement[]): WastedClickAnalysis {
    const totalWastedElements = wastedElements.length
    const averageWastedScore = wastedElements.reduce((sum, el) => sum + el.wastedClickScore, 0) / totalWastedElements
    const highRiskElements = wastedElements.filter((el) => el.wastedClickScore > 0.05)

    // Generate recommendations
    const recommendations = this.generateGlobalRecommendations(wastedElements)

    // Calculate projected improvements
    const projectedImprovements = this.calculateProjectedImprovements(wastedElements)

    return {
      totalWastedElements,
      averageWastedScore,
      highRiskElements,
      recommendations,
      projectedImprovements,
    }
  }

  private generateGlobalRecommendations(wastedElements: WastedClickElement[]): string[] {
    const recommendations: string[] = []

    const highWasteCount = wastedElements.filter((el) => el.wastedClickScore > 0.3).length
    const socialLinksCount = wastedElements.filter((el) => el.type === "social-link").length
    const additionalCTACount = wastedElements.filter((el) => el.type === "additional-cta").length

    if (highWasteCount > 5) {
      recommendations.push("High interactive element density detected - consider simplifying page layout")
    }

    if (socialLinksCount > 2) {
      recommendations.push("Multiple social links competing for attention - consolidate or relocate")
    }

    if (additionalCTACount > 1) {
      recommendations.push("Multiple CTAs creating decision paralysis - focus on single primary action")
    }

    if (wastedElements.some((el) => el.distractionFactors.includes("above fold competition"))) {
      recommendations.push("Above-fold elements competing with primary CTA - prioritize conversion elements")
    }

    return recommendations
  }

  private calculateProjectedImprovements(
    wastedElements: WastedClickElement[],
  ): WastedClickAnalysis["projectedImprovements"] {
    const highRiskElements = wastedElements.filter((el) => el.wastedClickScore > 0.05)
    const totalWastedScore = wastedElements.reduce((sum, el) => sum + el.wastedClickScore, 0)

    // Estimate improvements based on waste reduction
    const ctrImprovement = Math.min(totalWastedScore * 0.15, 0.5) // Cap at 50% improvement
    const fcrImprovement = Math.min(totalWastedScore * 0.12, 0.4) // Cap at 40% improvement

    // Revenue impact calculation (simplified)
    const currentCTR = this.pageContext.totalImpressions > 0 ? 0.031 : 0.02 // Default 3.1% or 2%
    const projectedCTR = currentCTR * (1 + ctrImprovement)
    const additionalClicks = (projectedCTR - currentCTR) * this.pageContext.totalImpressions
    const avgOrderValue = 100 // Simplified assumption
    const revenueImpact = additionalClicks * avgOrderValue * 0.1 // 10% conversion rate assumption

    // Implementation difficulty
    let implementationDifficulty: "easy" | "moderate" | "hard" = "easy"
    if (highRiskElements.length > 10) implementationDifficulty = "hard"
    else if (highRiskElements.length > 5) implementationDifficulty = "moderate"

    // Priority score (0-100)
    const priorityScore = Math.min(Math.round(totalWastedScore * 100), 100)

    return {
      ctrImprovement,
      fcrImprovement,
      revenueImpact,
      implementationDifficulty,
      priorityScore,
    }
  }

  // Utility methods that would be enhanced with real data
  private getIndustryClickBudget(): number {
    // Simplified industry-based click budget
    const industryBudgets: Record<string, number> = {
      saas: 2.5,
      ecommerce: 3.0,
      leadgen: 2.0,
      content: 4.0,
    }

    return industryBudgets[this.pageContext.industry || "saas"] || 2.5
  }

  private getUserArchetype(): "Explorer" | "Skimmer" | "Focused" {
    // Simplified user archetype detection
    // In real implementation, this would use behavioral data
    return "Focused"
  }

  private isTrustIndicator(element: DOMElement): boolean {
    const text = element.text?.toLowerCase() || ""
    const className = element.className?.toLowerCase() || ""

    // Common trust indicator keywords
    const trustKeywords = ["secure", "guaranteed", "certified", "verified", "trusted"]

    // Check for keywords in text or class name
    if (trustKeywords.some((keyword) => text.includes(keyword))) {
      return true
    }
    if (className.includes("trust-badge") || className.includes("security-seal")) {
      return true
    }

    return false
  }

  private isInternalNavigation(element: DOMElement, pageContext: PageContext): boolean {
    const href = element.href?.toLowerCase() || ""
    const hostname = typeof window !== "undefined" ? window.location.hostname : pageContext.url

    // Check if the link is internal and not an anchor link
    return href.startsWith("/") || (href.includes(hostname || "") && !href.startsWith("#"))
  }

  private isNavigationElement(element: DOMElement): boolean {
    const className = element.className?.toLowerCase() || ""
    return className.includes("nav") || element.tagName === "nav"
  }
}

// Export singleton for easy integration
export const wastedClickModelV53 = (pageContext: PageContext) => new WastedClickModelV53(pageContext)
