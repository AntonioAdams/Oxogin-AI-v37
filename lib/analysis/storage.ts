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
  private maxAnalyses = 2 // Keep last 2 analyses to prevent quota issues with larger parallel data
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

      // Calculate new dimensions (max width 800px to reduce size further)
      const maxWidth = 800
      const scale = Math.min(1, maxWidth / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale

      // Draw and compress the image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Convert to JPEG with 10% quality for ~90% size reduction
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.1)

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

  private getStorageSize(): number {
    try {
      let totalSize = 0
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length
        }
      }
      return totalSize
    } catch {
      return 0
    }
  }

  private canStore(dataSize: number): boolean {
    const storageLimit = 5 * 1024 * 1024 // 5MB approximate localStorage limit
    const currentSize = this.getStorageSize()
    return (currentSize + dataSize) < storageLimit * 0.8 // Keep 20% buffer
  }

  private getDataSize(data: any): number {
    try {
      return JSON.stringify(data).length
    } catch {
      return 0
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

      await this.updateAnalysis(analysisId, compressedData)

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

      // Check storage capacity before saving
      const updatedData = [analysis, ...existing].slice(0, this.maxAnalyses)
      const dataSize = this.getDataSize(updatedData)
      
      if (!this.canStore(dataSize)) {
        debugLogCategory("Analysis Storage", `Data too large (${Math.round(dataSize/1024)}KB), clearing old analyses`)
        // Clear all old analyses and try with just the current one
        const singleAnalysisData = [analysis]
        const singleDataSize = this.getDataSize(singleAnalysisData)
        
        if (!this.canStore(singleDataSize)) {
          // Try without screenshots as last resort
          const analysisWithoutScreenshots = {
            ...analysis,
            desktopCaptureResult: analysis.desktopCaptureResult ? 
              { ...analysis.desktopCaptureResult, screenshot: null } : null,
            mobileCaptureResult: analysis.mobileCaptureResult ? 
              { ...analysis.mobileCaptureResult, screenshot: null } : null,
          }
          
          try {
            localStorage.removeItem(this.storageKey)
            localStorage.setItem(this.storageKey, JSON.stringify([analysisWithoutScreenshots]))
            debugLogCategory("Analysis Storage", "Saved analysis without screenshots due to storage constraints")
          } catch (error) {
            console.error("Failed to save even without screenshots:", error)
            return ""
          }
        } else {
          try {
            localStorage.removeItem(this.storageKey)
            localStorage.setItem(this.storageKey, JSON.stringify(singleAnalysisData))
            debugLogCategory("Analysis Storage", "Cleared old analyses and saved current one")
          } catch (error) {
            console.error("Failed to save after clearing:", error)
            return ""
          }
        }
      } else {
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(updatedData))
          if (process.env.NODE_ENV === "development") {
            console.log("💾 New analysis saved with compressed images:", { 
              id: analysisId, 
              title, 
              url, 
              size: `${Math.round(dataSize/1024)}KB` 
            })
          }
        } catch (error) {
          console.error("Failed to save analysis:", error)
          // If quota exceeded despite our checks, fall back to aggressive clearing
          if (error instanceof Error && error.name === 'QuotaExceededError') {
            try {
              localStorage.removeItem(this.storageKey)
              const analysisWithoutScreenshots = {
                ...analysis,
                desktopCaptureResult: analysis.desktopCaptureResult ? 
                  { ...analysis.desktopCaptureResult, screenshot: null } : null,
                mobileCaptureResult: analysis.mobileCaptureResult ? 
                  { ...analysis.mobileCaptureResult, screenshot: null } : null,
              }
              localStorage.setItem(this.storageKey, JSON.stringify([analysisWithoutScreenshots]))
              debugLogCategory("Analysis Storage", "Emergency fallback: saved without screenshots")
            } catch (finalError) {
              console.error("Emergency fallback failed:", finalError)
              return ""
            }
          } else {
            return ""
          }
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
        
        const dataSize = this.getDataSize(analyses)
        
        if (!this.canStore(dataSize)) {
          debugLogCategory("Analysis Storage", `Update too large (${Math.round(dataSize/1024)}KB), reducing data`)
          // Keep only the most recent analysis
          const recentAnalyses = analyses.slice(-1)
          try {
            localStorage.setItem(this.storageKey, JSON.stringify(recentAnalyses))
            debugLogCategory("Analysis Storage", "Kept only most recent analysis due to size constraints")
          } catch (error) {
            console.error("Failed to save even reduced data:", error)
            return
          }
        } else {
          try {
            localStorage.setItem(this.storageKey, JSON.stringify(analyses))
          } catch (error) {
            if (error instanceof Error && error.name === 'QuotaExceededError') {
              // Emergency fallback: clear all and save only current analysis without screenshots
              const currentAnalysis = analyses[index]
              const analysisWithoutScreenshots = {
                ...currentAnalysis,
                desktopCaptureResult: currentAnalysis.desktopCaptureResult ? 
                  { ...currentAnalysis.desktopCaptureResult, screenshot: null } : null,
                mobileCaptureResult: currentAnalysis.mobileCaptureResult ? 
                  { ...currentAnalysis.mobileCaptureResult, screenshot: null } : null,
              }
              localStorage.removeItem(this.storageKey)
              localStorage.setItem(this.storageKey, JSON.stringify([analysisWithoutScreenshots]))
              debugLogCategory("Analysis Storage", "Emergency update: saved without screenshots")
            } else {
              throw error
            }
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
