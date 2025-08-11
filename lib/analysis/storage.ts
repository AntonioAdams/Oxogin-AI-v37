import { debugLogCategory } from "@/lib/utils/logger"

export interface SavedAnalysis {
  id: string
  url: string
  title: string
  timestamp: Date
  desktopCaptureResult: any | null
  desktopAnalysisResult: any | null
  desktopMatchedElement: any | null
  desktopDebugMatches: any[]
  desktopImageSize: { width: number; height: number }
  desktopFormBoundaryBoxes: any[]
  desktopClickPredictions: any[]
  desktopShowTooltip: boolean
  desktopPrimaryCTAPrediction: any | null
  desktopCroAnalysisResult: any | null
  mobileCaptureResult: any | null
  mobileAnalysisResult: any | null
  mobileMatchedElement: any | null
  mobileDebugMatches: any[]
  mobileImageSize: { width: number; height: number }
  mobileFormBoundaryBoxes: any[]
  mobileClickPredictions: any[]
  mobileShowTooltip: boolean
  mobilePrimaryCTAPrediction: any | null
  mobileCroAnalysisResult: any | null
}

class AnalysisStorage {
  private storageKey = "cta-detector-analyses"
  private maxAnalyses = 3 // Keep last 3 analyses to prevent quota issues
  private saveTimeout: NodeJS.Timeout | null = null

  private async compressImage(blobUrl: string): Promise<string> {
    try {
      // Fetch the blob data
      const response = await fetch(blobUrl)
      const blob = await response.blob()

      // Create image element
      const img = new Image()
      img.crossOrigin = "anonymous"

      // Load the image
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = URL.createObjectURL(blob)
      })

      // Create canvas for compression
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      // Calculate new dimensions (max width 1200px to reduce size)
      const maxWidth = 1200
      const scale = Math.min(1, maxWidth / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale

      // Draw and compress the image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Convert to JPEG with 20% quality for ~80% size reduction
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.2)

      // Clean up
      URL.revokeObjectURL(img.src)

