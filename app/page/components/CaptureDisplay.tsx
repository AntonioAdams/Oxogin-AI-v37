"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Target, Eye, EyeOff, RotateCcw, TrendingUp } from "lucide-react"
import { FormBoundaryBoxes } from "@/components/form-boundary/FormBoundaryBoxes"
import { CTATooltip } from "@/components/tooltip/CTATooltip"
import { CROAssistantIntegrated } from "@/components/cro/CROAssistantIntegrated"
import { FloatingCROArrow } from "@/components/ui/floating-cro-arrow"
import { computeTooltipProps, validateTooltipInput } from "@/lib/tooltip"
import type { CaptureDisplayProps } from "./CaptureDisplayProps"
import type { ScaledFormData } from "@/lib/form/schema"
import { debugLogCategory } from "@/lib/utils/logger"

// ENHANCED: Improved coordinate-based form detection with better scaling and overlap logic
function isCtaWithinFormBoundary(
  ctaCoords: { x: number; y: number; width?: number; height?: number },
  formBoundaryBoxes: ScaledFormData[],
  imageSize: { width: number; height: number },
  displaySize: { width: number; height: number },
): boolean {
  if (!formBoundaryBoxes || formBoundaryBoxes.length === 0) {
    debugLogCategory("Form Detection", "No form boundaries available")
    return false
  }

  if (!ctaCoords || imageSize.width === 0 || imageSize.height === 0) {
    debugLogCategory("Form Detection", "Invalid CTA coordinates or image size")
    return false
  }

  // Calculate scaling factors from original image to display size
  const scaleX = displaySize.width / imageSize.width
  const scaleY = displaySize.height / imageSize.height

  // Scale CTA coordinates to match display coordinates (same as form boundaries)
  const scaledCtaCoords = {
    x: Math.round(ctaCoords.x * scaleX),
    y: Math.round(ctaCoords.y * scaleY),
    width: Math.round((ctaCoords.width || 100) * scaleX), // Default width if not provided
    height: Math.round((ctaCoords.height || 30) * scaleY), // Default height if not provided
  }

  debugLogCategory("Form Detection", "Scaled CTA coordinates:", scaledCtaCoords)
  debugLogCategory("Form Detection", "Checking against", formBoundaryBoxes.length, "form boundaries")

  // Check overlap with each form boundary
  for (let i = 0; i < formBoundaryBoxes.length; i++) {
    const form = formBoundaryBoxes[i]
    const formCoords = form.displayCoords // Use display coordinates

    debugLogCategory("Form Detection", `Checking form ${i + 1}:`, formCoords)

    // Calculate overlap using rectangle intersection
    const xOverlap = Math.max(
      0,
      Math.min(scaledCtaCoords.x + scaledCtaCoords.width, formCoords.x + formCoords.width) -
        Math.max(scaledCtaCoords.x, formCoords.x),
    )

    const yOverlap = Math.max(
      0,
      Math.min(scaledCtaCoords.y + scaledCtaCoords.height, formCoords.y + formCoords.height) -
        Math.max(scaledCtaCoords.y, formCoords.y),
    )

    debugLogCategory("Form Detection", `Form ${i + 1} overlap - X: ${xOverlap}, Y: ${yOverlap}`)

    // ENHANCED: More lenient overlap detection - even small overlap counts
    if (xOverlap > 0 && yOverlap > 0) {
      const overlapArea = xOverlap * yOverlap
      const ctaArea = scaledCtaCoords.width * scaledCtaCoords.height
      const overlapPercentage = (overlapArea / ctaArea) * 100

      debugLogCategory("Form Detection", `✅ OVERLAP DETECTED with form ${i + 1}!`)
      debugLogCategory("Form Detection", `Overlap area: ${overlapArea}px², CTA area: ${ctaArea}px²`)
      debugLogCategory("Form Detection", `Overlap percentage: ${overlapPercentage.toFixed(1)}%`)

      return true
    }
  }

  debugLogCategory("Form Detection", "❌ No overlap detected with any form")
  return false
}

const formatPercentage = (value: number) => {
  return `${(value * 100).toFixed(1)}%`
}

