import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { Label } from "@/components/ui/label"
import type { CTAInsight, MatchedElement, ClickPredictionResult } from "../types"
import { formatConfidence, formatCoordinates } from "../utils"

interface AnalysisResultsProps {
  analysisResult: CTAInsight
  matchedElement: MatchedElement | null
  clickPredictions?: ClickPredictionResult[]
}

export function AnalysisResults({ analysisResult, matchedElement, clickPredictions = [] }: AnalysisResultsProps) {
  // Calculate waste metrics if predictions are available
  const totalPredictedClicks = clickPredictions.reduce((sum, p) => sum + p.predictedClicks, 0)
  const totalWastedClicks = clickPredictions.reduce((sum, p) => sum + p.wastedClicks, 0)
  const totalWastedSpend = clickPredictions.reduce((sum, p) => sum + p.wastedSpend, 0)
  const averageWasteRate = totalPredictedClicks > 0 ? totalWastedClicks / totalPredictedClicks : 0

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Analysis Results</CardTitle>
          <CardDescription className="text-sm">
            Primary CTA detected using screenshot + DOM data analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">AI Identified CTA</Label>
              <p className="text-base font-semibold text-blue-600">"{analysisResult.text}"</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">AI Confidence</Label>
              <p className="text-base font-semibold">{formatConfidence(analysisResult.confidence)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Form Present</Label>
              <p className={`text-base font-semibold ${analysisResult.hasForm ? "text-green-600" : "text-gray-500"}`}>
                {analysisResult.hasForm ? "Yes" : "No"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Element Type</Label>
              <p className="text-base font-semibold capitalize">{analysisResult.elementType}</p>
            </div>
          </div>

          {matchedElement && (
            <div className="border-t pt-3">
              <h4 className="font-medium mb-2 text-green-600 text-sm">✓ DOM Match Found</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Matched Text</Label>
                  <p className="text-sm font-semibold text-green-600">"{matchedElement.text}"</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Match Confidence</Label>
                  <p className="text-sm font-semibold">{formatConfidence(matchedElement.confidence)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Element Type</Label>
                  <p className="text-sm font-semibold capitalize">{matchedElement.type}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Priority</Label>
                  <p
                    className={`text-sm font-semibold capitalize ${
                      matchedElement.priority === "hero"
                        ? "text-green-600"
                        : matchedElement.priority === "header"
                          ? "text-blue-600"
                          : "text-gray-600"
                    }`}
                  >
                    {matchedElement.priority}
                  </p>
                </div>
              </div>

              <div className="space-y-1 mt-3">
                <Label className="text-xs font-medium">DOM Coordinates</Label>
                <div className="bg-green-50 p-2 rounded-lg text-xs font-mono">
                  <div>{formatCoordinates(matchedElement.coordinates)}</div>
                  <div className="text-green-600 mt-1">Priority Score: {matchedElement.priorityScore.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Waste Analysis Section */}
          {clickPredictions.length > 0 && (
            <div className="border-t pt-3">
              <h4 className="font-medium mb-2 text-red-600 flex items-center space-x-2 text-sm">
                <AlertTriangle className="h-3 w-3" />
                <span>4-Phase Waste Analysis</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <div className="text-lg font-bold text-red-600">{Math.round(totalWastedClicks)}</div>
                  <div className="text-xs text-red-700">Wasted Clicks</div>
                  <div className="text-xs text-gray-600">{(averageWasteRate * 100).toFixed(1)}% avg rate</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <div className="text-lg font-bold text-red-600">${Math.round(totalWastedSpend)}</div>
                  <div className="text-xs text-red-700">Wasted Spend</div>
                  <div className="text-xs text-gray-600">Monthly potential loss</div>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">{Math.round(totalPredictedClicks)}</div>
                  <div className="text-xs text-blue-700">Total Clicks</div>
                  <div className="text-xs text-gray-600">Predicted volume</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">{clickPredictions.length}</div>
                  <div className="text-xs text-green-700">Elements Analyzed</div>
                  <div className="text-xs text-gray-600">With predictions</div>
                </div>
              </div>

              {/* Top Waste Elements */}
              {clickPredictions.length > 0 && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <h5 className="font-medium text-red-700 mb-2 text-sm">
                    Top Waste Elements (Immediate Action Required)
                  </h5>
                  <div className="space-y-1">
                    {clickPredictions
                      .filter((p) => p.wastedClicks / p.predictedClicks > 0.3)
                      .sort((a, b) => b.wastedSpend - a.wastedSpend)
                      .slice(0, 5)
                      .map((element, index) => {
                        const wasteRate = (element.wastedClicks / element.predictedClicks) * 100
                        return (
                          <div
                            key={element.elementId}
                            className="flex justify-between items-center text-xs bg-white p-2 rounded"
                          >
                            <span className="text-gray-700 truncate flex-1">
                              {element.elementId.includes("nav")
                                ? "🧭 Navigation"
                                : element.elementId.includes("social")
                                  ? "📱 Social Media"
                                  : element.elementId.includes("external")
                                    ? "🔗 External Link"
                                    : element.elementId.includes("button")
                                      ? "🔘 Button"
                                      : element.elementId.includes("link")
                                        ? "🔗 Link"
                                        : "📄 Element"}{" "}
                              - {element.elementId.substring(0, 20)}...
                            </span>
                            <div className="text-right ml-2">
                              <div className="font-medium text-red-600">{wasteRate.toFixed(0)}% waste</div>
                              <div className="text-xs text-red-500">${element.wastedSpend.toFixed(0)} lost</div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-medium">AI Reasoning</Label>
            <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">{analysisResult.reasoning}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
