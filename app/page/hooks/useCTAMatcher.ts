"use client"

import { useMemo } from "react"
import type { CTAInsight, DOMData, MatchedElement, DebugMatch, ElementCoordinates } from "../types"
import { logger } from "@/lib/utils/logger"

const moduleLogger = logger.module("cta-matcher")

export function useCTAMatcher(imageSize: { width: number; height: number }) {
  return useMemo(() => {
    class CTAMatcher {
      private imageSize: { width: number; height: number }

      constructor(imageSize: { width: number; height: number }) {
        this.imageSize = imageSize
      }

      private calculateSimilarity(text1: string, text2: string): number {
        const t1 = text1.toLowerCase().trim()
        const t2 = text2.toLowerCase().trim()

        if (!t1 || !t2) return 0
        if (t1 === t2) return 1.0
        if (t1.includes(t2) || t2.includes(t1)) return 0.8

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

      findMatchingElement(
        analysisResult: CTAInsight,
        domData: DOMData,
      ): { match: MatchedElement | null; debug: DebugMatch[] } {
        const searchTexts = [analysisResult.text, ...analysisResult.alternativeTexts].map((text) =>
          text.toLowerCase().trim(),
        )
        const debugInfo: DebugMatch[] = []
        const candidates: MatchedElement[] = []

        // Only log in development
        moduleLogger.debug("Searching for CTA texts", { searchTexts })

        // Search buttons
        domData.buttons.forEach((button) => {
          if (!button.isVisible || !button.text?.trim()) return

          const bestSimilarity = Math.max(
            ...searchTexts.map((searchText) => this.calculateSimilarity(button.text, searchText)),
          )
          const { priority, score } = this.calculatePriority(button.coordinates)

          debugInfo.push({
            text: button.text || "(empty)",
            similarity: bestSimilarity,
            coordinates: button.coordinates,
            type: "button",
            priority,
            priorityScore: score,
          })

          if (button.text && button.text.trim() && bestSimilarity > 0.6) {
            candidates.push({
              coordinates: button.coordinates,
              text: button.text,
              type: "button",
              confidence: bestSimilarity,
              priority,
              priorityScore: score,
            })
          }
        })

        // Search links
        domData.links.forEach((link) => {
          if (!link.isVisible || !link.text?.trim()) return

          const bestSimilarity = Math.max(
            ...searchTexts.map((searchText) => this.calculateSimilarity(link.text, searchText)),
          )
          const { priority, score } = this.calculatePriority(link.coordinates)

          debugInfo.push({
            text: link.text || "(empty)",
            similarity: bestSimilarity,
            coordinates: link.coordinates,
            type: "link",
            priority,
            priorityScore: score,
          })

          if (link.text && link.text.trim() && bestSimilarity > 0.6) {
            candidates.push({
              coordinates: link.coordinates,
              text: link.text,
              type: "link",
              confidence: bestSimilarity,
              priority,
              priorityScore: score,
            })
          }
        })

        // Section-first selection logic - prioritize hero over header regardless of individual scores
        let bestMatch: MatchedElement | null = null

        // Partition candidates by section
        const heroCandidates = candidates.filter(
          (candidate) => candidate.coordinates.y >= 150 && candidate.coordinates.y < 800,
        )
        const headerCandidates = candidates.filter((candidate) => candidate.coordinates.y < 150)
        const otherAboveFoldCandidates = candidates.filter(
          (candidate) => candidate.coordinates.y >= 800 && candidate.coordinates.y < 1000,
        )

        // Select best candidate using section hierarchy
        if (heroCandidates.length > 0) {
          // Sort hero candidates by priority score, then by confidence
          heroCandidates.sort((a, b) => {
            if (Math.abs(a.priorityScore - b.priorityScore) > 0.1) {
              return b.priorityScore - a.priorityScore
            }
            return b.confidence - a.confidence
          })
          bestMatch = heroCandidates[0]
        } else if (headerCandidates.length > 0) {
          // Sort header candidates by priority score, then by confidence
          headerCandidates.sort((a, b) => {
            if (Math.abs(a.priorityScore - b.priorityScore) > 0.1) {
              return b.priorityScore - a.priorityScore
            }
            return b.confidence - a.confidence
          })
          bestMatch = headerCandidates[0]
        } else if (otherAboveFoldCandidates.length > 0) {
          // Sort other above-fold candidates by priority score, then by confidence
          otherAboveFoldCandidates.sort((a, b) => {
            if (Math.abs(a.priorityScore - b.priorityScore) > 0.1) {
              return b.priorityScore - a.priorityScore
            }
            return b.confidence - a.confidence
          })
          bestMatch = otherAboveFoldCandidates[0]
        }

        // Handle form association (preserve existing logic)
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

    return new CTAMatcher(imageSize)
  }, [imageSize])
}
