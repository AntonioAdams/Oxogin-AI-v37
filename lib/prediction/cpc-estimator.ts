// CPC Estimation Utilities
// Helps estimate sophisticated CPC context from basic page data

import type { PageContext } from "./types"
import { CPC_CONSTANTS, INDUSTRY_MODIFIERS } from "./constants"

export class CPCEstimator {
  /**
   * Estimate CPC context from basic page information
   */
  static estimateContext(basicContext: Partial<PageContext>): PageContext {
    const context: PageContext = {
      totalImpressions: basicContext.totalImpressions || 1000,
      trafficSource: basicContext.trafficSource || "unknown",
      deviceType: basicContext.deviceType || "desktop",
      ...basicContext,
    }

    // Auto-detect industry from URL if not provided
    if (!context.industry && context.url) {
      context.industry = this.detectIndustryFromURL(context.url)
    }

    // NEW: Auto-detect industry from DOM content if still not found
    if (!context.industry && context.domContent) {
      context.industry = this.detectIndustryFromDOMContent(context.domContent)
    }

    // Auto-detect business type
    if (!context.businessType) {
      context.businessType = this.detectBusinessType(context)
    }

    // Auto-detect network type from traffic source
    if (!context.networkType) {
      context.networkType = this.detectNetworkType(context.trafficSource)
    }

    // Estimate competition level
    if (!context.competitionLevel) {
      context.competitionLevel = this.estimateCompetitionLevel(context)
    }

    // Estimate quality score factors
    if (!context.qualityScore) {
      context.qualityScore = this.estimateQualityScore(context)
    }

    // Set default geo tier
    if (!context.geoTier) {
      context.geoTier = "tier1" // Conservative default
    }

    return context
  }

