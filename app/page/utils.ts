// Utility functions for the page components
import type { MatchedElement, CTAInsight, ClickPredictionResult } from "./types"

export const showToast = (title: string, description: string, variant: "default" | "destructive" = "default") => {
  if (variant === "destructive") {
    alert(`Error: ${title}\n${description}`)
  } else {
    alert(`${title}\n${description}`)
  }
}

export const formatConfidence = (confidence: number): string => {
  return `${Math.round(confidence * 100)}%`
}

export const formatCoordinates = (coords: { x: number; y: number; width: number; height: number }): string => {
  return `${Math.round(coords.x)}, ${Math.round(coords.y)} (${Math.round(coords.width)}×${Math.round(coords.height)})`
}

export const findCTAPrediction = (
  predictions: ClickPredictionResult[],
  matchedElement: MatchedElement | null,
  ctaText?: string,
  analysisResult?: CTAInsight,
): ClickPredictionResult | null => {
  if (!predictions.length || !matchedElement) {
    if (process.env.NODE_ENV === "development") {
      console.log("❌ No predictions or matched element:", {
        predictions: predictions.length,
        matchedElement: !!matchedElement,
      })
    }
    return null
  }

  if (process.env.NODE_ENV === "development") {
    console.log("🔍 Finding CTA prediction for:", {
      matchedElement: matchedElement.text,
      coordinates: matchedElement.coordinates,
      predictionsCount: predictions.length,
      ctaText,
    })
  }

  // Method 1: Coordinate-based matching (most reliable)
  const coordMatch = predictions.find((p) => {
    const coordMatch = p.elementId.match(/(\d+)-(\d+)/)
    if (coordMatch) {
      const predX = Number.parseInt(coordMatch[1])
      const predY = Number.parseInt(coordMatch[2])
      const tolerance = 50
      const matches =
        Math.abs(predX - matchedElement.coordinates.x) < tolerance &&
        Math.abs(predY - matchedElement.coordinates.y) < tolerance

      if (process.env.NODE_ENV === "development") {
        console.log(`🎯 Coordinate match check for ${p.elementId}:`, {
          predX,
          predY,
          elementX: matchedElement.coordinates.x,
          elementY: matchedElement.coordinates.y,
          tolerance,
          matches,
        })
      }

      return matches
    }
    return false
  })

  if (coordMatch) {
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Found coordinate match:", coordMatch.elementId)
    }
    return coordMatch
  }

  // Method 2: Text-based matching
  if (ctaText) {
    const textMatch = predictions.find((p) =>
      p.elementId.toLowerCase().includes(ctaText.toLowerCase().substring(0, 10)),
    )
    if (textMatch) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Found text match:", textMatch.elementId)
      }
      return textMatch
    }
  }

  // Method 3: Form-related matching
  if (analysisResult?.hasForm) {
    const formMatch = predictions.find((p) => p.formCompletionRate != null)
    if (formMatch) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Found form match:", formMatch.elementId)
      }
      return formMatch
    }
  }

  // Fallback: Highest scoring prediction
  const fallback = predictions.reduce((best, current) => (current.confidence > best.confidence ? current : best))
  if (process.env.NODE_ENV === "development") {
    console.log("⚠️ Using fallback prediction:", fallback.elementId)
  }
  return fallback
}

export const fetchClickPredictions = async (captureResult: any, setClickPredictions: any, isMobile = false, userId?: string) => {
  if (!captureResult?.domData) {
    if (process.env.NODE_ENV === "development") {
      console.log("❌ No capture result or DOM data for predictions")
    }
    return
  }

  if (process.env.NODE_ENV === "development") {
    console.log("🔄 Fetching click predictions...")
  }

  try {
    const response = await fetch("/api/predict-clicks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        domData: captureResult.domData,
        isMobile,
        userId: userId || "anonymous"
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const predictions = data.predictions || []
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Click predictions fetched:", predictions.length)
      }
      setClickPredictions(predictions)
      return predictions
    } else {
      console.error("❌ Failed to fetch predictions:", response.status)
      setClickPredictions([])
    }
  } catch (error) {
    console.error("❌ Error fetching click predictions:", error)
    setClickPredictions([])
  }
}
