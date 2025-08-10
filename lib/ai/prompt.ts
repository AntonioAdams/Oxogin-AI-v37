import type { DOMData } from "../contracts/capture"

export function createCTAAnalysisPrompt(domData: DOMData): string {
  const { title, buttons, formFields, forms, foldLine } = domData

  // Create context about the page
  const pageContext = `
Page Title: ${title || "Unknown"}
Number of buttons found: ${buttons?.length || 0}
Number of form fields found: ${formFields?.length || 0}
Number of forms found: ${forms?.length || 0}
`

  // List available buttons for context
  const buttonsList = buttons?.length
    ? buttons
        .slice(0, 10)
        .map((btn, idx) => `${idx + 1}. "${btn.text}" (${btn.tagName})`)
        .join("\n")
    : "No buttons found"

  // List form information
  const formsList = forms?.length
    ? forms
        .slice(0, 5)
        .map((form, idx) => {
          const fields =
            form.fields
              ?.slice(0, 3)
              .map((f) => f.type)
              .join(", ") || "no fields"
          return `${idx + 1}. Form with: ${fields}`
        })
        .join("\n")
    : "No forms found"

  const organizedDomData = {
    buttons: buttons
      .filter((btn) => btn.isVisible && btn.text?.trim())
      .slice(0, 20)
      .map((btn) => ({
        text: btn.text,
        type: btn.type,
        isAboveFold: btn.isAboveFold,
        formAction: btn.formAction,
        className: btn.className,
        coordinates: `${Math.round(btn.coordinates.x)}, ${Math.round(btn.coordinates.y)}`,
        size: `${Math.round(btn.coordinates.width)}×${Math.round(btn.coordinates.height)}`,
      })),
    links: domData.links
      .filter((link) => link.isVisible && link.text?.trim())
      .slice(0, 20)
      .map((link) => ({
        text: link.text,
        hasButtonStyling: link.hasButtonStyling,
        isAboveFold: link.isAboveFold,
        className: link.className,
        coordinates: `${Math.round(link.coordinates.x)}, ${Math.round(link.coordinates.y)}`,
        size: `${Math.round(link.coordinates.width)}×${Math.round(link.coordinates.height)}`,
      })),
    forms: forms.map((form) => ({
      hasSubmitButton: form.hasSubmitButton,
      inputs: form.inputs,
      isAboveFold: form.isAboveFold,
      coordinates: `${Math.round(form.coordinates.x)}, ${Math.round(form.coordinates.y)}`,
      size: `${Math.round(form.coordinates.width)}×${Math.round(form.coordinates.height)}`,
    })),
    foldLine: foldLine,
  }

  return `CRO Analyst: Identify the PRIMARY CTA element in this webpage screenshot.

${pageContext}

AVAILABLE ELEMENTS:
Buttons: ${buttonsList}
Forms: ${formsList}

TASK: Identify primary CTA with exact text, confidence (0-1), form presence, coordinates (x,y,width,height), and reasoning.

PRIORITY RULES:
1. Hero section forms/buttons above fold (0-${organizedDomData.foldLine.position}px)
2. Header section CTAs 
3. Visually prominent elements (size, contrast, positioning)
4. Action-oriented text ("Buy", "Start Trial") over navigation ("About", "Products")

VISUAL PROMINENCE FACTORS:
- Size: Large (>100px) > Small (<50px)
- Color: High contrast, unique colors
- Position: Centered, hero area, whitespace
- Style: Button styling, shadows, clickable appearance

DOM DATA:
BUTTONS: ${organizedDomData.buttons.map((btn, i) => `${i + 1}. "${btn.text}" - Above fold: ${btn.isAboveFold} - Coords: ${btn.coordinates}`).join("\n")}
LINKS: ${organizedDomData.links.map((link, i) => `${i + 1}. "${link.text}" - Button styling: ${link.hasButtonStyling} - Above fold: ${link.isAboveFold}`).join("\n")}
FORMS: ${organizedDomData.forms.map((form, i) => `${i + 1}. ${form.inputs} inputs - Above fold: ${form.isAboveFold}`).join("\n")}
FOLD LINE: ${organizedDomData.foldLine.position}px (${organizedDomData.foldLine.aboveFoldButtons} buttons above)

Return the ONE primary conversion action with reasoning based on visual prominence + conversion intent.`
}