  /**
   * NEW: Detect industry from DOM content language patterns
   */
  private static detectIndustryFromDOMContent(domContent: any): PageContext["industry"] {
    // Combine all text content for analysis
    const allText = this.extractAllTextFromDOM(domContent).toLowerCase()

    // Legal industry keywords
    const legalKeywords = [
      "attorney",
      "lawyer",
      "legal",
      "law firm",
      "litigation",
      "lawsuit",
      "court",
      "legal advice",
      "legal services",
      "paralegal",
      "solicitor",
      "barrister",
      "personal injury",
      "criminal defense",
      "divorce",
      "custody",
      "estate planning",
      "contract law",
      "corporate law",
      "immigration law",
      "bankruptcy",
      "dui",
      "workers compensation",
      "medical malpractice",
      "wrongful death",
    ]

    // Finance & Insurance keywords
    const financeKeywords = [
      "bank",
      "banking",
      "loan",
      "mortgage",
      "insurance",
      "financial",
      "investment",
      "credit",
      "finance",
      "wealth management",
      "financial advisor",
      "retirement",
      "portfolio",
      "stocks",
      "bonds",
      "mutual funds",
      "ira",
      "401k",
      "annuity",
      "life insurance",
      "auto insurance",
      "home insurance",
      "health insurance",
      "business insurance",
      "liability insurance",
      "refinance",
      "equity",
    ]

    // Technology keywords
    const technologyKeywords = [
      "software",
      "technology",
      "tech",
      "ai",
      "artificial intelligence",
      "machine learning",
      "cloud",
      "api",
      "development",
      "programming",
      "coding",
      "app",
      "mobile app",
      "web development",
      "cybersecurity",
      "data",
      "analytics",
      "blockchain",
      "cryptocurrency",
      "digital transformation",
      "automation",
      "iot",
      "saas",
    ]

    // SaaS keywords
    const saasKeywords = [
      "saas",
      "software as a service",
      "platform",
      "dashboard",
      "subscription",
      "cloud-based",
      "enterprise software",
      "business software",
      "crm",
      "erp",
      "project management",
      "collaboration",
      "productivity",
      "workflow",
      "integration",
      "scalable",
      "multi-tenant",
      "b2b software",
    ]

    // E-commerce keywords
    const ecommerceKeywords = [
      "shop",
      "store",
      "buy",
      "purchase",
      "cart",
      "checkout",
      "product",
      "sale",
      "discount",
      "free shipping",
      "return policy",
      "customer reviews",
      "wishlist",
      "inventory",
      "catalog",
      "marketplace",
      "retail",
      "online store",
      "e-commerce",
      "payment",
      "secure checkout",
      "add to cart",
      "buy now",
    ]

    // Real Estate keywords
    const realEstateKeywords = [
      "real estate",
      "property",
      "homes",
      "house",
      "apartment",
      "condo",
      "rental",
      "buy home",
      "sell home",
      "mortgage",
      "realtor",
      "agent",
      "listing",
      "mls",
      "property management",
      "commercial real estate",
      "residential",
      "investment property",
      "home value",
      "market analysis",
      "closing",
    ]

    // Healthcare keywords
    const healthcareKeywords = [
      "doctor",
      "medical",
      "health",
      "healthcare",
      "clinic",
      "hospital",
      "physician",
      "dentist",
      "dental",
      "surgery",
      "treatment",
      "patient",
      "appointment",
      "medical practice",
      "specialist",
      "therapy",
      "diagnosis",
      "prescription",
      "insurance accepted",
      "telehealth",
      "urgent care",
    ]

    // Education keywords
    const educationKeywords = [
      "education",
      "school",
      "university",
      "college",
      "course",
      "training",
      "learn",
      "student",
      "degree",
      "certification",
      "online learning",
      "e-learning",
      "tutorial",
      "class",
      "instructor",
      "curriculum",
      "academic",
      "scholarship",
      "enrollment",
      "tuition",
      "campus",
    ]

    // Travel & Hospitality keywords
    const travelKeywords = [
      "travel",
      "hotel",
      "flight",
      "booking",
      "vacation",
      "trip",
      "resort",
      "airline",
      "cruise",
      "tour",
      "destination",
      "accommodation",
      "reservation",
      "hospitality",
      "restaurant",
      "dining",
      "tourism",
      "adventure",
      "package deal",
    ]

    // Automotive keywords
    const automotiveKeywords = [
      "auto",
      "car",
      "vehicle",
      "automotive",
      "dealership",
      "used cars",
      "new cars",
      "truck",
      "suv",
      "motorcycle",
      "parts",
      "service",
      "repair",
      "maintenance",
      "financing",
      "lease",
      "trade-in",
      "warranty",
      "insurance",
      "registration",
    ]

    // Consumer Services keywords
    const consumerServicesKeywords = [
      "service",
      "repair",
      "maintenance",
      "cleaning",
      "landscaping",
      "plumbing",
      "electrical",
      "hvac",
      "roofing",
      "painting",
      "construction",
      "renovation",
      "home improvement",
      "contractor",
      "handyman",
      "installation",
      "emergency service",
      "local service",
      "professional service",
      "licensed",
      "insured",
    ]

    // Calculate keyword density for each industry
    const industryScores = {
      legal: this.calculateKeywordDensity(allText, legalKeywords),
      finance: this.calculateKeywordDensity(allText, financeKeywords),
      technology: this.calculateKeywordDensity(allText, technologyKeywords),
      saas: this.calculateKeywordDensity(allText, saasKeywords),
      ecommerce: this.calculateKeywordDensity(allText, ecommerceKeywords),
      realestate: this.calculateKeywordDensity(allText, realEstateKeywords),
      healthcare: this.calculateKeywordDensity(allText, healthcareKeywords),
      education: this.calculateKeywordDensity(allText, educationKeywords),
      travel: this.calculateKeywordDensity(allText, travelKeywords),
      automotive: this.calculateKeywordDensity(allText, automotiveKeywords),
      consumerservices: this.calculateKeywordDensity(allText, consumerServicesKeywords),
    }

    // Find the industry with the highest score
    const topIndustry = Object.entries(industryScores).reduce((a, b) =>
      industryScores[a[0]] > industryScores[b[0]] ? a : b,
    )

    // Only return if confidence is high enough (at least 3 keyword matches)
    if (topIndustry[1] >= 3) {
      return topIndustry[0] as PageContext["industry"]
    }

    return undefined // Unknown industry
  }

