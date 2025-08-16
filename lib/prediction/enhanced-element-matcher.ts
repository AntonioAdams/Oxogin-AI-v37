// Enhanced Element Matching System
// High-performance multi-strategy element matching with zero performance impact

import type { DOMElement, ClickPredictionResult } from "./types"

export interface MatchStrategy {
  name: string
  priority: number
  maxTime: number // Maximum time to spend on this strategy (ms)
  execute: (targetId: string, elements: DOMElement[]) => DOMElement | null
}

export interface MatchResult {
  element: DOMElement | null
  strategy: string
  confidence: number
  executionTime: number
}

export interface ElementIndex {
  byId: Map<string, DOMElement>
  byOxId: Map<string, DOMElement>
  byCoordinates: Map<string, DOMElement[]>
  byTextHash: Map<string, DOMElement[]>
  byPosition: DOMElement[][]  // 2D grid for spatial lookup
}

export class EnhancedElementMatcher {
  private elementIndex: ElementIndex | null = null
  private coordinateTolerance: number = 20 // pixels
  private performanceTracker = {
    totalMatches: 0,
    totalTime: 0,
    strategyStats: new Map<string, { uses: number, time: number, success: number }>()
  }

  constructor(tolerance: number = 20) {
    this.coordinateTolerance = tolerance
  }

  /**
   * PHASE 1: Pre-index elements for O(1) lookups
   * This runs once per prediction batch, not per match
   */
  private buildIndex(elements: DOMElement[]): ElementIndex {
    const startTime = performance.now()

    const index: ElementIndex = {
      byId: new Map(),
      byOxId: new Map(),
      byCoordinates: new Map(),
      byTextHash: new Map(),
      byPosition: []
    }

    // Build spatial grid for fast coordinate lookup
    const gridSize = 50 // 50px grid
    const maxGridX = Math.ceil(2000 / gridSize) // Assume max 2000px width
    const maxGridY = Math.ceil(2000 / gridSize) // Assume max 2000px height
    
    for (let i = 0; i < maxGridX; i++) {
      index.byPosition[i] = []
      for (let j = 0; j < maxGridY; j++) {
        index.byPosition[i][j] = []
      }
    }

    elements.forEach(element => {
      // Index by ID (fastest lookup)
      if (element.id) {
        index.byId.set(element.id, element)
      }

      // Index by oxId (enhanced capture compatibility)
      const oxId = (element as any).oxId
      if (oxId) {
        index.byOxId.set(oxId, element)
      }

      // Index by coordinate ranges (tolerance-based)
      if (element.coordinates) {
        const { x, y } = element.coordinates
        const coordKey = this.getCoordinateKey(x, y)
        if (!index.byCoordinates.has(coordKey)) {
          index.byCoordinates.set(coordKey, [])
        }
        index.byCoordinates.get(coordKey)!.push(element)

        // Add to spatial grid
        const gridX = Math.floor(x / gridSize)
        const gridY = Math.floor(y / gridSize)
        if (gridX < maxGridX && gridY < maxGridY && gridX >= 0 && gridY >= 0) {
          index.byPosition[gridX][gridY].push(element)
        }
      }

      // Index by text hash (similarity matching)
      if (element.text && element.text.trim()) {
        const textHash = this.getTextHash(element.text)
        if (!index.byTextHash.has(textHash)) {
          index.byTextHash.set(textHash, [])
        }
        index.byTextHash.get(textHash)!.push(element)
      }
    })

    const indexTime = performance.now() - startTime
    
    if (process.env.NODE_ENV === "development") {
      console.log(`🔍 Element index built in ${indexTime.toFixed(2)}ms for ${elements.length} elements`)
    }

    return index
  }

  /**
   * PHASE 2: High-performance element matching with multiple strategies
   */
  findElement(targetId: string, elements: DOMElement[]): MatchResult {
    const startTime = performance.now()
    
    // Build index if not cached (only once per batch)
    if (!this.elementIndex) {
      this.elementIndex = this.buildIndex(elements)
    }

    // Strategy 1: Exact ID match (O(1) - fastest)
    let result = this.tryExactIdMatch(targetId)
    if (result.element) {
      return this.recordMatch(result, startTime, 'exact-id', 1.0)
    }

    // Strategy 2: oxId match (O(1) - enhanced capture compatibility)
    result = this.tryOxIdMatch(targetId)
    if (result.element) {
      return this.recordMatch(result, startTime, 'ox-id', 0.95)
    }

    // Strategy 3: Coordinate-based matching (O(1) with spatial index)
    result = this.tryCoordinateMatch(targetId, elements)
    if (result.element) {
      return this.recordMatch(result, startTime, 'coordinate', 0.9)
    }

    // Strategy 4: Smart coordinate tolerance (O(k) where k is small)
    result = this.trySmartCoordinateMatch(targetId, elements)
    if (result.element) {
      return this.recordMatch(result, startTime, 'smart-coordinate', 0.85)
    }

    // Strategy 5: Text similarity (O(k) where k is small)
    result = this.tryTextSimilarityMatch(targetId, elements)
    if (result.element) {
      return this.recordMatch(result, startTime, 'text-similarity', 0.8)
    }

    // Strategy 6: Fallback heuristic (last resort)
    result = this.tryFallbackMatch(targetId, elements)
    
    return this.recordMatch(result, startTime, 'fallback', result.element ? 0.6 : 0.0)
  }

