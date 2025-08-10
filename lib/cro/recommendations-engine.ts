import type { CaptureResult } from "@/lib/contracts/capture"
import type { ClickPredictionResult } from "@/lib/contracts/cta"
import type { MatchedElement } from "@/lib/ai/match"

interface CRORecommendation {
  title: string
  description: string
  difficulty: "easy" | "medium" | "hard"
  status: string
  priority: number
  implementationTime: string
  expectedImpact: string
  specificElements?: string[]
}

interface CROAnalysisResult {
  overview: {
    currentCTR: number
    projectedCTR: number
    improvementPotential: number
    revenueImpact: number
    implementationDifficulty: "easy" | "medium" | "hard"
    priorityScore: number
    formContext?: {
      isFormCTA: boolean
      formFieldCount: number
      contextType: string
    }
  }
  elements: {
    highRiskCount: number
    recommendations: CRORecommendation[]
    formContext?: any
  }
  actions: {
    quickWins: CRORecommendation[]
    longTermImprovements: CRORecommendation[]
  }
  rawAnalysis: string
  wastedClickAnalysis?: any
  formContextAnalysis?: {
    ctaType: string
    formFieldCount: number
    expectedImprovementRange: string
    primaryOptimizationFocus: string
  }
}

// Configuration constants
const HEADER_ZONE_MAX_Y = 200 // Elements above this Y coordinate are considered header elements
const HIGH_RISK_HEADER_ELEMENTS = [
  "get in touch",
  "log in",
  "start for free",
  "contact us",
  "about us",
  "pricing",
  "resources",
  "blog",
]

const FORM_FIELD_LIMITS = {
  DREAM: 1,
  ACCEPTABLE: 3,
  PROBLEMATIC: 5,
}

export function generateCRORecommendations(
  captureResult: CaptureResult,
  clickPredictions: ClickPredictionResult[],
  primaryCTAId: string,
  primaryCTAPrediction: ClickPredictionResult,
  matchedElement: MatchedElement,
  allDOMElements: any,
  isFormRelated: boolean,
): CROAnalysisResult {
  const recommendations: CRORecommendation[] = []
  const quickWins: CRORecommendation[] = []
  const longTermImprovements: CRORecommendation[] = []

  // Get primary CTA coordinates for reference
  const primaryCTACoords = matchedElement.coordinates || { x: 0, y: 0, width: 0, height: 0 }
  const primaryCTAText = matchedElement.text?.toLowerCase() || ""

  // 1. HEADER DISTRACTION ANALYSIS
  const headerDistractions = analyzeHeaderDistractions(allDOMElements, primaryCTACoords, primaryCTAText)

  if (headerDistractions.length > 0) {
    quickWins.push({
      title: "Remove Header Distractions",
      description: `Remove ${headerDistractions.length} distracting navigation elements from the header area to focus user attention on your primary CTA. These elements compete for clicks and reduce conversion rates.`,
      difficulty: "easy",
      status: "high-impact",
      priority: 1,
      implementationTime: "30 minutes",
      expectedImpact: "15-25% CTR improvement",
      specificElements: headerDistractions,
    })
  }

  // 2. FORM OPTIMIZATION (if form-related CTA)
  if (isFormRelated) {
    const formOptimizations = analyzeFormComplexity(allDOMElements, primaryCTAText)
    if (formOptimizations.recommendations.length > 0) {
      formOptimizations.recommendations.forEach((rec) => {
        if (rec.difficulty === "easy") {
          quickWins.push(rec)
        } else {
          longTermImprovements.push(rec)
        }
      })
    }
  }

  // 3. DUPLICATE CTA ANALYSIS (only if primary CTA is not "get a demo")
  if (!primaryCTAText.includes("get a demo") && !primaryCTAText.includes("demo")) {
    const duplicateCTAs = findDuplicateCTAs(allDOMElements, primaryCTAText, primaryCTACoords)
    if (duplicateCTAs.length > 0) {
      quickWins.push({
        title: "Remove Duplicate CTAs",
        description: `Remove ${duplicateCTAs.length} competing CTAs that dilute focus from your primary conversion action.`,
        difficulty: "easy",
        status: "medium-impact",
        priority: 2,
        implementationTime: "15 minutes",
        expectedImpact: "8-15% CTR improvement",
        specificElements: duplicateCTAs,
      })
    }
  }

  // 4. VISUAL HIERARCHY IMPROVEMENTS
  const visualImprovements = analyzeVisualHierarchy(primaryCTACoords, allDOMElements)
  if (visualImprovements.length > 0) {
    longTermImprovements.push({
      title: "Improve Visual Hierarchy",
      description:
        "Enhance the visual prominence of your primary CTA through better contrast, sizing, and positioning.",
      difficulty: "medium",
      status: "medium-impact",
      priority: 3,
      implementationTime: "2-4 hours",
      expectedImpact: "10-20% CTR improvement",
      specificElements: visualImprovements,
    })
  }

  // Calculate overall metrics
  const currentCTR = primaryCTAPrediction.ctr || 0.03
  const projectedImprovement = calculateProjectedImprovement(quickWins, longTermImprovements)
  const projectedCTR = currentCTR * (1 + projectedImprovement)

  return {
    overview: {
      currentCTR,
      projectedCTR,
      improvementPotential: projectedImprovement * 100,
      revenueImpact: calculateRevenueImpact(currentCTR, projectedCTR, primaryCTAPrediction),
      implementationDifficulty: quickWins.length > longTermImprovements.length ? "easy" : "medium",
      priorityScore: Math.min(100, quickWins.length * 30 + longTermImprovements.length * 20),
      formContext: isFormRelated
        ? {
            isFormCTA: true,
            formFieldCount: allDOMElements?.formFields?.length || 0,
            contextType: "form-conversion",
          }
        : undefined,
    },
    elements: {
      highRiskCount: headerDistractions.length,
      recommendations: [...quickWins, ...longTermImprovements],
      formContext: isFormRelated ? analyzeFormContext(allDOMElements) : undefined,
    },
    actions: {
      quickWins,
      longTermImprovements,
    },
    rawAnalysis: generateRawAnalysis(quickWins, longTermImprovements, isFormRelated),
    formContextAnalysis: isFormRelated
      ? {
          ctaType: "form-submission",
          formFieldCount: allDOMElements?.formFields?.length || 0,
          expectedImprovementRange: "20-40%",
          primaryOptimizationFocus: "field-reduction",
        }
      : undefined,
  }
}

