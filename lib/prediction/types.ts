// Click Prediction Model - Type Definitions

export interface DOMElement {
  id?: string
  tagName: string
  className?: string
  text?: string
  href?: string
  isVisible: boolean
  isInteractive: boolean
  isAboveFold: boolean
  hasButtonStyling?: boolean
  coordinates: {
    x: number
    y: number
    width: number
    height: number
  }
  // Enhanced properties for wasted clicks calculation
  clickableElementsCount?: number
  primaryCTACount?: number
  hasHighContrast?: boolean
  isAutoRotating?: boolean
  zIndex?: string
  isSticky?: boolean
  textLength?: number
  hasNearbyCTA?: boolean
  isDecorative?: boolean
  hasVisualNoise?: boolean
  hasMultipleCompetingElements?: boolean
  autoplay?: boolean
  style?: Record<string, string>
  // Form-specific properties
  type?: string
  required?: boolean
  label?: string
  placeholder?: string
  hasAutocomplete?: boolean
  pattern?: string
  minLength?: number
  maxLength?: number
  distanceFromTop?: number
  formAction?: string
}

export interface PageContext {
  url?: string // Made optional and added to fix server-side issues
  title?: string // Made optional
  totalImpressions: number
  trafficSource: "organic" | "paid" | "social" | "email" | "direct" | "referral" | "linkedin" | "unknown"
  deviceType: "desktop" | "mobile" | "tablet"
  industry?:
    | "saas"
    | "ecommerce"
    | "leadgen"
    | "content"
    | "legal"
    | "finance"
    | "technology"
    | "automotive"
    | "realestate"
    | "travel"
    | "consumerservices"
  timeOfDay?: "morning" | "afternoon" | "evening" | "night"
  dayOfWeek?: "weekday" | "weekend"
  seasonality?: "high" | "medium" | "low"
  competitorPresence?: boolean
  brandRecognition?: number | "high" | "medium" | "low"
  allElements?: DOMElement[] // For context-aware calculations
  loadTime?: number
  adMessageMatch?: number // 0-1 score for ad-to-landing page relevance
  hasSSL?: boolean
  hasTrustBadges?: boolean
  hasTestimonials?: boolean
  pageComplexity?: number
  viewportWidth?: number
  viewportHeight?: number
  foldLine?: number
  // New CPC-related fields
  networkType?: "search" | "display" | "social" | "unknown"
  geoTier?: "tier1" | "tier2" | "tier3" | "unknown"
  competitionLevel?: "high" | "medium" | "low" | "unknown"
  qualityScore?: "excellent" | "good" | "average" | "poor" | "unknown"
  businessType?: "b2b" | "b2c" | "unknown"
}

export interface ScoredElement {
  element: DOMElement
  score: number
  adjustedScore?: number
}

export interface WasteBreakdown {
  baseWasteRate: number
  phase1ElementClassification: number
  phase2AttentionRatio: number
  phase3VisualEmphasis: number
  phase4ContentClutter: number
  legacyQualityFactors: number
  totalWasteRate: number
  cappedWasteRate: number
  elementCategory: string
  attentionRatio?: number
  visualFactors: string[]
  clutterFactors: string[]
  legacyFactors: string[]
}

export interface ClickPredictionResult {
  elementId: string
  predictedClicks: number
  ctr: number
  clickShare: number
  rawScore: number
  clickProbability: number
  confidence: "high" | "medium" | "low"
  riskFactors: string[]
  estimatedClicks: number
  wastedClicks: number
  wastedSpend: number
  avgCPC: number
  // ENHANCED: Add human-readable text and element information
  text?: string // Human-readable label like "Email Field", "Sign Up Button"
  elementType?: string // "input", "button", "link", "form", "textarea", "select"
  tagName?: string // HTML tag name
  coordinates?: {
    // Element position for reference
    x: number
    y: number
    width: number
    height: number
  }
  // Enhanced waste breakdown
  wasteBreakdown?: WasteBreakdown
  // Form-specific predictions
  formCompletionRate?: number
  leadCount?: number
  bottleneckField?: string
}

export interface FormBottleneckAnalysis {
  bottleneckField: string
  bottleneckCTR: number
  fieldAnalysis: Array<{
    fieldName: string
    dropoffRate: number
    completionRate: number
    avgTimeToComplete: number
  }>
  overallFormCTR: number
  recommendedOptimizations: string[]
}

export interface TrafficModifiers {
  totalClicks: number
  trafficSourceModifier: number
  deviceModifier: number
  timeModifier: number
  seasonalityModifier: number
}

export interface ElementFeatures {
  visualWeight: number
  positionScore: number
  contentRelevance: number
  interactionAffordance: number
  competitionLevel: number
  trustSignals: number
}

export interface WasteAnalysisReport {
  totalWastedClicks: number
  totalWastedSpend: number
  wasteByCategory: {
    navigation: { clicks: number; spend: number }
    external: { clicks: number; spend: number }
    social: { clicks: number; spend: number }
    competing: { clicks: number; spend: number }
    interruptive: { clicks: number; spend: number }
    clutter: { clicks: number; spend: number }
  }
  topWasteElements: Array<{
    elementId: string
    wastedClicks: number
    wastedSpend: number
    wasteRate: number
    category: string
  }>
  optimizationRecommendations: string[]
}
