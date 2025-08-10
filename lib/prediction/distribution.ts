// Click Prediction Model - Distribution Logic

import type { ScoredElement, ClickPredictionResult, PageContext, WasteBreakdown } from "./types"
import { TrafficAnalyzer } from "./traffic"
import { RiskAssessment } from "./risk"
import {
  ELEMENT_WASTE_RATES,
  ATTENTION_RATIO_THRESHOLDS,
  VISUAL_EMPHASIS_WASTE,
  CONTENT_CLUTTER_WASTE,
  LEGACY_QUALITY_WASTE,
  CONSTANTS,
  INDUSTRY_MODIFIERS,
  CPC_CONSTANTS,
} from "./constants"

// Define CPC constants
// const CPC_CONSTANTS = {
//   SEARCH_NETWORK_BASE: 0.75,
//   DISPLAY_NETWORK_BASE: 0.50,
//   B2B_MULTIPLIER: 1.2,
//   B2C_MULTIPLIER: 0.8,
//   TRAFFIC_SOURCE_CPC: {
//     organic: 0.05,
//     paid: 1.0,
//     social: 0.6,
//     email: 0.2,
//     direct: 0.1,
//     referral: 0.3,
//     unknown: 0.3,
//     linkedin: 1.1,
//   },
//   DEVICE_CPC_MODIFIERS: {
//     desktop: 1.0,
//     mobile: 0.8,
//     tablet: 0.9,
//   },
//   COMPETITION_MODIFIERS: {
//     high: 1.3,
//     medium: 1.0,
//     low: 0.7,
//     unknown: 1.0,
//   },
//   QUALITY_SCORE_MODIFIERS: {
//     excellent: 0.8,
//     good: 0.9,
//     average: 1.0,
//     poor: 1.2,
//     unknown: 1.1,
//   },
//   GEO_MODIFIERS: {
//     tier1: 1.0,
//     tier2: 0.8,
//     tier3: 0.6,
//     unknown: 1.0,
//   },
// }

export class ClickDistributor {
  private trafficAnalyzer: TrafficAnalyzer
  private riskAssessment: RiskAssessment

  constructor() {
    this.trafficAnalyzer = new TrafficAnalyzer()
    this.riskAssessment = new RiskAssessment()
  }

  /**
   * Distribute clicks across elements based on their scores and probabilities
   */
  distributeClicks(elements: ScoredElement[], context: PageContext): ClickPredictionResult[] {
    // Step 1: Calculate traffic modifiers
    const trafficModifiers = this.trafficAnalyzer.calculateTrafficModifiers(context)
    const totalClicks = trafficModifiers.totalClicks

    // Step 2: Apply traffic adjustments to scores
    const adjustedElements = elements.map((element) => ({
      ...element,
      adjustedScore: this.trafficAnalyzer.applyTrafficAdjustments(element.score, context),
    }))

    // Step 3: Calculate raw probabilities
    const totalScore = adjustedElements.reduce((sum, el) => sum + el.adjustedScore, 0)

    if (totalScore === 0) {
      return this.createEmptyResults(elements)
    }

    const probabilities = adjustedElements.map((el) => ({
      ...el,
      probability: el.adjustedScore / totalScore,
    }))

    // Step 4: Apply traffic source modifiers
    const trafficModifier = trafficModifiers.trafficSourceModifier * trafficModifiers.deviceModifier
    const adjustedProbabilities = probabilities.map((el) => ({
      ...el,
      adjustedProbability: el.probability * trafficModifier,
    }))

    // Step 5: Renormalize probabilities
    const totalAdjusted = adjustedProbabilities.reduce((sum, el) => sum + el.adjustedProbability, 0)

    const finalProbabilities = adjustedProbabilities.map((el) => ({
      ...el,
      finalProbability: totalAdjusted > 0 ? el.adjustedProbability / totalAdjusted : 0,
    }))

    // Step 6: Calculate click volumes and create results
    return finalProbabilities.map((el) => this.createPredictionResult(el, totalClicks, context))
  }

