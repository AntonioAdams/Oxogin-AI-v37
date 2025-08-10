import type { CaptureOptions } from "../contracts/capture"
import { logger } from "../utils/logger"
import { CaptureError } from "../errors/application-error"
import { ERROR_CODE_REGISTRY } from "../errors/error-codes"
import { handleError } from "../errors/error-handler"

export class BrowserlessClient {
  private apiKey: string
  private baseUrl: string
  private moduleLogger = logger.module("browserless-client")

  constructor(apiKey?: string) {
    const context = {
      file: "lib/capture/browserless.ts",
      function: "constructor",
    }

    this.apiKey = apiKey || process.env.BROWSERLESS_API_KEY || ""
    this.baseUrl = "https://production-sfo.browserless.io"

    if (!this.apiKey) {
      throw new CaptureError(
        ERROR_CODE_REGISTRY.CAPTURE_BROWSERLESS.ERRORS.API_KEY_MISSING,
        "Browserless API key is required",
        context,
      )
    }
  }

  private createBrowserFunction(options: CaptureOptions): string {
    const { url, timeout = 25000, width = 1920, height = 1080, foldLinePosition = 1000, isMobile = false } = options

    // Escape the URL properly to prevent injection issues
    const escapedUrl = url.replace(/"/g, '\\"').replace(/'/g, "\\'")

    // Mobile-specific settings
    const mobileWidth = 375
    const mobileHeight = 812
    const mobileFoldLine = 600
    const mobileUserAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

    const finalWidth = isMobile ? mobileWidth : width
    const finalHeight = isMobile ? mobileHeight : height
    const finalFoldLine = isMobile ? mobileFoldLine : foldLinePosition
    const userAgent = isMobile
      ? mobileUserAgent
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    return `
export default async function ({ page, context }) {
  try {
    const targetUrl = "${escapedUrl}";
    const timeout = ${timeout};
    const width = ${finalWidth};
    const height = ${finalHeight};
    const foldLinePosition = ${finalFoldLine};
    const isMobile = ${isMobile};
    
    console.log('Starting browser function for:', targetUrl, 'Mobile:', isMobile);
    
    // Set shorter timeout to prevent target closure
    page.setDefaultTimeout(timeout);
    await page.setViewport({ 
      width, 
      height,
      isMobile: isMobile,
      hasTouch: isMobile,
      deviceScaleFactor: isMobile ? 2 : 1
    });
    
    // Set appropriate user agent
    await page.setUserAgent('${userAgent}');
    
    console.log('Navigating to URL...');
    
    // Navigation with more conservative settings
    await page.goto(targetUrl, { 
      waitUntil: "domcontentloaded",
      timeout: Math.min(timeout, 20000) // Cap navigation timeout
    });
    
    console.log('Page loaded, waiting for content...');
    
    // Shorter wait for load state
    try {
      await page.waitForLoadState("load", { timeout: 10000 });
    } catch (e) {
      console.log("Load timeout, continuing with DOM extraction");
    }
    
    // Shorter buffer for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Starting DOM extraction...');
    
    // Enhanced DOM data extraction with better button detection + NON-INTERACTIVE ELEMENTS
    const domData = await page.evaluate((foldPosition) => {
      try {
        console.log('DOM evaluation started');
        
        const title = document.title || '';
        const metaDescription = document.querySelector('meta[name="description"]');
        const description = metaDescription ? metaDescription.getAttribute('content') || '' : '';
        
        // ENHANCED button extraction with broader selectors (EXISTING)
        let buttons = [];
        try {
          // Expanded selectors to catch more button-like elements
          const buttonSelectors = [
            'button',
            'input[type="submit"]', 
            'input[type="button"]',
            'a[role="button"]',
            '*[class*="btn"]',
            '*[class*="button"]',
            '*[class*="cta"]',
            '*[class*="call-to-action"]'
          ];
          
          const allButtonElements = new Set();
          
          // Collect all potential button elements
          buttonSelectors.forEach(selector => {
            try {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => allButtonElements.add(el));
            } catch (selectorError) {
              console.log('Selector error for:', selector, selectorError);
            }
          });
          
          console.log('Found potential button elements:', allButtonElements.size);
          
          buttons = Array.from(allButtonElements).slice(0, 100).map((button, index) => {
            try {
              const rect = button.getBoundingClientRect();
              const elementTop = rect.top + window.scrollY; // Use scroll-adjusted position
              const isAboveFold = elementTop >= 0 && elementTop < foldPosition;
              
              // Get text content more aggressively
              let text = '';
              if (button.textContent) {
                text = button.textContent.trim();
              } else if (button.value) {
                text = button.value.trim();
              } else if (button.innerText) {
                text = button.innerText.trim();
              } else if (button.getAttribute('aria-label')) {
                text = button.getAttribute('aria-label').trim();
              }
              
              // Skip if no meaningful text
              if (!text || text.length < 2) {
                return null;
              }
              
              const result = {
                text: text,
                type: button.tagName.toLowerCase() === 'button' ? (button.type || 'button') : 'link',
                className: button.className || '',
                id: button.id || '',
                isVisible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(button).visibility !== 'hidden',
                isAboveFold: isAboveFold,
                formAction: button.form ? (button.form.action || 'current page') : null,
                distanceFromTop: elementTop,
                coordinates: {
                  x: Math.round(rect.left),
                  y: Math.round(elementTop), // Use scroll-adjusted position
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                }
              };
              
              console.log(\`Button \${index}: "\${text}" - Above fold: \${isAboveFold} - Coords: \${rect.left},\${elementTop} - Size: \${rect.width}x\${rect.height}\`);
              
              return result;
            } catch (btnError) {
              console.log('Error processing button:', btnError);
              return null;
            }
          }).filter(button => button && button.isVisible && button.text && button.text.length > 1);
          
          console.log('Processed buttons:', buttons.length);
        } catch (buttonError) {
          console.log('Error extracting buttons:', buttonError);
        }
        
        // ENHANCED link extraction with better filtering (EXISTING)
        let links = [];
        try {
          const linkElements = document.querySelectorAll('a[href]');
          console.log('Found link elements:', linkElements.length);
          
          links = Array.from(linkElements).slice(0, 100).map((link, index) => {
            try {
              const rect = link.getBoundingClientRect();
              const elementTop = rect.top + window.scrollY; // Use scroll-adjusted position
              const isAboveFold = elementTop >= 0 && elementTop < foldPosition;
              const text = (link.textContent || '').trim();
              
              // Skip if no meaningful text or invalid href
              if (!text || text.length < 2 || !link.href || link.href === '#' || link.href === 'javascript:void(0)') {
                return null;
              }
              
              // Skip if not visible
              if (rect.width <= 0 || rect.height <= 0 || window.getComputedStyle(link).visibility === 'hidden') {
                return null;
              }
              
              const result = {
                text: text,
                href: link.href,
                className: link.className || '',
                id: link.id || '',
                isVisible: true,
                isAboveFold: isAboveFold,
                hasButtonStyling: (link.className || '').toLowerCase().includes('btn') || 
                                 (link.className || '').toLowerCase().includes('button') ||
                                 (link.className || '').toLowerCase().includes('cta'),
                distanceFromTop: elementTop,
                coordinates: {
                  x: Math.round(rect.left),
                  y: Math.round(elementTop), // Use scroll-adjusted position
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                }
              };
              
              console.log(\`Link \${index}: "\${text}" - Above fold: \${isAboveFold} - Button styling: \${result.hasButtonStyling}\`);
              
              return result;
            } catch (linkError) {
              console.log('Error processing link:', linkError);
              return null;
            }
          }).filter(link => link);
          
          console.log('Processed links:', links.length);
        } catch (linkError) {
          console.log('Error extracting links:', linkError);
        }
        
        // Enhanced form extraction (EXISTING - keep existing logic but improve)
        let forms = [];
        try {
          const formElements = document.querySelectorAll('form');
          console.log('Found form elements:', formElements.length);
          
          forms = Array.from(formElements).slice(0, 20).map(form => {
            try {
              const formRect = form.getBoundingClientRect();
              const formTop = formRect.top + window.scrollY; // Use scroll-adjusted position
              const isAboveFold = formTop >= 0 && formTop < foldPosition;
              
              const inputElements = form.querySelectorAll('input, textarea, select');
              
              // Enhanced submit button detection
              const submitSelectors = [
                'input[type="submit"]',
                'button[type="submit"]', 
                'button:not([type])',
                '*[class*="submit"]',
                '*[class*="Submit"]',
                '*[id*="submit"]',
                '*[id*="Submit"]'
              ];
              
              let submitButton = null;
              for (const selector of submitSelectors) {
                submitButton = form.querySelector(selector);
                if (submitButton) break;
              }
              
              const inputTypes = Array.from(inputElements).map(input => {
                if (input.tagName.toLowerCase() === 'input') {
                  return input.type || 'text';
                } else if (input.tagName.toLowerCase() === 'textarea') {
                  return 'textarea';
                } else if (input.tagName.toLowerCase() === 'select') {
                  return 'select';
                }
                return 'unknown';
              });
              
              return {
                action: form.action || '',
                method: form.method || 'get',
                inputs: inputElements.length,
                inputTypes: inputTypes,
                hasSubmitButton: !!submitButton,
                submitButtonText: submitButton ? (submitButton.textContent?.trim() || submitButton.value || '') : '',
                isAboveFold: isAboveFold,
                distanceFromTop: formTop,
                coordinates: {
                  x: Math.round(formRect.left),
                  y: Math.round(formTop), // Use scroll-adjusted position
                  width: Math.round(formRect.width),
                  height: Math.round(formRect.height)
                }
              };
            } catch (formError) {
              console.log('Error processing form:', formError);
              return null;
            }
          }).filter(form => form);
        } catch (formError) {
          console.log('Error extracting forms:', formError);
        }
        
        // Enhanced form field extraction (EXISTING)
        let formFields = [];
        try {
          const fieldElements = document.querySelectorAll('input, textarea, select');
          console.log('Found form field elements:', fieldElements.length);
          
          formFields = Array.from(fieldElements).slice(0, 200).map((field, index) => {
            try {
              const rect = field.getBoundingClientRect();
              const elementTop = rect.top + window.scrollY;
              
              // Skip if not visible
              if (rect.width <= 0 || rect.height <= 0 || window.getComputedStyle(field).visibility === 'hidden') {
                return null;
              }
              
              const fieldType = field.tagName.toLowerCase() === 'input' ? 
                (field.type || 'text') : field.tagName.toLowerCase();
              
              return {
                type: fieldType,
                name: field.name || '',
                value: field.value || '',
                required: field.required || false,
                coordinates: {
                  x: Math.round(rect.left),
                  y: Math.round(elementTop),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                },
                attributes: {
                  id: field.id || '',
                  className: field.className || '',
                  placeholder: field.placeholder || '',
                  type: fieldType
                }
              };
            } catch (fieldError) {
              console.log('Error processing form field:', fieldError);
              return null;
            }
          }).filter(field => field);
          
          console.log('Processed form fields:', formFields.length);
        } catch (fieldError) {
          console.log('Error extracting form fields:', fieldError);
        }

        // NEW: HEADING EXTRACTION
        let headings = [];
        try {
          const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
          console.log('Found heading elements:', headingElements.length);
          
          headings = Array.from(headingElements).slice(0, 50).map((heading, index) => {
            try {
              const rect = heading.getBoundingClientRect();
              const elementTop = rect.top + window.scrollY;
              const isAboveFold = elementTop >= 0 && elementTop < foldPosition;
              const text = (heading.textContent || '').trim();
              
              // Skip if no meaningful text or not visible
              if (!text || text.length < 2 || rect.width <= 0 || rect.height <= 0 || 
                  window.getComputedStyle(heading).visibility === 'hidden') {
                return null;
              }
              
              const level = parseInt(heading.tagName.charAt(1)); // Extract number from h1, h2, etc.
              
              return {
                text: text,
                level: level,
                className: heading.className || '',
                id: heading.id || '',
                isVisible: true,
                isAboveFold: isAboveFold,
                distanceFromTop: elementTop,
                coordinates: {
                  x: Math.round(rect.left),
                  y: Math.round(elementTop),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                }
              };
            } catch (headingError) {
              console.log('Error processing heading:', headingError);
              return null;
            }
          }).filter(heading => heading);
          
          console.log('Processed headings:', headings.length);
        } catch (headingError) {
          console.log('Error extracting headings:', headingError);
        }

        // NEW: TEXT BLOCK EXTRACTION
        let textBlocks = [];
        try {
          const textElements = document.querySelectorAll('p, span, div');
          console.log('Found potential text elements:', textElements.length);
          
          textBlocks = Array.from(textElements).slice(0, 100).map((element, index) => {
            try {
              const rect = element.getBoundingClientRect();
              const elementTop = rect.top + window.scrollY;
              const isAboveFold = elementTop >= 0 && elementTop < foldPosition;
              const text = (element.textContent || '').trim();
              
              // Skip if no meaningful text, not visible, or too short
              if (!text || text.length < 10 || rect.width <= 0 || rect.height <= 0 || 
                  window.getComputedStyle(element).visibility === 'hidden') {
                return null;
              }
              
              // Skip if element contains other block elements (to avoid duplicates)
              const hasBlockChildren = element.querySelector('p, div, h1, h2, h3, h4, h5, h6, ul, ol, li');
              if (hasBlockChildren && element.tagName.toLowerCase() === 'div') {
                return null;
              }
              
              const wordCount = text.split(/\\s+/).filter(word => word.length > 0).length;
              
              // Only include text blocks with substantial content
              if (wordCount < 3) {
                return null;
              }
              
              return {
                text: text.substring(0, 200), // Limit text length for performance
                tagName: element.tagName.toLowerCase(),
                className: element.className || '',
                id: element.id || '',
                isVisible: true,
                isAboveFold: isAboveFold,
                distanceFromTop: elementTop,
                coordinates: {
                  x: Math.round(rect.left),
                  y: Math.round(elementTop),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                },
                wordCount: wordCount
              };
            } catch (textError) {
              console.log('Error processing text element:', textError);
              return null;
            }
          }).filter(textBlock => textBlock);
          
          console.log('Processed text blocks:', textBlocks.length);
        } catch (textError) {
          console.log('Error extracting text blocks:', textError);
        }

        // NEW: IMAGE EXTRACTION
        let images = [];
        try {
          const imageElements = document.querySelectorAll('img');
          console.log('Found image elements:', imageElements.length);
          
          images = Array.from(imageElements).slice(0, 50).map((img, index) => {
            try {
              const rect = img.getBoundingClientRect();
              const elementTop = rect.top + window.scrollY;
              const isAboveFold = elementTop >= 0 && elementTop < foldPosition;
              
              // Skip if not visible or too small
              if (rect.width <= 10 || rect.height <= 10 || 
                  window.getComputedStyle(img).visibility === 'hidden') {
                return null;
              }
              
              return {
                src: img.src || '',
                alt: img.alt || '',
                className: img.className || '',
                id: img.id || '',
                isVisible: true,
                isAboveFold: isAboveFold,
                distanceFromTop: elementTop,
                coordinates: {
                  x: Math.round(rect.left),
                  y: Math.round(elementTop),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                },
                hasLazyLoading: img.loading === 'lazy' || img.hasAttribute('data-src')
              };
            } catch (imgError) {
              console.log('Error processing image:', imgError);
              return null;
            }
          }).filter(image => image);
          
          console.log('Processed images:', images.length);
        } catch (imageError) {
          console.log('Error extracting images:', imageError);
        }

        // NEW: VIDEO EXTRACTION
        let videos = [];
        try {
          const videoElements = document.querySelectorAll('video');
          console.log('Found video elements:', videoElements.length);
          
          videos = Array.from(videoElements).slice(0, 20).map((video, index) => {
            try {
              const rect = video.getBoundingClientRect();
              const elementTop = rect.top + window.scrollY;
              const isAboveFold = elementTop >= 0 && elementTop < foldPosition;
              
              // Skip if not visible or too small
              if (rect.width <= 10 || rect.height <= 10 || 
                  window.getComputedStyle(video).visibility === 'hidden') {
                return null;
              }
              
              return {
                src: video.src || video.currentSrc || '',
                poster: video.poster || '',
                className: video.className || '',
                id: video.id || '',
                isVisible: true,
                isAboveFold: isAboveFold,
                distanceFromTop: elementTop,
                coordinates: {
                  x: Math.round(rect.left),
                  y: Math.round(elementTop),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                },
                hasControls: video.hasAttribute('controls'),
                isAutoplay: video.hasAttribute('autoplay')
              };
            } catch (videoError) {
              console.log('Error processing video:', videoError);
              return null;
            }
          }).filter(video => video);
          
          console.log('Processed videos:', videos.length);
        } catch (videoError) {
          console.log('Error extracting videos:', videoError);
        }

        // Calculate fold line metrics with better counting (UPDATED)
        const aboveFoldButtons = buttons.filter(b => b.isAboveFold).length;
        const belowFoldButtons = buttons.filter(b => !b.isAboveFold).length;
        const aboveFoldLinks = links.filter(l => l.isAboveFold).length;
        const belowFoldLinks = links.filter(l => !l.isAboveFold).length;
        
        // NEW: Non-interactive metrics
        const aboveFoldHeadings = headings.filter(h => h.isAboveFold).length;
        const belowFoldHeadings = headings.filter(h => !h.isAboveFold).length;
        const aboveFoldImages = images.filter(i => i.isAboveFold).length;
        const belowFoldImages = images.filter(i => !i.isAboveFold).length;
        const aboveFoldVideos = videos.filter(v => v.isAboveFold).length;
        const belowFoldVideos = videos.filter(v => !v.isAboveFold).length;
        const aboveFoldTextBlocks = textBlocks.filter(t => t.isAboveFold).length;
        const belowFoldTextBlocks = textBlocks.filter(t => !t.isAboveFold).length;
        
        console.log('Final counts:', {
          totalButtons: buttons.length,
          aboveFoldButtons,
          belowFoldButtons,
          totalLinks: links.length,
          aboveFoldLinks,
          belowFoldLinks,
          totalHeadings: headings.length,
          aboveFoldHeadings,
          belowFoldHeadings,
          totalImages: images.length,
          aboveFoldImages,
          belowFoldImages,
          totalVideos: videos.length,
          aboveFoldVideos,
          belowFoldVideos,
          totalTextBlocks: textBlocks.length,
          aboveFoldTextBlocks,
          belowFoldTextBlocks
        });
        
        console.log('DOM extraction completed successfully');
        
        return {
          title,
          description,
          url: window.location.href,
          buttons: buttons || [],
          links: links || [],
          forms: forms || [],
          formFields: formFields || [],
          // NEW: Non-interactive elements
          headings: headings || [],
          textBlocks: textBlocks || [],
          images: images || [],
          videos: videos || [],
          foldLine: {
            position: foldPosition,
            aboveFoldButtons,
            belowFoldButtons,
            aboveFoldLinks,
            belowFoldLinks,
            // NEW: Non-interactive metrics
            aboveFoldHeadings,
            belowFoldHeadings,
            aboveFoldImages,
            belowFoldImages,
            aboveFoldVideos,
            belowFoldVideos,
            aboveFoldTextBlocks,
            belowFoldTextBlocks
          }
        };
      } catch (evalError) {
        console.log('Error in DOM evaluation:', evalError);
        return {
          title: document.title || '',
          description: '',
          url: window.location.href,
          buttons: [],
          links: [],
          forms: [],
          formFields: [],
          headings: [],
          textBlocks: [],
          images: [],
          videos: [],
          foldLine: {
            position: foldPosition,
            aboveFoldButtons: 0,
            belowFoldButtons: 0,
            aboveFoldLinks: 0,
            belowFoldLinks: 0,
            aboveFoldHeadings: 0,
            belowFoldHeadings: 0,
            aboveFoldImages: 0,
            belowFoldImages: 0,
            aboveFoldVideos: 0,
            belowFoldVideos: 0,
            aboveFoldTextBlocks: 0,
            belowFoldTextBlocks: 0
          }
        };
      }
    }, foldLinePosition);
    
    console.log('Taking screenshot...');
    
    // Take screenshot with error handling
    let screenshot;
    try {
      screenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
        encoding: 'base64',
        timeout: 10000 // Add timeout for screenshot
      });
    } catch (screenshotError) {
      console.log('Screenshot error, trying viewport screenshot:', screenshotError);
      // Fallback to viewport screenshot
      screenshot = await page.screenshot({
        fullPage: false,
        type: 'png',
        encoding: 'base64',
        timeout: 5000
      });
    }
    
    console.log('Browser function completed successfully');
    
    return {
      data: {
        screenshot: \`data:image/png;base64,\${screenshot}\`,
        domData: domData,
        synchronized: true,
        timestamp: new Date().toISOString(),
        isMobile: isMobile
      },
      type: "application/json"
    };
    
  } catch (error) {
    console.log('Browser function error:', error);
    return {
      data: { 
        error: error.message || 'Unknown error',
        stack: error.stack || '',
        timestamp: new Date().toISOString()
      },
      type: "application/json"
    };
  }
}
    `
  }

