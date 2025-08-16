// DOM Token Extractor - Extracts all tokens needed for CRO recommendations
import { CaptureData, DOMTokens } from './types';

export class TokenExtractor {
  
  /**
   * Main extraction method - converts capture data to tokens
   */
  async extractTokens(captureData: CaptureData): Promise<DOMTokens> {
    const { domData } = captureData;
    
    // Initialize tokens object
    const tokens: DOMTokens = {
      count: {} as any,
      labels: {} as any,
      px: {} as any,
      contrast_ratio: {} as any,
      sec: {} as any,
      ms: {} as any,
      text: {} as any,
      rate: {} as any,
      pattern: {} as any,
      pct: {} as any,
      scale: {} as any,
      element: {} as any,
      field: {} as any,
      id: {} as any
    };

    // Extract counts and lists
    this.extractCounts(domData, tokens);
    
    // Extract labels (human-readable text)
    this.extractLabels(domData, tokens);
    
    // Extract positions and sizes
    this.extractPositionsAndSizes(domData, tokens);
    
    // Extract typography and contrast
    this.extractTypographyAndContrast(domData, tokens);
    
    // Extract behavioral data
    this.extractBehavioralData(domData, tokens);
    
    // Extract content and copy
    this.extractContentAndCopy(domData, tokens);
    
    // Extract rates and analytics (with fallbacks)
    this.extractRatesAndAnalytics(domData, tokens);

    return tokens;
  }