export function CaptureDisplay({
  captureResult,
  matchedElement,
  imageSize,
  formBoundaryBoxes,
  showTooltip,
  primaryCTAPrediction,
  analysisResult,
  isAnalyzing,
  onImageLoad,
  onAnalyzeCTA,
  onReset,
  clickPredictions,
  allDOMElements,
  openAIResult,
  croAnalysisResult,
  funnelType = 'none',
  funnelStep = 1,
}: CaptureDisplayProps) {
  const [showFormBoundaries, setShowFormBoundaries] = useState(true)
  const imageRef = useRef<HTMLImageElement>(null)

  // Handle image load
  useEffect(() => {
    if (imageRef.current && imageRef.current.complete) {
      onImageLoad(imageRef.current)
    }
  }, [captureResult?.screenshot, onImageLoad])

  // NEW: Store prediction data in window for tooltip access
  useEffect(() => {
    if (typeof window !== "undefined" && primaryCTAPrediction) {
      ;(window as any).primaryCTAPrediction = primaryCTAPrediction
      debugLogCategory("CAPTURE", "Stored primaryCTAPrediction in window:", primaryCTAPrediction)

      // Also store estimated CPC if available
      if (primaryCTAPrediction.avgCPC) {
        ;(window as any).estimatedCPC = primaryCTAPrediction.avgCPC
        debugLogCategory("CAPTURE", "Stored estimatedCPC in window:", primaryCTAPrediction.avgCPC)
      }
    }
  }, [primaryCTAPrediction])

  const handleImageLoad = () => {
    if (imageRef.current) {
      onImageLoad(imageRef.current)
    }
  }

  if (!captureResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Capture Available</CardTitle>
          <CardDescription>Please capture a website to begin analysis</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // FIXED: Add null checks for all potentially undefined values
  const safeClickPredictions = clickPredictions || []
  const safeFormBoundaryBoxes = formBoundaryBoxes || []
  const safeImageSize = imageSize || { width: 0, height: 0 }

  // Get container size from actual image element
  const containerSize = imageRef.current
    ? { width: imageRef.current.offsetWidth, height: imageRef.current.offsetHeight }
    : { width: 800, height: 600 }

  // ENHANCED: Determine if CTA is form-related using improved coordinate detection
  const isFormRelated =
    matchedElement && imageRef.current && safeImageSize.width > 0 && safeFormBoundaryBoxes.length > 0
      ? isCtaWithinFormBoundary(
          {
            x: matchedElement.coordinates?.x || 0,
            y: matchedElement.coordinates?.y || 0,
            width: matchedElement.coordinates?.width,
            height: matchedElement.coordinates?.height,
          },
          safeFormBoundaryBoxes,
          safeImageSize,
          containerSize,
        )
      : false

  debugLogCategory("Form Detection", "Final isFormRelated result:", isFormRelated)

  // OPTION 1: Update matchedElement with live form detection result for data consistency
  const updatedMatchedElement = matchedElement
    ? {
        ...matchedElement,
        isFormRelated: isFormRelated, // Update with live detection result
      }
    : null

  debugLogCategory("Form Detection", "Updated matchedElement.isFormRelated:", updatedMatchedElement?.isFormRelated)

  // DEBUG: Log the allDOMElements structure to understand what we're working with
  debugLogCategory("CRO DEBUG", "allDOMElements structure:", {
    hasAllDOMElements: !!allDOMElements,
    type: typeof allDOMElements,
    keys: allDOMElements ? Object.keys(allDOMElements) : [],
    buttonsCount: allDOMElements?.buttons?.length || 0,
    linksCount: allDOMElements?.links?.length || 0,
    formsCount: allDOMElements?.forms?.length || 0,
    formFieldsCount: allDOMElements?.formFields?.length || 0,
  })

  // FIXED: Ensure we pass the correct DOM elements structure
  const domElementsForCRO = allDOMElements || captureResult.domData || {}

  debugLogCategory("CRO DEBUG", "domElementsForCRO structure:", {
    hasDomElementsForCRO: !!domElementsForCRO,
    buttonsCount: domElementsForCRO?.buttons?.length || 0,
    linksCount: domElementsForCRO?.links?.length || 0,
    formsCount: domElementsForCRO?.forms?.length || 0,
    formFieldsCount: domElementsForCRO?.formFields?.length || 0,
  })

  // FIXED: Calculate CRO metrics using the same logic as the "Your Click Prediction Is Ready" section
  const currentCTR = primaryCTAPrediction?.ctr || 0.04
  const targetCTR = currentCTR * 1.475 // 47.5% improvement to get from 4.0% to 5.9% (same as original logic)
  const improvementPotential = ((targetCTR - currentCTR) / currentCTR) * 100

  debugLogCategory("CAPTURE", "CRO metrics calculation:", {
    currentCTR,
    targetCTR,
    improvementPotential,
    primaryCTAPredictionCTR: primaryCTAPrediction?.ctr,
  })

  // Render tooltip with proper validation and form detection
  const renderTooltip = () => {
    if (!showTooltip || !updatedMatchedElement || !primaryCTAPrediction) {
      return null
    }

    // For mobile, use simplified validation without waiting for image load
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768

    if (isMobile) {
      // Mobile tooltip - show at top middle with 100px padding (exactly like the screenshot)
      const tooltipInput = {
        elementCoords: {
          x: updatedMatchedElement.coordinates?.x || 0,
          y: updatedMatchedElement.coordinates?.y || 0,
          width: updatedMatchedElement.coordinates?.width,
          height: updatedMatchedElement.coordinates?.height,
        },
        imageSize: safeImageSize.width > 0 ? safeImageSize : { width: 375, height: 667 },
        containerSize: containerSize.width > 0 ? containerSize : { width: 375, height: 667 },
        clickPrediction: primaryCTAPrediction,
        isFormRelated,
        ctaText: updatedMatchedElement.text || "",
      }

      if (validateTooltipInput(tooltipInput)) {
        const tooltipProps = computeTooltipProps(tooltipInput)
        return <CTATooltip {...tooltipProps} isFormRelated={isFormRelated} funnelType={funnelType} funnelStep={funnelStep} />
      }
      return null
    }

    // Desktop tooltip - original logic
    if (!imageRef.current || safeImageSize.width === 0) {
      return null
    }

    const tooltipInput = {
      elementCoords: {
        x: updatedMatchedElement.coordinates?.x || 0,
        y: updatedMatchedElement.coordinates?.y || 0,
        width: updatedMatchedElement.coordinates?.width,
        height: updatedMatchedElement.coordinates?.height,
      },
      imageSize: safeImageSize,
      containerSize: {
        width: imageRef.current.offsetWidth,
        height: imageRef.current.offsetHeight,
      },
      clickPrediction: primaryCTAPrediction,
      isFormRelated,
      ctaText: updatedMatchedElement.text || "",
    }

    if (validateTooltipInput(tooltipInput)) {
      const tooltipProps = computeTooltipProps(tooltipInput)
      return <CTATooltip {...tooltipProps} isFormRelated={isFormRelated} funnelType={funnelType} funnelStep={funnelStep} />
    }

    return null
  }

  return (
    <div id="analysis-content" className="space-y-6">
      {/* Your Conversion Goal Section - Moved above Website Analysis */}
      {primaryCTAPrediction && updatedMatchedElement && (
        <Card className="bg-green-50 border border-green-200">
          <CardContent className="p-4">
                          <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-900">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Your Click Prediction Is Ready
              </h3>
            <div className="flex items-center justify-between mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{formatPercentage(currentCTR)}</div>
                <div className="text-sm text-gray-600">
                  Current {updatedMatchedElement?.isFormRelated ? "Conversion Rate" : "CTR"}
                </div>
              </div>
              <div className="flex-1 mx-6">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${(currentCTR / targetCTR) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className="text-center mt-2 text-sm text-gray-600">
                  {improvementPotential.toFixed(1)}% improvement needed
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatPercentage(targetCTR)}</div>
                <div className="text-sm text-gray-600">
                  Target {updatedMatchedElement?.isFormRelated ? "Conversion Rate" : "CTR"}
                </div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-700">
                Expand the Executive Brief below to see detailed recommendations for reaching your{" "}
                <span className="font-semibold text-green-600">{formatPercentage(targetCTR)}</span> target
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Screenshot and Analysis */}
      <Card className="bg-white border border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-gray-900">Website Analysis</CardTitle>
              <CardDescription className="text-sm text-gray-600">
                {captureResult.domData?.title || "Website Screenshot"}
              </CardDescription>
            </div>

          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Screenshot Container - Changed height from 1000px to 650px */}
          <div className="relative bg-white border border-gray-200 rounded-lg overflow-auto" style={{ height: "650px" }}>
            <img
              ref={imageRef}
              src={captureResult.screenshot || "/placeholder.svg"}
              alt="Website Screenshot"
              className="w-full h-auto"
              onLoad={handleImageLoad}
              style={{ maxWidth: "100%", height: "auto" }}
            />

            {/* Form Boundary Boxes - Hide on mobile */}
            {showFormBoundaries && safeFormBoundaryBoxes.length > 0 && imageRef.current && (
              <div className="hidden md:block">
                <FormBoundaryBoxes forms={safeFormBoundaryBoxes} showLabels={true} />
              </div>
            )}

            {/* CTA Tooltip */}
            {renderTooltip()}
          </div>
        </CardContent>
      </Card>

      {/* Floating CRO Arrow - Positioned flexibly to follow user scroll */}
      {captureResult?.screenshot && primaryCTAPrediction && (
        <div className="fixed bottom-6 right-6 z-50">
          <FloatingCROArrow />
        </div>
      )}

      {/* CRO Assistant - Single instance without duplication - REMOVED deviceType prop */}
      {primaryCTAPrediction && updatedMatchedElement && (
        <div id="cro-results">
          <CROAssistantIntegrated
            captureResult={captureResult}
            clickPredictions={safeClickPredictions}
            primaryCTAId={primaryCTAPrediction?.elementId}
            isAnalyzing={false} // Analysis is already complete
            onAnalyze={onAnalyzeCTA}
            primaryCTAPrediction={primaryCTAPrediction}
            matchedElement={updatedMatchedElement}
            imageSize={safeImageSize}
            allDOMElements={domElementsForCRO}
            preLoadedAnalysis={true} // New prop to indicate analysis is ready
            // FIXED: Pass the target CTR to match the "Your Click Prediction Is Ready" section
            targetCTR={targetCTR}
            openAIResult={openAIResult} // Pass OpenAI result
            croAnalysisResult={croAnalysisResult} // Pass CRO analysis result
          />
        </div>
      )}

      {/* Removed the tabs section completely - no more Analysis Results, Statistics, or DOM Analysis tabs */}
    </div>
  )
}
