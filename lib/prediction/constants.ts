// Click Prediction Model - Constants and Configuration

export const FEATURE_WEIGHTS = {
  // Core interaction features
  visibilityScore: 0.15,
  informationScent: 0.12,
  frictionScore: 0.1,
  interactivityScore: 0.08,
  heatmapAttention: 0.09,

  // Content and credibility
  credibilityScore: 0.08,
  contentDepthScore: 0.07,
  intentScore: 0.06,
  visualAffordanceScore: 0.06,
  scrollDepthScore: 0.05,

  // Performance and technical
  performanceScore: 0.05,
  trustBoost: 0.04,
  segmentModifier: 0.03,
  socialProofBoost: 0.03,
  progressIndication: 0.03,

  // Enhancement factors
  dynamicContentBoost: 0.02,
  urgencyBoost: 0.02,
  autoCompletion: 0.02,
  fieldGrouping: 0.02,

  // Minor factors
  emotionalColorBoost: 0.01,
  crossDevicePriming: 0.01,

  // Penalty factors (negative weights)
  deadClickRisk: -0.04,
  cognitiveLoadPenalty: -0.02,
  fieldComplexity: -0.08,
} as const

export const CONSTANTS = {
  // Element limits
  MAX_ELEMENTS: 100,
  MAX_FORM_FIELDS: 20,

  // Scoring thresholds
  MIN_ELEMENT_SCORE: 0.01,
  MAX_ELEMENT_SCORE: 1.0,

  // Click distribution
  MIN_CLICKS_PER_ELEMENT: 0.1,
  MAX_CLICKS_PER_ELEMENT: 1000,

  // Reliability thresholds
  HIGH_RELIABILITY_THRESHOLD: 0.8,
  MEDIUM_RELIABILITY_THRESHOLD: 0.5,

  // Form analysis
  MIN_FORM_COMPLETION_RATE: 0.1,
  MAX_FORM_COMPLETION_RATE: 0.9,

  // CPC estimation
  DEFAULT_CPC: 2.5,
  MIN_CPC: 0.5,
  MAX_CPC: 50.0,

  // Traffic estimation
  DEFAULT_MONTHLY_TRAFFIC: 10000,
  DEFAULT_CTR: 0.02,

  // Element filtering
  MIN_ELEMENT_WIDTH: 10,
  MIN_ELEMENT_HEIGHT: 10,
  MAX_ELEMENT_WIDTH: 2000,
  MAX_ELEMENT_HEIGHT: 2000,

  // Minimum values
  MIN_CLICKS: 0.1,
  MIN_IMPRESSIONS: 100,
  MIN_SCORE: 0.001,

  // Maximum values
  MAX_TEXT_LENGTH: 200,
  MAX_WASTE_RATE: 0.8, // Cap waste rate at 80%

  // Default values
  DEFAULT_FOLD_LINE: 1000,
  DEFAULT_VIEWPORT_WIDTH: 1920,
  DEFAULT_VIEWPORT_HEIGHT: 1080,
  DEFAULT_TIMEOUT: 30000,

  // Behavioral constants
  AVG_CLICKS_PER_ENGAGED_USER: 2.3,
  FORM_CLICK_ALLOCATION: 0.3,
  ABOVE_FOLD_MULTIPLIER: 1.0,
  BELOW_FOLD_MULTIPLIER: 0.6,

  // Traffic source defaults
  DEFAULT_BOUNCE_RATE: 0.6,
  DEFAULT_TRAFFIC_MODIFIER: 0.85,
  DEFAULT_DEVICE_MODIFIER: 1.0,
} as const

// New: Element Classification Waste Rates (Phase 1)
export const ELEMENT_WASTE_RATES = {
  primaryCTA: 0.0, // Main conversion action
  navigation: 0.4, // Navigation menus - major distraction
  socialMedia: 0.35, // Social media links - major distraction
  externalLink: 0.3, // External links - takes users away
  interruptive: 0.3, // Interruptive elements - steals focus
  autoPlayingMedia: 0.25, // Auto-playing media - visual distraction
  competingCTA: 0.2, // Competing CTAs - choice paralysis
  internalNavigation: 0.1, // Internal navigation - guided tour
  supportingContent: 0.05, // Supporting content - minimal waste
  trustIndicator: 0.05, // Trust indicators - builds confidence
  unknown: 0.15, // Unknown element type
} as const

