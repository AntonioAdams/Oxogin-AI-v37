"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, AlertTriangle, BarChart3 } from "lucide-react"
import { useState } from "react"
import type { DOMData, ClickPredictionResult } from "../types"
import { formatCoordinates } from "../utils"

interface DOMAnalysisTabProps {
  domData: DOMData
  clickPredictions: ClickPredictionResult[]
}

interface CollapsibleSectionProps {
  title: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
  color?: string
}

function CollapsibleSection({ title, count, children, defaultOpen = false, color = "blue" }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border rounded-lg">
      <Button variant="ghost" className="w-full justify-between p-4 h-auto" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          <Badge variant="secondary" className={`bg-${color}-100 text-${color}-700`}>
            {count}
          </Badge>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </Button>
      {isOpen && <div className="p-4 pt-0 border-t">{children}</div>}
    </div>
  )
}

interface ElementCardProps {
  element: any
  prediction?: ClickPredictionResult
  type: string
}

function ElementCard({ element, prediction, type }: ElementCardProps) {
  const getPredictionBadge = (pred?: ClickPredictionResult) => {
    if (!pred) return <Badge variant="outline">No Prediction</Badge>

    const confidenceColor = pred.confidence === "high" ? "green" : pred.confidence === "medium" ? "yellow" : "red"
    return (
      <div className="flex gap-2">
        <Badge className={`bg-${confidenceColor}-100 text-${confidenceColor}-700`}>{pred.confidence} confidence</Badge>
        <Badge variant="outline">{pred.estimatedClicks} clicks</Badge>
      </div>
    )
  }

  const getWasteRateColor = (wasteRate: number) => {
    if (wasteRate > 50) return "text-red-600"
    if (wasteRate > 20) return "text-yellow-600"
    return "text-green-600"
  }

  // ENHANCED: Use prediction text when available, fallback to element data
  const getElementDisplayText = () => {
    // Priority: prediction.text > element.text > element attributes > fallback
    if (prediction?.text) {
      return prediction.text
    }
    if (element.text?.trim()) {
      return element.text
    }
    if (element.src) {
      return element.src
    }
    if (element.name) {
      return element.name
    }
    if (element.attributes?.placeholder) {
      return `${element.attributes.placeholder} (${type})`
    }
    return `${type} Element`
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="font-medium text-sm">{getElementDisplayText()}</div>
          {prediction?.text && prediction.text !== element.text && (
            <div className="text-xs text-blue-600">Enhanced Label: {prediction.text}</div>
          )}
          {element.text && element.text.length > 50 && (
            <div className="text-xs text-gray-500">"{element.text.substring(0, 50)}..."</div>
          )}
        </div>
        {getPredictionBadge(prediction)}
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="font-medium">Position:</span> {formatCoordinates(element.coordinates)}
        </div>
        <div>
          <span className="font-medium">Above Fold:</span>{" "}
          <Badge variant={element.isAboveFold ? "default" : "secondary"}>{element.isAboveFold ? "Yes" : "No"}</Badge>
        </div>
        {element.className && (
          <div className="col-span-2">
            <span className="font-medium">Classes:</span> {element.className}
          </div>
        )}
        {element.type && (
          <div>
            <span className="font-medium">Type:</span> {element.type}
          </div>
        )}
        {prediction?.elementType && prediction.elementType !== element.type && (
          <div>
            <span className="font-medium">Element Type:</span> {prediction.elementType}
          </div>
        )}
        {element.href && (
          <div className="col-span-2">
            <span className="font-medium">URL:</span>
            <span className="text-blue-600 break-all">{element.href}</span>
          </div>
        )}
        {element.level && (
          <div>
            <span className="font-medium">Level:</span> H{element.level}
          </div>
        )}
        {element.wordCount && (
          <div>
            <span className="font-medium">Words:</span> {element.wordCount}
          </div>
        )}
        {element.alt && (
          <div className="col-span-2">
            <span className="font-medium">Alt Text:</span> {element.alt}
          </div>
        )}
        {element.attributes?.placeholder && (
          <div className="col-span-2">
            <span className="font-medium">Placeholder:</span> {element.attributes.placeholder}
          </div>
        )}
      </div>

      {prediction && (
        <div className="bg-gray-50 rounded p-3 space-y-2">
          <div className="font-medium text-sm text-gray-700">Click Prediction Details</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="font-medium">CTR:</span> {prediction.ctr.toFixed(2)}%
            </div>
            <div>
              <span className="font-medium">Click Share:</span> {prediction.clickShare.toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Wasted Clicks:</span> {prediction.wastedClicks}
            </div>
            <div>
              <span className="font-medium">Wasted Spend:</span> ${prediction.wastedSpend}
            </div>
          </div>

          {/* Enhanced 4-Phase Waste Breakdown */}
          {prediction.wasteBreakdown && (
            <div className="mt-3 p-3 bg-red-50 rounded border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-red-700 flex items-center space-x-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>4-Phase Waste Analysis</span>
                </span>
                <Badge variant="destructive" className="text-xs">
                  {(prediction.wasteBreakdown.cappedWasteRate * 100).toFixed(0)}% total waste
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-medium">Category:</span>
                    <div className="text-red-600">{prediction.wasteBreakdown.elementCategory}</div>
                  </div>
                  <div>
                    <span className="font-medium">Phase 1:</span>
                    <div className="text-red-600">
                      +{(prediction.wasteBreakdown.phase1ElementClassification * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Phase 2:</span>
                    <div className="text-red-600">
                      +{(prediction.wasteBreakdown.phase2AttentionRatio * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Phase 3:</span>
                    <div className="text-red-600">
                      +{(prediction.wasteBreakdown.phase3VisualEmphasis * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Phase 4:</span>
                    <div className="text-red-600">
                      +{(prediction.wasteBreakdown.phase4ContentClutter * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Legacy:</span>
                    <div className="text-red-600">
                      +{(prediction.wasteBreakdown.legacyQualityFactors * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Show attention ratio if available */}
                {prediction.wasteBreakdown.attentionRatio && (
                  <div className="text-xs">
                    <span className="font-medium">Attention Ratio:</span>{" "}
                    {prediction.wasteBreakdown.attentionRatio.toFixed(1)} clickable elements per CTA
                  </div>
                )}

                {/* Show contributing factors */}
                {(prediction.wasteBreakdown.visualFactors.length > 0 ||
                  prediction.wasteBreakdown.clutterFactors.length > 0 ||
                  prediction.wasteBreakdown.legacyFactors.length > 0) && (
                  <div className="text-xs">
                    <span className="font-medium">Contributing Factors:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[
                        ...prediction.wasteBreakdown.visualFactors,
                        ...prediction.wasteBreakdown.clutterFactors,
                        ...prediction.wasteBreakdown.legacyFactors,
                      ]
                        .slice(0, 4)
                        .map((factor, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      {[
                        ...prediction.wasteBreakdown.visualFactors,
                        ...prediction.wasteBreakdown.clutterFactors,
                        ...prediction.wasteBreakdown.legacyFactors,
                      ].length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +
                          {[
                            ...prediction.wasteBreakdown.visualFactors,
                            ...prediction.wasteBreakdown.clutterFactors,
                            ...prediction.wasteBreakdown.legacyFactors,
                          ].length - 4}{" "}
                          more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {prediction.riskFactors.length > 0 && (
            <div>
              <span className="font-medium text-xs">Risk Factors:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {prediction.riskFactors.map((risk, idx) => (
                  <Badge key={idx} variant="destructive" className="text-xs">
                    {risk}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {prediction.formCompletionRate && (
            <div className="text-xs">
              <span className="font-medium">Form Completion Rate:</span>{" "}
              {(prediction.formCompletionRate * 100).toFixed(1)}%
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DOMAnalysisTab({ domData, clickPredictions }: DOMAnalysisTabProps) {
  // ENHANCED: Helper function to find prediction for an element with better matching
  const findPrediction = (
    elementType: string,
    coordinates: any,
    elementData?: any,
  ): ClickPredictionResult | undefined => {
    return clickPredictions.find((pred) => {
      // Try exact coordinate matching first
      const coordMatch = pred.elementId.match(/(\d+)-(\d+)/)
      if (coordMatch) {
        const predX = Number.parseInt(coordMatch[1])
        const predY = Number.parseInt(coordMatch[2])
        const tolerance = 50
        if (Math.abs(predX - coordinates.x) < tolerance && Math.abs(predY - coordinates.y) < tolerance) {
          return true
        }
      }

      // Try type-based matching
      if (pred.elementId.includes(elementType.toLowerCase())) {
        return true
      }

      // Try text-based matching for better accuracy
      if (elementData?.text && pred.text && elementData.text.trim() === pred.text.trim()) {
        return true
      }

      return false
    })
  }

  const totalElements =
    domData.buttons.length +
    domData.links.length +
    domData.forms.length +
    (domData.formFields?.length || 0) +
    (domData.headings?.length || 0) +
    (domData.textBlocks?.length || 0) +
    (domData.images?.length || 0) +
    (domData.videos?.length || 0)

  const totalPredictions = clickPredictions.length
  const totalEstimatedClicks = clickPredictions.reduce((sum, pred) => sum + pred.estimatedClicks, 0)
  const totalWastedClicks = clickPredictions.reduce((sum, pred) => sum + pred.wastedClicks, 0)
  const totalWastedSpend = clickPredictions.reduce((sum, pred) => sum + pred.wastedSpend, 0)

  // ENHANCED: Count predictions with meaningful text labels
  const predictionsWithText = clickPredictions.filter((pred) => pred.text && pred.text !== pred.elementId).length

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>DOM Analysis Overview</CardTitle>
          <CardDescription>
            Complete breakdown of all extracted DOM elements with enhanced 4-phase waste predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">{totalElements}</div>
              <div className="text-sm text-gray-500">Total Elements</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-600">{totalPredictions}</div>
              <div className="text-sm text-gray-500">With Predictions</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-purple-600">{totalEstimatedClicks}</div>
              <div className="text-sm text-gray-500">Total Est. Clicks</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-orange-600">
                {domData.foldLine.aboveFoldButtons + domData.foldLine.aboveFoldLinks}
              </div>
              <div className="text-sm text-gray-500">Interactive Above Fold</div>
            </div>
          </div>

          {/* ENHANCED: Show text label enhancement status */}
          {predictionsWithText > 0 && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
              <div className="text-sm text-green-800">
                <strong>Enhanced Labels Active:</strong> {predictionsWithText} elements now display human-readable names
                instead of technical IDs
              </div>
            </div>
          )}

          {/* 4-Phase Waste Summary */}
          {clickPredictions.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 rounded-lg">
              <h4 className="font-medium text-red-700 mb-3 flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>4-Phase Waste Analysis Summary</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-xl font-bold text-red-600">{totalWastedClicks}</div>
                  <div className="text-sm text-gray-500">Total Wasted Clicks</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-bold text-red-600">${Math.round(totalWastedSpend)}</div>
                  <div className="text-sm text-gray-500">Total Wasted Spend</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-bold text-red-600">
                    {((totalWastedClicks / totalEstimatedClicks) * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-500">Average Waste Rate</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-bold text-red-600">
                    {clickPredictions.filter((p) => p.wasteBreakdown && p.wasteBreakdown.cappedWasteRate > 0.5).length}
                  </div>
                  <div className="text-sm text-gray-500">High Waste Elements</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive Elements */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Interactive Elements</h3>

        {/* Buttons */}
        <CollapsibleSection title="Buttons" count={domData.buttons.length} color="blue" defaultOpen={true}>
          <div className="space-y-3">
            {domData.buttons.map((button, idx) => (
              <ElementCard
                key={`button-${idx}`}
                element={button}
                prediction={findPrediction("button", button.coordinates, button)}
                type="Button"
              />
            ))}
          </div>
        </CollapsibleSection>

        {/* Links */}
        <CollapsibleSection title="Links" count={domData.links.length} color="green">
          <div className="space-y-3">
            {domData.links.map((link, idx) => (
              <ElementCard
                key={`link-${idx}`}
                element={link}
                prediction={findPrediction("link", link.coordinates, link)}
                type="Link"
              />
            ))}
          </div>
        </CollapsibleSection>

        {/* Forms */}
        <CollapsibleSection title="Forms" count={domData.forms.length} color="purple">
          <div className="space-y-3">
            {domData.forms.map((form, idx) => (
              <ElementCard
                key={`form-${idx}`}
                element={form}
                prediction={findPrediction("form", form.coordinates, form)}
                type="Form"
              />
            ))}
          </div>
        </CollapsibleSection>

        {/* Individual Form Fields - ENHANCED */}
        {domData.formFields && domData.formFields.length > 0 && (
          <CollapsibleSection title="Form Fields" count={domData.formFields.length} color="emerald">
            <div className="space-y-3">
              {domData.formFields.map((field, idx) => (
                <ElementCard
                  key={`field-${idx}`}
                  element={field}
                  prediction={findPrediction("field", field.coordinates, field)}
                  type="Form Field"
                />
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* Content Elements */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Content Elements</h3>

        {/* Headings */}
        {domData.headings && domData.headings.length > 0 && (
          <CollapsibleSection title="Headings" count={domData.headings.length} color="indigo">
            <div className="space-y-3">
              {domData.headings.map((heading, idx) => (
                <ElementCard key={`heading-${idx}`} element={heading} type="Heading" />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Text Blocks */}
        {domData.textBlocks && domData.textBlocks.length > 0 && (
          <CollapsibleSection title="Text Blocks" count={domData.textBlocks.length} color="teal">
            <div className="space-y-3">
              {domData.textBlocks.slice(0, 20).map((textBlock, idx) => (
                <ElementCard key={`text-${idx}`} element={textBlock} type="Text Block" />
              ))}
              {domData.textBlocks.length > 20 && (
                <div className="text-center text-sm text-gray-500 py-2">
                  ... and {domData.textBlocks.length - 20} more text blocks
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Images */}
        {domData.images && domData.images.length > 0 && (
          <CollapsibleSection title="Images" count={domData.images.length} color="pink">
            <div className="space-y-3">
              {domData.images.map((image, idx) => (
                <ElementCard key={`image-${idx}`} element={image} type="Image" />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Videos */}
        {domData.videos && domData.videos.length > 0 && (
          <CollapsibleSection title="Videos" count={domData.videos.length} color="red">
            <div className="space-y-3">
              {domData.videos.map((video, idx) => (
                <ElementCard key={`video-${idx}`} element={video} type="Video" />
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* Fold Line Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Fold Line Analysis</CardTitle>
          <CardDescription>
            Element distribution above and below the fold (at {domData.foldLine.position}px)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{domData.foldLine.aboveFoldButtons}</div>
              <div className="text-sm text-gray-500">Buttons Above</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-600">{domData.foldLine.belowFoldButtons}</div>
              <div className="text-sm text-gray-500">Buttons Below</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{domData.foldLine.aboveFoldLinks}</div>
              <div className="text-sm text-gray-500">Links Above</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-600">{domData.foldLine.belowFoldLinks}</div>
              <div className="text-sm text-gray-500">Links Below</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