  /**
   * Create a prediction result for a single element
   */
  private createPredictionResult(
    element: ScoredElement & { finalProbability: number },
    totalClicks: number,
    context: PageContext,
  ): ClickPredictionResult {
    const predictedClicks = element.finalProbability * totalClicks
    const ctr = (predictedClicks / context.totalImpressions) * 100
    const clickShare = element.finalProbability * 100

    // Calculate additional metrics
    const avgCPC = this.calculateAverageCPC(context)

    // NEW: Calculate wasted clicks using 4-phase algorithm
    const wasteAnalysis = this.calculateWastedClicksWithBreakdown(predictedClicks, element.element, context)
    const wastedClicks = wasteAnalysis.wastedClicks
    const wastedSpend = wastedClicks * avgCPC

    // Generate risk factors and confidence
    const riskFactors = this.riskAssessment.generateRiskFactors(element.element, context)
    const confidence = this.riskAssessment.calculateConfidenceLevel(element.element, element.score, context)

    return {
      elementId: element.element.id || `${element.element.tagName}-${Date.now()}`,
      predictedClicks: Math.max(predictedClicks, 0.1),
      ctr: Math.max(ctr, 0.01),
      clickShare: Math.max(clickShare, 0.1),
      rawScore: element.score,
      clickProbability: element.finalProbability,
      confidence,
      riskFactors,
      estimatedClicks: Math.round(predictedClicks),
      wastedClicks: Math.round(wastedClicks),
      wastedSpend: Number(wastedSpend.toFixed(2)),
      avgCPC: Number(avgCPC.toFixed(2)),
      wasteBreakdown: wasteAnalysis.breakdown,
    }
  }

  /**
   * NEW: Calculate wasted clicks using Enhanced 4-Phase Algorithm with detailed breakdown
   */
  private calculateWastedClicksWithBreakdown(
    predictedClicks: number,
    element: any,
    context?: PageContext,
  ): { wastedClicks: number; breakdown: WasteBreakdown } {
    let wasteRate = 0
    const breakdown: WasteBreakdown = {
      baseWasteRate: 0,
      phase1ElementClassification: 0,
      phase2AttentionRatio: 0,
      phase3VisualEmphasis: 0,
      phase4ContentClutter: 0,
      legacyQualityFactors: 0,
      totalWasteRate: 0,
      cappedWasteRate: 0,
      elementCategory: "unknown",
      visualFactors: [],
      clutterFactors: [],
      legacyFactors: [],
    }

    // Phase 1: Element Classification
    const phase1Result = this.calculatePhase1ElementClassification(element, context)
    breakdown.phase1ElementClassification = phase1Result.wasteRate
    breakdown.elementCategory = phase1Result.category
    wasteRate += phase1Result.wasteRate

    // Phase 2: Attention Ratio Analysis
    const phase2Result = this.calculatePhase2AttentionRatio(element, context)
    breakdown.phase2AttentionRatio = phase2Result.wasteRate
    breakdown.attentionRatio = phase2Result.attentionRatio
    wasteRate += phase2Result.wasteRate

    // Phase 3: Visual Emphasis Analysis
    const phase3Result = this.calculatePhase3VisualEmphasis(element)
    breakdown.phase3VisualEmphasis = phase3Result.wasteRate
    breakdown.visualFactors = phase3Result.factors
    wasteRate += phase3Result.wasteRate

    // Phase 4: Content Clutter Detection
    const phase4Result = this.calculatePhase4ContentClutter(element)
    breakdown.phase4ContentClutter = phase4Result.wasteRate
    breakdown.clutterFactors = phase4Result.factors
    wasteRate += phase4Result.wasteRate

    // Legacy Quality Factors
    const legacyResult = this.calculateLegacyQualityFactors(element)
    breakdown.legacyQualityFactors = legacyResult.wasteRate
    breakdown.legacyFactors = legacyResult.factors
    wasteRate += legacyResult.wasteRate

    // Cap at 80% to prevent unrealistic predictions
    const cappedWasteRate = Math.min(wasteRate, CONSTANTS.MAX_WASTE_RATE)

    breakdown.totalWasteRate = wasteRate
    breakdown.cappedWasteRate = cappedWasteRate

    return {
      wastedClicks: predictedClicks * cappedWasteRate,
      breakdown,
    }
  }

