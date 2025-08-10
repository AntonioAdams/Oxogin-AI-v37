import type { CTAInsight, DOMData, MatchedElement, DebugMatch, ElementCoordinates } from "../contracts/cta"
import { logger } from "../utils/logger"

const moduleLogger = logger.module("ai-match")

// Simple inline CTA detection logic to avoid import issues
export class CTAMatcher {
  private imageSize: { width: number; height: number }

  constructor(imageSize: { width: number; height: number }) {
    this.imageSize = imageSize
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const t1 = text1.toLowerCase().trim()
    const t2 = text2.toLowerCase().trim()

    if (!t1 || !t2) return 0

    // Exact match
    if (t1 === t2) return 1.0

    // Partial match
    if (t1.includes(t2) || t2.includes(t1)) return 0.8

    // Word overlap
    const words1 = t1.split(/\s+/).filter((word) => word.length > 0)
    const words2 = t2.split(/\s+/).filter((word) => word.length > 0)
    const commonWords = words1.filter((word) => words2.includes(word))

    if (commonWords.length === 0) return 0
    return commonWords.length / Math.max(words1.length, words2.length)
  }

  private calculatePriority(coordinates: ElementCoordinates): {
    priority: "hero" | "header" | "below-fold"
    score: number
  } {
    const { x, y, width } = coordinates
    const foldLine = 1000
    const centerX = this.imageSize.width / 2
    const headerThreshold = 150

    if (y > foldLine) {
      return { priority: "below-fold", score: 1 }
    }

    if (y < headerThreshold) {
      const rightmostScore = x / this.imageSize.width
      return { priority: "header", score: 2 + rightmostScore }
    }

    const elementCenterX = x + width / 2
    const distanceFromCenter = Math.abs(elementCenterX - centerX)
    const centerScore = 1 - distanceFromCenter / centerX

    return { priority: "hero", score: 10 + centerScore }
  }

  private scoreTextIntent(text: string): number {
    const lowerText = text.toLowerCase().trim()

    // Product-specific + value (highest priority)
    const productValuePatterns = ["for free", "free trial", "try free", "download free", "get free", "start free"]
    if (productValuePatterns.some((pattern) => lowerText.includes(pattern))) {
      return 4 // Increased from 3 to 4 for product-specific value CTAs
    }

    // Strong action verbs
    const strongActions = [
      "buy",
      "purchase",
      "get",
      "start",
      "try",
      "download",
      "sign up",
      "signup",
      "register",
      "book",
      "request",
    ]
    if (strongActions.some((action) => lowerText.includes(action))) {
      return 3
    }

    // Medium actions
    const mediumActions = ["learn", "discover", "contact", "demo", "preview"]
    if (mediumActions.some((action) => lowerText.includes(action))) {
      return 2
    }

    // Passive phrases
    if (lowerText.includes("click here") || lowerText.includes("more info")) {
      return 0
    }

    return 1
  }