  /**
   * Extract counts and quantifiable metrics
   */
  private extractCounts(domData: any, tokens: DOMTokens): void {
    // Header CTA analysis
    const headerLinks = domData.links?.filter(link => 
      link.isVisible && link.distanceFromTop < 100 // Assume header is top 100px
    ) || [];
    
    tokens.count.header_unique_cta_urls = new Set(
      headerLinks.map(link => link.href)
    ).size;
    
    tokens.count.header_links = headerLinks.length;

    // Hero section analysis (first 600px typically)
    const heroElements = domData.links?.filter(link => 
      link.isVisible && link.distanceFromTop < 600
    ) || [];
    
    const heroHrefs = heroElements.map(el => el.href);
    const duplicateHrefs = heroHrefs.filter((href, index) => 
      heroHrefs.indexOf(href) !== index
    );
    tokens.count.hero_duplicate_links = duplicateHrefs.length;

    // Total clickable elements
    const clickables = [
      ...(domData.buttons || []),
      ...(domData.links || []),
      ...(domData.formFields?.filter(f => f.type === 'submit') || [])
    ].filter(el => el.isVisible);
    
    tokens.count.clickables_total = clickables.length;

    // Form analysis
    tokens.count.form_required_fields = domData.formFields?.filter(
      field => field.required || field.name?.includes('*') || field.placeholder?.includes('*')
    ).length || 0;

    // Estimate form columns (simple heuristic)
    const formFields = domData.formFields?.filter(f => f.isVisible) || [];
    const formWidth = Math.max(...formFields.map(f => f.coordinates?.x + f.coordinates?.width || 0));
    const avgFieldWidth = formFields.length > 0 
      ? formFields.reduce((sum, f) => sum + (f.coordinates?.width || 200), 0) / formFields.length
      : 200;
    tokens.count.form_columns = formWidth > avgFieldWidth * 1.8 ? 2 : 1;

    // Form steps (heuristic based on field groups)
    tokens.count.form_steps = domData.forms?.length || 1;

    // Dropdown fields
    const dropdownFields = domData.formFields?.filter(
      field => field.type === 'select' || field.type === 'dropdown'
    ) || [];
    tokens.count.dropdown_fields = dropdownFields.length;

    // Confirm fields (email confirmation, password confirmation, etc.)
    tokens.count.confirm_fields = domData.formFields?.filter(
      field => field.name?.toLowerCase().includes('confirm') || 
               field.placeholder?.toLowerCase().includes('confirm')
    ).length || 0;

    // Fields missing autocomplete
    tokens.count.fields_missing_autocomplete = domData.formFields?.filter(
      field => !field.autocomplete && 
               (field.type === 'email' || field.type === 'text' || field.type === 'tel')
    ).length || 0;

    // Fields needing inputmode
    tokens.count.fields_needing_inputmode = domData.formFields?.filter(
      field => (field.type === 'tel' || field.type === 'email' || 
                field.name?.toLowerCase().includes('phone')) &&
               !field.inputmode
    ).length || 0;

    // Fields needing validation
    tokens.count.fields_needing_validation = domData.formFields?.filter(
      field => field.type === 'email' || field.type === 'tel' || field.required
    ).length || 0;

    // Placeholder-only fields (no visible labels)
    tokens.count.fields_placeholder_only = domData.formFields?.filter(
      field => field.placeholder && !field.label
    ).length || 0;

    // Optional fields unmarked
    tokens.count.optional_fields_unmarked = domData.formFields?.filter(
      field => !field.required && !field.placeholder?.toLowerCase().includes('optional')
    ).length || 0;

    // Decorative elements near form (heuristic)
    const formElement = domData.forms?.[0];
    if (formElement) {
      const elementsNearForm = [...(domData.textBlocks || []), ...(domData.images || [])]
        .filter(el => el.isVisible && 
          Math.abs(el.coordinates?.y - formElement.coordinates?.y) < 200
        );
      tokens.count.decorative_elements_near_form = elementsNearForm.filter(
        el => el.tagName === 'img' || (el.wordCount && el.wordCount < 5)
      ).length;
    } else {
      tokens.count.decorative_elements_near_form = 0;
    }

    // Carousel frames (look for carousel indicators)
    tokens.count.carousel_frames = 1; // Default, would need more sophisticated detection

    // Footer links
    const footerLinks = domData.links?.filter(link => 
      link.isVisible && link.distanceFromTop > (domData.foldLine?.position || 600) + 500
    ) || [];
    tokens.count.footer_links = footerLinks.length;

    // Inconsistent margins (simplified heuristic)
    tokens.count.inconsistent_margins = 0; // Would need CSS analysis

    // CTAs in same viewport as primary
    const primaryCTA = this.findPrimaryCTA(domData);
    if (primaryCTA) {
      const sameViewportCTAs = clickables.filter(el => 
        Math.abs(el.distanceFromTop - primaryCTA.distanceFromTop) < 400
      );
      tokens.count.competing_ctas_same_viewport = sameViewportCTAs.length - 1; // Exclude primary
    } else {
      tokens.count.competing_ctas_same_viewport = 0;
    }

    // Unique destinations
    const allHrefs = domData.links?.map(link => link.href) || [];
    tokens.count.unique_destinations = new Set(allHrefs).size;

    // Accessibility counts (simplified)
    tokens.count.unlabeled_controls = domData.formFields?.filter(
      field => !field.label && !field.placeholder
    ).length || 0;

    tokens.count.color_contrast_failures = 0; // Would need color analysis
  }

