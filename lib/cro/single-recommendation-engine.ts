import type { WastedClickAnalysis, WastedClickElement } from "@/lib/prediction/wasted-click-model-v5-3"

interface SingleCRORecommendation {
  // Core recommendation
  title: string
  action: string
  projectedResult: string
  whyItWorks: string
  roiInsight: string

  // Data backing
  currentCTR: number
  projectedCTR: number
  improvementPercent: number
  elementsToRemove: number

  // Implementation
  difficulty: "easy" | "medium" | "hard"
  timeframe: string
  priorityScore: number
}

export class SingleCRORecommendationEngine {
  /**
   * Generate one high-impact recommendation based on wasted click analysis
   */
  generateRecommendation(
    wastedClickAnalysis: WastedClickAnalysis,
    primaryCTAText: string,
    existingCROAnalysis: { currentCTR: number; projectedCTR: number; ctrLabel: string },
    isFormRelated = false,
    deviceType: "desktop" | "mobile" = "desktop",
  ): SingleCRORecommendation {
    // Get the highest impact elements to remove - make this more inclusive
    const highWasteElements = wastedClickAnalysis.highRiskElements
      .filter((el) => el.wastedClickScore > 0.1) // Lowered from 0.15 to 0.1
      .slice(0, 8) // Increased from 5 to 8 to capture more elements

    if (highWasteElements.length === 0) {
      return this.generateFallbackRecommendation(primaryCTAText, existingCROAnalysis, isFormRelated)
    }

    // Use the existing CRO analysis data instead of calculating new values
    const projectedImprovement = {
      newCTR: existingCROAnalysis.projectedCTR,
      improvementPercent:
        ((existingCROAnalysis.projectedCTR - existingCROAnalysis.currentCTR) / existingCROAnalysis.currentCTR) * 100,
    }

    // Generate the recommendation based on the dominant waste pattern
    const dominantPattern = this.identifyDominantWastePattern(highWasteElements)

    return this.buildRecommendation(
      dominantPattern,
      highWasteElements,
      primaryCTAText,
      existingCROAnalysis,
      projectedImprovement,
      isFormRelated,
      deviceType,
    )
  }

  /**
   * Calculate projected CTR improvement from removing high-waste elements
   */
  private calculateProjectedImprovement(
    elementsToRemove: WastedClickElement[],
    currentCTR: number,
    isFormRelated: boolean,
  ): { newCTR: number; improvementPercent: number } {
    // Base improvement calculation
    const totalWasteScore = elementsToRemove.reduce((sum, el) => sum + el.wastedClickScore, 0)
    const avgWasteScore = totalWasteScore / elementsToRemove.length

    // Form CTAs typically see higher improvements when distractions are removed
    const formMultiplier = isFormRelated ? 1.4 : 1.2
    const elementCountMultiplier = Math.min(1 + elementsToRemove.length * 0.1, 1.8)

    // Calculate improvement based on waste reduction
    const baseImprovementRate = avgWasteScore * 0.3 * formMultiplier * elementCountMultiplier
    const cappedImprovementRate = Math.min(baseImprovementRate, 0.6) // Cap at 60% improvement

    const newCTR = currentCTR * (1 + cappedImprovementRate)
    const improvementPercent = cappedImprovementRate * 100

    return { newCTR, improvementPercent }
  }

  /**
   * Identify the dominant waste pattern to focus the recommendation
   */
  private identifyDominantWastePattern(elements: WastedClickElement[]): string {
    const patterns = {
      navigation: elements.filter((el) => el.type === "navigation").length,
      socialLinks: elements.filter((el) => el.type === "social-link").length,
      additionalCTAs: elements.filter((el) => el.type === "additional-cta").length,
      blogLinks: elements.filter((el) => el.type === "blog-link").length,
      formFields: elements.filter((el) => el.element.tagName?.toLowerCase() === "input").length,
      externalLinks: elements.filter((el) => el.type === "external-link").length,
    }

    // Find the most common pattern
    const dominantPattern = Object.entries(patterns).sort(([, a], [, b]) => b - a)[0][0]

    return dominantPattern
  }

