// Form boundary box feature - Public API
import type { DOMData } from "../contracts/capture"
import type { ScaledFormData, FormExtractionOptions, DisplaySize, OriginalSize } from "./schema"

// Import functions directly instead of from separate files
export type { FormData, ScaledFormData, FormExtractionOptions, DisplaySize, OriginalSize } from "./schema"

// Inline the extractor logic
function extractForms(domData: DOMData): import("./schema").FormData[] {
  const rawForms = domData.forms || []
  const rawFields = domData.formFields || []

  return rawForms.map((form, idx) => {
    // Find all fields inside this form by coordinate overlap
    const formBounds = form.coordinates
    const fieldsInForm = rawFields.filter((field) => {
      const fieldCoords = field.coordinates

      // Check if field coordinates are within form boundaries
      const isWithinX = fieldCoords.x >= formBounds.x && fieldCoords.x <= formBounds.x + formBounds.width
      const isWithinY = fieldCoords.y >= formBounds.y && fieldCoords.y <= formBounds.y + formBounds.height

      return isWithinX && isWithinY
    })

    // Fallback to form's own input count if no fields found through overlap
    const inputCount = fieldsInForm.length > 0 ? fieldsInForm.length : form.inputs

    return {
      id: form.action ? `form-${form.action.split("/").pop()}` : `form-${idx}`,
      coordinates: {
        x: Math.round(form.coordinates.x),
        y: Math.round(form.coordinates.y),
        width: Math.round(form.coordinates.width),
        height: Math.round(form.coordinates.height),
      },
      inputs: inputCount,
      submitButtonText: form.submitButtonText || "Submit",
      isAboveFold: form.isAboveFold,
      distanceFromTop: form.distanceFromTop,
      inputTypes: fieldsInForm.map((field) => field.type || "text"),
    }
  })
}

// Inline the deduplicate logic
function deduplicateForms(
  forms: import("./schema").FormData[],
  options: FormExtractionOptions = {},
): import("./schema").FormData[] {
  const { overlapThreshold = 0.2, excludeSearchForms = true } = options
  let candidates = forms

  // STEP 1: Filter out search forms in header area
  if (excludeSearchForms) {
    candidates = candidates.filter((form) => {
      const isInHeader = form.coordinates.y < 150 // Header detection

      if (!isInHeader) return true // Keep non-header forms

      // For header forms, check if they're search-related
      const formText = (form.submitButtonText || "").toLowerCase()
      const hasSearchKeywords = ["search", "find", "lookup", "query", "go"].some((keyword) =>
        formText.includes(keyword),
      )

      const isSingleInputForm = form.inputs === 1

      // Exclude single-input search forms in header
      if (isSingleInputForm && (hasSearchKeywords || isInHeader)) {
        return false
      }

      return true
    })
  }

  // STEP 2: Remove overlapping forms
  const deduplicated: import("./schema").FormData[] = []

  for (const form of candidates) {
    let isDuplicate = false

    for (const existingForm of deduplicated) {
      // Calculate coordinate overlap
      const xOverlap = Math.max(
        0,
        Math.min(
          form.coordinates.x + form.coordinates.width,
          existingForm.coordinates.x + existingForm.coordinates.width,
        ) - Math.max(form.coordinates.x, existingForm.coordinates.x),
      )

      const yOverlap = Math.max(
        0,
        Math.min(
          form.coordinates.y + form.coordinates.height,
          existingForm.coordinates.y + existingForm.coordinates.height,
        ) - Math.max(form.coordinates.y, existingForm.coordinates.y),
      )

      const overlapArea = xOverlap * yOverlap
      const formArea = form.coordinates.width * form.coordinates.height
      const existingFormArea = existingForm.coordinates.width * existingForm.coordinates.height

      const overlapPercentage = overlapArea / Math.min(formArea, existingFormArea)

      if (overlapPercentage >= overlapThreshold) {
        // 20% overlap threshold
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      deduplicated.push(form)
    }
  }

  return deduplicated
}

// Inline the filter logic
function filterForms(forms: import("./schema").FormData[]): import("./schema").FormData[] {
  return forms.filter((form) => {
    // Only include forms with actual inputs
    if (form.inputs <= 0) return false

    // Additional filtering criteria can be added here
    // For example, minimum form size
    const minWidth = 50
    const minHeight = 30

    if (form.coordinates.width < minWidth || form.coordinates.height < minHeight) {
      return false
    }

    return true
  })
}

// Inline the scale logic
function scaleFormCoords(
  coords: import("./schema").Coordinates,
  displaySize: DisplaySize,
  originalSize: OriginalSize,
): import("./schema").Coordinates {
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

export async function extractAndScaleForms(
  domData: DOMData,
  displaySize: DisplaySize,
  originalSize: OriginalSize,
  options: FormExtractionOptions = {},
): Promise<ScaledFormData[]> {
  // Step 1: Extract raw forms from DOM data
  const rawForms = extractForms(domData)

  // Step 2: Deduplicate overlapping and search forms
  const deduplicatedForms = deduplicateForms(rawForms, options)

  // Step 3: Filter forms by criteria
  const filteredForms = filterForms(deduplicatedForms)

  // Step 4: Scale coordinates for display
  const scaledForms = filteredForms.map((form) => ({
    ...form,
    displayCoords: scaleFormCoords(form.coordinates, displaySize, originalSize),
  }))

  return scaledForms
}

export function processFormsForDisplay(
  domData: DOMData,
  imageElement: HTMLImageElement,
  options: FormExtractionOptions = {},
): ScaledFormData[] {
  if (!imageElement.naturalWidth || !imageElement.naturalHeight) {
    return []
  }

  const originalSize: OriginalSize = {
    width: imageElement.naturalWidth,
    height: imageElement.naturalHeight,
  }

  const displaySize: DisplaySize = {
    width: imageElement.offsetWidth,
    height: imageElement.offsetHeight,
  }

  // Extract and process forms synchronously
  const rawForms = extractForms(domData)
  const deduplicatedForms = deduplicateForms(rawForms, options)
  const filteredForms = filterForms(deduplicatedForms)

  return filteredForms.map((form) => ({
    ...form,
    displayCoords: scaleFormCoords(form.coordinates, displaySize, originalSize),
  }))
}