  /**
   * Extract all text content from DOM data
   */
  private static extractAllTextFromDOM(domContent: any): string {
    const textParts: string[] = []

    // Extract from buttons
    if (domContent.buttons) {
      domContent.buttons.forEach((button: any) => {
        if (button.text) textParts.push(button.text)
      })
    }

    // Extract from links
    if (domContent.links) {
      domContent.links.forEach((link: any) => {
        if (link.text) textParts.push(link.text)
      })
    }

    // Extract from headings
    if (domContent.headings) {
      domContent.headings.forEach((heading: any) => {
        if (heading.text) textParts.push(heading.text)
      })
    }

    // Extract from text blocks
    if (domContent.textBlocks) {
      domContent.textBlocks.forEach((textBlock: any) => {
        if (textBlock.text) textParts.push(textBlock.text)
      })
    }

    // Extract from form fields (placeholders, labels)
    if (domContent.formFields) {
      domContent.formFields.forEach((field: any) => {
        if (field.attributes?.placeholder) textParts.push(field.attributes.placeholder)
        if (field.label) textParts.push(field.label)
      })
    }

    // Extract from page title and description
    if (domContent.title) textParts.push(domContent.title)
    if (domContent.description) textParts.push(domContent.description)

    // Extract from image alt text
    if (domContent.images) {
      domContent.images.forEach((image: any) => {
        if (image.alt) textParts.push(image.alt)
      })
    }

    return textParts.join(" ")
  }

  /**
   * Calculate keyword density for industry detection
   */
  private static calculateKeywordDensity(text: string, keywords: string[]): number {
    let matches = 0

    keywords.forEach((keyword) => {
      // Count exact matches and partial matches
      const regex = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "gi")
      const keywordMatches = (text.match(regex) || []).length
      matches += keywordMatches

      // Bonus for exact phrase matches
      if (keyword.includes(" ") && keywordMatches > 0) {
        matches += keywordMatches * 0.5 // 50% bonus for phrase matches
      }
    })