  /**
   * Phase 1: Element Classification Waste Calculation
   */
  private calculatePhase1ElementClassification(
    element: any,
    context?: PageContext,
  ): { wasteRate: number; category: string } {
    // Primary CTA: 0% waste (conversion-focused)
    if (this.isPrimaryCTA(element)) {
      return { wasteRate: ELEMENT_WASTE_RATES.primaryCTA, category: "Primary CTA" }
    }

    // Navigation elements: +40% waste (major distraction)
    if (this.isNavigationElement(element)) {
      return { wasteRate: ELEMENT_WASTE_RATES.navigation, category: "Navigation" }
    }

    // Social media links: +35% waste (major distraction)
    if (this.isSocialMediaLink(element)) {
      return { wasteRate: ELEMENT_WASTE_RATES.socialMedia, category: "Social Media" }
    }

    // External links: +30% waste (takes users away)
    if (this.isExternalLink(element, context)) {
      return { wasteRate: ELEMENT_WASTE_RATES.externalLink, category: "External Link" }
    }

    // Interruptive elements: +30% waste (steals focus)
    if (this.isInterruptiveElement(element)) {
      return { wasteRate: ELEMENT_WASTE_RATES.interruptive, category: "Interruptive" }
    }

    // Auto-playing media: +25% waste (visual distraction)
    if (this.isAutoPlayingMedia(element)) {
      return { wasteRate: ELEMENT_WASTE_RATES.autoPlayingMedia, category: "Auto-playing Media" }
    }

    // Competing CTAs: +20% waste (choice paralysis)
    if (this.isCompetingCTA(element)) {
      return { wasteRate: ELEMENT_WASTE_RATES.competingCTA, category: "Competing CTA" }
    }

    // Internal navigation: +10% waste (guided tour)
    if (this.isInternalNavigation(element, context)) {
      return { wasteRate: ELEMENT_WASTE_RATES.internalNavigation, category: "Internal Navigation" }
    }

    // Trust indicators: +5% waste (builds confidence)
    if (this.isTrustIndicator(element)) {
      return { wasteRate: ELEMENT_WASTE_RATES.trustIndicator, category: "Trust Indicator" }
    }

    // Supporting elements: +5% waste (minimal waste)
    if (this.isSupportingElement(element)) {
      return { wasteRate: ELEMENT_WASTE_RATES.supportingContent, category: "Supporting Content" }
    }

    // Unknown elements: +15% waste
    return { wasteRate: ELEMENT_WASTE_RATES.unknown, category: "Unknown" }
  }

  /**
   * Phase 2: Attention Ratio Analysis
   */
  private calculatePhase2AttentionRatio(
    element: any,
    context?: PageContext,
  ): { wasteRate: number; attentionRatio?: number } {
    if (!context?.allElements) {
      return { wasteRate: 0 }
    }

    const clickableElements = context.allElements.filter((el) => el.isInteractive).length
    const primaryCTAs = context.allElements.filter((el) => this.isPrimaryCTA(el)).length || 1
    const attentionRatio = clickableElements / primaryCTAs

    if (attentionRatio > ATTENTION_RATIO_THRESHOLDS.high.threshold) {
      return {
        wasteRate: ATTENTION_RATIO_THRESHOLDS.high.wasteRate,
        attentionRatio,
      }
    } else if (attentionRatio > ATTENTION_RATIO_THRESHOLDS.medium.threshold) {
      return {
        wasteRate: ATTENTION_RATIO_THRESHOLDS.medium.wasteRate,
        attentionRatio,
      }
    }

    return { wasteRate: 0, attentionRatio }
  }