  async capture(options: CaptureOptions): Promise<import("../contracts/capture").CaptureResult> {
    const context = {
      file: "lib/capture/browserless.ts",
      function: "capture",
      metadata: { url: options.url, timeout: options.timeout, isMobile: options.isMobile },
    }

    const maxRetries = 2
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.moduleLogger.info(`Browserless attempt ${attempt + 1}/${maxRetries + 1}`, {
          url: options.url,
          attempt: attempt + 1,
          isMobile: options.isMobile || false,
        })

        const functionCode = this.createBrowserFunction(options)

        const response = await fetch(`${this.baseUrl}/function?token=${this.apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: functionCode,
            context: {
              url: options.url,
              timestamp: new Date().toISOString(),
              isMobile: options.isMobile || false,
            },
          }),
        })

        // Enhanced error handling for non-200 responses
        if (!response.ok) {
          let errorDetails = `HTTP ${response.status}: ${response.statusText}`

          try {
            const responseBody = await response.text()
            this.moduleLogger.error(`Browserless API error response`, undefined, {
              status: response.status,
              statusText: response.statusText,
              body: responseBody.substring(0, 1000),
              url: options.url,
            })

            // Try to parse as JSON for structured error
            try {
              const errorJson = JSON.parse(responseBody)
              if (errorJson.message) {
                errorDetails = `${errorDetails} - ${errorJson.message}`
              }
            } catch (jsonParseError) {
              if (responseBody.length > 0) {
                errorDetails = `${errorDetails} - ${responseBody.substring(0, 200)}`
              }
            }
          } catch (textError) {
            this.moduleLogger.error("Could not read error response body", textError as Error)
          }

          // Determine specific error code based on status
          let errorCode = ERROR_CODE_REGISTRY.CAPTURE_BROWSERLESS.ERRORS.CONNECTION_FAILED
          if (response.status === 429) {
            errorCode = ERROR_CODE_REGISTRY.CAPTURE_BROWSERLESS.ERRORS.RATE_LIMITED
          } else if (response.status >= 500) {
            errorCode = ERROR_CODE_REGISTRY.CAPTURE_BROWSERLESS.ERRORS.CONNECTION_FAILED
          }

          throw new CaptureError(errorCode, errorDetails, context)
        }

        let result
        try {
          result = await response.json()
        } catch (jsonError) {
          const responseText = await response.text()
          this.moduleLogger.error("Failed to parse Browserless response as JSON", jsonError as Error, {
            responseText: responseText.substring(0, 500),
            url: options.url,
          })

          throw new CaptureError(
            ERROR_CODE_REGISTRY.CAPTURE_BROWSERLESS.ERRORS.INVALID_RESPONSE,
            `Invalid JSON response from Browserless API: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
            context,
            jsonError instanceof Error ? jsonError : undefined,
          )
        }

