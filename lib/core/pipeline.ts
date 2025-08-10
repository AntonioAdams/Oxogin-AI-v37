import type { CaptureResult } from "../contracts/capture"
import type { CTAInsight } from "../contracts/cta"
import { logger } from "../utils/logger"

// Pipeline step interface
export interface PipelineStep<TInput, TOutput> {
  name: string
  execute(input: TInput): Promise<TOutput>
  validate?(input: TInput): boolean
  onError?(error: Error, input: TInput): Promise<TOutput | null>
}

// Pipeline context for passing data between steps
export interface PipelineContext {
  url: string
  startTime: Date
  metadata: Record<string, any>
}

// Pipeline result
export interface PipelineResult<T> {
  success: boolean
  data?: T
  error?: Error
  context: PipelineContext
  stepResults: Array<{
    stepName: string
    success: boolean
    duration: number
    error?: Error
  }>
}

export class Pipeline<TInput, TOutput> {
  private steps: PipelineStep<any, any>[] = []
  private moduleLogger = logger.module("pipeline")

  constructor(private name: string) {}

  addStep<TStepOutput>(
    step: PipelineStep<TInput extends undefined ? any : TInput, TStepOutput>,
  ): Pipeline<TInput, TStepOutput> {
    this.steps.push(step)
    return this as any
  }

  async execute(input: TInput, context?: Partial<PipelineContext>): Promise<PipelineResult<TOutput>> {
    const pipelineContext: PipelineContext = {
      url: "",
      startTime: new Date(),
      metadata: {},
      ...context,
    }

    const stepResults: PipelineResult<TOutput>["stepResults"] = []
    let currentData: any = input

    this.moduleLogger.info(`Starting pipeline: ${this.name}`, {
      stepsCount: this.steps.length,
      context: pipelineContext,
    })

    try {
      for (const step of this.steps) {
        const stepStartTime = Date.now()

        try {
          // Validate input if validator exists
          if (step.validate && !step.validate(currentData)) {
            throw new Error(`Validation failed for step: ${step.name}`)
          }

          this.moduleLogger.debug(`Executing step: ${step.name}`)
          currentData = await step.execute(currentData)

          const duration = Date.now() - stepStartTime
          stepResults.push({
            stepName: step.name,
            success: true,
            duration,
          })

          this.moduleLogger.debug(`Step completed: ${step.name}`, { duration })
        } catch (error) {
          const duration = Date.now() - stepStartTime
          const stepError = error as Error

          stepResults.push({
            stepName: step.name,
            success: false,
            duration,
            error: stepError,
          })

          this.moduleLogger.error(`Step failed: ${step.name}`, stepError, { duration })

          // Try error handler if available
          if (step.onError) {
            try {
              const recoveredData = await step.onError(stepError, currentData)
              if (recoveredData !== null) {
                currentData = recoveredData
                this.moduleLogger.info(`Step recovered: ${step.name}`)
                continue
              }
            } catch (recoveryError) {
              this.moduleLogger.error(`Step recovery failed: ${step.name}`, recoveryError as Error)
            }
          }

          // Pipeline failed
          return {
            success: false,
            error: stepError,
            context: pipelineContext,
            stepResults,
          }
        }
      }

      // Pipeline succeeded
      this.moduleLogger.info(`Pipeline completed: ${this.name}`, {
        totalDuration: Date.now() - pipelineContext.startTime.getTime(),
        stepsCompleted: stepResults.length,
      })

      return {
        success: true,
        data: currentData,
        context: pipelineContext,
        stepResults,
      }
    } catch (error) {
      this.moduleLogger.error(`Pipeline failed: ${this.name}`, error as Error)

      return {
        success: false,
        error: error as Error,
        context: pipelineContext,
        stepResults,
      }
    }
  }
}

// Pre-built pipeline steps
export class CaptureStep implements PipelineStep<string, CaptureResult> {
  name = "capture"

  constructor(private captureWebsite: (url: string) => Promise<CaptureResult>) {}

  validate(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  async execute(url: string): Promise<CaptureResult> {
    return await this.captureWebsite(url)
  }

  async onError(error: Error, url: string): Promise<CaptureResult | null> {
    // Could implement retry logic here
    return null
  }
}

export class AnalysisStep implements PipelineStep<CaptureResult, CTAInsight> {
  name = "analysis"

  constructor(private analyzeCTA: (options: any) => Promise<any>) {}

  async execute(captureResult: CaptureResult): Promise<CTAInsight> {
    const response = await fetch(captureResult.screenshot)
    const blob = await response.blob()

    const result = await this.analyzeCTA({
      image: blob,
      domData: captureResult.domData,
    })

    return result.insight
  }
}

// Pipeline factory for common workflows
export class PipelineFactory {
  static createCaptureAnalysisPipeline(
    captureWebsite: (url: string) => Promise<CaptureResult>,
    analyzeCTA: (options: any) => Promise<any>,
  ): Pipeline<string, { capture: CaptureResult; analysis: CTAInsight }> {
    return new Pipeline<string, any>("capture-analysis").addStep(new CaptureStep(captureWebsite)).addStep({
      name: "analysis",
      async execute(captureResult: CaptureResult) {
        const response = await fetch(captureResult.screenshot)
        const blob = await response.blob()

        const result = await analyzeCTA({
          image: blob,
          domData: captureResult.domData,
        })

        return {
          capture: captureResult,
          analysis: result.insight,
        }
      },
    })
  }
}
