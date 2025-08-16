// CRO Recommendation Engine - Generates recommendations using tokenized templates
import { DOMTokens, CRORecommendation, CROTargets, CROUplift, CROFrictionRanges } from './types';

export class RecommendationEngine {
  private targets: CROTargets;
  private uplift: CROUplift;
  private frictionRanges: CROFrictionRanges;

  constructor() {
    this.targets = this.getDefaultTargets();
    this.uplift = this.getDefaultUplift();
    this.frictionRanges = this.getDefaultFrictionRanges();
  }

  /**
   * Generate all recommendations based on extracted tokens
   */
  async generateRecommendations(tokens: DOMTokens): Promise<CRORecommendation[]> {
    const recommendations: CRORecommendation[] = [];

    // Generate Quick Wins (🟢 1–2 hrs | +3–5%)
    recommendations.push(...this.generateQuickWins(tokens));

    // Generate Form Fixes (🟡 3–5 hrs | +5–8%)
    recommendations.push(...this.generateFormFixes(tokens));

    // Generate Structural Changes (🔴 1–2 days | +8–12%)
    recommendations.push(...this.generateStructuralChanges(tokens));

    // Generate Key Highlights
    recommendations.push(...this.generateKeyHighlights(tokens));

    // Generate Friction Points
    recommendations.push(...this.generateFrictionPoints(tokens));

    // Generate ROI Insights
    recommendations.push(...this.generateROIInsights(tokens));

    // Generate Next Steps (auto-prioritized)
    recommendations.push(...this.generateNextSteps(tokens));

    // Calculate priority scores and sort
    return this.prioritizeRecommendations(recommendations);
  }