        // Check for function execution errors
        if (result?.data?.error) {
          this.moduleLogger.error(`Browserless function execution error`, undefined, {
            error: result.data.error,
            stack: result.data.stack,
            url: options.url,
          })

          throw new CaptureError(
            ERROR_CODE_REGISTRY.CAPTURE_BROWSERLESS.ERRORS.FUNCTION_EXECUTION_ERROR,
            `Function execution error: ${result.data.error}`,
            context,
          )
        }

        // Validate successful response structure
        if (result?.data?.screenshot && result?.data?.domData) {
          this.moduleLogger.info("Browserless capture successful", {
            screenshotLength: result.data.screenshot.length,
            buttonsFound: result.data.domData.buttons?.length || 0,
            linksFound: result.data.domData.links?.length || 0,
            formsFound: result.data.domData.forms?.length || 0,
            // NEW: Log non-interactive elements
            headingsFound: result.data.domData.headings?.length || 0,
            textBlocksFound: result.data.domData.textBlocks?.length || 0,
            imagesFound: result.data.domData.images?.length || 0,
            videosFound: result.data.domData.videos?.length || 0,
            url: options.url,
            isMobile: result.data.isMobile || false,
          })

          return {
            screenshot: result.data.screenshot,
            domData: result.data.domData,
            synchronized: result.data.synchronized || true,
            timestamp: result.data.timestamp || new Date().toISOString(),
            isMobile: result.data.isMobile || false,
          }
        }