  /**
   * Phase 3: Visual Emphasis Analysis
   */
  private calculatePhase3VisualEmphasis(element: any): { wasteRate: number; factors: string[] } {
    let waste = 0
    const factors: string[] = []

    // High contrast non-primary elements: +10% waste
    if (element.hasHighContrast && !this.isPrimaryCTA(element)) {
      waste += VISUAL_EMPHASIS_WASTE.highContrastDistraction
      factors.push("High contrast distraction")
    }

    // Auto-rotating components: +15% waste
    if (element.isAutoRotating || element.className?.includes("carousel") || element.className?.includes("slider")) {
      waste += VISUAL_EMPHASIS_WASTE.autoRotatingComponents
      factors.push("Auto-rotating component")
    }

    // High z-index overlays: +10% waste
    if (element.style?.zIndex && Number.parseInt(element.style.zIndex) > 1000) {
      waste += VISUAL_EMPHASIS_WASTE.highZIndexOverlays
      factors.push("High z-index overlay")
    }

    // Sticky elements analysis
    const isSticky = element.className?.includes("sticky") || element.className?.includes("fixed")
    if (isSticky) {
      if (this.isPrimaryCTA(element)) {
        waste += VISUAL_EMPHASIS_WASTE.stickyCTA // Beneficial for CTAs
        factors.push("Sticky CTA (beneficial)")
      } else {
        waste += VISUAL_EMPHASIS_WASTE.stickyNavigation
        factors.push("Sticky navigation")
      }
    }

    return { wasteRate: waste, factors }
  }

  /**
   * Phase 4: Content Clutter Detection
   */
  private calculatePhase4ContentClutter(element: any): { wasteRate: number; factors: string[] } {
    let waste = 0
    const factors: string[] = []

    // Long text blocks without CTAs: +10% waste
    if (element.text && element.text.length > 500 && !element.hasNearbyCTA) {
      waste += CONTENT_CLUTTER_WASTE.longTextWithoutCTA
      factors.push("Long text without nearby CTA")
    }

    // Decorative images: +5% waste
    if (
      element.tagName === "IMG" &&
      (!element.alt || element.alt.includes("decoration") || element.alt.includes("banner"))
    ) {
      waste += CONTENT_CLUTTER_WASTE.decorativeImages
      factors.push("Decorative image")
    }

    // Visual noise: +8% waste
    if (
      element.className?.includes("animation") ||
      element.className?.includes("blink") ||
      element.className?.includes("flash")
    ) {
      waste += CONTENT_CLUTTER_WASTE.visualNoise
      factors.push("Visual noise/animation")
    }

    // Multiple competing elements: +12% waste
    if (element.hasMultipleCompetingElements) {
      waste += CONTENT_CLUTTER_WASTE.competingElements
      factors.push("Multiple competing elements")
    }

    return { wasteRate: waste, factors }
  }

  /**
   * Legacy Quality Factors
   */
  private calculateLegacyQualityFactors(element: any): { wasteRate: number; factors: string[] } {
    let waste = 0
    const factors: string[] = []

    // Non-interactive elements: +30% waste
    if (!element.isInteractive) {
      waste += LEGACY_QUALITY_WASTE.nonInteractive
      factors.push("Non-interactive element")
    }

    // Interactive elements without button styling: +10% waste
    if (element.isInteractive && !element.hasButtonStyling) {
      waste += LEGACY_QUALITY_WASTE.missingButtonStyling
      factors.push("Missing button styling")
    }

    // Below-the-fold elements: +10% waste
    if (!element.isAboveFold) {
      waste += LEGACY_QUALITY_WASTE.belowFold
      factors.push("Below the fold")
    }

    // Elements with minimal text (<3 chars): +15% waste
    if (element.text && element.text.length < 3) {
      waste += LEGACY_QUALITY_WASTE.minimalText
      factors.push("Minimal text content")
    }

    return { wasteRate: waste, factors }
  }

