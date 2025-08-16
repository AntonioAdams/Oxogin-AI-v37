// Anti-Detection Configuration for Enhanced Browserless Capture
// This module provides stealth capabilities to avoid bot detection

export interface StealthConfig {
  userAgentRotation: boolean
  viewportRandomization: boolean
  timingRandomization: boolean
  fingerPrintEvasion: boolean
  proxySupport: boolean
}

export interface BrowserFingerprint {
  userAgent: string
  viewport: {
    width: number
    height: number
    deviceScaleFactor: number
  }
  timezone: string
  language: string
  platform: string
}

export class StealthManager {
  private config: StealthConfig
  private userAgents: string[]
  private timezones: string[]
  private languages: string[]

  constructor(config?: Partial<StealthConfig>) {
    this.config = {
      userAgentRotation: true,
      viewportRandomization: true,
      timingRandomization: true,
      fingerPrintEvasion: true,
      proxySupport: false, // Can be enabled when proxy infrastructure is available
      ...config
    }

    this.initializeUserAgents()
    this.initializeTimezones()
    this.initializeLanguages()
  }

  private initializeUserAgents() {
    // Realistic, recent user agents that rotate
    this.userAgents = [
      // Chrome (various versions)
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      
      // Firefox
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
      
      // Safari
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
      
      // Edge
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
    ]
  }

  private initializeTimezones() {
    this.timezones = [
      'America/New_York',
      'America/Los_Angeles',
      'America/Chicago',
      'Europe/London',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Australia/Sydney'
    ]
  }

  private initializeLanguages() {
    this.languages = [
      'en-US,en;q=0.9',
      'en-GB,en;q=0.9',
      'en-US,en;q=0.9,es;q=0.8',
      'en-US,en;q=0.9,fr;q=0.8',
      'en-US,en;q=0.9,de;q=0.8'
    ]
  }

  /**
   * Generate a realistic browser fingerprint
   */
  generateFingerprint(isMobile: boolean = false): BrowserFingerprint {
    const userAgent = this.getRandomUserAgent(isMobile)
    const viewport = this.getRandomViewport(isMobile)
    
    return {
      userAgent,
      viewport,
      timezone: this.getRandomElement(this.timezones),
      language: this.getRandomElement(this.languages),
      platform: this.getPlatformFromUserAgent(userAgent)
    }
  }

  private getRandomUserAgent(isMobile: boolean): string {
    if (isMobile) {
      const mobileUserAgents = [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"
      ]
      return this.getRandomElement(mobileUserAgents)
    }
    
    return this.getRandomElement(this.userAgents)
  }

  private getRandomViewport(isMobile: boolean): BrowserFingerprint['viewport'] {
    if (isMobile) {
      const mobileViewports = [
        { width: 375, height: 812, deviceScaleFactor: 3 }, // iPhone 12/13/14
        { width: 414, height: 896, deviceScaleFactor: 2 }, // iPhone 11
        { width: 390, height: 844, deviceScaleFactor: 3 }, // iPhone 12 mini
        { width: 428, height: 926, deviceScaleFactor: 3 }, // iPhone 14 Plus
      ]
      return this.getRandomElement(mobileViewports)
    }

    const desktopViewports = [
      { width: 1920, height: 1080, deviceScaleFactor: 1 },
      { width: 1366, height: 768, deviceScaleFactor: 1 },
      { width: 1536, height: 864, deviceScaleFactor: 1.25 },
      { width: 1440, height: 900, deviceScaleFactor: 1 },
      { width: 2560, height: 1440, deviceScaleFactor: 1 }
    ]
    return this.getRandomElement(desktopViewports)
  }

  private getPlatformFromUserAgent(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Win32'
    if (userAgent.includes('Macintosh')) return 'MacIntel'
    if (userAgent.includes('Linux')) return 'Linux x86_64'
    if (userAgent.includes('iPhone')) return 'iPhone'
    if (userAgent.includes('Android')) return 'Linux armv8l'
    return 'Win32'
  }

  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  }

  /**
   * Generate realistic human-like delays
   */
  getHumanDelay(): number {
    // Random delay between 100ms and 2000ms with realistic distribution
    const baseDelay = 200
    const randomFactor = Math.random() * 1800
    const humanVariation = Math.random() < 0.3 ? Math.random() * 500 : 0 // 30% chance of extra pause
    
    return Math.floor(baseDelay + randomFactor + humanVariation)
  }

  /**
   * Get stealth page setup function
   */
  getStealthSetup(): string {
    return `
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override the languages property to match Accept-Language header
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override the plugins property to remove headless indicators
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override the permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Remove headless indicators from window.chrome
      if (window.chrome) {
        Object.defineProperty(window.chrome, 'runtime', {
          get: () => ({
            onConnect: undefined,
            onMessage: undefined,
            PlatformOs: {
              MAC: 'mac',
              WIN: 'win',
              ANDROID: 'android',
              CROS: 'cros',
              LINUX: 'linux',
              OPENBSD: 'openbsd',
            },
            PlatformArch: {
              ARM: 'arm',
              X86_32: 'x86-32',
              X86_64: 'x86-64',
            },
            PlatformNaclArch: {
              ARM: 'arm',
              X86_32: 'x86-32',
              X86_64: 'x86-64',
            },
            RequestUpdateCheckStatus: {
              THROTTLED: 'throttled',
              NO_UPDATE: 'no_update',
              UPDATE_AVAILABLE: 'update_available',
            },
          }),
        });
      }

      // Override console.debug to prevent detection
      const originalConsoleDebug = console.debug;
      console.debug = function(...args) {
        if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('DevTools')) {
          return;
        }
        return originalConsoleDebug.apply(this, args);
      };
    `
  }
}