function analyzeHeaderDistractions(allDOMElements: any, primaryCTACoords: any, primaryCTAText: string): string[] {
  const distractions: string[] = []

  // Check buttons in header zone
  if (allDOMElements?.buttons) {
    allDOMElements.buttons.forEach((button: any) => {
      if (button.coordinates?.y <= HEADER_ZONE_MAX_Y) {
        const buttonText = button.text?.toLowerCase() || ""

        // Skip if it's the primary CTA
        if (buttonText === primaryCTAText) return

        // Check against high-risk elements
        if (HIGH_RISK_HEADER_ELEMENTS.some((risk) => buttonText.includes(risk))) {
          distractions.push(`"${button.text}" (header button)`)
        }
      }
    })
  }

  // Check links in header zone
  if (allDOMElements?.links) {
    allDOMElements.links.forEach((link: any) => {
      if (link.coordinates?.y <= HEADER_ZONE_MAX_Y) {
        const linkText = link.text?.toLowerCase() || ""

        if (HIGH_RISK_HEADER_ELEMENTS.some((risk) => linkText.includes(risk))) {
          distractions.push(`"${link.text}" (header link)`)
        }
      }
    })
  }

  return distractions
}

function analyzeFormComplexity(
  allDOMElements: any,
  primaryCTAText: string,
): {
  recommendations: CRORecommendation[]
} {
  const recommendations: CRORecommendation[] = []
  const formFieldCount = allDOMElements?.formFields?.length || 0

  if (formFieldCount === 0) return { recommendations }

  // Dream scenario: 1 field only
  if (formFieldCount > FORM_FIELD_LIMITS.DREAM) {
    if (formFieldCount <= FORM_FIELD_LIMITS.ACCEPTABLE) {
      recommendations.push({
        title: "Optimize Form Fields",
        description: `Reduce form from ${formFieldCount} fields to 1 field maximum. Remove non-essential fields like phone number, company size, or optional information to minimize friction.`,
        difficulty: "easy",
        status: "high-impact",
        priority: 1,
        implementationTime: "1 hour",
        expectedImpact: "25-40% conversion improvement",
        specificElements: [`${formFieldCount - 1} non-essential form fields`],
      })
    } else if (formFieldCount <= FORM_FIELD_LIMITS.PROBLEMATIC) {
      recommendations.push({
        title: "Simplify Form Complexity",
        description: `Your form has ${formFieldCount} fields which creates significant friction. Reduce to maximum 3 fields, ideally just email. Consider progressive profiling or post-signup data collection.`,
        difficulty: "medium",
        status: "high-impact",
        priority: 1,
        implementationTime: "2-4 hours",
        expectedImpact: "30-50% conversion improvement",
        specificElements: [`${formFieldCount - FORM_FIELD_LIMITS.ACCEPTABLE} excessive form fields`],
      })
    } else {
      recommendations.push({
        title: "Critical Form Reduction Required",
        description: `${formFieldCount} form fields is conversion poison. This needs immediate attention. Reduce to 1-2 essential fields maximum. Consider multi-step forms or eliminate the form entirely.`,
        difficulty: "hard",
        status: "critical",
        priority: 1,
        implementationTime: "1-2 days",
        expectedImpact: "50-80% conversion improvement",
        specificElements: [`${formFieldCount - FORM_FIELD_LIMITS.DREAM} excessive form fields`],
      })
    }
  }

  return { recommendations }
}