  /**
   * Generate Quick Wins recommendations
   */
  private generateQuickWins(tokens: DOMTokens): CRORecommendation[] {
    const recommendations: CRORecommendation[] = [];

    // QW-01 • Header Nav CTAs
    if (tokens.count.header_unique_cta_urls > this.targets.header_unique_cta_urls) {
      recommendations.push({
        id: 'QW-01',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'Header Nav CTAs',
        description: `Reduce header CTAs from ${tokens.count.header_unique_cta_urls} to ${this.targets.header_unique_cta_urls} primary actions (keep: ${tokens.labels.ctas_kept.join(', ')}) → expected +${this.uplift.nav_focus_pct}% CTR.`,
        priority: this.calculatePriority(this.uplift.nav_focus_pct, 85, 1.5),
        confidence: 85,
        estimatedUplift: {
          min: this.uplift.nav_focus_min,
          max: this.uplift.nav_focus_max
        }
      });
    }

    // QW-02 • Hero Link Duplication
    if (tokens.count.hero_duplicate_links > 0) {
      recommendations.push({
        id: 'QW-02',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'Hero Link Duplication',
        description: `Remove ${tokens.count.hero_duplicate_links} duplicate links in hero so only ${this.targets.hero_unique_links} unique actions remain (focus: ${tokens.labels.ctas_kept.join(', ')}).`,
        priority: this.calculatePriority(4, 90, 1),
        confidence: 90,
        estimatedUplift: { min: 3, max: 5 }
      });
    }

    // QW-03 • CTA Contrast
    const currentContrast = parseFloat(tokens.contrast_ratio.cta_vs_bg);
    const targetContrast = parseFloat(this.targets.contrast_ratio_required);
    if (currentContrast < targetContrast) {
      recommendations.push({
        id: 'QW-03',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'CTA Contrast',
        description: `Increase ${tokens.labels.primary_cta} contrast from ${tokens.contrast_ratio.cta_vs_bg} to ≥${this.targets.contrast_ratio_required} (WCAG) → +${this.uplift.cta_contrast_pct}% clicks.`,
        priority: this.calculatePriority(this.uplift.cta_contrast_pct, 80, 1),
        confidence: 80,
        estimatedUplift: { min: 5, max: 10 }
      });
    }

    // QW-04 • Headline Dominance
    if (tokens.px.h1_size < this.targets.h1_size) {
      recommendations.push({
        id: 'QW-04',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'Headline Dominance',
        description: `Raise ${tokens.labels.h1} size ${tokens.px.h1_size}px → ${this.targets.h1_size}px and reduce surrounding text by ${this.targets.h1_context_reduction_pct}% to clarify hierarchy.`,
        priority: this.calculatePriority(3, 75, 1),
        confidence: 75,
        estimatedUplift: { min: 2, max: 4 }
      });
    }

    // QW-05 • Hero Height
    if (tokens.px.hero_height > this.targets.hero_height) {
      recommendations.push({
        id: 'QW-05',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'Hero Height',
        description: `Reduce hero height ${tokens.px.hero_height}px → ${this.targets.hero_height}px so ${tokens.labels.primary_cta} or ${tokens.labels.form_name} is visible in the first viewport (≤${this.targets.above_fold_px}px).`,
        priority: this.calculatePriority(6, 85, 1.5),
        confidence: 85,
        estimatedUplift: { min: 4, max: 8 }
      });
    }

    // QW-06 • Button Copy
    if (this.isGenericCTALabel(tokens.text.cta_label_current)) {
      recommendations.push({
        id: 'QW-06',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'Button Copy',
        description: `Change ${tokens.labels.primary_cta} text from "${tokens.text.cta_label_current}" → "${tokens.text.cta_label_target}" (≤${this.targets.cta_chars} chars) for clearer value.`,
        priority: this.calculatePriority(5, 80, 0.5),
        confidence: 80,
        estimatedUplift: { min: 3, max: 7 }
      });
    }

    // QW-07 • Suppress Auto-Rotation
    if (tokens.sec.carousel_interval > 0 && tokens.count.carousel_frames > 1) {
      recommendations.push({
        id: 'QW-07',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'Suppress Auto-Rotation',
        description: `Disable carousel auto-rotation (${tokens.sec.carousel_interval}s) and pin frame featuring ${tokens.labels.h1} + ${tokens.labels.primary_cta} (prior CTR ${tokens.rate.carousel_ctr}%).`,
        priority: this.calculatePriority(8, 85, 1),
        confidence: 85,
        estimatedUplift: { min: 5, max: 12 }
      });
    }

    // QW-08 • Tap Target Size (Mobile)
    if (tokens.px.cta_tap_w < this.targets.tap_min || tokens.px.cta_tap_h < this.targets.tap_min) {
      recommendations.push({
        id: 'QW-08',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'Tap Target Size (Mobile)',
        description: `Increase ${tokens.labels.primary_cta} tap area ${tokens.px.cta_tap_w}×${tokens.px.cta_tap_h} → ≥${this.targets.tap_min}px.`,
        priority: this.calculatePriority(4, 70, 1),
        confidence: 70,
        estimatedUplift: { min: 2, max: 6 }
      });
    }

    // QW-09 • Visual Noise Near Form
    if (tokens.count.decorative_elements_near_form > 2) {
      recommendations.push({
        id: 'QW-09',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'Visual Noise Near Form',
        description: `Remove ${tokens.count.decorative_elements_near_form} decorative elements within ${tokens.px.radius_form}px of ${tokens.labels.form_name}.`,
        priority: this.calculatePriority(3, 75, 1),
        confidence: 75,
        estimatedUplift: { min: 2, max: 5 }
      });
    }

    // QW-10 • Sticky Distraction
    if (tokens.labels.sticky_element && tokens.px.overlap_offset > 0) {
      recommendations.push({
        id: 'QW-10',
        category: 'Quick Wins',
        effort: '1-2 hrs',
        impact: '+3-5%',
        title: 'Sticky Distraction',
        description: `Hide sticky ${tokens.labels.sticky_element} on this page; it overlaps ${tokens.labels.primary_cta} at ${tokens.px.overlap_offset}px scroll.`,
        priority: this.calculatePriority(3, 80, 0.5),
        confidence: 80,
        estimatedUplift: { min: 2, max: 4 }
      });
    }

    return recommendations;
  }

