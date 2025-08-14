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
    const { url, timeout = 15000, width = 1920, height = 1080, foldLinePosition = 1000, isMobile = false } = options

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
    
    // 0) PRELOAD INSTRUMENTATION - Patch navigation methods before site JS runs
    await page.evaluateOnNewDocument(() => {
      // Initialize navigation log
      window.__ox_navLog = [];
      window.__ox_clickHandlers = new Map();
      
      // Generate unique IDs for elements
      let oxIdCounter = 0;
      window.__generateOxId = () => 'ox_' + (++oxIdCounter);
      
      // Patch history methods
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(state, title, url) {
        window.__ox_navLog.push({
          timestamp: Date.now(),
          url: url,
          type: 'pushState',
          sourceOxId: window.__currentProbeOxId || null
        });
        return originalPushState.call(this, state, title, url);
      };
      
      history.replaceState = function(state, title, url) {
        window.__ox_navLog.push({
          timestamp: Date.now(),
          url: url,
          type: 'replaceState',
          sourceOxId: window.__currentProbeOxId || null
        });
        return originalReplaceState.call(this, state, title, url);
      };
      
      // Patch location methods
      const originalLocationAssign = location.assign;
      const originalLocationReplace = location.replace;
      
      location.assign = function(url) {
        window.__ox_navLog.push({
          timestamp: Date.now(),
          url: url,
          type: 'location.assign',
          sourceOxId: window.__currentProbeOxId || null
        });
        return originalLocationAssign.call(this, url);
      };
      
      location.replace = function(url) {
        window.__ox_navLog.push({
          timestamp: Date.now(),
          url: url,
          type: 'location.replace',
          sourceOxId: window.__currentProbeOxId || null
        });
        return originalLocationReplace.call(this, url);
      };
      
      // Patch window.open
      const originalWindowOpen = window.open;
      window.open = function(url, target, features) {
        window.__ox_navLog.push({
          timestamp: Date.now(),
          url: url,
          type: 'window.open',
          target: target,
          sourceOxId: window.__currentProbeOxId || null
        });
        return originalWindowOpen.call(this, url, target, features);
      };
      
      // Patch anchor click
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        window.__ox_navLog.push({
          timestamp: Date.now(),
          url: this.href,
          type: 'anchor.click',
          sourceOxId: this.__oxId || window.__currentProbeOxId || null
        });
        return originalAnchorClick.call(this);
      };
      
      // Patch addEventListener to track click handlers
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click' && this.nodeType === 1) {
          const handlers = window.__ox_clickHandlers.get(this) || [];
          handlers.push({ listener, options, timestamp: Date.now() });
          window.__ox_clickHandlers.set(this, handlers);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      console.log('ATF navigation instrumentation loaded');
    });
    
    // Set optimized timeout to prevent target closure
    page.setDefaultTimeout(Math.min(timeout, 12000));
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
    
    // Navigation with optimized settings
    await page.goto(targetUrl, { 
      waitUntil: "domcontentloaded",
      timeout: Math.min(timeout, 12000) // Optimized navigation timeout
    });
    
    console.log('Page loaded, waiting for content...');
    
    // Optimized wait for load state
    try {
      await page.waitForLoadState("load", { timeout: 5000 });
    } catch (e) {
      console.log("Load timeout, continuing with DOM extraction");
    }
    
    // Minimal buffer for dynamic content
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('Starting DOM extraction...');
    
    // Enhanced DOM data extraction with ATF premium URL extraction
    const domData = await page.evaluate((foldPosition) => {
      console.log('DOM evaluation started');
      
      // 2) ATF VISIBILITY DETECTION - Define fold and visibility helpers
      const viewportH = window.innerHeight;
      const foldY = Math.min(foldPosition, viewportH + 100);
      
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        if (r.width <= 1 || r.height <= 1) return false;
        
        // Check if center point is clickable
        const cx = Math.floor(r.left + r.width/2);
        const cy = Math.floor(r.top + r.height/2);
        const topEl = document.elementFromPoint(cx, cy);
        return topEl && (el === topEl || el.contains(topEl) || topEl.contains(el));
      };
      
      const isATF = (el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const sticky = ['fixed', 'sticky'].includes(style.position);
        
        // ATF-FIRST: Pure position + visibility detection (no keyword filtering)
        const elementTop = r.top + window.scrollY;
        const isAboveFoldBasic = elementTop >= 0 && elementTop < foldY;
        
        // ATF criteria: Above fold + visible (no content bias)
        if (isAboveFoldBasic || (sticky && r.top < 140)) {
          // Basic visibility check - just ensure it's not hidden and has some size
          if (style.visibility === 'hidden' || style.display === 'none') return false;
          if (r.width <= 1 || r.height <= 1) return false;
          
          // Simple visibility test for all ATF elements
          return isVisible(el);
        }
        
        return false;
      };
      
      // 3A) STATIC URL EXTRACTION HELPERS
      const extractUrl = (el) => {
        const results = [];
        
        // Priority 1: Self/ancestor/descendant <a[href]>
        if (el.tagName.toLowerCase() === 'a' && el.href && el.href !== '#' && !el.href.startsWith('javascript:')) {
          results.push({ url: el.href, source: 'href', confidence: 'high' });
        }
        
        // Check ancestors for links
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
          if (parent.tagName.toLowerCase() === 'a' && parent.href && parent.href !== '#' && !parent.href.startsWith('javascript:')) {
            results.push({ url: parent.href, source: 'ancestor_href', confidence: 'high' });
            break;
          }
          parent = parent.parentElement;
        }
        
        // Check descendants for links
        const descendantLink = el.querySelector('a[href]:not([href="#"]):not([href^="javascript:"])');
        if (descendantLink) {
          results.push({ url: descendantLink.href, source: 'descendant_href', confidence: 'medium' });
        }
        
        // Priority 2: Data attributes
        const dataAttrs = ['data-href', 'data-url', 'data-destination', 'data-link', 'data-cta', 'data-track-link'];
        for (const attr of dataAttrs) {
          const value = el.getAttribute(attr);
          if (value && value !== '#' && !value.startsWith('javascript:')) {
            results.push({ url: value, source: attr, confidence: 'medium' });
          }
        }
        
        // Priority 3: Enhanced onclick parsing with better patterns
        const onclick = el.getAttribute('onclick');
        if (onclick) {
          const patterns = [
            { regex: /location\\.href\\s*=\\s*['"]([^'"]+)['"]/, source: 'location.href' },
            { regex: /window\\.open\\s*\\(\\s*['"]([^'"]+)['"]/, source: 'window.open' },
            { regex: /navigate\\s*\\(\\s*['"]([^'"]+)['"]/, source: 'navigate' },
            { regex: /router\\.push\\s*\\(\\s*['"]([^'"]+)['"]/, source: 'router.push' },
            { regex: /Link\\s*\\(\\s*\\{\\s*href:\\s*['"]([^'"]+)['"]/, source: 'Link.href' },
            { regex: /window\\.location\\s*=\\s*['"]([^'"]+)['"]/, source: 'window.location' },
            { regex: /href\\s*=\\s*['"]([^'"]+)['"]/, source: 'href.assignment' }
          ];
          
          for (const pattern of patterns) {
            const match = pattern.regex.exec(onclick);
            if (match && match[1]) {
              results.push({ url: match[1], source: 'onclick_' + pattern.source, confidence: 'medium' });
            }
          }
        }
        
        return results;
      };
      
      const inferFormUrl = (form, submitBtn) => {
        // Use button[formaction] if present
        if (submitBtn && submitBtn.getAttribute('formaction')) {
          return {
            url: submitBtn.getAttribute('formaction'),
            source: 'formaction',
            confidence: 'high',
            method: submitBtn.getAttribute('formmethod') || form.method || 'GET'
          };
        }
        
        // Use form[action]
        if (form.action && form.action !== location.href) {
          return {
            url: form.action,
            source: 'form_action',
            confidence: 'high',
            method: form.method || 'GET'
          };
        }
        
        // Default to current URL (HTML spec)
        return {
          url: location.href,
          source: 'default_current',
          confidence: 'low',
          method: form.method || 'GET'
        };
      };
      
      // ATF element tracking
      const atfElements = new Set();
      const atfEnhancedData = new Map();
      
      console.log('ATF visibility helpers initialized');
      try {
        console.log('DOM evaluation started');
        
        const title = document.title || '';
        const metaDescription = document.querySelector('meta[name="description"]');
        const description = metaDescription ? metaDescription.getAttribute('content') || '' : '';
        
        // ENHANCED button extraction with broader selectors (EXISTING)
        let buttons = [];
        try {
          // EXPANDED selectors for comprehensive interactive element detection
          const buttonSelectors = [
            // Original button selectors
            'button',
            'input[type="submit"]', 
            'input[type="button"]',
            'a[role="button"]',
            '*[class*="btn"]',
            '*[class*="button"]',
            '*[class*="cta"]',
            '*[class*="call-to-action"]',
            
            // NEW: Interactive elements we were missing
            '[role="button"]',                    // ARIA buttons
            '[tabindex]:not([tabindex="-1"])',    // Focusable elements
            '[onclick]',                          // Click handlers
            '[data-toggle]',                      // Modal/dropdown triggers
            '[data-href]', '[data-url]',          // Data-driven navigation
            '*[class*="modal"]', '*[class*="popup"]', // Modal containers
            '*[class*="overlay"]', '[role="dialog"]'  // Dialog elements
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
              
              // Generate unique ID for this element
              const oxId = window.__generateOxId();
              button.__oxId = oxId;
              
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
              
              // Check if this is an ATF element
              const isATFElement = isATF(button);
              if (isATFElement) {
                atfElements.add(button);
              }
              
              // ATF PREMIUM URL EXTRACTION for buttons
              let atfUrlData = null;
              if (isATFElement) {
                const urlExtractions = extractUrl(button);
                const clickHandlers = window.__ox_clickHandlers.get(button) || [];
                
                atfUrlData = {
                  urlExtractions: urlExtractions,
                  hasClickHandlers: clickHandlers.length > 0,
                  clickHandlerCount: clickHandlers.length,
                  destStatus: urlExtractions.length > 0 ? 'extracted' : 'none'
                };
                
                atfEnhancedData.set(oxId, atfUrlData);
              }
              
              // Extract enhanced navigation clues for ALL buttons (not just ATF)
              let enhancedNavigation = null
              try {
                const onclick = button.getAttribute('onclick')
                const dataHref = button.getAttribute('data-href') || button.getAttribute('data-url') || button.getAttribute('data-destination')
                const dataAction = button.getAttribute('data-action')
                
                // Check parent for wrapping link
                let parentHref = null;
                let parent = button.parentElement;
                while (parent && parent !== document.body) {
                  if (parent.tagName.toLowerCase() === 'a' && parent.href) {
                    parentHref = parent.href;
                    break;
                  }
                  parent = parent.parentElement;
                }
                
                if (onclick || dataHref || dataAction || parentHref) {
                  enhancedNavigation = {
                    onclick: onclick,
                    dataHref: dataHref,
                    dataAction: dataAction,
                    parentHref: parentHref,
                    hasNavClues: true
                  }
                }
              } catch (jsError) {
                console.log('Error extracting navigation clues:', jsError)
              }

              const result = {
                oxId: oxId,
                text: text,
                type: button.tagName.toLowerCase() === 'button' ? (button.type || 'button') : 'link',
                className: button.className || '',
                id: button.id || '',
                isVisible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(button).visibility !== 'hidden',
                isAboveFold: isAboveFold,
                isATF: isATFElement,
                formAction: button.form ? (button.form.action || 'current page') : null,
                enhancedNavigation: enhancedNavigation, // Enhanced navigation clues
                atfUrlData: atfUrlData, // ATF premium URL data
                distanceFromTop: elementTop,
                coordinates: {
                  x: Math.round(rect.left),
                  y: Math.round(elementTop), // Use scroll-adjusted position
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                }
              };
              
              console.log(\`Button \${index}: "\${text}" - Above fold: \${isAboveFold} - ATF: \${isATFElement} - Enhanced: \${!!enhancedNavigation} - Coords: \${rect.left},\${elementTop} - Size: \${rect.width}x\${rect.height}\`);
              
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
          // EXPANDED link selectors for comprehensive navigation detection
          const linkSelectors = [
            'a[href]:not([href="#"]):not([href^="javascript:"])',  // Real links only
            'a[data-href]', 'a[data-url]',                         // Data-driven links
            '*[class*="link"]'                                     // Link-styled elements
          ];
          
          const allLinkElements = new Set();
          linkSelectors.forEach(selector => {
            try {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => allLinkElements.add(el));
            } catch (selectorError) {
              console.log('Link selector error for:', selector, selectorError);
            }
          });
          
          const linkElements = Array.from(allLinkElements);
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
              
              // Generate unique ID for this element
              const oxId = window.__generateOxId();
              link.__oxId = oxId;
              
              // Check if this is an ATF element
              const isATFElement = isATF(link);
              if (isATFElement) {
                atfElements.add(link);
              }
              
              // ATF PREMIUM URL EXTRACTION for links
              let atfUrlData = null;
              if (isATFElement) {
                const urlExtractions = extractUrl(link);
                const clickHandlers = window.__ox_clickHandlers.get(link) || [];
                
                atfUrlData = {
                  urlExtractions: urlExtractions,
                  hasClickHandlers: clickHandlers.length > 0,
                  clickHandlerCount: clickHandlers.length,
                  destStatus: urlExtractions.length > 0 ? 'extracted' : 'none'
                };
                
                atfEnhancedData.set(oxId, atfUrlData);
              }

              const result = {
                oxId: oxId,
                text: text,
                href: link.href,
                className: link.className || '',
                id: link.id || '',
                isVisible: true,
                isAboveFold: isAboveFold,
                isATF: isATFElement,
                hasButtonStyling: (link.className || '').toLowerCase().includes('btn') || 
                                 (link.className || '').toLowerCase().includes('button') ||
                                 (link.className || '').toLowerCase().includes('cta'),
                atfUrlData: atfUrlData, // ATF premium URL data
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
        
        // DEDUPLICATION: Remove duplicate buttons and links with similar text and coordinates (90% overlap)
        try {
          console.log('Starting deduplication process...');
          console.log('Before deduplication - Buttons:', buttons.length, 'Links:', links.length);
          
          const allClickableElements = [
            ...buttons.map(btn => ({ ...btn, sourceType: 'button' })),
            ...links.map(link => ({ ...link, sourceType: 'link' }))
          ];
          
          const deduplicated = [];
          const processed = new Set();
          
          for (let i = 0; i < allClickableElements.length; i++) {
            if (processed.has(i)) continue;
            
            const current = allClickableElements[i];
            let shouldKeep = current;
            
            // Look for duplicates
            for (let j = i + 1; j < allClickableElements.length; j++) {
              if (processed.has(j)) continue;
              
              const candidate = allClickableElements[j];
              
              // Check text similarity (exact match or very similar)
              const textSimilarity = current.text === candidate.text || 
                                   (current.text.length > 0 && candidate.text.length > 0 && 
                                    (current.text.includes(candidate.text) || candidate.text.includes(current.text)));
              
              if (textSimilarity) {
                // Check coordinate overlap (90% threshold)
                const currentCoords = current.coordinates;
                const candidateCoords = candidate.coordinates;
                
                const overlapX = Math.max(0, Math.min(currentCoords.x + currentCoords.width, candidateCoords.x + candidateCoords.width) - 
                                       Math.max(currentCoords.x, candidateCoords.x));
                const overlapY = Math.max(0, Math.min(currentCoords.y + currentCoords.height, candidateCoords.y + candidateCoords.height) - 
                                       Math.max(currentCoords.y, candidateCoords.y));
                const overlapArea = overlapX * overlapY;
                
                const currentArea = currentCoords.width * currentCoords.height;
                const candidateArea = candidateCoords.width * candidateCoords.height;
                const minArea = Math.min(currentArea, candidateArea);
                
                const overlapPercentage = minArea > 0 ? overlapArea / minArea : 0;
                
                if (overlapPercentage >= 0.9) {
                  console.log(\`Found duplicate: "\${current.text}" (\${current.sourceType}) vs "\${candidate.text}" (\${candidate.sourceType}) - \${(overlapPercentage * 100).toFixed(1)}% overlap\`);
                  
                  // Priority logic: prefer links with href over buttons, prefer elements with more attributes
                  if (candidate.sourceType === 'link' && candidate.href && current.sourceType === 'button') {
                    shouldKeep = candidate;
                  } else if (current.sourceType === 'link' && current.href && candidate.sourceType === 'button') {
                    // Keep current (already preferred)
                  } else {
                    // Keep the one with more/better attributes
                    const currentScore = (current.id ? 1 : 0) + (current.className ? 1 : 0) + (current.href ? 2 : 0);
                    const candidateScore = (candidate.id ? 1 : 0) + (candidate.className ? 1 : 0) + (candidate.href ? 2 : 0);
                    
                    if (candidateScore > currentScore) {
                      shouldKeep = candidate;
                    }
                  }
                  
                  processed.add(j); // Mark candidate as processed
                }
              }
            }
            
            deduplicated.push(shouldKeep);
            processed.add(i);
          }
          
          // Separate back into buttons and links
          buttons = deduplicated.filter(el => el.sourceType === 'button').map(el => {
            const { sourceType, ...rest } = el;
            return rest;
          });
          
          links = deduplicated.filter(el => el.sourceType === 'link').map(el => {
            const { sourceType, ...rest } = el;
            return rest;
          });
          
          console.log('After deduplication - Buttons:', buttons.length, 'Links:', links.length);
          console.log('Removed', allClickableElements.length - deduplicated.length, 'duplicate elements');
          
        } catch (dedupError) {
          console.log('Error during deduplication:', dedupError);
          // Continue with original arrays if deduplication fails
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
        
        // 3B) ATF HYDRATION WATCHER - Monitor for href changes after hydration
        const hydrationUpdates = [];
        
        if (atfElements.size > 0) {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'attributes' && 
                  ['href', 'data-href', 'data-url', 'data-destination', 'data-link', 'data-cta'].includes(mutation.attributeName)) {
                
                const element = mutation.target;
                if (atfElements.has(element)) {
                  const oxId = element.__oxId;
                  const newUrlExtractions = extractUrl(element);
                  
                  hydrationUpdates.push({
                    oxId: oxId,
                    attributeName: mutation.attributeName,
                    newValue: element.getAttribute(mutation.attributeName),
                    urlInferences: newUrlInferences,
                    timestamp: Date.now()
                  });
                  
                  // Update the ATF data
                  const existingData = atfEnhancedData.get(oxId) || {};
                  existingData.urlInferences = newUrlInferences;
                  existingData.destStatus = newUrlInferences.length > 0 ? 'hydrated' : existingData.destStatus;
                  existingData.hydrationUpdate = true;
                  atfEnhancedData.set(oxId, existingData);
                  
                  console.log(\`ATF Hydration update for \${oxId}: \${mutation.attributeName} = \${element.getAttribute(mutation.attributeName)}\`);
                }
              }
            });
          });
          
          // Only observe ATF subtrees
          atfElements.forEach(element => {
            try {
              observer.observe(element, { 
                attributes: true, 
                attributeFilter: ['href', 'data-href', 'data-url', 'data-destination', 'data-link', 'data-cta'],
                subtree: true 
              });
            } catch (e) {
              console.log('Error observing element:', e);
            }
          });
          
          // Stop watching after a brief period - simplified without async
          setTimeout(() => {
            observer.disconnect();
          }, 800);
        }
        
        // 3C) MICRO-PROBE for unresolved ATF elements
        const performMicroProbe = () => {
          const probeResults = [];
          const unresolvedElements = [];
          
          // Find ATF elements that still need URL resolution
          atfElements.forEach(element => {
            const oxId = element.__oxId;
            const data = atfEnhancedData.get(oxId);
            if (!data || data.destStatus === 'none' || (data.urlInferences && data.urlInferences.length === 0)) {
              unresolvedElements.push({ element, oxId });
            }
          });
          
          console.log(\`Starting micro-probe for \${unresolvedElements.length} unresolved ATF elements\`);
          
          for (const { element, oxId } of unresolvedElements.slice(0, 10)) { // Increased limit to 10 for better coverage
            try {
              // Set current probe context
              window.__currentProbeOxId = oxId;
              
              // Clear previous navigation logs
              const logBefore = window.__ox_navLog.length;
              
              // Non-destructive probing sequence
              
              // 1. Try hover/focus events (some libs set URL on hover)
              try {
                element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }));
                if (element.focus && typeof element.focus === 'function') {
                  element.focus();
                }
              } catch (e) {
                console.log('Error in hover/focus events:', e);
              }
              
              // 2. Modifier-click to trigger nav logic without navigation
              try {
                const modifierClickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  metaKey: true, // Cmd/Ctrl key held
                  ctrlKey: true,
                  button: 0,
                  buttons: 1
                });
                
                element.dispatchEvent(modifierClickEvent);
              } catch (e) {
                console.log('Error in modifier click:', e);
              }
              
              // 3. Try other interaction events that might trigger navigation setup
              try {
                element.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
              } catch (e) {
                console.log('Error in touch/pointer events:', e);
              }
              
              // Check for navigation attempts in our log
              const newNavLogs = window.__ox_navLog.slice(logBefore);
              const elementNavLogs = newNavLogs.filter(log => log.sourceOxId === oxId);
              
              // Re-check URL inferences after probing
              const postProbeExtractions = extractUrl(element);
              
              // Check for any new attributes that might have been set
              const postProbeAttrs = {
                href: element.href || null,
                dataHref: element.getAttribute('data-href') || null,
                dataUrl: element.getAttribute('data-url') || null,
                onclick: element.getAttribute('onclick') || null
              };
              
              const probeResult = {
                oxId: oxId,
                elementText: element.textContent?.trim() || '',
                elementTag: element.tagName.toLowerCase(),
                navigationLogs: elementNavLogs,
                postProbeInferences: postProbeInferences,
                postProbeAttrs: postProbeAttrs,
                probeSuccess: elementNavLogs.length > 0 || postProbeInferences.length > 0 || 
                             (postProbeAttrs.href || postProbeAttrs.dataHref || postProbeAttrs.dataUrl)
              };
              
              probeResults.push(probeResult);
              
              // Update ATF data with probe results
              const existingData = atfEnhancedData.get(oxId) || {};
              if (elementNavLogs.length > 0) {
                existingData.destUrl = elementNavLogs[0].url;
                existingData.destSource = elementNavLogs[0].type;
                existingData.destConfidence = 'probe';
                existingData.destStatus = 'probed';
              } else if (postProbeExtractions.length > 0) {
                existingData.urlExtractions = postProbeExtractions;
                existingData.destStatus = 'post_probe_extracted';
              } else if (postProbeAttrs.href || postProbeAttrs.dataHref || postProbeAttrs.dataUrl) {
                existingData.destUrl = postProbeAttrs.href || postProbeAttrs.dataHref || postProbeAttrs.dataUrl;
                existingData.destSource = 'post_probe_attr';
                existingData.destConfidence = 'probe';
                existingData.destStatus = 'probed';
              }
              existingData.probeAttempted = true;
              existingData.probeResult = probeResult;
              atfEnhancedData.set(oxId, existingData);
              
              console.log(\`Probe result for \${oxId} (\${element.textContent?.trim()?.substring(0,20)}...): \${probeResult.probeSuccess ? 'SUCCESS' : 'NO_RESULT'}\`);
              
            } catch (probeError) {
              console.log(\`Probe error for \${oxId}:\`, probeError);
            }
          }
          
          // Clear probe context
          window.__currentProbeOxId = null;
          
          return probeResults;
        };
        
        // Execute ATF premium extraction pipeline
        console.log('Starting micro-probe for unresolved elements...');
        const probeResults = performMicroProbe();
        
        // Prepare final ATF data
        const atfSummary = {
          totalATFElements: atfElements.size,
          elementsWithUrls: Array.from(atfEnhancedData.values()).filter(data => 
            data.destStatus !== 'none' && (data.urlInferences?.length > 0 || data.destUrl)
          ).length,
          hydrationUpdates: hydrationUpdates.length,
          probeAttempts: probeResults.length,
          probeSuccesses: probeResults.filter(r => r.probeSuccess).length
        };
        
        console.log('ATF Premium extraction complete:', atfSummary);
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
          },
          // ATF PREMIUM EXTRACTION RESULTS
          atfPremium: {
            summary: atfSummary,
            enhancedData: Object.fromEntries(atfEnhancedData),
            hydrationResults: hydrationUpdates,
            probeResults: probeResults,
            navigationLog: window.__ox_navLog || []
          },
          // MODAL ANALYSIS RESULTS
          modalAnalysis: (() => {
            const currentUrl = window.location.href;
            const hasModalFragment = currentUrl.includes('#modal') || currentUrl.includes('#popup') || currentUrl.includes('#dialog');
            
            if (!hasModalFragment) {
              return {
                isModalState: false,
                modalType: 'none',
                summary: { totalModalElements: 0, formFieldsDetected: 0, deduplicatedFields: 0 }
              };
            }
            
            // MODAL STATE DETECTED
            console.log('Modal fragment detected in URL:', currentUrl);
            
            // Detect modal elements
            const modalSelectors = [
              '.modal', '[role="dialog"]', '.popup', '.overlay',
              '[class*="modal"]', '[class*="popup"]', '[class*="dialog"]',
              '[id*="modal"]', '[id*="popup"]', '[id*="dialog"]'
            ];
            
            const modalElements = [];
            modalSelectors.forEach(selector => {
              try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                    modalElements.push({
                      selector: selector,
                      id: el.id,
                      className: el.className,
                      visible: true,
                      bbox: el.getBoundingClientRect()
                    });
                  }
                });
              } catch (e) {
                console.log('Modal selector error:', selector, e);
              }
            });
            
            // FORM FIELD DEDUPLICATION for modal state
            const deduplicateFormFields = (fields) => {
              if (!fields || fields.length === 0) return [];
              
              const uniqueFields = [];
              const seenFields = new Set();
              
              for (const field of fields) {
                const name = field.name || field.attributes?.name || field.attributes?.id || "";
                const type = field.type || "text";
                
                // Round coordinates to nearest 50px to catch near-duplicates
                const roundedX = Math.round((field.coordinates?.x || 0) / 50) * 50;
                const roundedY = Math.round((field.coordinates?.y || 0) / 50) * 50;
                
                // Create unique identifier
                const uniqueKey = \`\${name}-\${type}-\${roundedX}-\${roundedY}\`;
                const nameKey = \`\${name}-\${type}\`;
                
                if (!seenFields.has(uniqueKey) && !seenFields.has(nameKey)) {
                  uniqueFields.push(field);
                  seenFields.add(uniqueKey);
                  seenFields.add(nameKey);
                }
              }
              
              return uniqueFields;
            };
            
            // Apply deduplication to form fields
            const originalFormFields = formFields || [];
            const deduplicatedFormFields = deduplicateFormFields(originalFormFields);
            
            // Extract modal-specific form data
            const modalFormFields = deduplicatedFormFields.filter(field => {
              // Exclude search fields
              if (field.name === 'term' || field.name === 'search' || field.name === 'q') return false;
              
              // Include form fields that are likely part of modal
              return field.type !== 'hidden' && field.name !== '';
            });
            
            // Analyze form completion requirements
            const requiredFields = modalFormFields.filter(field => field.required);
            const optionalFields = modalFormFields.filter(field => !field.required);
            
            // Categorize field types
            const fieldTypes = {
              personal: modalFormFields.filter(f => ['firstname', 'lastname', 'name', 'email', 'phone'].includes(f.name)),
              business: modalFormFields.filter(f => ['company', 'organization', 'title', 'industry'].includes(f.name)),
              location: modalFormFields.filter(f => ['city', 'state', 'country', 'address', 'zip'].includes(f.name)),
              intent: modalFormFields.filter(f => f.name.includes('timeline') || f.name.includes('budget') || f.name.includes('application')),
              other: modalFormFields.filter(f => !['firstname', 'lastname', 'name', 'email', 'phone', 'company', 'organization', 'title', 'industry', 'city', 'state', 'country', 'address', 'zip'].includes(f.name) && !f.name.includes('timeline') && !f.name.includes('budget') && !f.name.includes('application'))
            };
            
            return {
              isModalState: true,
              modalType: 'form_modal',
              fragmentUrl: currentUrl,
              modalElements: modalElements,
              formAnalysis: {
                originalFieldCount: originalFormFields.length,
                deduplicatedFieldCount: deduplicatedFormFields.length,
                modalFormFields: modalFormFields.length,
                requiredFields: requiredFields.length,
                optionalFields: optionalFields.length,
                duplicatesRemoved: originalFormFields.length - deduplicatedFormFields.length,
                fieldCategories: {
                  personal: fieldTypes.personal.length,
                  business: fieldTypes.business.length,
                  location: fieldTypes.location.length,
                  intent: fieldTypes.intent.length,
                  other: fieldTypes.other.length
                },
                fields: modalFormFields.map(field => ({
                  name: field.name,
                  type: field.type,
                  required: field.required,
                  category: fieldTypes.personal.includes(field) ? 'personal' :
                           fieldTypes.business.includes(field) ? 'business' :
                           fieldTypes.location.includes(field) ? 'location' :
                           fieldTypes.intent.includes(field) ? 'intent' : 'other'
                }))
              },
              summary: {
                totalModalElements: modalElements.length,
                formFieldsDetected: originalFormFields.length,
                deduplicatedFields: deduplicatedFormFields.length,
                modalFormFields: modalFormFields.length,
                conversionComplexity: requiredFields.length > 5 ? 'high' : requiredFields.length > 2 ? 'medium' : 'low'
              }
            };
          })()
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
