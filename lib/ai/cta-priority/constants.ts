// Primary CTA Detection Model v1.0 - Constants and Weights

export const LOCATION_WEIGHTS = {
  "above-fold": 2, // Above estimated fold (600-1000px)
  "mid-page": 1, // Mid-page visible
  "below-fold": 0, // Below 1,500px or footer
} as const

export const TEXT_INTENT_SCORES = {
  strong: 3, // "Buy Now", "Start Trial", "Get Started", "Sign Up", "Download Now"
  medium: 2, // "Download Guide", "Request Demo", "Contact Sales"
  low: 1, // "Learn More", "Read More", "View Details"
  passive: 0, // "Click Here", "More Info", generic text
} as const

export const VISUAL_PROMINENCE_SCORES = {
  high: 3, // Large, unique color, whitespace, button styling
  medium: 2, // Medium size, matches theme
  low: 1, // Small, blends in
  hidden: 0, // Hidden, flat link
} as const

export const SINGULARITY_SCORES = {
  unique: 2, // Only clear CTA in section
  primary: 1, // One of few, but likely primary
  competing: 0, // Lost among many similar CTAs
} as const

export const CONTEXT_ALIGNMENT_SCORES = {
  perfect: 2, // Text matches headline/value prop exactly
  partial: 1, // Some alignment with page message
  none: 0, // No clear connection
} as const

// Adjustment layer constants
export const MOTIVATION_BOOST = 1
export const SIDE_BIAS_BOOST = 1
export const Z_PATTERN_BOOST = 1
export const CTV_BOOST = 1
export const COMPLEXITY_ADJUSTMENT = 1

// Thresholds
export const FOLD_LINE_ESTIMATE = 1000
export const HEADER_THRESHOLD = 150
export const FOOTER_THRESHOLD = 1500
export const LONG_PAGE_THRESHOLD = 2000
export const SHORT_PAGE_THRESHOLD = 1000
export const MIN_SCORE_THRESHOLD = 6

// Section definitions
export const PAGE_SECTIONS = {
  hero: { minY: 0, maxY: 800, priority: 15 },
  header: { minY: 0, maxY: 150, priority: 8 },
  features: { minY: 800, maxY: 1500, priority: 6 },
  testimonials: { minY: 1500, maxY: 2000, priority: 4 },
  footer: { minY: 2000, maxY: Number.POSITIVE_INFINITY, priority: 2 },
  "below-fold": { minY: 1000, maxY: Number.POSITIVE_INFINITY, priority: 3 },
} as const

// Strong action verbs for text intent detection
export const STRONG_ACTION_VERBS = [
  "buy",
  "purchase",
  "order",
  "shop", // Added for Apple.com and similar e-commerce sites
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

export const MEDIUM_ACTION_VERBS = [
  "learn",
  "discover",
  "explore",
  "view",
  "see",
  "watch",
  "read",
  "contact",
  "call",
  "email",
  "demo",
  "preview",
  "browse",
]

export const PASSIVE_PHRASES = ["click here", "more info", "details", "continue", "next", "back"]

// Navigation terms that should be deprioritized (not primary CTAs)
export const NAVIGATION_TERMS = [
  "mac",
  "ipad", 
  "iphone",
  "watch",
  "airpods",
  "tv",
  "home",
  "about",
  "support",
  "store",
  "products",
  "services",
  "solutions",
  "company",
  "news",
  "blog",
  "help",
  "faq",
  "resources",
  "documentation",
  "guides",
  "tutorials"
]

// Section selection hierarchy - hero section gets absolute priority
export const SECTION_HIERARCHY = {
  HERO_Y_MIN: 150,
  HERO_Y_MAX: 800,
  HEADER_Y_MAX: 150,
  ABOVE_FOLD_MAX: 1000,
} as const

export const SECTION_SELECTION_ORDER = ["hero", "header", "above-fold"] as const