  private getFormFieldCount(elementsToRemove: WastedClickElement[]): number {
    return elementsToRemove.filter((el) => el.element.tagName?.toLowerCase() === "input").length
  }

  /**
   * Build the final recommendation based on the dominant pattern
   */
  private buildRecommendation(
    pattern: string,
    elementsToRemove: WastedClickElement[],
    primaryCTAText: string,
    existingCROAnalysis: { currentCTR: number; projectedCTR: number; ctrLabel: string },
    projectedImprovement: { newCTR: number; improvementPercent: number },
    isFormRelated: boolean,
    deviceType: "desktop" | "mobile",
  ): SingleCRORecommendation {
    const elementCount = elementsToRemove.length
    const specificElements = elementsToRemove
      .slice(0, 5)
      .map((el) => {
        // Better element identification with more context
        const elementText =
          el.element.text ||
          el.element.textContent ||
          el.element.innerText ||
          el.element.id ||
          el.element.className?.split(" ")[0] ||
          `${el.type} element`

        // Add element type context for clarity
        const elementType =
          el.type === "navigation"
            ? "navigation link"
            : el.type === "social-link"
              ? "social media link"
              : el.type === "blog-link"
                ? "blog/content link"
                : el.type === "additional-cta"
                  ? "competing CTA"
                  : el.type === "external-link"
                    ? "external link"
                    : el.type === "form-field"
                      ? "form field"
                      : "clickable element"

        return `"${elementText}" (${elementType})`
      })
      .join(", ")

    const ctrLabel = existingCROAnalysis.ctrLabel
    const formFieldCount = this.getFormFieldCount(elementsToRemove)

    // Pattern-specific recommendations with specific elements
    const recommendations = {
      navigation: {
        title: `Navigation links reduce conversions`,
        action: `REMOVE these ${elementCount} specific navigation elements that our Wasted Click Model v5.3 identified as high-distraction: ${specificElements}. These exact elements were used in calculating your ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% projection. Hide them or move to footer to achieve the projected improvement.`,
        whyItWorks: `Our Wasted Click Model v5.3 flagged these specific navigation links as creating confusion with high waste scores. Users who click these elements rarely convert back to your primary CTA.`,
        roiInsight: `We calculated your ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% projection by removing these exact navigation elements. Navigation simplification typically lifts conversions by 25-45%.`,
      },

      socialLinks: {
        title: `Social media links reduce conversions`,
        action: `REMOVE these ${elementCount} specific social media elements that our analysis flagged as high-waste: ${specificElements}. These are the exact elements we removed to calculate your projected improvement. Hide them or move to footer/sidebar to reach your target.`,
        whyItWorks: `Our wasted click model identified these specific social links as conversion killers with high waste scores. They take users off-site with near-zero return rate.`,
        roiInsight: `Your ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% projection assumes removing these specific social elements. This typically increases ${ctrLabel.toLowerCase()} by 20-40%.`,
      },

      additionalCTAs: {
        title: `Too many buttons confuse visitors`,
        action: `REMOVE these ${elementCount} specific competing CTAs that our analysis identified as high-waste: ${specificElements}. Focus entirely on "${primaryCTAText}" to achieve the projected improvement. Convert these to text links or remove completely.`,
        whyItWorks: `Our model flagged these specific additional CTAs as creating choice overload. When users see multiple options, they often choose none.`,
        roiInsight: `We calculated your ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% improvement by removing these specific competing CTAs. Single-CTA pages convert 30-50% better.`,
      },

      blogLinks: {
        title: `Blog links distract from your main goal`,
        action: `REMOVE these ${elementCount} specific blog/content elements that our wasted click analysis flagged as high-distraction: ${specificElements}. These exact elements were factored into your projection calculation. Move to footer or separate section to reach target.`,
        whyItWorks: `Our analysis shows these specific blog links satisfy curiosity but kill buying momentum with high waste scores. Users who click these rarely return to convert.`,
        roiInsight: `Your ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% projection assumes removing these exact blog elements. This typically improves ${ctrLabel.toLowerCase()} by 15-35%.`,
      },

      formFields: {
        title: `Your form is creating unnecessary friction`,
        action: `REMOVE these ${elementCount} specific elements that our Wasted Click Model v5.3 identified as high-distraction: ${specificElements}. ${formFieldCount > 0 ? `Also reduce form fields from ${formFieldCount} to 3 or fewer.` : ""} These exact elements were used in calculating your ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% projection. Keep only essential fields to reach target.`,
        whyItWorks: `Our model shows these specific form fields create unnecessary friction and reduce completion rates. Each field reduces completion by 5-10%.`,
        roiInsight: `We calculated your ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% improvement by removing these exact form fields. Form reduction typically increases completion by 20-60%.`,
      },

      externalLinks: {
        title: `External links take visitors away`,
        action: `REMOVE these ${elementCount} specific external elements that our wasted click analysis flagged as high-risk: ${specificElements}. These are the exact elements we removed to calculate your projection. Remove completely or open in new tab with warning to reach target.`,
        whyItWorks: `Our analysis shows these specific external links have 90%+ exit rates and high waste scores. Once users leave your site, they rarely return to convert.`,
        roiInsight: `Your ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% projection assumes removing these specific external elements. This can improve ${ctrLabel.toLowerCase()} by 25-50%.`,
      },
    }

    const rec = recommendations[pattern] || recommendations.navigation

    return {
      title: rec.title,
      action: rec.action,
      projectedResult: `${ctrLabel} uplift from ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% based on removing the specific high-waste elements our model identified.`,
      whyItWorks: rec.whyItWorks,
      roiInsight: rec.roiInsight,

      currentCTR: existingCROAnalysis.currentCTR,
      projectedCTR: existingCROAnalysis.projectedCTR,
      improvementPercent: projectedImprovement.improvementPercent,
      elementsToRemove: elementCount,

      difficulty: elementCount <= 3 ? "easy" : elementCount <= 6 ? "medium" : "hard",
      timeframe: elementCount <= 3 ? "1-2 hours" : elementCount <= 6 ? "Half day" : "1-2 days",
      priorityScore: Math.min(Math.round(projectedImprovement.improvementPercent * 2), 100),
    }
  }