  /**
   * Generate Form Fixes recommendations
   */
  private generateFormFixes(tokens: DOMTokens): CRORecommendation[] {
    const recommendations: CRORecommendation[] = [];

    // FF-01 • Required Fields
    if (tokens.count.form_required_fields > this.targets.form_required_fields) {
      recommendations.push({
        id: 'FF-01',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Required Fields',
        description: `Reduce ${tokens.labels.form_name} required fields ${tokens.count.form_required_fields} → ${this.targets.form_required_fields} (keep: ${tokens.labels.required_fields_kept.join(', ')}) → +${this.uplift.field_reduction_pct}% completions.`,
        priority: this.calculatePriority(this.uplift.field_reduction_pct, 90, 4),
        confidence: 90,
        estimatedUplift: {
          min: this.uplift.field_reduction_min,
          max: this.uplift.field_reduction_max
        }
      });
    }

    // FF-02 • Field Type Swap
    if (tokens.count.dropdown_fields > 0) {
      recommendations.push({
        id: 'FF-02',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Field Type Swap',
        description: `Replace dropdowns (${tokens.labels.dropdown_fields.join(', ')}) with radios (≤${this.targets.max_options_for_radios} options) → selection time ↓ ${this.uplift.dropdown_time_savings_pct}%.`,
        priority: this.calculatePriority(6, 85, 3),
        confidence: 85,
        estimatedUplift: { min: 4, max: 8 }
      });
    }

    // FF-03 • Autofill & Autocomplete
    if (tokens.count.fields_missing_autocomplete > 0) {
      recommendations.push({
        id: 'FF-03',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Autofill & Autocomplete',
        description: `Add autocomplete for ${tokens.labels.fields_missing_autocomplete.join(', ')}.`,
        priority: this.calculatePriority(5, 85, 2),
        confidence: 85,
        estimatedUplift: { min: 3, max: 7 }
      });
    }

    // FF-04 • Mobile Input Modes
    if (tokens.count.fields_needing_inputmode > 0) {
      recommendations.push({
        id: 'FF-04',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Mobile Input Modes',
        description: `Add appropriate inputmode for ${tokens.labels.fields_needing_inputmode.join(', ')} (e.g., tel, email, numeric).`,
        priority: this.calculatePriority(4, 80, 2),
        confidence: 80,
        estimatedUplift: { min: 2, max: 5 }
      });
    }

    // FF-05 • Inline Validation
    if (tokens.count.fields_needing_validation > 0) {
      recommendations.push({
        id: 'FF-05',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Inline Validation',
        description: `Enable inline validation for ${tokens.labels.fields_needing_validation.join(', ')}; error shows within ${tokens.ms.validation_latency}ms; keep messages under ${this.targets.error_copy_chars} chars.`,
        priority: this.calculatePriority(7, 85, 4),
        confidence: 85,
        estimatedUplift: { min: 5, max: 10 }
      });
    }

    // FF-06 • Combine Redundant Fields
    if (tokens.count.confirm_fields > 0) {
      recommendations.push({
        id: 'FF-06',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Combine Redundant Fields',
        description: `Remove "Confirm ${tokens.field.name}" (current duplicates: ${tokens.count.confirm_fields}) in ${tokens.labels.form_name}; historical drop-off ${tokens.pct.confirm_dropoff}%.`,
        priority: this.calculatePriority(8, 90, 3),
        confidence: 90,
        estimatedUplift: { min: 6, max: 12 }
      });
    }

    // FF-07 • Persistent Labels
    if (tokens.count.fields_placeholder_only > 0) {
      recommendations.push({
        id: 'FF-07',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Persistent Labels',
        description: `Convert placeholder-only fields (${tokens.labels.placeholder_only_fields.join(', ')}) to visible labels.`,
        priority: this.calculatePriority(5, 80, 3),
        confidence: 80,
        estimatedUplift: { min: 3, max: 6 }
      });
    }

    // FF-08 • Optionality Clarity
    if (tokens.count.optional_fields_unmarked > 0) {
      recommendations.push({
        id: 'FF-08',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Optionality Clarity',
        description: `Mark ${tokens.labels.optional_fields_unmarked.join(', ')} as optional and move to later step.`,
        priority: this.calculatePriority(4, 75, 2),
        confidence: 75,
        estimatedUplift: { min: 2, max: 5 }
      });
    }

    // FF-09 • Progress Indicator (If Multi-Step)
    if (tokens.count.form_steps > 1) {
      recommendations.push({
        id: 'FF-09',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Progress Indicator (If Multi-Step)',
        description: `Add progress to ${tokens.labels.form_name} (${tokens.count.form_steps} steps) with labels ${tokens.text.step_labels} at ${tokens.pct.progress_display}% granularity.`,
        priority: this.calculatePriority(6, 85, 4),
        confidence: 85,
        estimatedUplift: { min: 4, max: 8 }
      });
    }

    // FF-10 • Address Autocomplete
    if (tokens.labels.address_fields.length > 0) {
      recommendations.push({
        id: 'FF-10',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'Address Autocomplete',
        description: `Enable address autocomplete for ${tokens.labels.address_fields.join(', ')}.`,
        priority: this.calculatePriority(8, 90, 3),
        confidence: 90,
        estimatedUplift: { min: 6, max: 12 }
      });
    }

    // FF-12 • SSO / Social Fill
    if (tokens.labels.sso_fillable_fields.length > 0) {
      recommendations.push({
        id: 'FF-12',
        category: 'Form Fixes',
        effort: '3-5 hrs',
        impact: '+5-8%',
        title: 'SSO / Social Fill',
        description: `Offer Google/LinkedIn fill for ${tokens.labels.sso_fillable_fields.join(', ')} → +${this.uplift.sso_pct}% completion.`,
        priority: this.calculatePriority(this.uplift.sso_pct, 80, 5),
        confidence: 80,
        estimatedUplift: { min: 8, max: 15 }
      });
    }

    return recommendations;
  }

