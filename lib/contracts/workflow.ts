// Workflow and orchestration type definitions
import type { CaptureResult, CaptureOptions } from "./capture"
import type { CTAInsight, MatchedElement, AIAnalysisOptions } from "./cta"

export interface WorkflowStep {
  id: string
  name: string
  status: "pending" | "running" | "completed" | "failed"
  startTime?: Date
  endTime?: Date
  error?: string
  metadata?: Record<string, any>
}

export interface CaptureAnalysisWorkflow {
  id: string
  url: string
  status: "pending" | "running" | "completed" | "failed"
  steps: WorkflowStep[]
  result?: {
    capture: CaptureResult
    analysis: CTAInsight
    match: MatchedElement | null
  }
  createdAt: Date
  completedAt?: Date
  totalProcessingTime?: number
}

export interface WorkflowOptions {
  captureOptions?: Partial<CaptureOptions>
  analysisOptions?: Partial<AIAnalysisOptions>
  skipAnalysis?: boolean
  skipMatching?: boolean
}

export interface BatchWorkflowOptions extends WorkflowOptions {
  urls: string[]
  concurrency?: number
  delayBetweenRequests?: number
}

export interface BatchWorkflowResult {
  id: string
  totalUrls: number
  completed: number
  failed: number
  results: CaptureAnalysisWorkflow[]
  startTime: Date
  endTime?: Date
  totalProcessingTime?: number
}