function findDuplicateCTAs(allDOMElements: any, primaryCTAText: string, primaryCTACoords: any): string[] {
  const duplicates: string[] = []

  // Check for similar CTA buttons
  if (allDOMElements?.buttons) {
    allDOMElements.buttons.forEach((button: any) => {
      const buttonText = button.text?.toLowerCase() || ""

      // Skip the primary CTA itself
      if (button.coordinates?.x === primaryCTACoords.x && button.coordinates?.y === primaryCTACoords.y) return

      // Look for similar intent CTAs
      if (
        (buttonText.includes("sign up") && primaryCTAText.includes("sign up")) ||
        (buttonText.includes("get started") && primaryCTAText.includes("get started")) ||
        (buttonText.includes("try") && primaryCTAText.includes("try"))
      ) {
        duplicates.push(`"${button.text}" (duplicate CTA)`)
      }
    })
  }

  return duplicates
}

function analyzeVisualHierarchy(primaryCTACoords: any, allDOMElements: any): string[] {
  const improvements: string[] = []

  // This is a simplified analysis - in a real implementation you'd analyze:
  // - Color contrast ratios
  // - Size relationships
  // - Positioning conflicts
  // - Visual weight distribution

  improvements.push("Increase CTA button size by 20-30%")
  improvements.push("Improve color contrast for better visibility")
  improvements.push("Add more whitespace around primary CTA")

  return improvements
}

function calculateProjectedImprovement(
  quickWins: CRORecommendation[],
  longTermImprovements: CRORecommendation[],
): number {
  // Base improvement calculation
  let improvement = 0

  quickWins.forEach((win) => {
    if (win.title.includes("Header Distractions")) improvement += 0.2
    if (win.title.includes("Form")) improvement += 0.35
    if (win.title.includes("Duplicate")) improvement += 0.12
  })

  longTermImprovements.forEach((improvement_item) => {
    improvement += 0.15 // Average long-term improvement
  })

  return Math.min(improvement, 0.6) // Cap at 60% improvement
}

function calculateRevenueImpact(
  currentCTR: number,
  projectedCTR: number,
  primaryCTAPrediction: ClickPredictionResult,
): number {
  const monthlyClicks = (primaryCTAPrediction.estimatedClicks || 100) * 30
  const avgOrderValue = 150 // Default AOV
  const improvementClicks = monthlyClicks * (projectedCTR - currentCTR)

  return improvementClicks * avgOrderValue
}

function analyzeFormContext(allDOMElements: any) {
  return {
    fieldTypes: allDOMElements?.formFields?.map((field: any) => field.type) || [],
    hasRequiredFields: true,
    estimatedCompletionTime: `${(allDOMElements?.formFields?.length || 0) * 15} seconds`,
  }
}

function generateRawAnalysis(
  quickWins: CRORecommendation[],
  longTermImprovements: CRORecommendation[],
  isFormRelated: boolean,
): string {
  let analysis = "CRO Analysis Summary:\n\n"

  if (quickWins.length > 0) {
    analysis += "IMMEDIATE ACTIONS (High Impact, Easy Implementation):\n"
    quickWins.forEach((win, index) => {
      analysis += `${index + 1}. ${win.title}: ${win.description}\n`
    })
    analysis += "\n"
  }

  if (longTermImprovements.length > 0) {
    analysis += "STRATEGIC IMPROVEMENTS (Medium-Long Term):\n"
    longTermImprovements.forEach((improvement, index) => {
      analysis += `${index + 1}. ${improvement.title}: ${improvement.description}\n`
    })
  }

  if (isFormRelated) {
    analysis += "\nFORM OPTIMIZATION FOCUS: Reducing form friction is critical for conversion improvement."
  }

  return analysis
}
