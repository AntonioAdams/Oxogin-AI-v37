// Form boundary box feature - Remove overlapping and search forms
import type { FormData, FormExtractionOptions } from "./schema"

export function deduplicateForms(forms: FormData[], options: FormExtractionOptions = {}): FormData[] {
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
  const deduplicated: FormData[] = []

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
