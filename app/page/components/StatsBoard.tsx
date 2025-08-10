import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Target, BarChart3, Zap } from "lucide-react"
import type { DOMData, ClickPredictionResult } from "../types"

interface StatsBoardProps {
  domData: DOMData
  clickPredictions?: ClickPredictionResult[]
}

export function StatsBoard({ domData, clickPredictions = [] }: StatsBoardProps) {
  // Calculate form field predictions
  const formFieldPredictions = clickPredictions.filter((p) => p.elementId.includes("field-"))
  const buttonPredictions = clickPredictions.filter((p) => p.elementId.includes("button-"))
  const linkPredictions = clickPredictions.filter((p) => p.elementId.includes("link-"))
  const formContainerPredictions = clickPredictions.filter((p) => p.elementId.includes("form-"))

  // Calculate waste metrics
  const totalWastedClicks = clickPredictions.reduce((sum, p) => sum + p.wastedClicks, 0)
  const totalWastedSpend = clickPredictions.reduce((sum, p) => sum + p.wastedSpend, 0)
  const totalPredictedClicks = clickPredictions.reduce((sum, p) => sum + p.predictedClicks, 0)
  const averageWasteRate = totalPredictedClicks > 0 ? (totalWastedClicks / totalPredictedClicks) * 100 : 0

  // Categorize elements by waste rate
  const highWasteElements = clickPredictions.filter((p) => p.wastedClicks / p.predictedClicks > 0.5)
  const mediumWasteElements = clickPredictions.filter((p) => {
    const wasteRate = p.wastedClicks / p.predictedClicks
    return wasteRate > 0.2 && wasteRate <= 0.5
  })
  const lowWasteElements = clickPredictions.filter((p) => p.wastedClicks / p.predictedClicks <= 0.2)

  // Calculate waste by category
  const wasteByCategory = clickPredictions.reduce(
    (acc, pred) => {
      const category = pred.wasteBreakdown?.elementCategory || "Unknown"
      if (!acc[category]) {
        acc[category] = { clicks: 0, spend: 0, count: 0 }
      }
      acc[category].clicks += pred.wastedClicks
      acc[category].spend += pred.wastedSpend
      acc[category].count += 1
      return acc
    },
    {} as Record<string, { clicks: number; spend: number; count: number }>,
  )

  // Get top waste categories
  const topWasteCategories = Object.entries(wasteByCategory)
    .sort(([, a], [, b]) => b.spend - a.spend)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>DOM Analysis & Click Predictions</CardTitle>
          <CardDescription>
            Complete breakdown of all extracted DOM elements with enhanced 4-phase waste analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Interactive Elements */}
          <div>
            <h4 className="font-medium mb-3 text-blue-600">Interactive Elements</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">{domData.buttons.length}</div>
                <div className="text-sm text-gray-500">Total Buttons</div>
                {buttonPredictions.length > 0 && (
                  <div className="text-xs text-blue-500">{buttonPredictions.length} predictions</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">{domData.foldLine.aboveFoldButtons}</div>
                <div className="text-sm text-gray-500">Buttons Above Fold</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-purple-600">{domData.forms.length}</div>
                <div className="text-sm text-gray-500">Forms</div>
                {formContainerPredictions.length > 0 && (
                  <div className="text-xs text-purple-500">{formContainerPredictions.length} predictions</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-orange-600">{domData.links.length}</div>
                <div className="text-sm text-gray-500">Links</div>
                {linkPredictions.length > 0 && (
                  <div className="text-xs text-orange-500">{linkPredictions.length} predictions</div>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced 4-Phase Waste Analysis Section */}
          {clickPredictions.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 text-red-600 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <span>4-Phase Waste Analysis</span>
              </h4>

              {/* Overall Waste Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-red-600">{Math.round(totalWastedClicks)}</div>
                  <div className="text-sm text-gray-500">Total Wasted Clicks</div>
                  <div className="text-xs text-red-500">{averageWasteRate.toFixed(1)}% avg waste rate</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-red-600">${Math.round(totalWastedSpend)}</div>
                  <div className="text-sm text-gray-500">Wasted Spend</div>
                  <div className="text-xs text-red-500">Monthly potential loss</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-red-600">{highWasteElements.length}</div>
                  <div className="text-sm text-gray-500">High Waste Elements</div>
                  <div className="text-xs text-red-500">{">"}50% waste rate</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-yellow-600">{mediumWasteElements.length}</div>
                  <div className="text-sm text-gray-500">Medium Waste Elements</div>
                  <div className="text-xs text-yellow-500">20-50% waste rate</div>
                </div>
              </div>

              {/* Waste by Category Breakdown */}
              {topWasteCategories.length > 0 && (
                <div className="mb-6 p-4 bg-red-50 rounded-lg">
                  <h5 className="font-medium text-red-700 mb-3 flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Waste by Element Category</span>
                  </h5>
                  <div className="space-y-3">
                    {topWasteCategories.map(([category, data]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-700">{category}</span>
                          <Badge variant="outline" className="text-xs">
                            {data.count} elements
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-red-600">{Math.round(data.clicks)} clicks</div>
                          <div className="text-xs text-red-500">${Math.round(data.spend)} wasted</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase Breakdown for Top Waste Elements */}
              {highWasteElements.length > 0 && (
                <div className="mb-6 p-4 bg-orange-50 rounded-lg">
                  <h5 className="font-medium text-orange-700 mb-3 flex items-center space-x-2">
                    <Zap className="h-4 w-4" />
                    <span>4-Phase Breakdown (Top Waste Elements)</span>
                  </h5>
                  <div className="space-y-4">
                    {highWasteElements.slice(0, 3).map((element, index) => {
                      const breakdown = element.wasteBreakdown
                      if (!breakdown) return null

                      return (
                        <div key={element.elementId} className="border rounded-lg p-3 bg-white">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-sm text-gray-700">
                              {breakdown.elementCategory} - {element.elementId.substring(0, 30)}...
                            </span>
                            <Badge variant="destructive">{(breakdown.cappedWasteRate * 100).toFixed(0)}% waste</Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="font-medium">Phase 1 (Classification):</span>
                              <div className="text-red-600">
                                +{(breakdown.phase1ElementClassification * 100).toFixed(0)}%
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Phase 2 (Attention):</span>
                              <div className="text-red-600">+{(breakdown.phase2AttentionRatio * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                              <span className="font-medium">Phase 3 (Visual):</span>
                              <div className="text-red-600">+{(breakdown.phase3VisualEmphasis * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                              <span className="font-medium">Phase 4 (Clutter):</span>
                              <div className="text-red-600">+{(breakdown.phase4ContentClutter * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                              <span className="font-medium">Legacy Factors:</span>
                              <div className="text-red-600">+{(breakdown.legacyQualityFactors * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                              <span className="font-medium">Total Impact:</span>
                              <div className="text-red-700 font-bold">${element.wastedSpend.toFixed(0)} lost</div>
                            </div>
                          </div>

                          {/* Show specific factors */}
                          {(breakdown.visualFactors.length > 0 ||
                            breakdown.clutterFactors.length > 0 ||
                            breakdown.legacyFactors.length > 0) && (
                            <div className="mt-2 pt-2 border-t">
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">Contributing factors: </span>
                                {[...breakdown.visualFactors, ...breakdown.clutterFactors, ...breakdown.legacyFactors]
                                  .slice(0, 3)
                                  .join(", ")}
                                {[...breakdown.visualFactors, ...breakdown.clutterFactors, ...breakdown.legacyFactors]
                                  .length > 3 && "..."}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {highWasteElements.length > 3 && (
                      <div className="text-xs text-gray-500 text-center pt-2">
                        +{highWasteElements.length - 3} more high-waste elements with detailed breakdowns...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Waste Rate Distribution */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-700 mb-3">Waste Rate Distribution</h5>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-700">High Waste ({">"} 50%)</span>
                    <span className="text-sm font-medium">{highWasteElements.length} elements</span>
                  </div>
                  <Progress value={(highWasteElements.length / clickPredictions.length) * 100} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-yellow-700">Medium Waste (20-50%)</span>
                    <span className="text-sm font-medium">{mediumWasteElements.length} elements</span>
                  </div>
                  <Progress value={(mediumWasteElements.length / clickPredictions.length) * 100} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700">Low Waste ({"<"} 20%)</span>
                    <span className="text-sm font-medium">{lowWasteElements.length} elements</span>
                  </div>
                  <Progress value={(lowWasteElements.length / clickPredictions.length) * 100} className="h-2" />
                </div>
              </div>
            </div>
          )}

          {/* Individual Form Fields Section */}
          {domData.formFields && domData.formFields.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 text-emerald-600">Individual Form Fields</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-emerald-600">{domData.formFields.length}</div>
                  <div className="text-sm text-gray-500">Total Form Fields</div>
                  {formFieldPredictions.length > 0 && (
                    <div className="text-xs text-emerald-500">{formFieldPredictions.length} predictions</div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-teal-600">
                    {domData.formFields.filter((f) => f.type === "email").length}
                  </div>
                  <div className="text-sm text-gray-500">Email Fields</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-cyan-600">
                    {domData.formFields.filter((f) => f.type === "text").length}
                  </div>
                  <div className="text-sm text-gray-500">Text Fields</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-sky-600">
                    {domData.formFields.filter((f) => f.type === "select").length}
                  </div>
                  <div className="text-sm text-gray-500">Dropdowns</div>
                </div>
              </div>

              {/* Form Field Click Predictions with Waste Analysis */}
              {formFieldPredictions.length > 0 && (
                <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
                  <h5 className="font-medium text-emerald-700 mb-2">Form Field Click Predictions & Waste</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {formFieldPredictions.slice(0, 8).map((prediction, index) => {
                      const wasteRate = (prediction.wastedClicks / prediction.predictedClicks) * 100
                      return (
                        <div key={prediction.elementId} className="flex justify-between items-center">
                          <span className="text-gray-600">
                            {prediction.elementId.includes("email")
                              ? "📧 Email Field"
                              : prediction.elementId.includes("phone")
                                ? "📞 Phone Field"
                                : prediction.elementId.includes("name")
                                  ? "👤 Name Field"
                                  : prediction.elementId.includes("company")
                                    ? "🏢 Company Field"
                                    : prediction.elementId.includes("country")
                                      ? "🌍 Country Field"
                                      : prediction.elementId.includes("message")
                                        ? "💬 Message Field"
                                        : `📝 Field ${index + 1}`}
                          </span>
                          <div className="text-right">
                            <div className="font-medium text-emerald-600">{prediction.estimatedClicks} clicks</div>
                            <div className="text-xs text-red-500">{wasteRate.toFixed(0)}% waste</div>
                          </div>
                        </div>
                      )
                    })}
                    {formFieldPredictions.length > 8 && (
                      <div className="text-xs text-gray-500 col-span-2 text-center">
                        +{formFieldPredictions.length - 8} more fields...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Non-Interactive Elements */}
          <div>
            <h4 className="font-medium mb-3 text-indigo-600">Content Elements</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-indigo-600">{domData.headings?.length || 0}</div>
                <div className="text-sm text-gray-500">Headings</div>
                <div className="text-xs text-gray-400">({domData.foldLine.aboveFoldHeadings || 0} above fold)</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-teal-600">{domData.textBlocks?.length || 0}</div>
                <div className="text-sm text-gray-500">Text Blocks</div>
                <div className="text-xs text-gray-400">({domData.foldLine.aboveFoldTextBlocks || 0} above fold)</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-pink-600">{domData.images?.length || 0}</div>
                <div className="text-sm text-gray-500">Images</div>
                <div className="text-xs text-gray-400">({domData.foldLine.aboveFoldImages || 0} above fold)</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-red-600">{domData.videos?.length || 0}</div>
                <div className="text-sm text-gray-500">Videos</div>
                <div className="text-xs text-gray-400">({domData.foldLine.aboveFoldVideos || 0} above fold)</div>
              </div>
            </div>
          </div>

          {/* Content Summary */}
          {(domData.headings?.length > 0 || domData.textBlocks?.length > 0) && (
            <div>
              <h4 className="font-medium mb-3 text-gray-700">Content Summary</h4>
              <div className="space-y-2">
                {domData.headings?.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Main Headings:</span>{" "}
                    {domData.headings
                      .filter((h) => h.level <= 2)
                      .slice(0, 3)
                      .map((h) => `"${h.text.substring(0, 30)}${h.text.length > 30 ? "..." : ""}"`)
                      .join(", ")}
                  </div>
                )}
                {domData.textBlocks?.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Total Words:</span>{" "}
                    {domData.textBlocks.reduce((sum, block) => sum + block.wordCount, 0).toLocaleString()}
                  </div>
                )}
                {domData.images?.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Images with Alt Text:</span>{" "}
                    {domData.images.filter((img) => img.alt && img.alt.trim().length > 0).length} /{" "}
                    {domData.images.length}
                  </div>
                )}
                {domData.formFields && domData.formFields.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Form Fields:</span> {domData.formFields.length} individual inputs
                    detected
                  </div>
                )}
                {clickPredictions.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">4-Phase Waste Analysis:</span> {averageWasteRate.toFixed(1)}% average
                    waste rate across {clickPredictions.length} elements
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Optimization Recommendations */}
          {clickPredictions.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium mb-3 text-blue-700 flex items-center space-x-2">
                <Target className="h-4 w-4" />
                <span>4-Phase Optimization Recommendations</span>
              </h4>
              <div className="space-y-2 text-sm text-blue-700">
                {averageWasteRate > 40 && (
                  <div>
                    • <strong>Phase 1 Priority:</strong> High waste rate detected - focus on {highWasteElements.length}{" "}
                    elements with {">"}50% waste
                  </div>
                )}
                {topWasteCategories.length > 0 && (
                  <div>
                    • <strong>Category Focus:</strong> Top waste category is "{topWasteCategories[0][0]}" with $
                    {Math.round(topWasteCategories[0][1].spend)} monthly waste
                  </div>
                )}
                {totalWastedSpend > 100 && (
                  <div>
                    • <strong>ROI Opportunity:</strong> Potential monthly savings of ${Math.round(totalWastedSpend)} by
                    optimizing waste elements
                  </div>
                )}
                <div>
                  • <strong>Phase Analysis:</strong> Use the detailed 4-phase breakdown to understand specific waste
                  causes for each element
                </div>
                <div>
                  • <strong>Quick Wins:</strong> Start with Phase 1 (Element Classification) optimizations for immediate
                  impact
                </div>
                {Object.keys(wasteByCategory).length > 3 && (
                  <div>
                    • <strong>Systematic Approach:</strong> Address waste by category - focus on highest-spend
                    categories first
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