        // Log invalid response structure
        this.moduleLogger.error("Invalid response structure from Browserless", undefined, {
          hasData: !!result?.data,
          hasScreenshot: !!result?.data?.screenshot,
          hasDomData: !!result?.data?.domData,
          responseKeys: result ? Object.keys(result) : [],
          dataKeys: result?.data ? Object.keys(result.data) : [],
          url: options.url,
        })

        throw new CaptureError(
          ERROR_CODE_REGISTRY.CAPTURE_BROWSERLESS.ERRORS.INVALID_RESPONSE,
          "Invalid response structure from Browserless - missing screenshot or domData",
          context,
        )
      } catch (error) {
        lastError = error as Error

        // If it's already a CaptureError, don't wrap it again
        if (error instanceof CaptureError) {
          if (attempt === maxRetries) {
            throw error
          }
        } else {
          this.moduleLogger.error(`Browserless attempt ${attempt + 1} failed`, error as Error, {
            url: options.url,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
          })
        }

        if (attempt === maxRetries) {
          break
        }

        // Exponential backoff
        const delay = Math.min(Math.pow(2, attempt) * 1000, 5000)
        this.moduleLogger.info(`Retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // All retries exhausted
    const finalError = new CaptureError(
      ERROR_CODE_REGISTRY.CAPTURE_BROWSERLESS.ERRORS.RETRY_EXHAUSTED,
      `All retry attempts exhausted. Last error: ${lastError!.message}`,
      context,
      lastError!,
    )

    handleError(finalError)
    throw finalError
  }
}