  private calculateVisualProminenceScore(
    candidate: MatchedElement | { coordinates: ElementCoordinates; text: string; type: string; className?: string },
    allCandidates: Array<{ coordinates: ElementCoordinates; text: string; type: string; className?: string }>,
    domData: DOMData,
  ): number {
    const { coordinates, className = "" } = candidate
    const { width, height, x, y } = coordinates

    let prominenceScore = 0

    // 1. Size relative to viewport (0-3 points)
    const viewportArea = this.imageSize.width * this.imageSize.height
    const elementArea = width * height
    const sizeRatio = elementArea / viewportArea

    if (sizeRatio > 0.01) {
      // Large element (>1% of viewport)
      prominenceScore += 3
    } else if (sizeRatio > 0.005) {
      // Medium element (>0.5% of viewport)
      prominenceScore += 2
    } else if (sizeRatio > 0.002) {
      // Small but visible element (>0.2% of viewport)
      prominenceScore += 1
    }

    // 2. Center positioning bonus (0-2 points)
    const centerX = this.imageSize.width / 2
    const centerY = this.imageSize.height / 2
    const elementCenterX = x + width / 2
    const elementCenterY = y + height / 2

    const distanceFromCenterX = Math.abs(elementCenterX - centerX) / centerX
    const distanceFromCenterY = Math.abs(elementCenterY - centerY) / centerY

    // Horizontal centering is more important for CTAs
    if (distanceFromCenterX < 0.1) {
      // Very centered horizontally
      prominenceScore += 2
    } else if (distanceFromCenterX < 0.3) {
      // Reasonably centered
      prominenceScore += 1
    }

    // 3. Button styling and prominence indicators (0-2 points)
    const classNameLower = className.toLowerCase()
    const hasButtonClass =
      classNameLower.includes("btn") ||
      classNameLower.includes("button") ||
      classNameLower.includes("cta") ||
      candidate.type === "button"

    const hasProminentClass =
      classNameLower.includes("primary") ||
      classNameLower.includes("main") ||
      classNameLower.includes("hero") ||
      classNameLower.includes("action") ||
      classNameLower.includes("call-to-action")

    if (hasButtonClass && hasProminentClass) {
      prominenceScore += 2
    } else if (hasButtonClass) {
      prominenceScore += 1
    }

    // 4. Supporting text detection bonus (0-2 points)
    const supportingTextBonus = this.detectSupportingText(candidate, domData)
    prominenceScore += supportingTextBonus

    // 5. Color contrast and styling prominence estimation (0-2 points)
    // We can't directly measure color contrast from DOM data, but we can infer from class names
    const colorProminenceBonus = this.estimateColorProminence(className)
    prominenceScore += colorProminenceBonus

    // 6. Relative size compared to other candidates (0-1 point)
    if (allCandidates.length > 1) {
      const avgArea =
        allCandidates.reduce((sum, c) => sum + c.coordinates.width * c.coordinates.height, 0) / allCandidates.length
      if (elementArea > avgArea * 1.5) {
        prominenceScore += 1
      }
    }

    moduleLogger.debug("Visual prominence calculated", {
      text: candidate.text,
      sizeRatio: sizeRatio.toFixed(6),
      centerDistance: distanceFromCenterX.toFixed(3),
      hasButtonClass,
      hasProminentClass,
      supportingTextBonus,
      colorProminenceBonus,
      totalScore: prominenceScore,
    })

    return Math.min(prominenceScore, 12) // Cap at 12 points
  }

  private detectSupportingText(candidate: { coordinates: ElementCoordinates; text: string }, domData: DOMData): number {
    const { coordinates } = candidate
    const searchRadius = 100 // pixels to search around the CTA

    // Look for supporting text patterns near the CTA
    const supportingPatterns = [
      "no credit card",
      "no credit card required",
      "free forever",
      "cancel anytime",
      "no commitment",
      "risk free",
      "money back",
      "guarantee",
      "instant access",
      "immediate access",
    ]

    let supportingScore = 0

    // Check buttons for supporting text in their vicinity
    domData.buttons.forEach((button) => {
      if (button.text === candidate.text) return // Skip self

      const distance = Math.sqrt(
        Math.pow(button.coordinates.x - coordinates.x, 2) + Math.pow(button.coordinates.y - coordinates.y, 2),
      )

      if (distance <= searchRadius) {
        const buttonTextLower = button.text.toLowerCase()
        if (supportingPatterns.some((pattern) => buttonTextLower.includes(pattern))) {
          supportingScore += 1
        }
      }
    })

    // Check links for supporting text
    domData.links.forEach((link) => {
      if (link.text === candidate.text) return // Skip self

      const distance = Math.sqrt(
        Math.pow(link.coordinates.x - coordinates.x, 2) + Math.pow(link.coordinates.y - coordinates.y, 2),
      )

      if (distance <= searchRadius) {
        const linkTextLower = link.text.toLowerCase()
        if (supportingPatterns.some((pattern) => linkTextLower.includes(pattern))) {
          supportingScore += 1
        }
      }
    })

    return Math.min(supportingScore, 2) // Cap at 2 points
  }

  private estimateColorProminence(className: string): number {
    const classNameLower = className.toLowerCase()

    // High prominence color indicators
    const highProminenceClasses = [
      "primary",
      "accent",
      "highlight",
      "featured",
      "standout",
      "bright",
      "bold",
      "vibrant",
    ]

    // Medium prominence color indicators
    const mediumProminenceClasses = ["secondary", "outlined", "bordered", "colored"]

    if (highProminenceClasses.some((cls) => classNameLower.includes(cls))) {
      return 2
    } else if (mediumProminenceClasses.some((cls) => classNameLower.includes(cls))) {
      return 1
    }

    return 0
  }

