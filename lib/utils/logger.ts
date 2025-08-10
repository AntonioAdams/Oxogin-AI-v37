// Consolidated logging utility with multiple adapters
export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  module?: string
  metadata?: Record<string, any>
  error?: Error
}

export interface LoggerAdapter {
  log(entry: LogEntry): void | Promise<void>
}

export interface LoggerConfig {
  level: LogLevel
  adapters: LoggerAdapter[]
  enableTimestamps?: boolean
  enableModuleNames?: boolean
}

// Console Logger Adapter
export class ConsoleLoggerAdapter implements LoggerAdapter {
  private colors = {
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m", // Green
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    reset: "\x1b[0m", // Reset
  }

  log(entry: LogEntry): void {
    const color = this.colors[entry.level]
    const reset = this.colors.reset
    const timestamp = entry.timestamp.toISOString()
    const module = entry.module ? `[${entry.module}]` : ""
    const level = entry.level.toUpperCase().padEnd(5)

    let message = `${color}[${level}]${reset} ${timestamp} ${module} ${entry.message}`

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.message}`
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`
      }
    }

    const logMethod =
      entry.level === "error"
        ? console.error
        : entry.level === "warn"
          ? console.warn
          : entry.level === "debug"
            ? console.debug
            : console.log

    logMethod(message)
  }
}

// Main Logger Class
class ModularLogger {
  private config: LoggerConfig
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: process.env.NODE_ENV === "production" ? "error" : "info", // Only errors in production
      adapters: [new ConsoleLoggerAdapter()],
      enableTimestamps: true,
      enableModuleNames: true,
      ...config,
    }
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log errors
    if (process.env.NODE_ENV === "production") {
      return level === "error"
    }
    return this.levelPriority[level] >= this.levelPriority[this.config.level]
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    module?: string,
    metadata?: Record<string, any>,
    error?: Error,
  ): LogEntry {
    return {
      timestamp: new Date(),
      level,
      message,
      module,
      metadata,
      error,
    }
  }

  private async logEntry(entry: LogEntry): Promise<void> {
    if (!this.shouldLog(entry.level)) return

    const promises = this.config.adapters.map((adapter) => {
      try {
        return adapter.log(entry)
      } catch (error) {
        console.error("Logger adapter failed:", error)
      }
    })

    await Promise.allSettled(promises)
  }

  debug(message: string, module?: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry("debug", message, module, metadata)
    this.logEntry(entry)
  }

  info(message: string, module?: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry("info", message, module, metadata)
    this.logEntry(entry)
  }

  warn(message: string, module?: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry("warn", message, module, metadata)
    this.logEntry(entry)
  }

  error(message: string, error?: Error, module?: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry("error", message, module, metadata, error)
    this.logEntry(entry)
  }

  // Module-specific logger factory
  module(moduleName: string) {
    return {
      debug: (message: string, metadata?: Record<string, any>) => this.debug(message, moduleName, metadata),
      info: (message: string, metadata?: Record<string, any>) => this.info(message, moduleName, metadata),
      warn: (message: string, metadata?: Record<string, any>) => this.warn(message, moduleName, metadata),
      error: (message: string, error?: Error, metadata?: Record<string, any>) =>
        this.error(message, error, moduleName, metadata),
    }
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.config.level = level
  }

  addAdapter(adapter: LoggerAdapter): void {
    this.config.adapters.push(adapter)
  }

  removeAdapter(adapter: LoggerAdapter): void {
    const index = this.config.adapters.indexOf(adapter)
    if (index > -1) {
      this.config.adapters.splice(index, 1)
    }
  }
}

// Create and export default logger instance
export const logger = new ModularLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "error", // Only errors in production
})

// Legacy compatibility
export const createLogger = (moduleName: string) => logger.module(moduleName)

// Simple logging interface for backward compatibility
export interface Logger {
  info(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  debug(message: string, ...args: any[]): void
}

// Debug utility function that only logs in development
export const debugLog = (message: string, ...args: any[]): void => {
  if (process.env.NODE_ENV === "development") {
    console.log(message, ...args)
  }
}

// Debug utility function for specific debug categories
export const debugLogCategory = (category: string, message: string, ...args: any[]): void => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[${category}] ${message}`, ...args)
  }
}