  /**
   * Calculate sophisticated average cost per click based on multiple factors
   */
  private calculateAverageCPC(context: PageContext): number {
    // Step 1: Start with base CPC - UPDATED to $2.93
    let baseCPC = 2.93 // Updated from CPC_CONSTANTS.SEARCH_NETWORK_BASE

    // Determine if this is likely display network traffic
    if (context.trafficSource === "social" || context.trafficSource === "referral") {
      baseCPC = 2.93 // Updated from CPC_CONSTANTS.DISPLAY_NETWORK_BASE
    }

    // Step 2: Apply industry-specific CPC
    let industryCPC = baseCPC
    if (context.industry && INDUSTRY_MODIFIERS[context.industry]) {
      industryCPC = Math.max(INDUSTRY_MODIFIERS[context.industry].avgCPC, 2.93) // Ensure minimum $2.93
    }

    // Step 3: Apply B2B vs B2C modifier
    const businessType = this.determineBusinessType(context)
    const businessMultiplier = businessType === "b2b" ? CPC_CONSTANTS.B2B_MULTIPLIER : CPC_CONSTANTS.B2C_MULTIPLIER

    industryCPC *= businessMultiplier

    // Step 4: Apply traffic source modifiers
    const trafficSourceMultiplier = CPC_CONSTANTS.TRAFFIC_SOURCE_CPC[context.trafficSource] ?? 0.3
    let finalCPC = industryCPC * trafficSourceMultiplier

    // Step 5: Apply device type modifiers
    const deviceMultiplier = CPC_CONSTANTS.DEVICE_CPC_MODIFIERS[context.deviceType] ?? 1.0
    finalCPC *= deviceMultiplier

    // Step 6: Apply competition level modifier
    const competitionLevel = this.determineCompetitionLevel(context)
    const competitionMultiplier = CPC_CONSTANTS.COMPETITION_MODIFIERS[competitionLevel]
    finalCPC *= competitionMultiplier

    // Step 7: Apply quality score modifier (estimated based on context)
    const qualityScore = this.estimateQualityScore(context)
    const qualityMultiplier = CPC_CONSTANTS.QUALITY_SCORE_MODIFIERS[qualityScore]
    finalCPC *= qualityMultiplier

    // Step 8: Apply geographic modifier (if available)
    const geoTier = this.determineGeoTier(context)
    const geoMultiplier = CPC_CONSTANTS.GEO_MODIFIERS[geoTier]
    finalCPC *= geoMultiplier

    // Step 9: Apply time-based modifiers
    finalCPC *= this.getTimeBasedMultiplier(context)

    // Ensure minimum CPC of $2.93
    return Math.max(finalCPC, 2.93)
  }

  /**
   * Determine if this is B2B or B2C based on context
   */
  private determineBusinessType(context: PageContext): "b2b" | "b2c" {
    // Industry-based classification
    const b2bIndustries = ["saas", "technology", "legal", "finance", "leadgen"]
    const b2cIndustries = ["ecommerce", "travel", "consumerservices"]

    if (context.industry) {
      if (b2bIndustries.includes(context.industry)) return "b2b"
      if (b2cIndustries.includes(context.industry)) return "b2c"
    }

    // Traffic source hints
    if (context.trafficSource === "linkedin") return "b2b"
    if (context.trafficSource === "social") return "b2c" // Assuming Facebook/Instagram

    // URL-based hints (if available)
    if (context.url) {
      const url = context.url.toLowerCase()
      if (url.includes("enterprise") || url.includes("business") || url.includes("b2b")) {
        return "b2b"
      }
      if (url.includes("shop") || url.includes("buy") || url.includes("consumer")) {
        return "b2c"
      }
    }

    // Default to B2B for higher CPC estimate (conservative)
    return "b2b"
  }

  /**
   * Determine competition level based on context
   */
  private determineCompetitionLevel(context: PageContext): "high" | "medium" | "low" | "unknown" {
    // High competition industries
    const highCompetitionIndustries = ["legal", "finance", "consumerservices", "saas"]

    if (context.industry && highCompetitionIndustries.includes(context.industry)) {
      return "high"
    }

    // Medium competition
    const mediumCompetitionIndustries = ["technology", "automotive", "realestate"]
    if (context.industry && mediumCompetitionIndustries.includes(context.industry)) {
      return "medium"
    }

    // Low competition
    const lowCompetitionIndustries = ["content", "travel"]
    if (context.industry && lowCompetitionIndustries.includes(context.industry)) {
      return "low"
    }

    // Check for competitor presence
    if (context.competitorPresence === true) {
      return "high"
    }

    return "medium" // Default
  }