  /**
   * Extract human-readable labels from elements
   */
  private extractLabels(domData: any, tokens: DOMTokens): void {
    // Primary CTA
    const primaryCTA = this.findPrimaryCTA(domData);
    tokens.labels.primary_cta = primaryCTA ? this.extractElementLabel(primaryCTA) : "Main CTA";

    // H1 headline
    const h1 = domData.headings?.find(h => h.level === 1 && h.isVisible);
    tokens.labels.h1 = h1?.text || domData.title || "Main Headline";

    // Form name
    const form = domData.forms?.[0];
    tokens.labels.form_name = form ? this.extractElementLabel(form) : "Contact Form";

    // Sticky element (heuristic - look for position fixed/sticky)
    tokens.labels.sticky_element = "Support Chat"; // Default, would need CSS analysis

    // CTAs kept (top 3 most prominent)
    const topCTAs = [...(domData.buttons || []), ...(domData.links || [])]
      .filter(el => el.isVisible && el.isAboveFold)
      .sort((a, b) => (b.coordinates?.width * b.coordinates?.height) - (a.coordinates?.width * a.coordinates?.height))
      .slice(0, 3);
    
    tokens.labels.ctas_kept = topCTAs.map(cta => this.extractElementLabel(cta));

    // Dropdown fields
    const dropdowns = domData.formFields?.filter(f => f.type === 'select') || [];
    tokens.labels.dropdown_fields = dropdowns.map(field => this.extractElementLabel(field));

    // Placeholder-only fields
    const placeholderOnly = domData.formFields?.filter(f => f.placeholder && !f.label) || [];
    tokens.labels.placeholder_only_fields = placeholderOnly.map(field => this.extractElementLabel(field));

    // Fields missing autocomplete
    const missingAutocomplete = domData.formFields?.filter(f => 
      !f.autocomplete && (f.type === 'email' || f.type === 'text' || f.type === 'tel')
    ) || [];
    tokens.labels.fields_missing_autocomplete = missingAutocomplete.map(field => this.extractElementLabel(field));

    // Fields needing inputmode
    const needingInputmode = domData.formFields?.filter(f => 
      (f.type === 'tel' || f.type === 'email') && !f.inputmode
    ) || [];
    tokens.labels.fields_needing_inputmode = needingInputmode.map(field => this.extractElementLabel(field));

    // Fields needing validation
    const needingValidation = domData.formFields?.filter(f => 
      f.type === 'email' || f.type === 'tel' || f.required
    ) || [];
    tokens.labels.fields_needing_validation = needingValidation.map(field => this.extractElementLabel(field));

    // Required fields kept (essential ones)
    const requiredFields = domData.formFields?.filter(f => f.required) || [];
    const essentialRequired = requiredFields.filter(f => 
      f.type === 'email' || 
      f.name?.toLowerCase().includes('name') ||
      f.name?.toLowerCase().includes('company')
    );
    tokens.labels.required_fields_kept = essentialRequired.map(field => this.extractElementLabel(field));

    // Optional fields unmarked
    const optionalUnmarked = domData.formFields?.filter(f => 
      !f.required && !f.placeholder?.toLowerCase().includes('optional')
    ) || [];
    tokens.labels.optional_fields_unmarked = optionalUnmarked.map(field => this.extractElementLabel(field));

    // Address fields
    const addressFields = domData.formFields?.filter(f => 
      f.name?.toLowerCase().includes('address') ||
      f.name?.toLowerCase().includes('city') ||
      f.name?.toLowerCase().includes('zip') ||
      f.name?.toLowerCase().includes('state')
    ) || [];
    tokens.labels.address_fields = addressFields.map(field => this.extractElementLabel(field));

    // Trust markers (look for security badges, certifications)
    const trustImages = domData.images?.filter(img => 
      img.alt?.toLowerCase().includes('secure') ||
      img.alt?.toLowerCase().includes('ssl') ||
      img.alt?.toLowerCase().includes('certified') ||
      img.alt?.toLowerCase().includes('badge')
    ) || [];
    tokens.labels.trust_markers = trustImages.map(img => img.alt || 'Security Badge');

    // Form step fields (first 3 essential fields)
    const allFields = domData.formFields?.filter(f => f.isVisible) || [];
    const step1Fields = allFields.slice(0, 3);
    tokens.labels.fields_step1 = step1Fields.map(field => this.extractElementLabel(field));

    // Deferred fields (remaining fields)
    const deferredFields = allFields.slice(3);
    tokens.labels.fields_deferred = deferredFields.map(field => this.extractElementLabel(field));

    // Footer priority links
    const footerLinks = domData.links?.filter(link => 
      link.isVisible && link.distanceFromTop > (domData.foldLine?.position || 600) + 500
    ) || [];
    const priorityFooterLinks = footerLinks.filter(link =>
      link.text?.toLowerCase().includes('privacy') ||
      link.text?.toLowerCase().includes('contact') ||
      link.text?.toLowerCase().includes('terms')
    );
    tokens.labels.footer_priority_links = priorityFooterLinks.map(link => this.extractElementLabel(link));

    // SSO fillable fields
    const ssoFillable = domData.formFields?.filter(f => 
      f.type === 'email' || 
      f.name?.toLowerCase().includes('name') ||
      f.name?.toLowerCase().includes('company')
    ) || [];
    tokens.labels.sso_fillable_fields = ssoFillable.map(field => this.extractElementLabel(field));
  }

