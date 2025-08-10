// Form boundary box feature - Filter forms by criteria
import type { FormData } from "./schema"

export function filterForms(forms: FormData[]): FormData[] {
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

export function separateFormsByFold(forms: FormData[]): {
  aboveFold: FormData[]
  belowFold: FormData[]
} {
  const aboveFold = forms.filter((form) => form.isAboveFold)
  const belowFold = forms.filter((form) => !form.isAboveFold)

  return { aboveFold, belowFold }
}
