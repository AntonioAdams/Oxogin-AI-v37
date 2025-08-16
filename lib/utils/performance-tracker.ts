// Comprehensive Performance Tracking Utility
// This helps identify bottlenecks and timing issues throughout the loading process

interface PerformanceMetric {
  id: string
  name: string
  startTime: number
  endTime?: number
  duration?: number
  category: 'capture' | 'analysis' | 'api' | 'ui' | 'network'
  deviceType?: 'desktop' | 'mobile' | 'both'
  metadata?: Record<string, any>
}

interface PerformanceSession {
  sessionId: string
  url: string
  startTime: number
  endTime?: number
  totalDuration?: number
  metrics: PerformanceMetric[]
  summary: {
    totalSteps: number
    completedSteps: number
    failedSteps: number
    slowestStep?: PerformanceMetric
    fastestStep?: PerformanceMetric
    averageStepTime: number
  }
}

class PerformanceTracker {
  private currentSession: PerformanceSession | null = null
  private activeMetrics: Map<string, PerformanceMetric> = new Map()

  /**
   * Start a new performance tracking session
   */
  startSession(url: string, sessionId?: string): string {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.currentSession = {
      sessionId: id,
      url,
      startTime: Date.now(),
      metrics: [],
      summary: {
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        averageStepTime: 0
      }
    }

    console.log(`🔍 [PERF-TRACKER] 🚀 Started performance session:`, {
      sessionId: id,
      url,
      timestamp: new Date().toISOString()
    })

    return id
  }

  /**
   * Start tracking a specific metric
   */
  startMetric(
    id: string, 
    name: string, 
    category: PerformanceMetric['category'], 
    deviceType?: PerformanceMetric['deviceType'],
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id,
      name,
      startTime: Date.now(),
      category,
      deviceType,
      metadata
    }

    this.activeMetrics.set(id, metric)
    