  /**
   * Estimate quality score based on page context
   */
  private estimateQualityScore(context: PageContext): "excellent" | "good" | "average" | "poor" | "unknown" {
    let score = 0

    // Page load time factor
    if (context.loadTime) {
      if (context.loadTime <= 2) score += 2
      else if (context.loadTime <= 3) score += 1
      else if (context.loadTime >= 5) score -= 1
    }

    // SSL and trust signals
    if (context.hasSSL) score += 1
    if (context.hasTrustBadges) score += 1
    if (context.hasTestimonials) score += 1

    // Brand recognition
    if (typeof context.brandRecognition === "number") {
      score += context.brandRecognition * 2
    } else if (context.brandRecognition === "high") {
      score += 2
    } else if (context.brandRecognition === "medium") {
      score += 1
    }

    // Ad message match (if available)
    if (context.adMessageMatch && context.adMessageMatch > 0.8) {
      score += 2
    } else if (context.adMessageMatch && context.adMessageMatch > 0.6) {
      score += 1
    }

    // Convert score to quality rating
    if (score >= 6) return "excellent"
    if (score >= 4) return "good"
    if (score >= 2) return "average"
    if (score >= 0) return "poor"

    return "unknown"
  }

  /**
   * Determine geographic tier (simplified)
   */
  private determineGeoTier(context: PageContext): "tier1" | "tier2" | "tier3" | "unknown" {
    // This would typically use actual geographic data
    // For now, return tier1 as default (conservative estimate)
    return "tier1"
  }

  /**
   * Apply time-based multipliers
   */
  private getTimeBasedMultiplier(context: PageContext): number {
    let multiplier = 1.0

    // Time of day adjustments
    if (context.timeOfDay === "morning" || context.timeOfDay === "afternoon") {
      multiplier *= 1.1 // Business hours premium
    } else if (context.timeOfDay === "evening") {
      multiplier *= 0.95
    } else if (context.timeOfDay === "night") {
      multiplier *= 0.8
    }

    // Day of week adjustments
    if (context.dayOfWeek === "weekday") {
      multiplier *= 1.05 // Weekday premium for B2B
    }

    // Seasonality adjustments
    if (context.seasonality === "high") {
      multiplier *= 1.2 // High season premium
    } else if (context.seasonality === "low") {
      multiplier *= 0.85
    }

    return multiplier
  }

  // Helper methods for element classification (FIXED: Server-safe implementations)
  private isPrimaryCTA(element: any): boolean {
    const text = element.text?.toLowerCase() || ""
    const className = element.className?.toLowerCase() || ""

    return (
      text.includes("buy") ||
      text.includes("purchase") ||
      text.includes("order") ||
      text.includes("subscribe") ||
      text.includes("sign up") ||
      text.includes("get started") ||
      text.includes("download") ||
      text.includes("try free") ||
      className.includes("primary") ||
      className.includes("cta") ||
      className.includes("btn-primary")
    )
  }

  private isNavigationElement(element: any): boolean {
    const tagName = element.tagName?.toLowerCase()
    const className = element.className?.toLowerCase() || ""

    return (
      tagName === "nav" ||
      className.includes("nav") ||
      className.includes("menu") ||
      className.includes("header") ||
      className.includes("breadcrumb")
    )
  }

  // FIXED: Server-safe external link detection
  private isExternalLink(element: any, context?: PageContext): boolean {
    const href = element.href || ""
    if (!href.startsWith("http")) return false

    try {
      const url = new URL(href)
      // Use context.url if available, otherwise assume it's external
      if (context?.url) {
        const contextUrl = new URL(context.url)
        return url.hostname !== contextUrl.hostname
      }
      // If no context URL, check for common external patterns
      return !href.includes("localhost") && !href.includes("127.0.0.1")
    } catch {
      return false
    }
  }

  private isSocialMediaLink(element: any): boolean {
    const href = element.href?.toLowerCase() || ""
    const className = element.className?.toLowerCase() || ""
    const text = element.text?.toLowerCase() || ""

    return (
      href.includes("facebook") ||
      href.includes("twitter") ||
      href.includes("instagram") ||
      href.includes("linkedin") ||
      href.includes("youtube") ||
      href.includes("tiktok") ||
      className.includes("social") ||
      text.includes("follow") ||
      text.includes("share")
    )
  }

  private isAutoPlayingMedia(element: any): boolean {
    const tagName = element.tagName?.toLowerCase()
    return (
      (tagName === "video" && element.autoplay) ||
      (tagName === "audio" && element.autoplay) ||
      element.className?.includes("autoplay") ||
      element.className?.includes("auto-play")
    )
  }

