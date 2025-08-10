// Click Prediction Model - Traffic Analysis System

import type { TrafficParams, PageContext } from "./types"
import {
  BASE_BOUNCE_RATES,
  TRAFFIC_SOURCE_MODIFIERS,
  DEVICE_MODIFIERS,
  INDUSTRY_MODIFIERS,
  CONSTANTS,
} from "./constants"

export class TrafficAnalyzer {
  /**
   * Calculate bounce rate based on traffic parameters
   */
  calculateBounceRate(params: TrafficParams): number {
    const { trafficSource, deviceType, loadTime, adMessageMatch } = params

    // Base bounce rate by traffic source
    let bounceRate = BASE_BOUNCE_RATES[trafficSource] || CONSTANTS.DEFAULT_BOUNCE_RATE

    // Device adjustments
    const deviceModifier = DEVICE_MODIFIERS[deviceType] || CONSTANTS.DEFAULT_DEVICE_MODIFIER
    bounceRate *= deviceModifier

    // Load time penalty
    if (loadTime > 3.0) {
      bounceRate *= 1 + (loadTime - 3.0) * 0.1
    }

    // Ad message match bonus
    bounceRate *= 1 - adMessageMatch * 0.2

    return Math.min(Math.max(bounceRate, 0.1), 0.9)
  }

  /**
   * Calculate total page clicks from engagement metrics
   */
  calculateTotalClicks(context: PageContext): number {
    const bounceRate = this.calculateBounceRate({
      trafficSource: context.trafficSource,
      deviceType: context.deviceType,
      loadTime: context.loadTime,
      adMessageMatch: context.adMessageMatch,
    })

    const engagementRate = 1 - bounceRate
    const engagedUsers = context.totalImpressions * engagementRate

    return engagedUsers * CONSTANTS.AVG_CLICKS_PER_ENGAGED_USER
  }

  /**
   * Get traffic source modifier
   */
  getTrafficSourceModifier(trafficSource: PageContext["trafficSource"]): number {
    return TRAFFIC_SOURCE_MODIFIERS[trafficSource] || CONSTANTS.DEFAULT_TRAFFIC_MODIFIER
  }

  /**
   * Get device type modifier
   */
  getDeviceModifier(deviceType: PageContext["deviceType"]): number {
    return DEVICE_MODIFIERS[deviceType] || CONSTANTS.DEFAULT_DEVICE_MODIFIER
  }

  /**
   * Apply industry-specific modifiers
   */
  applyIndustryModifiers(
    baseValue: number,
    industry: PageContext["industry"],
    type: "formCompletionRate" | "ctaClickRate" | "bounceRateAdjustment",
  ): number {
    if (!industry) return baseValue

    const modifier = INDUSTRY_MODIFIERS[industry]
    if (!modifier) return baseValue

    switch (type) {
      case "formCompletionRate":
        return baseValue * modifier.formCompletionRate
      case "ctaClickRate":
        return baseValue * modifier.ctaClickRate
      case "bounceRateAdjustment":
        return baseValue + modifier.bounceRateAdjustment
      default:
        return baseValue
    }
  }

  /**
   * Calculate comprehensive traffic modifiers
   */
  calculateTrafficModifiers(context: PageContext): {
    trafficSourceModifier: number
    deviceModifier: number
    bounceRate: number
    totalClicks: number
    engagementRate: number
  } {
    const trafficSourceModifier = this.getTrafficSourceModifier(context.trafficSource)
    const deviceModifier = this.getDeviceModifier(context.deviceType)

    const bounceRate = this.calculateBounceRate({
      trafficSource: context.trafficSource,
      deviceType: context.deviceType,
      loadTime: context.loadTime,
      adMessageMatch: context.adMessageMatch,
    })

    const totalClicks = this.calculateTotalClicks(context)
    const engagementRate = 1 - bounceRate

    return {
      trafficSourceModifier,
      deviceModifier,
      bounceRate,
      totalClicks,
      engagementRate,
    }
  }

  /**
   * Adjust scores based on traffic characteristics
   */
  applyTrafficAdjustments(baseScore: number, context: PageContext): number {
    const modifiers = this.calculateTrafficModifiers(context)

    let adjustedScore = baseScore
    adjustedScore *= modifiers.trafficSourceModifier
    adjustedScore *= modifiers.deviceModifier

    // Apply industry-specific adjustments
    if (context.industry) {
      adjustedScore = this.applyIndustryModifiers(adjustedScore, context.industry, "ctaClickRate")
    }

    return adjustedScore
  }
}
