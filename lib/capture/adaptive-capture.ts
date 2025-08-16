// Adaptive Capture - Intelligent routing between standard and enhanced browserless
// This module provides backward compatibility while enabling advanced features

import { BrowserlessClient } from "./browserless"
import { EnhancedBrowserlessClient, type EnhancedCaptureOptions } from "./enhanced-browserless"
import type { CaptureOptions, CaptureResult } from "../contracts/capture"
import { logger } from "../utils/logger"

export interface AdaptiveCaptureConfig {
  enableEnhancedForComplexSites: boolean
  enableEnhancedForKnownProblematicDomains: boolean
  enableFallbackToStandard: boolean
  complexSiteIndicators: string[]
  problematicDomains: string[]
}

export class AdaptiveCaptureClient {
  private standardClient: BrowserlessClient
  private enhancedClient: EnhancedBrowserlessClient
  private config: AdaptiveCaptureConfig
  private moduleLogger = logger.module("adaptive-capture-client")

  constructor(apiKey?: string, config?: Partial<AdaptiveCaptureConfig>) {
    this.standardClient = new BrowserlessClient(apiKey)
    this.enhancedClient = new EnhancedBrowserlessClient(apiKey)
    
    this.config = {
      enableEnhancedForComplexSites: true,
      enableEnhancedForKnownProblematicDomains: true,
      enableFallbackToStandard: true,
      complexSiteIndicators: [
        // SPA frameworks and indicators
        'react', 'angular', 'vue', 'next.js', 'nuxt',
        // Known complex platforms
        'shopify', 'wordpress', 'drupal', 'magento',
        // Interactive platforms
        'interactive', 'dynamic', 'spa'
      ],
      problematicDomains: [
        // E-commerce platforms known to have bot detection
        'amazon.com', 'ebay.com', 'etsy.com', 'alibaba.com',
        // Social media platforms
        'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
        // Enterprise/SaaS platforms
        'salesforce.com', 'hubspot.com', 'mailchimp.com',
        // Financial/security-focused sites
        'chase.com', 'wellsfargo.com', 'paypal.com', 'stripe.com',
        // Content platforms with anti-scraping
        'netflix.com', 'youtube.com', 'spotify.com',
        // Major tech companies
        'google.com', 'microsoft.com', 'apple.com'
      ],
      ...config
    }
  }