// New: Attention Ratio Thresholds (Phase 2)
export const ATTENTION_RATIO_THRESHOLDS = {
  high: { threshold: 20, wasteRate: 0.25 }, // > 20 clickable elements per CTA
  medium: { threshold: 10, wasteRate: 0.15 }, // > 10 clickable elements per CTA
  low: { threshold: 0, wasteRate: 0 }, // <= 10 clickable elements per CTA
} as const

// New: Visual Emphasis Factors (Phase 3)
export const VISUAL_EMPHASIS_WASTE = {
  highContrastDistraction: 0.1, // High contrast elements that aren't primary CTAs
  stickyNavigation: 0.2, // Sticky navigation elements
  stickyCTA: -0.05, // Sticky primary CTAs (beneficial)
  autoRotatingComponents: 0.15, // Auto-rotating carousels/sliders
  highZIndexOverlays: 0.1, // Overlay elements that steal focus
} as const

// New: Content Clutter Factors (Phase 4)
export const CONTENT_CLUTTER_WASTE = {
  longTextWithoutCTA: 0.1, // Long text blocks without nearby CTAs
  decorativeImages: 0.05, // Purely decorative images
  visualNoise: 0.08, // Too many colors/styles
  competingElements: 0.12, // Multiple competing interactive elements
} as const

// New: Legacy Quality Factors
export const LEGACY_QUALITY_WASTE = {
  nonInteractive: 0.3, // Element is not clickable
  missingButtonStyling: 0.1, // Interactive but lacks button styling
  belowFold: 0.1, // Element is not visible initially
  minimalText: 0.15, // Text content < 3 characters
} as const

export const TRAFFIC_SOURCE_MODIFIERS = {
  organic: 0.85, // High intent, lower volume
  paid: 1.2, // High intent, targeted
  social: 0.7, // Lower intent, browsing behavior
  email: 1.1, // Engaged audience
  direct: 0.9, // Brand awareness
  referral: 0.8, // Variable intent
  unknown: 0.75, // Conservative estimate
} as const

export const DEVICE_MODIFIERS = {
  desktop: 1.0, // Baseline
  mobile: 0.85, // Smaller screens, touch interface
  tablet: 0.95, // Medium screens
} as const

export const BASE_BOUNCE_RATES = {
  organic: 0.45,
  paid: 0.65,
  social: 0.7,
  email: 0.35,
  direct: 0.4,
  referral: 0.55,
} as const

// Updated industry modifiers with 2025 CPC data
export const INDUSTRY_MODIFIERS = {
  saas: {
    formCompletionRate: 0.85,
    ctaClickRate: 1.2,
    bounceRateAdjustment: -0.05,
    avgCPC: 8.5, // High-end B2B SaaS (can go $6-15+ for competitive niches)
  },
  ecommerce: {
    formCompletionRate: 0.75,
    ctaClickRate: 1.4,
    bounceRateAdjustment: 0.1,
    avgCPC: 1.16, // E-commerce average (2025 data)
  },
  leadgen: {
    formCompletionRate: 0.65,
    ctaClickRate: 1.1,
    bounceRateAdjustment: 0.05,
    avgCPC: 4.2, // B2B lead generation
  },
  content: {
    formCompletionRate: 0.7,
    ctaClickRate: 0.9,
    bounceRateAdjustment: -0.1,
    avgCPC: 2.4, // Education/content average
  },
  legal: {
    formCompletionRate: 0.8,
    ctaClickRate: 1.3,
    bounceRateAdjustment: 0.0,
    avgCPC: 6.75, // Legal services (2025 WordStream data)
  },
  finance: {
    formCompletionRate: 0.75,
    ctaClickRate: 1.1,
    bounceRateAdjustment: 0.05,
    avgCPC: 3.44, // Finance & Insurance (2025 data)
  },
  technology: {
    formCompletionRate: 0.8,
    ctaClickRate: 1.2,
    bounceRateAdjustment: -0.05,
    avgCPC: 3.8, // Technology (2025 data)
  },
  automotive: {
    formCompletionRate: 0.7,
    ctaClickRate: 1.0,
    bounceRateAdjustment: 0.0,
    avgCPC: 2.46, // Auto industry (2025 data)
  },
  realestate: {
    formCompletionRate: 0.75,
    ctaClickRate: 1.1,
    bounceRateAdjustment: 0.0,
    avgCPC: 2.37, // Real Estate (2025 data)
  },
  travel: {
    formCompletionRate: 0.65,
    ctaClickRate: 0.9,
    bounceRateAdjustment: 0.1,
    avgCPC: 1.53, // Travel & Hospitality (2025 data)
  },
  consumerservices: {
    formCompletionRate: 0.7,
    ctaClickRate: 1.0,
    bounceRateAdjustment: 0.0,
    avgCPC: 6.4, // Consumer Services (2025 data)
  },
  education: {
    formCompletionRate: 0.75,
    ctaClickRate: 0.95,
    bounceRateAdjustment: -0.05,
    avgCPC: 2.4, // Education (2025 data)
  },
  healthcare: {
    formCompletionRate: 0.78,
    ctaClickRate: 1.15,
    bounceRateAdjustment: 0.02,
    avgCPC: 4.8, // Healthcare/Medical (2025 data) - higher due to compliance/trust requirements
  },
} as const