  /**
   * Extract positions and size measurements
   */
  private extractPositionsAndSizes(domData: any, tokens: DOMTokens): void {
    const primaryCTA = this.findPrimaryCTA(domData);
    
    // CTA position
    tokens.px.cta_top_offset = primaryCTA?.distanceFromTop || 0;

    // Hero height (distance to first form or primary content)
    const form = domData.forms?.[0];
    const heroHeight = form?.coordinates?.y || domData.foldLine?.position || 600;
    tokens.px.hero_height = heroHeight;

    // Scroll to form
    tokens.px.scroll_to_form = form?.coordinates?.y || 0;

    // Above form spacing
    tokens.px.above_form_spacing = 160; // Default spacing recommendation

    // Viewport reclaimed (mobile nav optimization)
    tokens.px.viewport_reclaimed = 60; // Typical mobile nav height

    // CTA tap area
    if (primaryCTA?.coordinates) {
      tokens.px.cta_tap_w = primaryCTA.coordinates.width;
      tokens.px.cta_tap_h = primaryCTA.coordinates.height;
    } else {
      tokens.px.cta_tap_w = 120; // Default
      tokens.px.cta_tap_h = 44;  // Default
    }

    // Safe area for mobile
    tokens.px.safe_area = 80; // Standard mobile safe area

    // Radius around form for distraction detection
    tokens.px.radius_form = 200;

    // Primary conversion element offset
    tokens.px.primary_conversion_offset = primaryCTA?.distanceFromTop || 0;

    // H1 size (if available from computed styles)
    const h1 = domData.headings?.find(h => h.level === 1);
    tokens.px.h1_size = 32; // Default, would need style analysis

    // Sticky start position
    tokens.px.sticky_start = 200; // Typical scroll position for sticky elements

    // Overlap offset
    tokens.px.overlap_offset = 420; // Where sticky elements typically cause overlap
  }

  /**
   * Extract typography and contrast information
   */
  private extractTypographyAndContrast(domData: any, tokens: DOMTokens): void {
    // CTA contrast (would need actual color analysis)
    tokens.contrast_ratio.cta_vs_bg = "3.2:1"; // Default/estimated
  }

  /**
   * Extract behavioral and timing data
   */
  private extractBehavioralData(domData: any, tokens: DOMTokens): void {
    // Carousel interval
    tokens.sec.carousel_interval = 5; // Default auto-rotation

    // Average dropdown time
    tokens.sec.avg_dropdown_time = 3; // Estimated selection time

    // Address typing vs autocomplete
    tokens.sec.addr_typing = 45; // Seconds to type full address
    tokens.sec.addr_autocomplete = 8; // Seconds with autocomplete

    // CAPTCHA solve time
    tokens.sec.captcha_time = 12; // Average CAPTCHA solve time

    // Validation latency
    tokens.ms.validation_latency = 200; // Target validation response time
  }

  /**
   * Extract content and copy
   */
  private extractContentAndCopy(domData: any, tokens: DOMTokens): void {
    // H1 text
    const h1 = domData.headings?.find(h => h.level === 1 && h.isVisible);
    tokens.text.h1 = h1?.text || domData.title || "Main Headline";

    // Current CTA label
    const primaryCTA = this.findPrimaryCTA(domData);
    tokens.text.cta_label_current = primaryCTA ? this.extractElementLabel(primaryCTA) : "Submit";

    // Target CTA label (improved version)
    tokens.text.cta_label_target = this.generateImprovedCTALabel(tokens.text.cta_label_current);

    // Unified promise (combination of headline and CTA intent)
    tokens.text.promise = this.generateUnifiedPromise(tokens.text.h1, tokens.text.cta_label_current);

    // Trust caption
    tokens.text.trust_caption = "Your data is protected";

    // Step labels for multi-step forms
    tokens.text.step_labels = "Contact Info, Requirements, Submit";

    // Progress copy
    tokens.text.progress_copy = "Step 1 of 3";
  }