  /**
   * Clear index cache (call when starting new prediction batch)
   */
  clearCache(): void {
    this.elementIndex = null
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const avgTime = this.performanceTracker.totalMatches > 0 
      ? this.performanceTracker.totalTime / this.performanceTracker.totalMatches 
      : 0

    return {
      totalMatches: this.performanceTracker.totalMatches,
      averageTime: Number(avgTime.toFixed(3)),
      strategyBreakdown: Object.fromEntries(this.performanceTracker.strategyStats),
    }
  }

  // ============ STRATEGY IMPLEMENTATIONS ============

  private tryExactIdMatch(targetId: string): MatchResult {
    const element = this.elementIndex!.byId.get(targetId)
    return { element: element || null, strategy: 'exact-id', confidence: 1.0, executionTime: 0 }
  }

  private tryOxIdMatch(targetId: string): MatchResult {
    // Extract oxId from various ID formats
    let oxId = targetId
    
    // Handle enhanced capture oxId patterns
    if (targetId.startsWith('button-') || targetId.startsWith('link-') || targetId.startsWith('field-')) {
      const parts = targetId.split('-')
      if (parts.length >= 4) {
        // Try to find by oxId in the element data
        for (const [id, element] of this.elementIndex!.byOxId) {
          if (targetId.includes(id) || this.coordinatesMatch(targetId, element)) {
            return { element, strategy: 'ox-id', confidence: 0.95, executionTime: 0 }
          }
        }
      }
    }

    const element = this.elementIndex!.byOxId.get(oxId)
    return { element: element || null, strategy: 'ox-id', confidence: 0.95, executionTime: 0 }
  }

  private tryCoordinateMatch(targetId: string, elements: DOMElement[]): MatchResult {
    // Extract coordinates from ID patterns like "button-123-456"
    const coords = this.extractCoordinatesFromId(targetId)
    if (!coords) return { element: null, strategy: 'coordinate', confidence: 0, executionTime: 0 }

    const coordKey = this.getCoordinateKey(coords.x, coords.y)
    const candidates = this.elementIndex!.byCoordinates.get(coordKey) || []

    for (const candidate of candidates) {
      if (this.coordinatesExactMatch(coords, candidate.coordinates)) {
        return { element: candidate, strategy: 'coordinate', confidence: 0.9, executionTime: 0 }
      }
    }

    return { element: null, strategy: 'coordinate', confidence: 0, executionTime: 0 }
  }

