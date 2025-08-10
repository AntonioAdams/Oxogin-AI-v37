"use client"

import { useMemo } from "react"

interface OverlayBoxProps {
  coordinates: {
    x: number
    y: number
    width: number
    height: number
  }
  imageSize: {
    width: number
    height: number
  }
  displaySize: {
    width: number
    height: number
  }
  label?: string
  priority?: string
  className?: string
}

export function OverlayBox({
  coordinates,
  imageSize,
  displaySize,
  label,
  priority,
  className = "border-2 border-blue-500 bg-blue-500/10",
}: OverlayBoxProps) {
  const scaledCoordinates = useMemo(() => {
    // Safety checks to prevent runtime errors
    if (!coordinates || !imageSize || !displaySize) {
      return null
    }

    if (
      typeof coordinates.x !== "number" ||
      typeof coordinates.y !== "number" ||
      typeof coordinates.width !== "number" ||
      typeof coordinates.height !== "number"
    ) {
      return null
    }

    if (
      typeof imageSize.width !== "number" ||
      typeof imageSize.height !== "number" ||
      imageSize.width <= 0 ||
      imageSize.height <= 0
    ) {
      return null
    }

    if (
      typeof displaySize.width !== "number" ||
      typeof displaySize.height !== "number" ||
      displaySize.width <= 0 ||
      displaySize.height <= 0
    ) {
      return null
    }

    // Calculate scale factors
    const scaleX = displaySize.width / imageSize.width
    const scaleY = displaySize.height / imageSize.height

    return {
      left: coordinates.x * scaleX,
      top: coordinates.y * scaleY,
      width: coordinates.width * scaleX,
      height: coordinates.height * scaleY,
    }
  }, [coordinates, imageSize, displaySize])

  // Don't render if we don't have valid coordinates
  if (!scaledCoordinates) {
    return null
  }

  return (
    <div
      className={`absolute pointer-events-none ${className}`}
      style={{
        left: `${scaledCoordinates.left}px`,
        top: `${scaledCoordinates.top}px`,
        width: `${scaledCoordinates.width}px`,
        height: `${scaledCoordinates.height}px`,
      }}
    >
      {label && (
        <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          {label}
        </div>
      )}
    </div>
  )
}
