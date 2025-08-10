// Core orchestration module exports
export * from "./workflow"
export * from "./pipeline"

// Re-export commonly used classes and functions
export {
  WorkflowOrchestrator,
  workflowOrchestrator,
} from "./workflow"

export {
  Pipeline,
  PipelineFactory,
  CaptureStep,
  AnalysisStep,
} from "./pipeline"

// Convenience functions
import { workflowOrchestrator } from "./workflow"
import type { WorkflowOptions } from "../contracts/workflow"

export async function captureAndAnalyze(url: string, options?: WorkflowOptions) {
  return await workflowOrchestrator.executeWorkflow(url, options)
}

export async function batchCaptureAndAnalyze(urls: string[], options?: Partial<WorkflowOptions>) {
  return await workflowOrchestrator.executeBatchWorkflow({
    urls,
    ...options,
  })
}