  /**
   * Generate Structural Changes recommendations
   */
  private generateStructuralChanges(tokens: DOMTokens): CRORecommendation[] {
    const recommendations: CRORecommendation[] = [];

    // ST-01 • Above-the-Fold CTA
    if (tokens.px.cta_top_offset > this.targets.above_fold_px) {
      recommendations.push({
        id: 'ST-01',
        category: 'Structural Changes',
        effort: '1-2 days',
        impact: '+8-12%',
        title: 'Above-the-Fold CTA',
        description: `Move ${tokens.labels.primary_cta} from ${tokens.px.cta_top_offset}px to ≤${this.targets.above_fold_px}px; add anchor in ${tokens.labels.h1} section.`,
        priority: this.calculatePriority(12, 95, 16),
        confidence: 95,
        estimatedUplift: {
          min: this.uplift.above_fold_min,
          max: this.uplift.above_fold_max
        }
      });
    }

    // ST-02 • Single-Column Form
    if (tokens.count.form_columns > 1) {
      recommendations.push({
        id: 'ST-02',
        category: 'Structural Changes',
        effort: '1-2 days',
        impact: '+8-12%',
        title: 'Single-Column Form',
        description: `Convert ${tokens.labels.form_name} from ${tokens.count.form_columns}-column → 1-column for scanability and mobile parity.`,
        priority: this.calculatePriority(8, 85, 12),
        confidence: 85,
        estimatedUplift: {
          min: this.uplift.single_col_min,
          max: this.uplift.single_col_max
        }
      });
    }

    // ST-03 • Clickable Element Reduction
    if (tokens.count.clickables_total > this.targets.clickables_total) {
      recommendations.push({
        id: 'ST-03',
        category: 'Structural Changes',
        effort: '1-2 days',
        impact: '+8-12%',
        title: 'Clickable Element Reduction',
        description: `Reduce total clickables ${tokens.count.clickables_total} → ${this.targets.clickables_total}; keep primary actions ${tokens.labels.ctas_kept.join(', ')}; move tertiary links to footer.`,
        priority: this.calculatePriority(10, 80, 16),
        confidence: 80,
        estimatedUplift: { min: 6, max: 12 }
      });
    }

    // ST-04 • Merge Hero + Form
    if (tokens.px.scroll_to_form > this.targets.scroll_to_form) {
      recommendations.push({
        id: 'ST-04',
        category: 'Structural Changes',
        effort: '1-2 days',
        impact: '+8-12%',
        title: 'Merge Hero + Form',
        description: `Merge ${tokens.labels.h1} section with ${tokens.labels.form_name}; scroll to form ${tokens.px.scroll_to_form}px → ${this.targets.scroll_to_form}px.`,
        priority: this.calculatePriority(15, 90, 20),
        confidence: 90,
        estimatedUplift: { min: 10, max: 18 }
      });
    }

    // ST-05 • Social Proof Placement
    if (tokens.labels.trust_markers.length > 0) {
      recommendations.push({
        id: 'ST-05',
        category: 'Structural Changes',
        effort: '1-2 days',
        impact: '+8-12%',
        title: 'Social Proof Placement',
        description: `Place trust markers ${tokens.labels.trust_markers.join(', ')} near ${tokens.labels.form_name} (within ${tokens.px.above_form_spacing}px); caption "${tokens.text.trust_caption}".`,
        priority: this.calculatePriority(8, 85, 8),
        confidence: 85,
        estimatedUplift: {
          min: this.uplift.trust_near_form_min,
          max: this.uplift.trust_near_form_max
        }
      });
    }

    return recommendations;
  }