// Updated CPC calculation constants with 2025 data
export const CPC_CONSTANTS = {
  // Base CPCs by network type (2025 averages)
  SEARCH_NETWORK_BASE: 2.69, // Overall Google Search average (2025)
  DISPLAY_NETWORK_BASE: 0.63, // Display network average (2025)

  // B2B vs B2C multipliers (2025 data)
  B2B_MULTIPLIER: 1.24, // B2B is ~24% higher ($3.33 vs $2.69)
  B2C_MULTIPLIER: 0.98, // B2C is slightly lower ($2.64 vs $2.69)

  // Traffic source CPC modifiers (updated with 2025 social data)
  TRAFFIC_SOURCE_CPC: {
    organic: 0.0, // Organic traffic has no direct cost
    paid: 1.0, // Use calculated CPC
    social: 0.4, // Social media advertising (Facebook ~$0.50, Instagram ~$1.03)
    email: 0.05, // Email marketing cost per click
    direct: 0.0, // Direct traffic has no cost
    referral: 0.15, // Referral program costs
    unknown: 0.3, // Conservative estimate
    linkedin: 2.0, // LinkedIn B2B premium (~$5.39 in 2025)
  },

  // Device type modifiers
  DEVICE_CPC_MODIFIERS: {
    desktop: 1.0, // Baseline
    mobile: 0.85, // Mobile typically 15% lower CPC
    tablet: 0.92, // Tablet slightly lower
  },

  // Geographic modifiers (can be expanded)
  GEO_MODIFIERS: {
    tier1: 1.0, // US, UK, Canada, Australia
    tier2: 0.7, // Western Europe, Japan
    tier3: 0.4, // Emerging markets
    unknown: 0.8, // Conservative estimate
  },

  // Competition level modifiers
  COMPETITION_MODIFIERS: {
    high: 1.4, // High competition increases CPC
    medium: 1.0, // Baseline
    low: 0.7, // Low competition reduces CPC
    unknown: 1.0,
  },

  // Quality Score impact (Google Ads)
  QUALITY_SCORE_MODIFIERS: {
    excellent: 0.7, // 8-10 Quality Score
    good: 0.85, // 6-7 Quality Score
    average: 1.0, // 4-5 Quality Score
    poor: 1.3, // 1-3 Quality Score
    unknown: 1.0,
  },
} as const

export const FIELD_TYPE_COMPLEXITY = {
  text: 0.1,
  email: 0.3,
  password: 0.5,
  tel: 0.4,
  number: 0.2,
  date: 0.3,
  select: 0.2,
  textarea: 0.4,
  checkbox: 0.1,
  radio: 0.1,
} as const

export const HIGH_INTENT_KEYWORDS = [
  "buy",
  "purchase",
  "order",
  "get",
  "start",
  "begin",
  "try",
  "download",
  "sign up",
  "signup",
  "register",
  "join",
  "subscribe",
  "book",
  "schedule",
  "request",
  "claim",
  "unlock",
  "access",
  "upgrade",
  "activate",
]

export const URGENCY_KEYWORDS = [
  "now",
  "today",
  "limited",
  "hurry",
  "fast",
  "quick",
  "instant",
  "immediate",
  "deadline",
  "expires",
  "ending",
  "last chance",
  "final",
  "urgent",
]

export const TRUST_INDICATORS = [
  "guarantee",
  "secure",
  "safe",
  "protected",
  "verified",
  "certified",
  "trusted",
  "ssl",
  "encrypted",
  "privacy",
  "refund",
  "money back",
]

// Constants loaded - debug logging removed for production