  /**
   * Extract rates and analytics (with sensible defaults)
   */
  private extractRatesAndAnalytics(domData: any, tokens: DOMTokens): void {
    // Carousel CTR (low default for auto-rotating carousels)
    tokens.rate.carousel_ctr = 0.8; // 0.8% baseline

    // Navigation patterns
    tokens.pattern.nav_current = "horizontal tabs";
    tokens.pattern.nav_target = "hamburger menu";

    // Percentages
    const formArea = domData.forms?.[0]?.coordinates;
    const viewportArea = 1200 * 800; // Approximate viewport
    tokens.pct.form_area_of_viewport = formArea 
      ? (formArea.width * formArea.height) / viewportArea * 100
      : 15; // Default 15%

    tokens.pct.confirm_dropoff = 12; // Historical average for confirmation fields
    tokens.pct.progress_display = 25; // Show progress every 25%

    // Spacing scale
    tokens.scale.spacing = 8; // 8px grid system

    // Element references
    tokens.element.primary_conversion_element = tokens.labels.primary_cta;

    // Field references
    const firstField = domData.formFields?.[0];
    tokens.field.name = firstField ? this.extractElementLabel(firstField) : "Email";

    // IDs
    tokens.id.sticky_element = "support-chat";
    tokens.id.form_element = "main-form";
  }

  /**
   * Find the primary CTA on the page
   */
  private findPrimaryCTA(domData: any): any {
    // Look for prominent buttons first
    const buttons = domData.buttons?.filter(btn => btn.isVisible) || [];
    if (buttons.length > 0) {
      // Sort by size and above-fold position
      return buttons.sort((a, b) => {
        const aScore = (a.isAboveFold ? 100 : 0) + (a.coordinates?.width * a.coordinates?.height || 0);
        const bScore = (b.isAboveFold ? 100 : 0) + (b.coordinates?.width * b.coordinates?.height || 0);
        return bScore - aScore;
      })[0];
    }

    // Fallback to prominent links
    const links = domData.links?.filter(link => 
      link.isVisible && link.isAboveFold
    ) || [];
    
    if (links.length > 0) {
      return links[0];
    }

    return null;
  }

  /**
   * Extract readable label from any element
   */
  private extractElementLabel(element: any): string {
    if (!element) return "Unknown Element";

    // Priority order for label extraction
    const label = 
      element.text ||
      element.label ||
      element.placeholder ||
      element.name ||
      element.alt ||
      element.title ||
      element.value ||
      "Unlabeled Element";

    return this.sanitizeLabel(label);
  }

  /**
   * Sanitize and normalize labels
   */
  private sanitizeLabel(text: string): string {
    if (!text) return "Unlabeled";
    
    return text
      .replace(/\s+/g, ' ')           // Collapse whitespace
      .replace(/[^\w\s-]/g, '')       // Remove special chars except hyphens
      .substring(0, 40)               // Cap length
      .trim()
      .replace(/\b\w/g, l => l.toUpperCase()); // Title case
  }

  /**
   * Generate improved CTA label
   */
  private generateImprovedCTALabel(currentLabel: string): string {
    const generic = ['submit', 'click here', 'go', 'continue', 'next'];
    
    if (generic.some(g => currentLabel.toLowerCase().includes(g))) {
      return "Get Started";
    }
    
    return currentLabel; // Keep if already good
  }

  /**
   * Generate unified promise from headline and CTA
   */
  private generateUnifiedPromise(headline: string, ctaLabel: string): string {
    // Simple heuristic to combine headline intent with CTA action
    const action = ctaLabel.toLowerCase().includes('demo') ? 'demo' :
                  ctaLabel.toLowerCase().includes('quote') ? 'quote' :
                  ctaLabel.toLowerCase().includes('trial') ? 'trial' : 'started';
    
    return `${headline} - Get ${action}`;
  }
}