      return compressedDataUrl
    } catch (error) {
      debugLogCategory("Analysis Storage", "Failed to compress image, using original:", error)
      return blobUrl
    }
  }

  private async compressAnalysisImages(data: any): Promise<any> {
    const compressed = { ...data }

    try {
      // Compress desktop screenshot
      if (compressed.desktopCaptureResult?.screenshot) {
        compressed.desktopCaptureResult = {
          ...compressed.desktopCaptureResult,
          screenshot: await this.compressImage(compressed.desktopCaptureResult.screenshot),
        }
      }

      // Compress mobile screenshot
      if (compressed.mobileCaptureResult?.screenshot) {
        compressed.mobileCaptureResult = {
          ...compressed.mobileCaptureResult,
          screenshot: await this.compressImage(compressed.mobileCaptureResult.screenshot),
        }
      }
    } catch (error) {
      debugLogCategory("Analysis Storage", "Failed to compress analysis images:", error)
    }

    return compressed
  }

  private isStorageAvailable(): boolean {
    try {
      if (typeof window === "undefined") return false
      const testKey = "__storage_test__"
      localStorage.setItem(testKey, "test")
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  private generateId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private extractTitle(url: string, domData?: any): string {
    // Try to get title from DOM data first
    if (domData?.title && domData.title.trim()) {
      return domData.title.trim()
    }

    // Fallback to URL parsing
    try {
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`)
      const hostname = urlObj.hostname.replace("www.", "")
      return hostname.charAt(0).toUpperCase() + hostname.slice(1)
    } catch {
      return url.slice(0, 50) + (url.length > 50 ? "..." : "")
    }
  }

  async saveAnalysis(url: string, desktopData: any, mobileData: any): Promise<string> {
    if (!this.isStorageAvailable()) {
      debugLogCategory("Analysis Storage", "Local storage not available, cannot save analysis")
      return ""
    }

    // Clear any existing timeout to prevent duplicate saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    // Check if we already have an analysis for this URL that's very recent (within 30 seconds)
    const existing = this.getAnalyses()
    const recentAnalysis = existing.find((analysis) => {
      const timeDiff = Date.now() - analysis.timestamp.getTime()
      return analysis.url === url && timeDiff < 30000 // 30 seconds
    })

    let analysisId: string

    if (recentAnalysis) {
      // Update existing recent analysis instead of creating new one
      analysisId = recentAnalysis.id

      // Compress images before updating
      const compressedData = await this.compressAnalysisImages({
        ...desktopData,
        ...mobileData,
        timestamp: new Date(),
      })

      this.updateAnalysis(analysisId, compressedData)

      if (process.env.NODE_ENV === "development") {
        console.log("💾 Analysis updated (preventing duplicate):", analysisId)
      }
    } else {
      // Create new analysis
      analysisId = this.generateId()
      const title = this.extractTitle(
        url,
        desktopData.desktopCaptureResult?.domData || mobileData.mobileCaptureResult?.domData,
      )

      // Compress images before saving
      const compressedDesktopData = await this.compressAnalysisImages(desktopData)
      const compressedMobileData = await this.compressAnalysisImages(mobileData)

      const analysis: SavedAnalysis = {
        id: analysisId,
        url,
        title,
        timestamp: new Date(),
        ...compressedDesktopData,
        ...compressedMobileData,
      }

      try {
        const updated = [analysis, ...existing].slice(0, this.maxAnalyses)
        localStorage.setItem(this.storageKey, JSON.stringify(updated))

        if (process.env.NODE_ENV === "development") {
          console.log("💾 New analysis saved with compressed images:", { id: analysisId, title, url })
        }
      } catch (error) {
        console.error("Failed to save analysis:", error)
        // If quota exceeded, try to clear old analyses and retry
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          try {
            // Clear all analyses and try to save just the current one
            localStorage.removeItem(this.storageKey)
            localStorage.setItem(this.storageKey, JSON.stringify([analysis]))
            debugLogCategory("Analysis Storage", "Cleared old analyses due to quota limit, saved current analysis")
          } catch (retryError) {
            console.error("Failed to save analysis even after clearing:", retryError)
            // Try to save without images as last resort
            try {
              const analysisWithoutImages = {
                ...analysis,
                desktopCaptureResult: analysis.desktopCaptureResult ? { ...analysis.desktopCaptureResult, image: null } : null,
                mobileCaptureResult: analysis.mobileCaptureResult ? { ...analysis.mobileCaptureResult, image: null } : null,
              }
              localStorage.setItem(this.storageKey, JSON.stringify([analysisWithoutImages]))
              debugLogCategory("Analysis Storage", "Saved analysis without images due to quota limit")
            } catch (finalError) {
              console.error("Failed to save analysis even without images:", finalError)
              return ""
            }
          }
        } else {
          return ""
        }
      }
    }

    return analysisId
  }

  getAnalyses(): SavedAnalysis[] {
    if (!this.isStorageAvailable()) return []

    try {
      const data = localStorage.getItem(this.storageKey)
      if (!data) return []

      const analyses = JSON.parse(data)
      // Convert timestamp strings back to Date objects
      return analyses.map((analysis: any) => ({
        ...analysis,
        timestamp: new Date(analysis.timestamp),
      }))
    } catch (error) {
      console.error("Failed to load analyses:", error)
      return []
    }
  }

  getAnalysis(id: string): SavedAnalysis | null {
    const analyses = this.getAnalyses()
    return analyses.find((analysis) => analysis.id === id) || null
  }

  deleteAnalysis(id: string): void {
    if (!this.isStorageAvailable()) return

    try {
      const analyses = this.getAnalyses()
      const filtered = analyses.filter((analysis) => analysis.id !== id)
      localStorage.setItem(this.storageKey, JSON.stringify(filtered))

      if (process.env.NODE_ENV === "development") {
        debugLogCategory("Analysis Storage", "Analysis deleted:", id)
      }
    } catch (error) {
      console.error("Failed to delete analysis:", error)
    }
  }

  clearAllAnalyses(): void {
    if (!this.isStorageAvailable()) return

    try {
      localStorage.removeItem(this.storageKey)
      if (process.env.NODE_ENV === "development") {
        debugLogCategory("Analysis Storage", "All analyses cleared")
      }
    } catch (error) {
      console.error("Failed to clear analyses:", error)
    }
  }

  async updateAnalysis(id: string, updates: Partial<SavedAnalysis>): Promise<void> {
    if (!this.isStorageAvailable()) return

    try {
      const analyses = this.getAnalyses()
      const index = analyses.findIndex((analysis) => analysis.id === id)

      if (index !== -1) {
        // Compress images in updates if they exist
        const compressedUpdates = await this.compressAnalysisImages(updates)

        analyses[index] = { ...analyses[index], ...compressedUpdates, timestamp: new Date() }
        
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(analyses))
        } catch (error) {
          if (error.name === 'QuotaExceededError') {
            // Clear old analyses to free up space
            const recentAnalyses = analyses.slice(-5) // Keep only last 5 analyses
            localStorage.setItem(this.storageKey, JSON.stringify(recentAnalyses))
            console.warn("Storage quota exceeded, cleared old analyses and retried")
          } else {
            throw error
          }
        }

        if (process.env.NODE_ENV === "development") {
          debugLogCategory("Analysis Storage", "Analysis updated with compression:", id)
        }
      }
    } catch (error) {
      console.error("Failed to update analysis:", error)
    }
  }
}

export const analysisStorage = new AnalysisStorage()
