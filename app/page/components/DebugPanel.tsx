import type { MatchedElement, ClickPredictionResult, CaptureResult } from "../types"

interface DebugPanelProps {
  matchedElement: MatchedElement | null
  showTooltip: boolean
  primaryCTAPrediction: ClickPredictionResult | null
  clickPredictions: ClickPredictionResult[]
  imageSize: { width: number; height: number }
  captureResult: CaptureResult
}

export function DebugPanel({
  matchedElement,
  showTooltip,
  primaryCTAPrediction,
  clickPredictions,
  imageSize,
  captureResult,
}: DebugPanelProps) {
  // Double-check: only show in development
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded text-sm">
      <h4 className="font-bold mb-2">Debug Info (Development Only):</h4>
      <div>Matched Element: {matchedElement ? `"${matchedElement.text}"` : "None"}</div>
      <div>Show Tooltip: {showTooltip ? "Yes" : "No"}</div>
      <div>Primary Prediction: {primaryCTAPrediction ? primaryCTAPrediction.elementId : "None"}</div>
      <div>Click Predictions: {clickPredictions.length}</div>
      <div>
        Image Size: {imageSize.width}x{imageSize.height}
      </div>
      <div>Headings: {captureResult.domData.headings?.length || 0}</div>
      <div>Text Blocks: {captureResult.domData.textBlocks?.length || 0}</div>
      <div>Images: {captureResult.domData.images?.length || 0}</div>
      <div>Videos: {captureResult.domData.videos?.length || 0}</div>
    </div>
  )
}
