// CRO Analysis Types and Interfaces

export interface DOMTokens {
  // Counts & Lists
  count: {
    header_unique_cta_urls: number;
    hero_duplicate_links: number;
    clickables_total: number;
    header_links: number;
    form_required_fields: number;
    form_columns: number;
    form_steps: number;
    dropdown_fields: number;
    confirm_fields: number;
    fields_missing_autocomplete: number;
    fields_needing_inputmode: number;
    fields_needing_validation: number;
    fields_placeholder_only: number;
    optional_fields_unmarked: number;
    decorative_elements_near_form: number;
    carousel_frames: number;
    footer_links: number;
    inconsistent_margins: number;
    competing_ctas_same_viewport: number;
    unique_destinations: number;
    unlabeled_controls: number;
    color_contrast_failures: number;
  };

  // Labels (human-readable element text)
  labels: {
    primary_cta: string;
    h1: string;
    form_name: string;
    sticky_element: string;
    ctas_kept: string[];
    dropdown_fields: string[];
    placeholder_only_fields: string[];
    fields_missing_autocomplete: string[];
    fields_needing_inputmode: string[];
    fields_needing_validation: string[];
    required_fields_kept: string[];
    optional_fields_unmarked: string[];
    address_fields: string[];
    trust_markers: string[];
    fields_step1: string[];
    fields_deferred: string[];
    footer_priority_links: string[];
    sso_fillable_fields: string[];
  };

  // Positions & Sizes (in pixels)
  px: {
    cta_top_offset: number;
    hero_height: number;
    scroll_to_form: number;
    above_form_spacing: number;
    viewport_reclaimed: number;
    cta_tap_w: number;
    cta_tap_h: number;
    safe_area: number;
    radius_form: number;
    primary_conversion_offset: number;
    h1_size: number;
    sticky_start: number;
    overlap_offset: number;
  };

  // Typography & Contrast
  contrast_ratio: {
    cta_vs_bg: string; // e.g., "2.8:1"
  };

  // Patterns & Behaviors
  sec: {
    carousel_interval: number;
    avg_dropdown_time: number;
    addr_typing: number;
    addr_autocomplete: number;
    captcha_time: number;
  };

  // Timing & Performance
  ms: {
    validation_latency: number;
  };

  // Copy & Content
  text: {
    h1: string;
    cta_label_current: string;
    cta_label_target: string;
    promise: string;
    trust_caption: string;
    step_labels: string;
    progress_copy: string;
  };

  // Rates & Analytics (fallback to defaults if unknown)
  rate: {
    carousel_ctr: number; // percentage
  };

  // Patterns
  pattern: {
    nav_current: string;
    nav_target: string;
  };

  // Percentages
  pct: {
    form_area_of_viewport: number;
    confirm_dropoff: number;
    progress_display: number;
  };

  // Scale & Spacing
  scale: {
    spacing: number; // e.g., 8 for 8px grid
  };

  // Element references
  element: {
    primary_conversion_element: string;
  };

  // Field references  
  field: {
    name: string;
  };

  // IDs
  id: {
    sticky_element: string;
    form_element: string;
  };
}

export interface CROTargets {
  header_unique_cta_urls: number;
  hero_unique_links: number;
  form_required_fields: number;
  above_fold_px: number;
  contrast_ratio_required: string;
  h1_size: number;
  hero_height: number;
  clickables_total: number;
  scroll_to_form: number;
  max_options_for_radios: number;
  cta_chars: number;
  tap_min: number;
  unique_destinations: number;
  footer_links: number;
  error_copy_chars: number;
  h1_context_reduction_pct: number;
  ms_tbt: number;
  sec_lcp: number;
}

export interface CROUplift {
  nav_focus_pct: number;
  cta_contrast_pct: number;
  field_reduction_pct: number;
  dropdown_to_radio_pct: number;
  dropdown_time_savings_pct: number;
  sso_pct: number;
  
  // Ranges
  field_reduction_min: number;
  field_reduction_max: number;
  above_fold_min: number;
  above_fold_max: number;
  nav_focus_min: number;
  nav_focus_max: number;
  trust_near_form_min: number;
  trust_near_form_max: number;
  single_col_min: number;
  single_col_max: number;
}

export interface CROFrictionRanges {
  dropoff_fields_min: number;
  dropoff_fields_max: number;
  below_fold_min: number;
  below_fold_max: number;
  low_contrast_min: number;
  low_contrast_max: number;
  link_overload_min: number;
  link_overload_max: number;
  label_issue_min: number;
  label_issue_max: number;
  dropdown_penalty_min: number;
  dropdown_penalty_max: number;
}

export interface CRORecommendation {
  id: string; // e.g., "QW-01", "FF-01", "ST-01"
  category: 'Quick Wins' | 'Form Fixes' | 'Structural Changes' | 'Key Highlights' | 'Friction Points' | 'ROI Insights' | 'Next Steps';
  effort: string; // e.g., "1-2 hrs", "3-5 hrs", "1-2 days"
  impact: string; // e.g., "+3-5%", "+5-8%", "+8-12%"
  title: string;
  description: string;
  priority: number; // calculated score for ordering
  confidence: number; // 50-90% based on detection certainty
  estimatedUplift: {
    min: number;
    max: number;
  };
}

export interface CROAnalysisResult {
  recommendations: CRORecommendation[];
  summary: {
    totalRecommendations: number;
    quickWins: number;
    formFixes: number;
    structuralChanges: number;
    estimatedUpliftRange: {
      min: number;
      max: number;
    };
  };
  tokens: DOMTokens;
  metadata: {
    analyzedAt: string;
    url: string;
    deviceType: 'desktop' | 'mobile';
    analysisVersion: string;
  };
}

// Input from existing capture system
export interface CaptureData {
  domData: {
    title: string;
    url: string;
    buttons: Array<{
      oxId: string;
      text: string;
      className: string;
      id: string;
      isVisible: boolean;
      isAboveFold: boolean;
      coordinates: { x: number; y: number; width: number; height: number };
      distanceFromTop: number;
    }>;
    links: Array<{
      oxId: string;
      text: string;
      href: string;
      className: string;
      id: string;
      isVisible: boolean;
      isAboveFold: boolean;
      coordinates: { x: number; y: number; width: number; height: number };
      distanceFromTop: number;
    }>;
    forms: Array<{
      oxId: string;
      action: string;
      method: string;
      className: string;
      id: string;
      isVisible: boolean;
      coordinates: { x: number; y: number; width: number; height: number };
    }>;
    formFields: Array<{
      oxId: string;
      type: string;
      name: string;
      placeholder: string;
      required: boolean;
      className: string;
      id: string;
      label: string;
      isVisible: boolean;
      coordinates: { x: number; y: number; width: number; height: number };
    }>;
    headings: Array<{
      text: string;
      level: number;
      className: string;
      id: string;
      isVisible: boolean;
      isAboveFold: boolean;
      coordinates: { x: number; y: number; width: number; height: number };
      distanceFromTop: number;
    }>;
    textBlocks: Array<{
      text: string;
      tagName: string;
      className: string;
      id: string;
      isVisible: boolean;
      coordinates: { x: number; y: number; width: number; height: number };
      wordCount: number;
    }>;
    foldLine: {
      position: number;
      aboveFoldButtons: number;
      belowFoldButtons: number;
      aboveFoldLinks: number;
      belowFoldLinks: number;
    };
  };
  screenshot: string;
  timestamp: string;
  isMobile: boolean;
}

