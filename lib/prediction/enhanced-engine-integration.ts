// Enhanced Element Matching Integration for Prediction Engine
// Drop-in performance optimization with zero API changes

import type { DOMElement, ClickPredictionResult } from "./types"
import { EnhancedElementMatcher } from "./enhanced-element-matcher"

export class EnhancedPredictionHelper {
  private matcher: EnhancedElementMatcher
  private currentBatchElements: DOMElement[] | null = null
  private performanceMode: 'enhanced' | 'fallback' | 'auto' = 'auto'

  constructor() {
    this.matcher = new EnhancedElementMatcher(20) // 20px tolerance
  }

  /**
   * Initialize for a new prediction batch
   * Call this at the start of predictClicks() to enable caching
   */
  startBatch(elements: DOMElement[]): void {
    this.currentBatchElements = elements
    this.matcher.clearCache() // Ensure fresh index for new batch
  }

  /**
   * Enhanced element finding with performance tracking
   * Drop-in replacement for: validElements.find((el) => el.id === targetId)
   */
  findElementById(targetId: string, fallbackElements?: DOMElement[]): DOMElement | null {
    const elements = this.currentBatchElements || fallbackElements
    if (!elements) {
      console.warn('EnhancedPredictionHelper: No elements available for matching')
      return null
    }

    const startTime = performance.now()

    try {
      // Use enhanced matching
      const result = this.matcher.findElement(targetId, elements)
      
      const executionTime = performance.now() - startTime

      // Log performance in development
      if (process.env.NODE_ENV === "development" && result.element) {
        console.log(`🎯 Enhanced element match: ${result.strategy} (${result.confidence}) in ${executionTime.toFixed(2)}ms`)
      }

      // Auto-fallback if enhanced matching is consistently slow
      if (this.performanceMode === 'auto' && executionTime > 10) {
        console.warn(`Enhanced matching took ${executionTime.toFixed(2)}ms, consider fallback mode`)
      }

      return result.element

    } catch (error) {
      // Fallback to simple matching on error
      console.warn('Enhanced element matching failed, using fallback:', error)
      return this.simpleFallbackMatch(targetId, elements)
    }
  }

  /**
   * Batch element lookup for better performance
   * Use when you need to find multiple elements at once
   */
  findMultipleElements(targetIds: string[]): Map<string, DOMElement | null> {
    const results = new Map<string, DOMElement | null>()
    
    if (!this.currentBatchElements) {
      targetIds.forEach(id => results.set(id, null))
      return results
    }

    const batchStartTime = performance.now()

    // Process all lookups with shared index
    targetIds.forEach(targetId => {
      const element = this.findElementById(targetId)
      results.set(targetId, element)
    })

    const batchTime = performance.now() - batchStartTime

    if (process.env.NODE_ENV === "development") {
      console.log(`🔍 Batch element lookup: ${targetIds.length} elements in ${batchTime.toFixed(2)}ms`)
    }

    return results
  }

  /**
   * Enhanced primary CTA finding with multiple strategies
   * Replacement for the problematic primaryCTAElement lookup
   */
  findPrimaryCTAElement(primaryCTA: ClickPredictionResult, fallbackElements?: DOMElement[]): DOMElement | null {
    const elements = this.currentBatchElements || fallbackElements
    if (!elements) return null

    if (process.env.NODE_ENV === "development") {
      console.log(`🎯 Finding primary CTA element: ${primaryCTA.elementId}`)
    }

    // Strategy 1: Enhanced matching
    const enhancedResult = this.findElementById(primaryCTA.elementId, elements)
    if (enhancedResult) {
      return enhancedResult
    }

    // Strategy 2: Text-based matching (for CTAs, text is often stable)
    if (primaryCTA.text) {
      const textMatches = elements.filter(el => 
        el.text && 
        el.text.trim().toLowerCase() === (primaryCTA.text as any)?.trim().toLowerCase() &&
        el.isInteractive
      )
      
      if (textMatches.length === 1) {
        if (process.env.NODE_ENV === "development") {
          console.log(`🎯 Found CTA by text match: "${primaryCTA.text}"`)
        }
        return textMatches[0]
      }
    }

    // Strategy 3: Highest scoring interactive element (reasonable fallback for CTA)
    const interactiveElements = elements.filter(el => el.isInteractive && el.isAboveFold)
    if (interactiveElements.length > 0) {
      // Return first above-fold interactive element as best guess
      const fallbackCTA = interactiveElements[0]
      if (process.env.NODE_ENV === "development") {
        console.log(`🎯 Using fallback CTA: ${fallbackCTA.text || fallbackCTA.id}`)
      }
      return fallbackCTA
    }

    return null
  }

  /**
   * Performance summary for optimization insights
   */
  getPerformanceSummary() {
    return {
      ...this.matcher.getPerformanceStats(),
      mode: this.performanceMode,
      currentBatchSize: this.currentBatchElements?.length || 0
    }
  }

  /**
   * Clean up batch state
   */
  endBatch(): void {
    this.currentBatchElements = null
    
    if (process.env.NODE_ENV === "development") {
      const stats = this.getPerformanceSummary()
      if (stats.totalMatches > 0) {
        console.log(`📊 Enhanced matching batch complete:`, {
          matches: stats.totalMatches,
          avgTime: `${stats.averageTime}ms`,
          strategies: Object.keys(stats.strategyBreakdown)
        })
      }
    }
  }

  /**
   * Simple fallback matching (original logic)
   */
  private simpleFallbackMatch(targetId: string, elements: DOMElement[]): DOMElement | null {
    return elements.find(el => el.id === targetId) || null
  }

  /**
   * Set performance mode for testing
   */
  setPerformanceMode(mode: 'enhanced' | 'fallback' | 'auto'): void {
    this.performanceMode = mode
    console.log(`🔧 Enhanced matcher mode: ${mode}`)
  }
}

// Singleton instance for global use
export const enhancedPredictionHelper = new EnhancedPredictionHelper()
