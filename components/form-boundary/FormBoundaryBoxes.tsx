import type { ScaledFormData } from "@/lib/form/schema"

export interface FormBoundaryBoxesProps {
  forms: ScaledFormData[]
  showLabels?: boolean
}

// Replace the dynamic class names with explicit ones to ensure Tailwind includes them
export function FormBoundaryBoxes({ forms, showLabels = true }: FormBoundaryBoxesProps) {
  if (!forms || forms.length === 0) {
    return null
  }

  return (
    <>
      {forms.map((form, index) => {
        const { x, y, width, height } = form.displayCoords
        const isAboveFold = form.isAboveFold
        const foldLabel = isAboveFold ? "Above Fold" : "Below Fold"

        // Use explicit class names instead of dynamic ones
        const borderClass = isAboveFold ? "border-blue-500 bg-blue-500/10" : "border-green-500 bg-green-500/10"
        const labelClass = isAboveFold ? "bg-blue-500" : "bg-green-500"

        return (
          <div
            key={form.id || `form-${index}`}
            className={`absolute border-4 ${borderClass} rounded pointer-events-none`}
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${width}px`,
              height: `${height}px`,
            }}
          >
            {showLabels && (
              <div
                className={`absolute -top-8 left-0 ${labelClass} text-white px-2 py-1 rounded text-sm font-medium whitespace-nowrap`}
              >
                Form ({form.inputs} inputs) - {foldLabel}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
