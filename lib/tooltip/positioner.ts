// CTA Tooltip System - Positioning and collision detection logic

import type { RawTooltipInput, TooltipSide, TooltipPositionResult } from "./schema"

const TOOLTIP_WIDTH = 320
const TOOLTIP_HEIGHT = 280
const MARGIN = 20

export function positionTooltip(input: RawTooltipInput): TooltipPositionResult {
  const { elementCoords, imageSize, containerSize } = input

  // Calculate scaling factors
  const scaleX = containerSize.width / imageSize.width
  const scaleY = containerSize.height / imageSize.height

  // Special mobile positioning - center tooltip at top of container with 100px padding
  const isMobileViewport = containerSize.width <= 768 // Updated to match mobile breakpoint
  if (isMobileViewport) {
    const mobilePosition = {
      x: Math.max(10, (containerSize.width - TOOLTIP_WIDTH) / 2), // Center horizontally with min 10px margin
      y: 100, // Exactly 100px from top as shown in screenshot
    }

    const pulsePosition = {
      x:
        elementCoords.x * (containerSize.width / imageSize.width) +
        (elementCoords.width * (containerSize.width / imageSize.width)) / 2,
      y:
        elementCoords.y * (containerSize.height / imageSize.height) +
        (elementCoords.height * (containerSize.height / imageSize.height)) / 2,
    }

    const linePath = `M ${pulsePosition.x} ${pulsePosition.y} L ${mobilePosition.x + TOOLTIP_WIDTH / 2} ${mobilePosition.y + TOOLTIP_HEIGHT}`

    return {
      pulsePosition,
      side: "top" as TooltipSide,
      linePath,
      panelStyle: {
        left: mobilePosition.x,
        top: mobilePosition.y,
        width: TOOLTIP_WIDTH,
        height: TOOLTIP_HEIGHT,
      },
    }
  }

  // Scale element coordinates to display size
  const scaledElement = {
    x: elementCoords.x * scaleX,
    y: elementCoords.y * scaleY,
    width: elementCoords.width * scaleX,
    height: elementCoords.height * scaleY,
  }

  // Calculate pulse position (center of element)
  const pulsePosition = {
    x: scaledElement.x + scaledElement.width / 2,
    y: scaledElement.y + scaledElement.height / 2,
  }

  // Determine optimal tooltip side using collision detection
  const side = determineOptimalSide(scaledElement, containerSize)

  // Calculate panel position based on chosen side
  const panelPosition = calculatePanelPosition(scaledElement, side, containerSize)

  // Calculate connection line endpoints
  const linePath = calculateLinePath(pulsePosition, panelPosition, side)

  return {
    pulsePosition,
    side,
    linePath: `M ${linePath.x1} ${linePath.y1} L ${linePath.x2} ${linePath.y2}`,
    panelStyle: {
      left: panelPosition.x,
      top: panelPosition.y,
      width: TOOLTIP_WIDTH,
      height: TOOLTIP_HEIGHT,
    },
  }
}

function determineOptimalSide(
  element: { x: number; y: number; width: number; height: number },
  containerSize: { width: number; height: number },
): TooltipSide {
  const { x, y, width, height } = element
  const { width: containerWidth, height: containerHeight } = containerSize

  // Check if tooltip fits on the right
  if (x + width + TOOLTIP_WIDTH + MARGIN < containerWidth) {
    return "right"
  }

  // Check if tooltip fits on the left
  if (x - TOOLTIP_WIDTH - MARGIN > 0) {
    return "left"
  }

  // Check if tooltip fits above
  if (y - TOOLTIP_HEIGHT - MARGIN > 0) {
    return "top"
  }

  // Default to bottom
  return "bottom"
}

function calculatePanelPosition(
  element: { x: number; y: number; width: number; height: number },
  side: TooltipSide,
  containerSize: { width: number; height: number },
): { x: number; y: number } {
  const { x, y, width, height } = element

  switch (side) {
    case "right":
      return {
        x: x + width + MARGIN,
        y: Math.max(0, Math.min(y, containerSize.height - TOOLTIP_HEIGHT)),
      }

    case "left":
      return {
        x: x - TOOLTIP_WIDTH - MARGIN,
        y: Math.max(0, Math.min(y, containerSize.height - TOOLTIP_HEIGHT)),
      }

    case "top":
      return {
        x: Math.max(0, Math.min(x, containerSize.width - TOOLTIP_WIDTH)),
        y: y - TOOLTIP_HEIGHT - MARGIN,
      }

    case "bottom":
      return {
        x: Math.max(0, Math.min(x, containerSize.width - TOOLTIP_WIDTH)),
        y: y + height + MARGIN,
      }

    default:
      return { x: 0, y: 0 }
  }
}

function calculateLinePath(
  pulsePosition: { x: number; y: number },
  panelPosition: { x: number; y: number },
  side: TooltipSide,
): { x1: number; y1: number; x2: number; y2: number } {
  // Calculate connection point on panel edge
  let connectionPoint: { x: number; y: number }

  switch (side) {
    case "right":
      connectionPoint = {
        x: panelPosition.x,
        y: panelPosition.y + TOOLTIP_HEIGHT / 2,
      }
      break

    case "left":
      connectionPoint = {
        x: panelPosition.x + TOOLTIP_WIDTH,
        y: panelPosition.y + TOOLTIP_HEIGHT / 2,
      }
      break

    case "top":
      connectionPoint = {
        x: panelPosition.x + TOOLTIP_WIDTH / 2,
        y: panelPosition.y + TOOLTIP_HEIGHT,
      }
      break

    case "bottom":
      connectionPoint = {
        x: panelPosition.x + TOOLTIP_WIDTH / 2,
        y: panelPosition.y,
      }
      break

    default:
      connectionPoint = { x: panelPosition.x, y: panelPosition.y }
  }

  return {
    x1: pulsePosition.x,
    y1: pulsePosition.y,
    x2: connectionPoint.x,
    y2: connectionPoint.y,
  }
}

export function detectCollisions(
  panelPosition: { x: number; y: number },
  containerSize: { width: number; height: number },
): boolean {
  return (
    panelPosition.x < 0 ||
    panelPosition.y < 0 ||
    panelPosition.x + TOOLTIP_WIDTH > containerSize.width ||
    panelPosition.y + TOOLTIP_HEIGHT > containerSize.height
  )
}