  /**
   * Generate Key Highlights
   */
  private generateKeyHighlights(tokens: DOMTokens): CRORecommendation[] {
    const recommendations: CRORecommendation[] = [];

    // KH-01
    recommendations.push({
      id: 'KH-01',
      category: 'Key Highlights',
      effort: '',
      impact: '',
      title: 'Primary Conversion Path',
      description: `${tokens.labels.primary_cta} near ${tokens.px.primary_conversion_offset}px competes with ${tokens.count.competing_ctas_same_viewport} CTAs in the same viewport.`,
      priority: 0,
      confidence: 100,
      estimatedUplift: { min: 0, max: 0 }
    });

    // KH-02
    recommendations.push({
      id: 'KH-02',
      category: 'Key Highlights',
      effort: '',
      impact: '',
      title: 'Form Visibility',
      description: `${tokens.labels.form_name} uses ${tokens.count.form_required_fields} required fields and loads after ${tokens.px.scroll_to_form}px on mobile.`,
      priority: 0,
      confidence: 100,
      estimatedUplift: { min: 0, max: 0 }
    });

    // KH-03
    recommendations.push({
      id: 'KH-03',
      category: 'Key Highlights',
      effort: '',
      impact: '',
      title: 'Message Alignment',
      description: `${tokens.labels.h1} and ${tokens.labels.primary_cta} communicate different intents; unify to "${tokens.text.promise}".`,
      priority: 0,
      confidence: 100,
      estimatedUplift: { min: 0, max: 0 }
    });

    return recommendations;
  }

  /**
   * Generate Friction Points
   */
  private generateFrictionPoints(tokens: DOMTokens): CRORecommendation[] {
    const recommendations: CRORecommendation[] = [];

    // FP-01 • Too Many Required Fields
    if (tokens.count.form_required_fields > 5) {
      recommendations.push({
        id: 'FP-01',
        category: 'Friction Points',
        effort: '',
        impact: '',
        title: 'Too Many Required Fields',
        description: `${tokens.labels.form_name} has ${tokens.count.form_required_fields} required fields (>5) → -${this.frictionRanges.dropoff_fields_min}–${this.frictionRanges.dropoff_fields_max}% completion.`,
        priority: 0,
        confidence: 85,
        estimatedUplift: { min: 0, max: 0 }
      });
    }

    // FP-02 • CTA Below Fold
    if (tokens.px.cta_top_offset > this.targets.above_fold_px) {
      recommendations.push({
        id: 'FP-02',
        category: 'Friction Points',
        effort: '',
        impact: '',
        title: 'CTA Below Fold',
        description: `${tokens.labels.primary_cta} sits at ${tokens.px.cta_top_offset}px (>${this.targets.above_fold_px}px) → -${this.frictionRanges.below_fold_min}–${this.frictionRanges.below_fold_max}% primary clicks.`,
        priority: 0,
        confidence: 90,
        estimatedUplift: { min: 0, max: 0 }
      });
    }

    return recommendations;
  }

  /**
   * Generate ROI Insights
   */
  private generateROIInsights(tokens: DOMTokens): CRORecommendation[] {
    const recommendations: CRORecommendation[] = [];

    // ROI-01
    if (tokens.count.form_required_fields > this.targets.form_required_fields) {
      recommendations.push({
        id: 'ROI-01',
        category: 'ROI Insights',
        effort: '',
        impact: '',
        title: 'Form Field Reduction ROI',
        description: `Reducing ${tokens.labels.form_name} required fields ${tokens.count.form_required_fields} → ${this.targets.form_required_fields} → +${this.uplift.field_reduction_min}–${this.uplift.field_reduction_max}% completions.`,
        priority: 0,
        confidence: 90,
        estimatedUplift: { min: 0, max: 0 }
      });
    }

    // ROI-02
    if (tokens.px.cta_top_offset > this.targets.above_fold_px) {
      recommendations.push({
        id: 'ROI-02',
        category: 'ROI Insights',
        effort: '',
        impact: '',
        title: 'Above Fold ROI',
        description: `Moving ${tokens.labels.primary_cta} above the fold → +${this.uplift.above_fold_min}–${this.uplift.above_fold_max}% conversions.`,
        priority: 0,
        confidence: 95,
        estimatedUplift: { min: 0, max: 0 }
      });
    }

    return recommendations;
  }

