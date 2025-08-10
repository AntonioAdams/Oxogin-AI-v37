import type {
  CaptureAnalysisWorkflow,
  WorkflowStep,
  WorkflowOptions,
  BatchWorkflowOptions,
  BatchWorkflowResult,
} from "../contracts/workflow"
import type { CTAInsight } from "../contracts/cta"
import { captureWebsite } from "../capture"
import { analyzeCTA, createCTAMatcher } from "../ai"
import { validateUrl } from "../utils/validation"
import { logger } from "../utils/logger"

export class WorkflowOrchestrator {
  private workflows = new Map<string, CaptureAnalysisWorkflow>()
  private moduleLogger = logger.module("workflow")

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private createWorkflowStep(id: string, name: string): WorkflowStep {
    return {
      id,
      name,
      status: "pending",
    }
  }

  private updateWorkflowStep(workflow: CaptureAnalysisWorkflow, stepId: string, updates: Partial<WorkflowStep>): void {
    const step = workflow.steps.find((s) => s.id === stepId)
    if (step) {
      Object.assign(step, updates)
      if (updates.status === "running") {
        step.startTime = new Date()
      } else if (updates.status === "completed" || updates.status === "failed") {
        step.endTime = new Date()
      }
    }
  }

  async executeWorkflow(url: string, options: WorkflowOptions = {}): Promise<CaptureAnalysisWorkflow> {
    const workflowId = this.generateWorkflowId()

    const workflow: CaptureAnalysisWorkflow = {
      id: workflowId,
      url,
      status: "running",
      steps: [
        this.createWorkflowStep("validate", "URL Validation"),
        this.createWorkflowStep("capture", "Website Capture"),
        ...(options.skipAnalysis ? [] : [this.createWorkflowStep("analyze", "CTA Analysis")]),
        ...(options.skipMatching ? [] : [this.createWorkflowStep("match", "DOM Matching")]),
      ],
      createdAt: new Date(),
    }

    this.workflows.set(workflowId, workflow)
    this.moduleLogger.info(`Starting workflow for URL: ${url}`, { workflowId })

    try {
      // Step 1: URL Validation
      this.updateWorkflowStep(workflow, "validate", { status: "running" })
      const validation = validateUrl(url)
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid URL")
      }
      this.updateWorkflowStep(workflow, "validate", { status: "completed" })

      // Step 2: Website Capture
      this.updateWorkflowStep(workflow, "capture", { status: "running" })
      const captureResult = await captureWebsite(url, options.captureOptions)
      this.updateWorkflowStep(workflow, "capture", {
        status: "completed",
        metadata: {
          screenshotSize: captureResult.screenshot.length,
          buttonsFound: captureResult.domData.buttons.length,
          linksFound: captureResult.domData.links.length,
          formsFound: captureResult.domData.forms.length,
        },
      })

      if (!workflow.result) {
        workflow.result = { capture: captureResult, analysis: {} as CTAInsight, match: null }
      } else {
        workflow.result.capture = captureResult
      }

      // Step 3: CTA Analysis (if not skipped)
      if (!options.skipAnalysis) {
        this.updateWorkflowStep(workflow, "analyze", { status: "running" })

        // Convert screenshot to blob for analysis
        const response = await fetch(captureResult.screenshot)
        const blob = await response.blob()

        const analysisResult = await analyzeCTA({
          image: blob,
          domData: captureResult.domData,
          ...options.analysisOptions,
        })

        this.updateWorkflowStep(workflow, "analyze", {
          status: "completed",
          metadata: {
            confidence: analysisResult.insight.confidence,
            elementType: analysisResult.insight.elementType,
            processingTime: analysisResult.processingTime,
          },
        })

        workflow.result.analysis = analysisResult.insight

        // Step 4: DOM Matching (if not skipped)
        if (!options.skipMatching) {
          this.updateWorkflowStep(workflow, "match", { status: "running" })

          // We need image dimensions for matching - extract from screenshot
          const imageSize = await this.getImageDimensions(captureResult.screenshot)
          const matcher = createCTAMatcher(imageSize)
          const { match, debug } = matcher.findMatchingElement(analysisResult.insight, captureResult.domData)

          this.updateWorkflowStep(workflow, "match", {
            status: "completed",
            metadata: {
              matchFound: !!match,
              matchConfidence: match?.confidence,
              debugCandidates: debug.length,
            },
          })

          workflow.result.match = match
        }
      }

      // Complete workflow
      workflow.status = "completed"
      workflow.completedAt = new Date()
      workflow.totalProcessingTime = workflow.completedAt.getTime() - workflow.createdAt.getTime()

      this.moduleLogger.info(`Workflow completed successfully`, {
        workflowId,
        processingTime: workflow.totalProcessingTime,
      })

      return workflow
    } catch (error) {
      workflow.status = "failed"
      workflow.completedAt = new Date()

      // Mark current running step as failed
      const runningStep = workflow.steps.find((s) => s.status === "running")
      if (runningStep) {
        this.updateWorkflowStep(workflow, runningStep.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }

      this.moduleLogger.error(`Workflow failed`, error as Error, { workflowId })
      throw error
    }
  }

