export interface BrowserlessResult {
  screenshot: string
  domData: {
    title: string
    description: string
    url: string
    buttons: Array<{
      text: string
      type: string
      className: string
      id: string
      isVisible: boolean
      isAboveFold: boolean
      formAction: string | null
      distanceFromTop: number
      coordinates: {
        x: number
        y: number
        width: number
        height: number
      }
    }>
    links: Array<{
      text: string
      href: string
      className: string
      id: string
      isVisible: boolean
      isAboveFold: boolean
      hasButtonStyling: boolean
      distanceFromTop: number
      coordinates: {
        x: number
        y: number
        width: number
        height: number
      }
    }>
    forms: Array<{
      action: string
      method: string
      inputs: number
      inputTypes: string[]
      hasSubmitButton: boolean
      submitButtonText: string
      isAboveFold: boolean
      distanceFromTop: number
      coordinates: {
        x: number
        y: number
        width: number
        height: number
      }
    }>
    foldLine: {
      position: number
      aboveFoldButtons: number
      belowFoldButtons: number
      aboveFoldLinks: number
      belowFoldLinks: number
    }
  }
  synchronized: boolean
  timestamp: string
}

export const createBrowserlessFunction = (url: string) => `
export default async function ({ page, context }) {
  try {
    const targetUrl = "${url}";
    const timeout = 30000;
    const width = 1920;
    const height = 1080;
    const foldLinePosition = 1000;
    
    // Browser setup
    page.setDefaultTimeout(timeout);
    await page.setViewport({ width, height });
    
    // Navigation with proper waiting
    await page.goto(targetUrl, { 
      waitUntil: "domcontentloaded",
      timeout: timeout 
    });
    
    // Wait for full load with fallback
    try {
      await page.waitForLoadState("load", { timeout: 15000 });
    } catch (e) {
      console.log("Load timeout, continuing anyway");
    }
    
    // Additional buffer for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // DOM data extraction with increased limits
    const domData = await page.evaluate((foldPosition) => {
      const title = document.title || '';
      const metaDescription = document.querySelector('meta[name="description"]');
      const description = metaDescription ? metaDescription.getAttribute('content') : '';
      
      // Button extraction with fold line detection - INCREASED LIMIT
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).map(button => {
        const rect = button.getBoundingClientRect();
        const elementTop = rect.top;
        const isAboveFold = elementTop >= 0 && elementTop < foldPosition;
        
        return {
          text: button.textContent?.trim() || button.value || '',
          type: button.type || 'button',
          className: button.className,
          id: button.id,
          isVisible: rect.width > 0 && rect.height > 0,
          isAboveFold: isAboveFold,
          formAction: button.form ? (button.form.action || 'current page') : null,
          distanceFromTop: elementTop,
          coordinates: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          }
        };
      }).filter(button => button.isVisible);
      
      // Link extraction - INCREASED LIMIT and better filtering
      const links = Array.from(document.querySelectorAll('a[href]')).map(link => {
        const rect = link.getBoundingClientRect();
        const elementTop = rect.top;
        const isAboveFold = elementTop >= 0 && elementTop < foldPosition;
        
        return {
          text: link.textContent?.trim() || '',
          href: link.href,
          className: link.className,
          id: link.id,
          isVisible: rect.width > 0 && rect.height > 0,
          isAboveFold: isAboveFold,
          hasButtonStyling: link.className.toLowerCase().includes('btn') || 
                           link.className.toLowerCase().includes('button') ||
                           link.style.display === 'inline-block' ||
                           link.style.padding !== '',
          distanceFromTop: elementTop,
          coordinates: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          }
        };
      }).filter(link => 
        link.href && 
        link.href !== '#' && 
        link.isVisible && 
        link.text.length > 0
      ).slice(0, 125); // Increased from 100 to 125
      
      // Form extraction - ENHANCED with flexible submit button detection
      const forms = Array.from(document.querySelectorAll('form')).map(form => {
        const formRect = form.getBoundingClientRect();
        const formTop = formRect.top;
        const isAboveFold = formTop >= 0 && formTop < foldPosition;
        
        // Get all input elements within the form
        const inputElements = form.querySelectorAll('input, textarea, select');
        
        // Enhanced submit button detection - look for multiple patterns
        const submitSelectors = [
          'input[type="submit"]',
          'button[type="submit"]', 
          'button:not([type])',
          '*[class*="submit"]',  // Any element with "submit" in class name
          '*[class*="Submit"]',  // Case variation
          '*[id*="submit"]',     // Any element with "submit" in ID
          '*[id*="Submit"]'      // Case variation
        ];
        
        let submitButton = null;
        for (const selector of submitSelectors) {
          submitButton = form.querySelector(selector);
          if (submitButton) break;
        }
        
        // Get form field details for better analysis
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
          hasSubmitButton: submitButton !== null,
          submitButtonText: submitButton ? (submitButton.textContent?.trim() || submitButton.value || '') : '',
          isAboveFold: isAboveFold,
          distanceFromTop: formTop,
          coordinates: {
            x: formRect.left,
            y: formRect.top,
            width: formRect.width,
            height: formRect.height
          }
        };
      });
      
      // Fold line metrics
      const aboveFoldButtons = buttons.filter(b => b.isAboveFold).length;
      const belowFoldButtons = buttons.filter(b => !b.isAboveFold).length;
      const aboveFoldLinks = links.filter(l => l.isAboveFold).length;
      const belowFoldLinks = links.filter(l => !l.isAboveFold).length;
      
      return {
        title,
        description,
        url: window.location.href,
        buttons,
        links,
        forms,
        foldLine: {
          position: foldPosition,
          aboveFoldButtons,
          belowFoldButtons,
          aboveFoldLinks,
          belowFoldLinks
        }
      };
    }, foldLinePosition);
    
    // Screenshot capture
    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
      encoding: 'base64'
    });
    
    return {
      data: {
        screenshot: \`data:image/png;base64,\${screenshot}\`,
        domData: domData,
        synchronized: true,
        timestamp: new Date().toISOString()
      },
      type: "application/json"
    };
    
  } catch (error) {
    return {
      data: { 
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      },
      type: "application/json"
    };
  }
}
`