    return matches
  }

  /**
   * Detect industry from URL patterns
   */
  private static detectIndustryFromURL(url: string): PageContext["industry"] {
    const urlLower = url.toLowerCase()

    // SaaS indicators
    if (
      urlLower.includes("saas") ||
      urlLower.includes("software") ||
      urlLower.includes("app") ||
      urlLower.includes("platform")
    ) {
      return "saas"
    }

    // E-commerce indicators
    if (
      urlLower.includes("shop") ||
      urlLower.includes("store") ||
      urlLower.includes("buy") ||
      urlLower.includes("cart")
    ) {
      return "ecommerce"
    }

    // Legal indicators
    if (
      urlLower.includes("law") ||
      urlLower.includes("legal") ||
      urlLower.includes("attorney") ||
      urlLower.includes("lawyer")
    ) {
      return "legal"
    }

    // Finance indicators
    if (
      urlLower.includes("bank") ||
      urlLower.includes("finance") ||
      urlLower.includes("insurance") ||
      urlLower.includes("loan")
    ) {
      return "finance"
    }

    // Technology indicators
    if (
      urlLower.includes("tech") ||
      urlLower.includes("ai") ||
      urlLower.includes("cloud") ||
      urlLower.includes("api")
    ) {
      return "technology"
    }

    // Real estate indicators
    if (
      urlLower.includes("real") ||
      urlLower.includes("property") ||
      urlLower.includes("homes") ||
      urlLower.includes("realty")
    ) {
      return "realestate"
    }

    // Travel indicators
    if (
      urlLower.includes("travel") ||
      urlLower.includes("hotel") ||
      urlLower.includes("flight") ||
      urlLower.includes("booking")
    ) {
      return "travel"
    }

    // Auto indicators
    if (
      urlLower.includes("auto") ||
      urlLower.includes("car") ||
      urlLower.includes("vehicle") ||
      urlLower.includes("dealer")
    ) {
      return "automotive"
    }

    return undefined // Unknown industry
  }

  /**
   * Detect business type from context
   */
  private static detectBusinessType(context: Partial<PageContext>): "b2b" | "b2c" | "unknown" {
    // Industry-based detection
    const b2bIndustries = ["saas", "technology", "legal", "finance", "leadgen", "healthcare"]
    const b2cIndustries = ["ecommerce", "travel", "consumerservices"]

    if (context.industry) {
      if (b2bIndustries.includes(context.industry)) return "b2b"
      if (b2cIndustries.includes(context.industry)) return "b2c"
    }

    // Traffic source hints
    if (context.trafficSource === "linkedin") return "b2b"
    if (context.trafficSource === "social") return "b2c"

    // URL-based detection
    if (context.url) {
      const urlLower = context.url.toLowerCase()
      if (
        urlLower.includes("enterprise") ||
        urlLower.includes("business") ||
        urlLower.includes("b2b") ||
        urlLower.includes("corporate")
      ) {
        return "b2b"
      }
      if (urlLower.includes("consumer") || urlLower.includes("personal") || urlLower.includes("individual")) {
        return "b2c"
      }
    }

    // NEW: DOM content-based detection
    if (context.domContent) {
      const allText = this.extractAllTextFromDOM(context.domContent).toLowerCase()

      // B2B indicators
      const b2bKeywords = [
        "enterprise",
        "business",
        "corporate",
        "b2b",
        "professional",
        "organization",
        "company",
        "team",
        "workflow",
        "productivity",
        "collaboration",
        "integration",
        "scalable",
        "roi",
        "efficiency",
        "automation",
        "dashboard",
        "analytics",
      ]

      // B2C indicators
      const b2cKeywords = [
        "personal",
        "individual",
        "family",
        "home",
        "consumer",
        "lifestyle",
        "everyday",
        "simple",
        "easy",
        "convenient",
        "affordable",
        "budget",
        "save money",
        "deal",
        "discount",
        "free trial",
        "no commitment",
      ]

      const b2bScore = this.calculateKeywordDensity(allText, b2bKeywords)
      const b2cScore = this.calculateKeywordDensity(allText, b2cKeywords)

      if (b2bScore > b2cScore && b2bScore >= 2) return "b2b"
      if (b2cScore > b2bScore && b2cScore >= 2) return "b2c"
    }

    return "unknown"
  }

  /**
   * Detect network type from traffic source
   */
  private static detectNetworkType(
    trafficSource: PageContext["trafficSource"],
  ): "search" | "display" | "social" | "unknown" {
    switch (trafficSource) {
      case "paid":
        return "search" // Assume paid search unless specified otherwise
      case "social":
      case "linkedin":
        return "social"
      case "referral":
        return "display" // Often display network referrals
      default:
        return "unknown"
    }
  }

  /**
   * Estimate competition level
   */
  private static estimateCompetitionLevel(context: Partial<PageContext>): "high" | "medium" | "low" | "unknown" {
    const highCompetitionIndustries = ["legal", "finance", "consumerservices", "saas", "healthcare"]
    const mediumCompetitionIndustries = ["technology", "automotive", "realestate"]
    const lowCompetitionIndustries = ["content", "travel"]

    if (context.industry) {
      if (highCompetitionIndustries.includes(context.industry)) return "high"
      if (mediumCompetitionIndustries.includes(context.industry)) return "medium"
      if (lowCompetitionIndustries.includes(context.industry)) return "low"
    }

    if (context.competitorPresence === true) return "high"

    return "medium" // Default
  }

  /**
   * Estimate quality score
   */
  private static estimateQualityScore(
    context: Partial<PageContext>,
  ): "excellent" | "good" | "average" | "poor" | "unknown" {
    let score = 0

    // Load time factor
    if (context.loadTime) {
      if (context.loadTime <= 2) score += 2
      else if (context.loadTime <= 3) score += 1
      else if (context.loadTime >= 5) score -= 1
    }

    // Trust signals
    if (context.hasSSL) score += 1
    if (context.hasTrustBadges) score += 1
    if (context.hasTestimonials) score += 1

    // Brand recognition
    if (typeof context.brandRecognition === "number") {
      score += context.brandRecognition * 2
    } else if (context.brandRecognition === "high") {
      score += 2
    } else if (context.brandRecognition === "medium") {
      score += 1
    }

    // Convert to rating
    if (score >= 6) return "excellent"
    if (score >= 4) return "good"
    if (score >= 2) return "average"
    if (score >= 0) return "poor"

    return "unknown"
  }

  /**
   * Calculate estimated CPC for a given context
   */
  static calculateEstimatedCPC(context: PageContext): {
    estimatedCPC: number
    breakdown: {
      baseCPC: number
      industryMultiplier: number
      businessTypeMultiplier: number
      trafficSourceMultiplier: number
      deviceMultiplier: number
      competitionMultiplier: number
      qualityMultiplier: number
      geoMultiplier: number
      timeMultiplier: number
    }
  } {
    // Base CPC - UPDATED to $2.93
    const baseCPC = context.networkType === "display" ? 2.93 : 2.93

    // Industry CPC - ensure minimum $2.93
    const industryCPC =
      context.industry && INDUSTRY_MODIFIERS[context.industry]
        ? Math.max(INDUSTRY_MODIFIERS[context.industry].avgCPC, 2.93)
        : 2.93

    // Multipliers
    const businessTypeMultiplier =
      context.businessType === "b2b" ? CPC_CONSTANTS.B2B_MULTIPLIER : CPC_CONSTANTS.B2C_MULTIPLIER

    const trafficSourceMultiplier = CPC_CONSTANTS.TRAFFIC_SOURCE_CPC[context.trafficSource] ?? 0.3
    const deviceMultiplier = CPC_CONSTANTS.DEVICE_CPC_MODIFIERS[context.deviceType] ?? 1.0
    const competitionMultiplier = CPC_CONSTANTS.COMPETITION_MODIFIERS[context.competitionLevel || "medium"]
    const qualityMultiplier = CPC_CONSTANTS.QUALITY_SCORE_MODIFIERS[context.qualityScore || "unknown"]
    const geoMultiplier = CPC_CONSTANTS.GEO_MODIFIERS[context.geoTier || "tier1"]

    // Time multiplier (simplified)
    let timeMultiplier = 1.0
    if (context.timeOfDay === "morning" || context.timeOfDay === "afternoon") {
      timeMultiplier *= 1.1
    }
    if (context.seasonality === "high") {
      timeMultiplier *= 1.2
    } else if (context.seasonality === "low") {
      timeMultiplier *= 0.85
    }

    // Calculate final CPC - ensure minimum $2.93
    const estimatedCPC = Math.max(
      industryCPC *
        businessTypeMultiplier *
        trafficSourceMultiplier *
        deviceMultiplier *
        competitionMultiplier *
        qualityMultiplier *
        geoMultiplier *
        timeMultiplier,
      2.93,
    )

    return {
      estimatedCPC,
      breakdown: {
        baseCPC,
        industryMultiplier: industryCPC / baseCPC,
        businessTypeMultiplier,
        trafficSourceMultiplier,
        deviceMultiplier,
        competitionMultiplier,
        qualityMultiplier,
        geoMultiplier,
        timeMultiplier,
      },
    }
  }
}