  /**
   * Fallback recommendation when no high-waste elements are found
   */
  private generateFallbackRecommendation(
    primaryCTAText: string,
    existingCROAnalysis: { currentCTR: number; projectedCTR: number; ctrLabel: string },
    isFormRelated: boolean,
  ): SingleCRORecommendation {
    const ctrLabel = existingCROAnalysis.ctrLabel
    const improvementPercent =
      ((existingCROAnalysis.projectedCTR - existingCROAnalysis.currentCTR) / existingCROAnalysis.currentCTR) * 100

    return {
      title: `Optimize "${primaryCTAText}" for maximum impact`,
      action: `Increase the visual prominence of your primary CTA "${primaryCTAText}" by using high-contrast colors, larger size, and more white space around it.`,
      projectedResult: `${ctrLabel} uplift from ${(existingCROAnalysis.currentCTR * 100).toFixed(1)}% → ${(existingCROAnalysis.projectedCTR * 100).toFixed(1)}% through improved CTA visibility and prominence.`,
      whyItWorks: `Visual hierarchy drives attention. A more prominent CTA captures more clicks from users who are already interested but might miss a subtle button.`,
      roiInsight: `CTA optimization typically improves ${ctrLabel.toLowerCase()} by 15-30%. Small visual changes can yield significant conversion improvements.`,

      currentCTR: existingCROAnalysis.currentCTR,
      projectedCTR: existingCROAnalysis.projectedCTR,
      improvementPercent,
      elementsToRemove: 0,

      difficulty: "easy",
      timeframe: "1-2 hours",
      priorityScore: 75,
    }
  }
}

// Export singleton instance
export const singleCRORecommendationEngine = new SingleCRORecommendationEngine()