  private enhancedCTAScoring(
    analysisResult: CTAInsight,
    domData: DOMData,
  ): { match: MatchedElement | null; debug: DebugMatch[] } {
    const searchTexts = [analysisResult.text, ...analysisResult.alternativeTexts].map((text) =>
      text.toLowerCase().trim(),
    )
    const debugInfo: DebugMatch[] = []
    const candidates: MatchedElement[] = []

    moduleLogger.debug("Enhanced CTA Detection - searching for", { searchTexts })

    // Process buttons with enhanced scoring
    domData.buttons.forEach((button, index) => {
      if (!button.isVisible || !button.text?.trim()) return

      const bestSimilarity = Math.max(
        ...searchTexts.map((searchText) => this.calculateSimilarity(button.text, searchText)),
      )
      const { priority, score } = this.calculatePriority(button.coordinates)
      const textIntentScore = this.scoreTextIntent(button.text)

      // Create candidate for visual prominence calculation
      const candidateForVisual = {
        coordinates: button.coordinates,
        text: button.text,
        type: "button",
        className: button.className,
      }

      // Calculate enhanced visual prominence
      const visualProminenceScore = this.calculateVisualProminenceScore(candidateForVisual, [], domData)

      // Enhanced scoring: location + text intent + visual prominence + bonuses
      let enhancedScore = score + textIntentScore + visualProminenceScore
      if (button.formAction) enhancedScore += 2 // Form association bonus
      if (button.isAboveFold) enhancedScore += 1 // Above fold bonus

      debugInfo.push({
        text: button.text || "(empty)",
        similarity: bestSimilarity,
        coordinates: button.coordinates,
        type: "button",
        priority,
        priorityScore: enhancedScore,
      })

      moduleLogger.debug("Button analysis", {
        index,
        text: button.text,
        similarity: bestSimilarity,
        enhancedScore,
        visualProminence: visualProminenceScore,
      })

      if (button.text && button.text.trim() && (bestSimilarity > 0.5 || enhancedScore > 8)) {
        candidates.push({
          coordinates: button.coordinates,
          text: button.text,
          type: "button",
          confidence: Math.max(bestSimilarity, enhancedScore / 20), // Adjusted denominator for higher scores
          priority,
          priorityScore: enhancedScore,
        })
      }
    })

    // Process links with enhanced scoring
    domData.links.forEach((link, index) => {
      if (!link.isVisible || !link.text?.trim()) return

      const bestSimilarity = Math.max(
        ...searchTexts.map((searchText) => this.calculateSimilarity(link.text, searchText)),
      )
      const { priority, score } = this.calculatePriority(link.coordinates)
      const textIntentScore = this.scoreTextIntent(link.text)

      // Create candidate for visual prominence calculation
      const candidateForVisual = {
        coordinates: link.coordinates,
        text: link.text,
        type: "link",
        className: link.className,
      }

      // Calculate enhanced visual prominence
      const visualProminenceScore = this.calculateVisualProminenceScore(candidateForVisual, [], domData)

      // Enhanced scoring
      let enhancedScore = score + textIntentScore + visualProminenceScore
      if (link.hasButtonStyling) enhancedScore += 1 // Button styling bonus
      if (link.isAboveFold) enhancedScore += 1 // Above fold bonus

      debugInfo.push({
        text: link.text || "(empty)",
        similarity: bestSimilarity,
        coordinates: link.coordinates,
        type: "link",
        priority,
        priorityScore: enhancedScore,
      })

      moduleLogger.debug("Link analysis", {
        index,
        text: link.text,
        similarity: bestSimilarity,
        enhancedScore,
        visualProminence: visualProminenceScore,
      })

      if (link.text && link.text.trim() && (bestSimilarity > 0.5 || enhancedScore > 6)) {
        candidates.push({
          coordinates: link.coordinates,
          text: link.text,
          type: "link",
          confidence: Math.max(bestSimilarity, enhancedScore / 20), // Adjusted denominator for higher scores
          priority,
          priorityScore: enhancedScore,
        })
      }
    })

    // Enhanced Hero-First Prioritization Logic
    // Filter to only above-fold elements first
    const aboveFoldCandidates = candidates.filter((candidate) => {
      const foldLine = 1000
      return candidate.coordinates.y < foldLine
    })

    moduleLogger.debug("Candidate distribution", {
      aboveFold: aboveFoldCandidates.length,
      total: candidates.length,
    })

    if (aboveFoldCandidates.length === 0) {
      moduleLogger.warn("No above-fold candidates found, using all candidates")
      // Fallback to original logic if no above-fold candidates
      candidates.sort((a, b) => {
        if (Math.abs(a.priorityScore - b.priorityScore) > 0.5) {
          return b.priorityScore - a.priorityScore
        }
        return b.confidence - a.confidence
      })

      const bestMatch = candidates.length > 0 ? candidates[0] : null
      moduleLogger.debug("Best match (fallback)", { bestMatch })
      return { match: bestMatch, debug: debugInfo }
    }

    // Partition above-fold candidates into sections
    const heroCandidates = aboveFoldCandidates.filter((candidate) => {
      const y = candidate.coordinates.y
      return y >= 150 && y < 800 // Hero section: below header, above fold
    })

    const headerCandidates = aboveFoldCandidates.filter((candidate) => {
      const y = candidate.coordinates.y
      return y < 150 // Header section: top 150px
    })

    const otherAboveFoldCandidates = aboveFoldCandidates.filter((candidate) => {
      const y = candidate.coordinates.y
      return y >= 800 // This shouldn't happen since we filtered above-fold, but safety check
    })

    moduleLogger.debug("Section distribution", {
      hero: heroCandidates.length,
      header: headerCandidates.length,
      other: otherAboveFoldCandidates.length,
    })

    // Hero-First Selection Logic
    let bestMatch: MatchedElement | null = null

    // 1. Try Hero section first
    if (heroCandidates.length > 0) {
      heroCandidates.sort((a, b) => {
        if (Math.abs(a.priorityScore - b.priorityScore) > 0.5) {
          return b.priorityScore - a.priorityScore
        }
        return b.confidence - a.confidence
      })
      bestMatch = heroCandidates[0]
      moduleLogger.debug("Selected from HERO section", { bestMatch })
    }

    // 2. Fallback to Header section
    else if (headerCandidates.length > 0) {
      headerCandidates.sort((a, b) => {
        if (Math.abs(a.priorityScore - b.priorityScore) > 0.5) {
          return b.priorityScore - a.priorityScore
        }
        return b.confidence - a.confidence
      })
      bestMatch = headerCandidates[0]
      moduleLogger.debug("Selected from HEADER section", { bestMatch })
    }

    // 3. Final fallback to other above-fold
    else if (otherAboveFoldCandidates.length > 0) {
      otherAboveFoldCandidates.sort((a, b) => {
        if (Math.abs(a.priorityScore - b.priorityScore) > 0.5) {
          return b.priorityScore - a.priorityScore
        }
        return b.confidence - a.confidence
      })
      bestMatch = otherAboveFoldCandidates[0]
      moduleLogger.debug("Selected from OTHER above-fold section", { bestMatch })
    }

    return { match: bestMatch, debug: debugInfo }
  }