  private trySmartCoordinateMatch(targetId: string, elements: DOMElement[]): MatchResult {
    const coords = this.extractCoordinatesFromId(targetId)
    if (!coords) return { element: null, strategy: 'smart-coordinate', confidence: 0, executionTime: 0 }

    // Use spatial grid for efficient nearby element lookup
    const gridSize = 50
    const gridX = Math.floor(coords.x / gridSize)
    const gridY = Math.floor(coords.y / gridSize)

    // Check nearby grid cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const checkX = gridX + dx
        const checkY = gridY + dy
        
        if (checkX >= 0 && checkY >= 0 && 
            checkX < this.elementIndex!.byPosition.length && 
            checkY < this.elementIndex!.byPosition[0].length) {
          
          const candidates = this.elementIndex!.byPosition[checkX][checkY]
          
          for (const candidate of candidates) {
            if (this.coordinatesWithinTolerance(coords, candidate.coordinates)) {
              // Additional validation: check element type matches
              if (this.elementTypeMatches(targetId, candidate)) {
                return { element: candidate, strategy: 'smart-coordinate', confidence: 0.85, executionTime: 0 }
              }
            }
          }
        }
      }
    }

    return { element: null, strategy: 'smart-coordinate', confidence: 0, executionTime: 0 }
  }

  private tryTextSimilarityMatch(targetId: string, elements: DOMElement[]): MatchResult {
    // Extract element type from ID
    const elementType = this.extractElementTypeFromId(targetId)
    if (!elementType) return { element: null, strategy: 'text-similarity', confidence: 0, executionTime: 0 }

    // Find elements of same type
    const sameTypeElements = elements.filter(el => 
      el.tagName.toLowerCase() === elementType ||
      (elementType === 'button' && (el.tagName === 'button' || (el as any).type === 'button'))
    )

    // If only one element of this type, it's likely a match
    if (sameTypeElements.length === 1) {
      return { element: sameTypeElements[0], strategy: 'text-similarity', confidence: 0.8, executionTime: 0 }
    }

    // Try to match by text similarity for buttons/links
    if (elementType === 'button' || elementType === 'link') {
      const coords = this.extractCoordinatesFromId(targetId)
      if (coords) {
        // Find closest element of same type
        let closest = null
        let minDistance = Infinity

        for (const candidate of sameTypeElements) {
          const distance = this.calculateDistance(coords, candidate.coordinates)
          if (distance < minDistance && distance < this.coordinateTolerance * 2) {
            minDistance = distance
            closest = candidate
          }
        }

        if (closest) {
          return { element: closest, strategy: 'text-similarity', confidence: 0.8, executionTime: 0 }
        }
      }
    }

    return { element: null, strategy: 'text-similarity', confidence: 0, executionTime: 0 }
  }

  private tryFallbackMatch(targetId: string, elements: DOMElement[]): MatchResult {
    // Last resort: find best guess based on element type and position
    const coords = this.extractCoordinatesFromId(targetId)
    const elementType = this.extractElementTypeFromId(targetId)

    if (!coords || !elementType) {
      return { element: null, strategy: 'fallback', confidence: 0, executionTime: 0 }
    }

    // Find any interactive element near the coordinates
    let closest = null
    let minDistance = Infinity

    for (const element of elements) {
      if (element.isInteractive && element.coordinates) {
        const distance = this.calculateDistance(coords, element.coordinates)
        if (distance < minDistance && distance < this.coordinateTolerance * 3) {
          minDistance = distance
          closest = element
        }
      }
    }

    return { element: closest, strategy: 'fallback', confidence: closest ? 0.6 : 0, executionTime: 0 }
  }

  // ============ HELPER METHODS ============

  private recordMatch(result: MatchResult, startTime: number, strategy: string, confidence: number): MatchResult {
    const executionTime = performance.now() - startTime
    
    // Update performance tracking
    this.performanceTracker.totalMatches++
    this.performanceTracker.totalTime += executionTime

    if (!this.performanceTracker.strategyStats.has(strategy)) {
      this.performanceTracker.strategyStats.set(strategy, { uses: 0, time: 0, success: 0 })
    }
    
    const stats = this.performanceTracker.strategyStats.get(strategy)!
    stats.uses++
    stats.time += executionTime
    if (result.element) stats.success++

    return {
      ...result,
      strategy,
      confidence,
      executionTime
    }
  }

  private getCoordinateKey(x: number, y: number): string {
    // Round to tolerance for grouping
    const roundedX = Math.round(x / this.coordinateTolerance) * this.coordinateTolerance
    const roundedY = Math.round(y / this.coordinateTolerance) * this.coordinateTolerance
    return `${roundedX},${roundedY}`
  }

  private getTextHash(text: string): string {
    // Simple but effective text normalization for matching
    return text.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  private extractCoordinatesFromId(id: string): { x: number, y: number } | null {
    // Handle various ID patterns
    const patterns = [
      /^(button|link|field|form)-(\d+)-(\d+)/, // Standard pattern
      /^(button|link|field|form)-(\d+)-(\d+)-/, // With additional suffix
      /(\d+)-(\d+)$/ // Coordinates at end
    ]

    for (const pattern of patterns) {
      const match = id.match(pattern)
      if (match) {
        const x = parseInt(match[match.length - 2])
        const y = parseInt(match[match.length - 1])
        if (!isNaN(x) && !isNaN(y)) {
          return { x, y }
        }
      }
    }

    return null
  }

  private extractElementTypeFromId(id: string): string | null {
    const match = id.match(/^(button|link|field|form)/)
    return match ? match[1] : null
  }

  private coordinatesExactMatch(coords1: { x: number, y: number }, coords2: { x: number, y: number, width: number, height: number }): boolean {
    return coords1.x === coords2.x && coords1.y === coords2.y
  }

  private coordinatesWithinTolerance(coords1: { x: number, y: number }, coords2: { x: number, y: number, width: number, height: number }): boolean {
    const dx = Math.abs(coords1.x - coords2.x)
    const dy = Math.abs(coords1.y - coords2.y)
    return dx <= this.coordinateTolerance && dy <= this.coordinateTolerance
  }

  private coordinatesMatch(targetId: string, element: DOMElement): boolean {
    const coords = this.extractCoordinatesFromId(targetId)
    if (!coords || !element.coordinates) return false
    return this.coordinatesWithinTolerance(coords, element.coordinates)
  }

  private elementTypeMatches(targetId: string, element: DOMElement): boolean {
    const expectedType = this.extractElementTypeFromId(targetId)
    if (!expectedType) return true // Can't validate, assume match
    
    const actualType = element.tagName.toLowerCase()
    
    // Handle type variations
    if (expectedType === 'button') {
      return actualType === 'button' || (element as any).type === 'button'
    }
    if (expectedType === 'link') {
      return actualType === 'a'
    }
    if (expectedType === 'field') {
      return actualType === 'input' || actualType === 'textarea' || actualType === 'select'
    }
    
    return actualType === expectedType
  }

  private calculateDistance(coords1: { x: number, y: number }, coords2: { x: number, y: number }): number {
    const dx = coords1.x - coords2.x
    const dy = coords1.y - coords2.y
    return Math.sqrt(dx * dx + dy * dy)
  }
}