  /**
   * Generate Next Steps (auto-prioritized)
   */
  private generateNextSteps(tokens: DOMTokens): CRORecommendation[] {
    const recommendations: CRORecommendation[] = [];

    // NS-01
    recommendations.push({
      id: 'NS-01',
      category: 'Next Steps',
      effort: '',
      impact: '',
      title: 'Remove Distractions',
      description: `Remove distractions: unique destinations ${tokens.count.unique_destinations} → ${this.targets.unique_destinations}; de-duplicate hero links (${tokens.count.hero_duplicate_links}).`,
      priority: 85,
      confidence: 85,
      estimatedUplift: { min: 5, max: 10 }
    });

    // NS-02
    recommendations.push({
      id: 'NS-02',
      category: 'Next Steps',
      effort: '',
      impact: '',
      title: 'Simplify Form',
      description: `Simplify ${tokens.labels.form_name}: required fields ${tokens.count.form_required_fields} → ${this.targets.form_required_fields}; enable autocomplete on ${tokens.labels.fields_missing_autocomplete.join(', ')}.`,
      priority: 90,
      confidence: 90,
      estimatedUplift: { min: 8, max: 15 }
    });

    // NS-03
    recommendations.push({
      id: 'NS-03',
      category: 'Next Steps',
      effort: '',
      impact: '',
      title: 'Lift Visibility',
      description: `Lift visibility: move ${tokens.labels.primary_cta} to ≤${this.targets.above_fold_px}px; raise contrast to ≥${this.targets.contrast_ratio_required}.`,
      priority: 95,
      confidence: 95,
      estimatedUplift: { min: 10, max: 18 }
    });

    return recommendations;
  }

  /**
   * Calculate priority score for recommendations
   */
  private calculatePriority(impactPct: number, confidencePct: number, effortHours: number): number {
    return (impactPct * confidencePct) / (effortHours * 100);
  }

  /**
   * Prioritize recommendations by score
   */
  private prioritizeRecommendations(recommendations: CRORecommendation[]): CRORecommendation[] {
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if CTA label is generic and needs improvement
   */
  private isGenericCTALabel(label: string): boolean {
    const genericLabels = ['submit', 'click here', 'go', 'continue', 'next', 'send', 'button'];
    return genericLabels.some(generic => label.toLowerCase().includes(generic));
  }

  /**
   * Get default target values
   */
  private getDefaultTargets(): CROTargets {
    return {
      header_unique_cta_urls: 3,
      hero_unique_links: 2,
      form_required_fields: 3,
      above_fold_px: 360,
      contrast_ratio_required: "4.5:1",
      h1_size: 36,
      hero_height: 520,
      clickables_total: 25,
      scroll_to_form: 750,
      max_options_for_radios: 5,
      cta_chars: 24,
      tap_min: 44,
      unique_destinations: 5,
      footer_links: 8,
      error_copy_chars: 120,
      h1_context_reduction_pct: 15,
      ms_tbt: 100,
      sec_lcp: 2.5
    };
  }

  /**
   * Get default uplift values
   */
  private getDefaultUplift(): CROUplift {
    return {
      nav_focus_pct: 4,
      cta_contrast_pct: 8,
      field_reduction_pct: 20,
      dropdown_to_radio_pct: 30,
      dropdown_time_savings_pct: 30,
      sso_pct: 12,
      field_reduction_min: 15,
      field_reduction_max: 25,
      above_fold_min: 10,
      above_fold_max: 15,
      nav_focus_min: 3,
      nav_focus_max: 5,
      trust_near_form_min: 6,
      trust_near_form_max: 10,
      single_col_min: 5,
      single_col_max: 15
    };
  }

  /**
   * Get default friction ranges
   */
  private getDefaultFrictionRanges(): CROFrictionRanges {
    return {
      dropoff_fields_min: 15,
      dropoff_fields_max: 30,
      below_fold_min: 10,
      below_fold_max: 20,
      low_contrast_min: 5,
      low_contrast_max: 10,
      link_overload_min: 5,
      link_overload_max: 12,
      label_issue_min: 3,
      label_issue_max: 8,
      dropdown_penalty_min: 3,
      dropdown_penalty_max: 7
    };
  }
}