  findMatchingElement(
    analysisResult: CTAInsight,
    domData: DOMData,
  ): { match: MatchedElement | null; debug: DebugMatch[] } {
    moduleLogger.debug("Starting Enhanced CTA Detection")

    // Use enhanced scoring
    const { match: bestMatch, debug: debugInfo } = this.enhancedCTAScoring(analysisResult, domData)

    // Handle form association (keep existing logic)
    if (bestMatch && analysisResult.hasForm && domData.forms.length > 0) {
      const buttonY = bestMatch.coordinates.y
      let closestForm = domData.forms[0]
      let minDistance = Math.abs(closestForm.coordinates.y - buttonY)

      domData.forms.forEach((form) => {
        const distance = Math.abs(form.coordinates.y - buttonY)
        if (distance < minDistance) {
          minDistance = distance
          closestForm = form
        }
      })

      if (minDistance < 200) {
        const minX = Math.min(bestMatch.coordinates.x, closestForm.coordinates.x)
        const minY = Math.min(bestMatch.coordinates.y, closestForm.coordinates.y)
        const maxX = Math.max(
          bestMatch.coordinates.x + bestMatch.coordinates.width,
          closestForm.coordinates.x + closestForm.coordinates.width,
        )
        const maxY = Math.max(
          bestMatch.coordinates.y + bestMatch.coordinates.height,
          closestForm.coordinates.y + closestForm.coordinates.height,
        )

        bestMatch.coordinates = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
        bestMatch.type = "form-with-button"
      }
    }

    return { match: bestMatch, debug: debugInfo }
  }
}