  private isCompetingCTA(element: any): boolean {
    const text = element.text?.toLowerCase() || ""
    const className = element.className?.toLowerCase() || ""

    return (
      (text.includes("learn more") ||
        text.includes("read more") ||
        text.includes("explore") ||
        text.includes("discover") ||
        text.includes("see more") ||
        className.includes("secondary") ||
        className.includes("btn-secondary")) &&
      !this.isPrimaryCTA(element)
    )
  }

  private isInterruptiveElement(element: any): boolean {
    const className = element.className?.toLowerCase() || ""

    return (
      className.includes("modal") ||
      className.includes("popup") ||
      className.includes("overlay") ||
      className.includes("notification") ||
      className.includes("alert") ||
      className.includes("banner") ||
      className.includes("toast")
    )
  }

  private isSupportingElement(element: any): boolean {
    const text = element.text?.toLowerCase() || ""

    return (
      text.includes("help") ||
      text.includes("support") ||
      text.includes("faq") ||
      text.includes("contact") ||
      text.includes("about") ||
      text.includes("terms") ||
      text.includes("privacy")
    )
  }

  private isTrustIndicator(element: any): boolean {
    const text = element.text?.toLowerCase() || ""
    const className = element.className?.toLowerCase() || ""

    return (
      text.includes("testimonial") ||
      text.includes("review") ||
      text.includes("guarantee") ||
      text.includes("secure") ||
      text.includes("certified") ||
      text.includes("verified") ||
      className.includes("trust") ||
      className.includes("badge") ||
      className.includes("seal")
    )
  }

  // FIXED: Server-safe internal navigation detection
  private isInternalNavigation(element: any, context?: PageContext): boolean {
    const href = element.href || ""

    // Check for relative URLs
    if (href.startsWith("/") || href.startsWith("#")) {
      return true
    }

    // Check for absolute URLs that match the current domain
    if (href.startsWith("http") && context?.url) {
      try {
        const linkUrl = new URL(href)
        const contextUrl = new URL(context.url)
        return linkUrl.hostname === contextUrl.hostname
      } catch {
        return false
      }
    }

    // Check for localhost patterns (common in development)
    if (href.includes("localhost") || href.includes("127.0.0.1")) {
      return true
    }

    return false
  }

  /**
   * Create empty results when no valid elements exist
   */
  private createEmptyResults(elements: ScoredElement[]): ClickPredictionResult[] {
    return elements.map((element) => ({
      elementId: element.element.id || `${element.element.tagName}-${Date.now()}`,
      predictedClicks: 0.1,
      ctr: 0.01,
      clickShare: 0.1,
      rawScore: 0,
      clickProbability: 0,
      confidence: "low" as const,
      riskFactors: ["No valid scoring data"],
      estimatedClicks: 0,
      wastedClicks: 0,
      wastedSpend: 0,
      avgCPC: 0,
      wasteBreakdown: undefined,
    }))
  }

  /**
   * Apply advanced distribution strategies
   */
  applyAdvancedDistribution(results: ClickPredictionResult[], context: PageContext): ClickPredictionResult[] {
    // Apply Pareto principle (80/20 rule)
    const sortedResults = [...results].sort((a, b) => b.predictedClicks - a.predictedClicks)
    const top20Percent = Math.ceil(sortedResults.length * 0.2)

    // Redistribute some clicks to top performers
    const redistributionFactor = 0.1
    const totalRedistribution = results.reduce((sum, r) => sum + r.predictedClicks, 0) * redistributionFactor

    return results.map((result, index) => {
      const isTopPerformer = sortedResults.slice(0, top20Percent).includes(result)

      if (isTopPerformer) {
        const boost = totalRedistribution / top20Percent
        return {
          ...result,
          predictedClicks: result.predictedClicks + boost,
          estimatedClicks: Math.round(result.predictedClicks + boost),
        }
      } else {
        const reduction = totalRedistribution / (results.length - top20Percent)
        return {
          ...result,
          predictedClicks: Math.max(0.1, result.predictedClicks - reduction),
          estimatedClicks: Math.round(Math.max(0.1, result.predictedClicks - reduction)),
        }
      }
    })
  }
}
