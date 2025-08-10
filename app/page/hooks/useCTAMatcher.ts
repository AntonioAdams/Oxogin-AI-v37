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
        if (t1.includes(t2) || t2.includes(t1)) return 0.85

        // Enhanced fuzzy matching with CTA synonyms
        const ctaSynonyms: { [key: string]: string[] } = {
          'join': ['sign up', 'register', 'get started', 'start', 'signup'],
          'start': ['get started', 'begin', 'join', 'sign up', 'launch'],
          'shop': ['buy', 'purchase', 'order', 'get', 'browse'],
          'learn': ['start learning', 'study', 'explore', 'discover'],
          'get': ['obtain', 'receive', 'start', 'grab', 'download'],
          'try': ['test', 'demo', 'sample', 'experience'],
          'book': ['schedule', 'reserve', 'appointment'],
          'contact': ['reach out', 'get in touch', 'talk'],
          'more': ['options', 'details', 'info', 'information']
        }

        // Check synonym matching
        for (const [key, synonyms] of Object.entries(ctaSynonyms)) {
          if ((t1.includes(key) && synonyms.some(syn => t2.includes(syn))) ||
              (t2.includes(key) && synonyms.some(syn => t1.includes(syn))) ||
              (synonyms.some(syn => t1.includes(syn)) && synonyms.some(syn => t2.includes(syn)))) {
            return 0.75
          }
        }

        const words1 = t1.split(/\s+/).filter((word) => word.length > 0)
        const words2 = t2.split(/\s+/).filter((word) => word.length > 0)
        
        // Enhanced partial word matching
        let partialMatches = 0
        for (const word1 of words1) {
          for (const word2 of words2) {
            // Exact word match
            if (word1 === word2) {
              partialMatches += 1
            }
            // Partial word match (minimum 3 characters)
            else if (word1.length >= 3 && word2.length >= 3) {
              if (word1.includes(word2) || word2.includes(word1)) {
                partialMatches += 0.7
              }
              // Common prefixes/suffixes for action words
              else if ((word1.startsWith(word2.slice(0, 3)) && word1.length > 3) ||
                       (word2.startsWith(word1.slice(0, 3)) && word2.length > 3)) {
                partialMatches += 0.5
              }
            }
          }
        }

        if (partialMatches === 0) return 0
        return Math.min(0.9, partialMatches / Math.max(words1.length, words2.length))
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

          if (button.text && button.text.trim() && bestSimilarity > 0.3) {
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

          if (link.text && link.text.trim() && bestSimilarity > 0.3) {
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

        // FALLBACK STRATEGY: If no text matches found, implement intelligent fallbacks
        if (!bestMatch) {
          moduleLogger.debug("No text matches found, implementing fallback strategies", {
            totalDebugInfo: debugInfo.length,
            searchTexts
          })

          // Fallback 1: Find highest similarity score even if below threshold
          const allElementsWithSimilarity = debugInfo.filter(info => info.similarity > 0)
          if (allElementsWithSimilarity.length > 0) {
            // Sort by similarity score, then by priority score
            allElementsWithSimilarity.sort((a, b) => {
              if (Math.abs(a.similarity - b.similarity) > 0.05) {
                return b.similarity - a.similarity
              }
              return b.priorityScore - a.priorityScore
            })

            const fallbackElement = allElementsWithSimilarity[0]
            // Find the corresponding button/link data
            const originalElement = [...domData.buttons, ...domData.links].find(
              el => el.text === fallbackElement.text && 
                    el.coordinates.x === fallbackElement.coordinates.x &&
                    el.coordinates.y === fallbackElement.coordinates.y
            )

            if (originalElement) {
              bestMatch = {
                coordinates: originalElement.coordinates,
                text: originalElement.text || 'Unknown',
                type: fallbackElement.type as 'button' | 'link',
                confidence: fallbackElement.similarity,
                priority: fallbackElement.priority,
                priorityScore: fallbackElement.priorityScore
              }
              moduleLogger.debug("Fallback 1 successful - using highest similarity element", {
                text: bestMatch.text,
                similarity: fallbackElement.similarity
              })
            }
          }

          // Fallback 2: If still no match, use highest priority score in hero section
          if (!bestMatch) {
            const heroElements = debugInfo.filter(
              info => info.coordinates.y >= 150 && info.coordinates.y < 800
            )
            if (heroElements.length > 0) {
              heroElements.sort((a, b) => b.priorityScore - a.priorityScore)
              const fallbackElement = heroElements[0]
              
              const originalElement = [...domData.buttons, ...domData.links].find(
                el => el.text === fallbackElement.text && 
                      el.coordinates.x === fallbackElement.coordinates.x &&
                      el.coordinates.y === fallbackElement.coordinates.y
              )

              if (originalElement) {
                bestMatch = {
                  coordinates: originalElement.coordinates,
                  text: originalElement.text || 'Unknown',
                  type: fallbackElement.type as 'button' | 'link',
                  confidence: 0.25, // Low confidence for fallback
                  priority: fallbackElement.priority,
                  priorityScore: fallbackElement.priorityScore
                }
                moduleLogger.debug("Fallback 2 successful - using highest priority hero element", {
                  text: bestMatch.text,
                  priorityScore: fallbackElement.priorityScore
                })
              }
            }
          }

          // Fallback 3: Last resort - use any high-priority element above fold
          if (!bestMatch) {
            const aboveFoldElements = debugInfo.filter(
              info => info.coordinates.y < 1000
            )
            if (aboveFoldElements.length > 0) {
              aboveFoldElements.sort((a, b) => b.priorityScore - a.priorityScore)
              const fallbackElement = aboveFoldElements[0]
              
              const originalElement = [...domData.buttons, ...domData.links].find(
                el => el.text === fallbackElement.text && 
                      el.coordinates.x === fallbackElement.coordinates.x &&
                      el.coordinates.y === fallbackElement.coordinates.y
              )

              if (originalElement) {
                bestMatch = {
                  coordinates: originalElement.coordinates,
                  text: originalElement.text || 'Unknown',
                  type: fallbackElement.type as 'button' | 'link',
                  confidence: 0.2, // Very low confidence for last resort
                  priority: fallbackElement.priority,
                  priorityScore: fallbackElement.priorityScore
                }
                moduleLogger.debug("Fallback 3 successful - using highest priority above-fold element", {
                  text: bestMatch.text,
                  priorityScore: fallbackElement.priorityScore
                })
              }
            }
          }
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