  /**
   * Determine which capture method to use based on URL and options
   */
  private shouldUseEnhancedCapture(url: string, options: CaptureOptions): boolean {
    // Always use enhanced if explicitly requested
    if ('enableSmartTimeouts' in options || 'enableStealthMode' in options) {
      return true
    }

    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.toLowerCase().replace('www.', '')
      const fullUrl = url.toLowerCase()

      // Check against known problematic domains
      if (this.config.enableEnhancedForKnownProblematicDomains) {
        const isProblematicDomain = this.config.problematicDomains.some(problematicDomain => 
          domain.includes(problematicDomain) || domain.endsWith(problematicDomain)
        )
        
        if (isProblematicDomain) {
          this.moduleLogger.info(`Using enhanced capture for known problematic domain: ${domain}`)
          return true
        }
      }

      // Check for complex site indicators
      if (this.config.enableEnhancedForComplexSites) {
        const hasComplexIndicators = this.config.complexSiteIndicators.some(indicator =>
          fullUrl.includes(indicator) || domain.includes(indicator)
        )

        if (hasComplexIndicators) {
          this.moduleLogger.info(`Using enhanced capture for complex site indicators: ${domain}`)
          return true
        }
      }

      // Default to standard capture for unknown domains
      return false

    } catch (urlError) {
      this.moduleLogger.warn(`URL parsing error, defaulting to standard capture: ${urlError}`)
      return false
    }
  }

  /**
   * Adaptive capture with intelligent routing and fallback
   */
  async capture(options: CaptureOptions): Promise<CaptureResult> {
    const startTime = Date.now()
    const useEnhanced = this.shouldUseEnhancedCapture(options.url, options)

    this.moduleLogger.info(`Starting adaptive capture`, {
      url: options.url,
      useEnhanced,
      isMobile: options.isMobile
    })

    // Attempt primary capture method
    try {
      if (useEnhanced) {
        this.moduleLogger.info(`Attempting enhanced capture for: ${options.url}`)
        
        const enhancedOptions: EnhancedCaptureOptions = {
          ...options,
          enableSmartTimeouts: true,
          enableStealthMode: true,
          enableResourceBlocking: false, // Conservative default
          retryFailedCaptures: true,
          maxRetries: 2
        }

        const result = await this.enhancedClient.capture(enhancedOptions)
        
        this.moduleLogger.info(`Enhanced capture successful`, {
          url: options.url,
          duration: Date.now() - startTime,
          method: 'enhanced'
        })

        return result
      } else {
        this.moduleLogger.info(`Attempting standard capture for: ${options.url}`)
        
        const result = await this.standardClient.capture(options)
        
        this.moduleLogger.info(`Standard capture successful`, {
          url: options.url,
          duration: Date.now() - startTime,
          method: 'standard'
        })

        return result
      }
    } catch (primaryError) {
      this.moduleLogger.warn(`Primary capture method failed`, {
        url: options.url,
        method: useEnhanced ? 'enhanced' : 'standard',
        error: (primaryError as Error).message,
        duration: Date.now() - startTime
      })

      // Attempt fallback if enabled
      if (this.config.enableFallbackToStandard && useEnhanced) {
        try {
          this.moduleLogger.info(`Attempting fallback to standard capture for: ${options.url}`)
          
          const fallbackResult = await this.standardClient.capture(options)
          
          this.moduleLogger.info(`Fallback capture successful`, {
            url: options.url,
            duration: Date.now() - startTime,
            method: 'fallback-standard'
          })

          return fallbackResult
        } catch (fallbackError) {
          this.moduleLogger.error(`Both primary and fallback capture failed`, {
            url: options.url,
            primaryError: (primaryError as Error).message,
            fallbackError: (fallbackError as Error).message,
            duration: Date.now() - startTime
          })

          // Throw the original primary error as it's more relevant
          throw primaryError
        }
      } else {
        // No fallback enabled or already using standard, throw the error
        throw primaryError
      }
    }
  }

  /**
   * Force enhanced capture (useful for testing or specific requirements)
   */
  async captureEnhanced(options: CaptureOptions): Promise<CaptureResult> {
    const enhancedOptions: EnhancedCaptureOptions = {
      ...options,
      enableSmartTimeouts: true,
      enableStealthMode: true,
      enableResourceBlocking: false,
      retryFailedCaptures: true,
      maxRetries: 3
    }

    this.moduleLogger.info(`Forced enhanced capture for: ${options.url}`)
    return await this.enhancedClient.capture(enhancedOptions)
  }

  /**
   * Force standard capture (useful for comparison or fallback)
   */
  async captureStandard(options: CaptureOptions): Promise<CaptureResult> {
    this.moduleLogger.info(`Forced standard capture for: ${options.url}`)
    return await this.standardClient.capture(options)
  }

  /**
   * Get capture recommendations for a URL
   */
  getCaptureRecommendation(url: string): {
    recommendedMethod: 'standard' | 'enhanced'
    reasoning: string
    confidence: 'low' | 'medium' | 'high'
  } {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.toLowerCase().replace('www.', '')
      const fullUrl = url.toLowerCase()

      // Check problematic domains
      const isProblematicDomain = this.config.problematicDomains.some(problematicDomain => 
        domain.includes(problematicDomain) || domain.endsWith(problematicDomain)
      )

      if (isProblematicDomain) {
        return {
          recommendedMethod: 'enhanced',
          reasoning: `Domain ${domain} is known to have bot detection or complex loading patterns`,
          confidence: 'high'
        }
      }

      // Check complexity indicators
      const complexIndicators = this.config.complexSiteIndicators.filter(indicator =>
        fullUrl.includes(indicator) || domain.includes(indicator)
      )

      if (complexIndicators.length > 0) {
        return {
          recommendedMethod: 'enhanced',
          reasoning: `Site shows complexity indicators: ${complexIndicators.join(', ')}`,
          confidence: 'medium'
        }
      }

      return {
        recommendedMethod: 'standard',
        reasoning: 'No specific complexity or problematic patterns detected',
        confidence: 'low'
      }

    } catch (urlError) {
      return {
        recommendedMethod: 'standard',
        reasoning: 'URL parsing error, defaulting to safe option',
        confidence: 'low'
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AdaptiveCaptureConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.moduleLogger.info('Adaptive capture configuration updated', newConfig)
  }

  /**
   * Get current configuration
   */
  getConfig(): AdaptiveCaptureConfig {
    return { ...this.config }
  }
}
