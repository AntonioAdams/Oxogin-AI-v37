// Form boundary box feature - Type definitions
export interface Coordinates {
  x: number
  y: number
  width: number
  height: number
}

export interface FoldLine {
  position: number
}

export interface FormData {
  id: string
  coordinates: Coordinates
  inputs: number
  submitButtonText: string
  isAboveFold: boolean
  distanceFromTop: number
  inputTypes: string[]
}

export interface ScaledFormData extends FormData {
  displayCoords: Coordinates
}

export interface FormExtractionOptions {
  overlapThreshold?: number
  excludeSearchForms?: boolean
  foldLinePosition?: number
}

export interface DisplaySize {
  width: number
  height: number
}

export interface OriginalSize {
  width: number
  height: number
}