    console.log(`🔍 [PERF-TRACKER] ⏱️ Started ${category} metric:`, {
      id,
      name,
      deviceType,
      timestamp: new Date().toISOString(),
      metadata
    })
  }

  /**
   * End tracking a specific metric
   */
  endMetric(id: string, success: boolean = true, additionalMetadata?: Record<string, any>): PerformanceMetric | null {
    const metric = this.activeMetrics.get(id)
    if (!metric) {
      console.warn(`🔍 [PERF-TRACKER] ⚠️ Metric not found: ${id}`)
      return null
    }

    const endTime = Date.now()
    const duration = endTime - metric.startTime
    
    const completedMetric: PerformanceMetric = {
      ...metric,
      endTime,
      duration,
      metadata: { ...metric.metadata, success, ...additionalMetadata }
    }

    // Remove from active and add to session
    this.activeMetrics.delete(id)
    if (this.currentSession) {
      this.currentSession.metrics.push(completedMetric)
    }

    console.log(`🔍 [PERF-TRACKER] ✅ Completed ${metric.category} metric:`, {
      id,
      name: metric.name,
      duration: duration + 'ms',
      success,
      deviceType: metric.deviceType,
      timestamp: new Date().toISOString(),
      additionalMetadata
    })

    return completedMetric
  }

  /**
   * End the current performance session
   */
  endSession(): PerformanceSession | null {
    if (!this.currentSession) {
      console.warn(`🔍 [PERF-TRACKER] ⚠️ No active session to end`)
      return null
    }

    const endTime = Date.now()
    const totalDuration = endTime - this.currentSession.startTime

    // Complete any remaining active metrics
    for (const [id, metric] of this.activeMetrics) {
      this.endMetric(id, false, { reason: 'session_ended_early' })
    }

    // Calculate summary
    const completedMetrics = this.currentSession.metrics.filter(m => m.duration !== undefined)
    const failedMetrics = this.currentSession.metrics.filter(m => m.metadata?.success === false)
    
    let slowestStep: PerformanceMetric | undefined
    let fastestStep: PerformanceMetric | undefined
    
    if (completedMetrics.length > 0) {
      slowestStep = completedMetrics.reduce((max, current) => 
        (current.duration || 0) > (max.duration || 0) ? current : max
      )
      fastestStep = completedMetrics.reduce((min, current) => 
        (current.duration || 0) < (min.duration || 0) ? current : min
      )
    }

    const averageStepTime = completedMetrics.length > 0 
      ? completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / completedMetrics.length 
      : 0

    const finalSession: PerformanceSession = {
      ...this.currentSession,
      endTime,
      totalDuration,
      summary: {
        totalSteps: this.currentSession.metrics.length,
        completedSteps: completedMetrics.length,
        failedSteps: failedMetrics.length,
        slowestStep,
        fastestStep,
        averageStepTime
      }
    }

    console.log(`🔍 [PERF-TRACKER] 🏁 Session completed:`, {
      sessionId: finalSession.sessionId,
      url: finalSession.url,
      totalDuration: totalDuration + 'ms',
      totalSteps: finalSession.summary.totalSteps,
      completedSteps: finalSession.summary.completedSteps,
      failedSteps: finalSession.summary.failedSteps,
      averageStepTime: Math.round(finalSession.summary.averageStepTime) + 'ms',
      slowestStep: slowestStep ? `${slowestStep.name} (${slowestStep.duration}ms)` : 'N/A',
      fastestStep: fastestStep ? `${fastestStep.name} (${fastestStep.duration}ms)` : 'N/A',
      timestamp: new Date().toISOString()
    })

    // Detailed breakdown by category
    const categories = ['capture', 'analysis', 'api', 'ui', 'network'] as const
    categories.forEach(category => {
      const categoryMetrics = completedMetrics.filter(m => m.category === category)
      if (categoryMetrics.length > 0) {
        const categoryTotal = categoryMetrics.reduce((sum, m) => sum + (m.duration || 0), 0)
        const categoryAverage = categoryTotal / categoryMetrics.length
        
        console.log(`🔍 [PERF-TRACKER] 📊 ${category.toUpperCase()} Performance:`, {
          count: categoryMetrics.length,
          totalTime: categoryTotal + 'ms',
          averageTime: Math.round(categoryAverage) + 'ms',
          percentage: Math.round((categoryTotal / totalDuration) * 100) + '%',
          steps: categoryMetrics.map(m => `${m.name}: ${m.duration}ms`)
        })
      }
    })

    this.currentSession = null
    return finalSession
  }

  /**
   * Get current session status
   */
  getCurrentSession(): PerformanceSession | null {
    return this.currentSession
  }

  /**
   * Get active metrics
   */
  getActiveMetrics(): PerformanceMetric[] {
    return Array.from(this.activeMetrics.values())
  }

  /**
   * Log a quick metric (start and end immediately)
   */
  logQuickMetric(
    name: string, 
    category: PerformanceMetric['category'],
    duration: number,
    deviceType?: PerformanceMetric['deviceType'],
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id: `quick_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      startTime: Date.now() - duration,
      endTime: Date.now(),
      duration,
      category,
      deviceType,
      metadata: { ...metadata, quickMetric: true }
    }

    if (this.currentSession) {
      this.currentSession.metrics.push(metric)
    }

    console.log(`🔍 [PERF-TRACKER] ⚡ Quick ${category} metric:`, {
      name,
      duration: duration + 'ms',
      deviceType,
      timestamp: new Date().toISOString(),
      metadata
    })
  }
}

// Global performance tracker instance
export const performanceTracker = new PerformanceTracker()

// Convenience functions for common metrics
export const trackCapture = (deviceType: 'desktop' | 'mobile', url: string) => {
  const id = `capture_${deviceType}_${Date.now()}`
  performanceTracker.startMetric(id, `${deviceType} Capture`, 'capture', deviceType, { url })
  return () => performanceTracker.endMetric(id)
}

export const trackAnalysis = (deviceType: 'desktop' | 'mobile', analysisType: string) => {
  const id = `analysis_${deviceType}_${analysisType}_${Date.now()}`
  performanceTracker.startMetric(id, `${deviceType} ${analysisType}`, 'analysis', deviceType)
  return () => performanceTracker.endMetric(id)
}

export const trackAPICall = (endpoint: string, deviceType?: 'desktop' | 'mobile') => {
  const id = `api_${endpoint}_${Date.now()}`
  performanceTracker.startMetric(id, `API ${endpoint}`, 'api', deviceType, { endpoint })
  return () => performanceTracker.endMetric(id)
}

export const trackUIUpdate = (component: string, operation: string) => {
  const id = `ui_${component}_${operation}_${Date.now()}`
  performanceTracker.startMetric(id, `${component} ${operation}`, 'ui')
  return () => performanceTracker.endMetric(id)
}

export const trackNetworkRequest = (url: string, method: string = 'GET') => {
  const id = `network_${method}_${Date.now()}`
  performanceTracker.startMetric(id, `${method} ${url}`, 'network', undefined, { url, method })
  return () => performanceTracker.endMetric(id)
}

// Enhanced logging utilities
export const logPerformanceWarning = (message: string, threshold: number, actual: number, context?: Record<string, any>) => {
  if (actual > threshold) {
    console.warn(`🔍 [PERF-WARNING] ⚠️ ${message}`, {
      threshold: threshold + 'ms',
      actual: actual + 'ms',
      slowness: `${Math.round((actual / threshold) * 100)}% of threshold`,
      context,
      timestamp: new Date().toISOString()
    })
  }
}

export const logPerformanceInfo = (message: string, timing: number, context?: Record<string, any>) => {
  console.log(`🔍 [PERF-INFO] ℹ️ ${message}`, {
    timing: timing + 'ms',
    context,
    timestamp: new Date().toISOString()
  })
}