  async executeBatchWorkflow(options: BatchWorkflowOptions): Promise<BatchWorkflowResult> {
    const batchId = this.generateWorkflowId()
    const startTime = new Date()
    const concurrency = options.concurrency || 3
    const delay = options.delayBetweenRequests || 1000

    this.moduleLogger.info(`Starting batch workflow`, {
      batchId,
      totalUrls: options.urls.length,
      concurrency,
    })

    const results: CaptureAnalysisWorkflow[] = []
    const failed: string[] = []

    // Process URLs in batches
    for (let i = 0; i < options.urls.length; i += concurrency) {
      const batch = options.urls.slice(i, i + concurrency)

      const batchPromises = batch.map(async (url, index) => {
        try {
          // Add delay between requests to avoid rate limiting
          if (i > 0 || index > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay))
          }

          return await this.executeWorkflow(url, options)
        } catch (error) {
          this.moduleLogger.error(`Batch workflow failed for URL: ${url}`, error as Error)
          failed.push(url)
          return null
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          results.push(result.value)
        }
      })

      // Progress logging
      this.moduleLogger.info(`Batch progress`, {
        batchId,
        completed: results.length,
        failed: failed.length,
        total: options.urls.length,
      })
    }

    const endTime = new Date()
    const batchResult: BatchWorkflowResult = {
      id: batchId,
      totalUrls: options.urls.length,
      completed: results.length,
      failed: failed.length,
      results,
      startTime,
      endTime,
      totalProcessingTime: endTime.getTime() - startTime.getTime(),
    }

    this.moduleLogger.info(`Batch workflow completed`, {
      batchId,
      totalProcessingTime: batchResult.totalProcessingTime,
      successRate: `${Math.round((results.length / options.urls.length) * 100)}%`,
    })

    return batchResult
  }

  getWorkflow(workflowId: string): CaptureAnalysisWorkflow | undefined {
    return this.workflows.get(workflowId)
  }

  getAllWorkflows(): CaptureAnalysisWorkflow[] {
    return Array.from(this.workflows.values())
  }

  clearCompletedWorkflows(): void {
    for (const [id, workflow] of this.workflows.entries()) {
      if (workflow.status === "completed" || workflow.status === "failed") {
        this.workflows.delete(id)
      }
    }
  }

  private async getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        // Server-side - return default dimensions
        resolve({ width: 1920, height: 1080 })
        return
      }

      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => {
        reject(new Error("Failed to load image for dimension calculation"))
      }
      img.src = dataUrl
    })
  }
}

// Export singleton instance
export const workflowOrchestrator = new WorkflowOrchestrator()
