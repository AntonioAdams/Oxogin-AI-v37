// Main contracts barrel export - hyper-focused feature subcontracts
export * from "./capture"
export * from "./cta"
export * from "./workflow"

// Re-export commonly used types for convenience
export type {
  // Core data types
  ElementCoordinates,
  DOMData,
  CaptureResult,
  CTAInsight,
  MatchedElement,
  // Options and configurations
  CaptureOptions,
  AIAnalysisOptions,
  WorkflowOptions,
  // Results and responses
  MatchingResult,
  CaptureAnalysisWorkflow,
  BatchWorkflowResult,
} from "./capture"

export type {
  CTAInsight,
  MatchedElement,
  DebugMatch,
  AIAnalysisOptions,
  AIAnalysisResult,
  MatchingOptions,
  MatchingResult,
} from "./cta"

export type {
  WorkflowStep,
  CaptureAnalysisWorkflow,
  WorkflowOptions,
  BatchWorkflowOptions,
  BatchWorkflowResult,
} from "./workflow"
