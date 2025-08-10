// Form boundary box feature - Raw form extraction from DOM data
import type { DOMData } from "../contracts/capture"
import type { FormData } from "./schema"

export function extractForms(domData: DOMData): FormData[] {
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
