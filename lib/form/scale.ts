// Form boundary box feature - Coordinate scaling mathematics
import type { Coordinates, DisplaySize, OriginalSize } from "./schema"

export function scaleFormCoords(
  coords: Coordinates,
  displaySize: DisplaySize,
  originalSize: OriginalSize,
): Coordinates {
  // Calculate scaling factors
  const scaleX = displaySize.width / originalSize.width
  const scaleY = displaySize.height / originalSize.height

  return {
    x: Math.round(coords.x * scaleX),
    y: Math.round(coords.y * scaleY),
    width: Math.round(coords.width * scaleX),
    height: Math.round(coords.height * scaleY),
  }
}

export function calculateImageDimensions(imageElement: HTMLImageElement): {
  original: OriginalSize
  display: DisplaySize
} {
  return {
    original: {
      width: imageElement.naturalWidth,
      height: imageElement.naturalHeight,
    },
    display: {
      width: imageElement.offsetWidth,
      height: imageElement.offsetHeight,
    },
  }
}
