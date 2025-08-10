import sharp from 'sharp'

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

export interface SmartCompressionResult {
  compressedImage: string
  originalSizeKB: number
  compressedSizeKB: number
  compressionRatio: number
  appliedQuality: number
  appliedDimensions: { width: number; height: number }
  warnings: string[]
}

// Size limits for different use cases
export const SIZE_LIMITS = {
  OPENAI_API: 4 * 1024 * 1024, // 4MB for OpenAI API calls
  VERCEL_FUNCTION: 4.5 * 1024 * 1024, // 4.5MB Vercel limit
  SAFE_PAYLOAD: 3 * 1024 * 1024, // 3MB safe limit with JSON overhead
} as const

// Progressive compression settings
const COMPRESSION_LEVELS = [
  { quality: 20, maxWidth: 1200, maxHeight: 1600, name: 'standard' },
  { quality: 15, maxWidth: 1000, maxHeight: 1400, name: 'aggressive' },
  { quality: 10, maxWidth: 800, maxHeight: 1200, name: 'maximum' },
  { quality: 8, maxWidth: 600, maxHeight: 1000, name: 'emergency' },
] as const

export async function compressScreenshot(
  base64Image: string,
  options: CompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 80,
    format = 'jpeg'
  } = options

  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '')
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64')
    
    // Compress image using Sharp
    let sharpInstance = sharp(buffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })

    // Apply format-specific compression
    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality })
        break
      case 'png':
        sharpInstance = sharpInstance.png({ quality })
        break
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality })
        break
    }

    // Compress and convert back to base64
    const compressedBuffer = await sharpInstance.toBuffer()
    const compressedBase64 = compressedBuffer.toString('base64')
    
    // Return with appropriate data URL prefix
    const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp'
    return `data:${mimeType};base64,${compressedBase64}`
  } catch (error) {
    console.error('[Screenshot Compression] Failed to compress image:', error)
    // Return original if compression fails
    return base64Image
  }
}

/**
 * Calculate the size of a base64 string in bytes
 */
function getBase64SizeInBytes(base64String: string): number {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '')
  // Base64 encoding adds ~33% overhead, so actual size is roughly 3/4 of the string length
  return Math.ceil((base64Data.length * 3) / 4)
}

/**
 * Smart compression with progressive quality reduction until size target is met
 */
export async function compressScreenshotSmart(
  base64Image: string,
  deviceType: 'desktop' | 'mobile' = 'desktop',
  targetSizeBytes: number = SIZE_LIMITS.SAFE_PAYLOAD
): Promise<SmartCompressionResult> {
  const originalSizeBytes = getBase64SizeInBytes(base64Image)
  const originalSizeKB = Math.round(originalSizeBytes / 1024)
  const targetSizeKB = Math.round(targetSizeBytes / 1024)
  
  const warnings: string[] = []
  
  // Always log compression info, even in production (critical for debugging payload issues)
  if (typeof window !== 'undefined') {
    console.log(`[Smart Compression] Original: ${originalSizeKB}KB, Target: ${targetSizeKB}KB`)
  } else {
    // Server-side: always log for production debugging
    console.error(`[Smart Compression] Original: ${originalSizeKB}KB, Target: ${targetSizeKB}KB`)
  }

  // If original is already small enough, use standard compression
  if (originalSizeBytes <= targetSizeBytes) {
    const standardOptions: CompressionOptions = deviceType === 'mobile' 
      ? { maxWidth: 800, maxHeight: 1200, quality: 20, format: 'jpeg' }
      : { maxWidth: 1200, maxHeight: 1600, quality: 20, format: 'jpeg' }
    
    const compressed = await compressScreenshot(base64Image, standardOptions)
    const compressedSize = getBase64SizeInBytes(compressed)
    
    return {
      compressedImage: compressed,
      originalSizeKB,
      compressedSizeKB: Math.round(compressedSize / 1024),
      compressionRatio: compressedSize / originalSizeBytes,
      appliedQuality: standardOptions.quality!,
      appliedDimensions: { width: standardOptions.maxWidth!, height: standardOptions.maxHeight! },
      warnings
    }
  }

  // Try progressive compression levels
  for (let i = 0; i < COMPRESSION_LEVELS.length; i++) {
    const level = COMPRESSION_LEVELS[i]
    const options: CompressionOptions = {
      maxWidth: deviceType === 'mobile' ? Math.min(level.maxWidth, 800) : level.maxWidth,
      maxHeight: deviceType === 'mobile' ? Math.min(level.maxHeight, 1200) : level.maxHeight,
      quality: level.quality,
      format: 'jpeg'
    }

    try {
      const compressed = await compressScreenshot(base64Image, options)
      const compressedSize = getBase64SizeInBytes(compressed)
      const compressedSizeKB = Math.round(compressedSize / 1024)
      
      // Always log compression levels, even in production (critical for debugging)
      if (typeof window !== 'undefined') {
        console.log(`[Smart Compression] Level ${level.name}: ${compressedSizeKB}KB (quality: ${level.quality}%)`)
      } else {
        console.error(`[Smart Compression] Level ${level.name}: ${compressedSizeKB}KB (quality: ${level.quality}%)`)
      }

      // Check if this compression level meets our target
      if (compressedSize <= targetSizeBytes) {
        if (i > 0) {
          warnings.push(`Applied ${level.name} compression due to large image size`)
        }
        
        return {
          compressedImage: compressed,
          originalSizeKB,
          compressedSizeKB,
          compressionRatio: compressedSize / originalSizeBytes,
          appliedQuality: level.quality,
          appliedDimensions: { width: options.maxWidth!, height: options.maxHeight! },
          warnings
        }
      }
    } catch (error) {
      console.error(`[Smart Compression] Level ${level.name} failed:`, error)
      continue
    }
  }

  // If all levels failed to meet target, return the most aggressive compression
  warnings.push('Unable to compress below target size - using maximum compression')
  const emergencyLevel = COMPRESSION_LEVELS[COMPRESSION_LEVELS.length - 1]
  const emergencyOptions: CompressionOptions = {
    maxWidth: deviceType === 'mobile' ? 600 : 800,
    maxHeight: deviceType === 'mobile' ? 800 : 1000,
    quality: emergencyLevel.quality,
    format: 'jpeg'
  }

  const compressed = await compressScreenshot(base64Image, emergencyOptions)
  const compressedSize = getBase64SizeInBytes(compressed)
  
  return {
    compressedImage: compressed,
    originalSizeKB,
    compressedSizeKB: Math.round(compressedSize / 1024),
    compressionRatio: compressedSize / originalSizeBytes,
    appliedQuality: emergencyLevel.quality,
    appliedDimensions: { width: emergencyOptions.maxWidth!, height: emergencyOptions.maxHeight! },
    warnings
  }
}

/**
 * Enhanced OpenAI compression with smart size detection
 */
export async function compressScreenshotForOpenAI(
  base64Image: string,
  deviceType: 'desktop' | 'mobile' = 'desktop'
): Promise<string> {
  try {
    const result = await compressScreenshotSmart(base64Image, deviceType, SIZE_LIMITS.SAFE_PAYLOAD)
    
    // Log compression results (always show, even in production)
    const logMessage = `[OpenAI Compression] ${result.originalSizeKB}KB → ${result.compressedSizeKB}KB (${Math.round(result.compressionRatio * 100)}%)`
    if (typeof window !== 'undefined') {
      console.log(logMessage)
    } else {
      console.error(logMessage)
    }
    
    if (result.warnings.length > 0) {
      console.error('[OpenAI Compression] Warnings:', result.warnings)
    }
    
    return result.compressedImage
  } catch (error) {
    console.error('[OpenAI Compression] Smart compression failed, falling back to standard:', error)
    
    // Fallback to original method with more aggressive settings
    const options: CompressionOptions = deviceType === 'mobile' 
      ? { maxWidth: 600, maxHeight: 800, quality: 10, format: 'jpeg' }
      : { maxWidth: 800, maxHeight: 1000, quality: 10, format: 'jpeg' }

    return compressScreenshot(base64Image, options)
  }
}

/**
 * Validate payload size before API calls
 */
export function validatePayloadSize(
  payload: any, 
  limit: number = SIZE_LIMITS.SAFE_PAYLOAD,
  context: string = 'API call'
): { isValid: boolean; sizeKB: number; limitKB: number; error?: string } {
  const payloadString = JSON.stringify(payload)
  const sizeBytes = Buffer.byteLength(payloadString, 'utf8')
  const sizeKB = Math.round(sizeBytes / 1024)
  const limitKB = Math.round(limit / 1024)
  
  // Always log payload validation, even in production (critical for debugging 413 errors)
  if (typeof window !== 'undefined') {
    console.log(`[Payload Validation] ${context}: ${sizeKB}KB (limit: ${limitKB}KB)`)
  } else {
    console.error(`[Payload Validation] ${context}: ${sizeKB}KB (limit: ${limitKB}KB)`)
  }
  
  if (sizeBytes > limit) {
    const error = `Payload too large for ${context}: ${sizeKB}KB exceeds ${limitKB}KB limit`
    console.error(`[Payload Validation] ${error}`)
    return {
      isValid: false,
      sizeKB,
      limitKB,
      error
    }
  }
  
  return {
    isValid: true,
    sizeKB,
    limitKB
  }
}

/**
 * Handle oversized payload with fallback strategies
 */
export async function handleOversizedPayload(
  originalScreenshot: string,
  deviceType: 'desktop' | 'mobile' = 'desktop',
  context: string = 'API call'
): Promise<{ 
  compressedScreenshot: string; 
  applied: string; 
  warnings: string[] 
}> {
  const warnings: string[] = []
  
  console.error(`[Payload Recovery] Attempting emergency compression for ${context}`)
  
  // Emergency compression levels (more aggressive than standard)
  const emergencyLevels = [
    { quality: 8, maxWidth: 600, maxHeight: 800, name: 'emergency-8%' },
    { quality: 5, maxWidth: 500, maxHeight: 700, name: 'emergency-5%' },
    { quality: 3, maxWidth: 400, maxHeight: 600, name: 'emergency-3%' },
  ]
  
  for (const level of emergencyLevels) {
    try {
      const options = {
        maxWidth: deviceType === 'mobile' ? Math.min(level.maxWidth, 500) : level.maxWidth,
        maxHeight: deviceType === 'mobile' ? Math.min(level.maxHeight, 700) : level.maxHeight,
        quality: level.quality,
        format: 'jpeg' as const,
      }
      
      const emergencyCompressed = await compressScreenshot(originalScreenshot, options)
      const testPayload = { screenshot: emergencyCompressed, context }
      const validation = validatePayloadSize(testPayload, SIZE_LIMITS.SAFE_PAYLOAD, `${context} (${level.name})`)
      
      if (validation.isValid) {
        warnings.push(`Applied ${level.name} emergency compression due to payload size`)
        warnings.push(`Quality significantly reduced to ensure successful API call`)
        
        return {
          compressedScreenshot: emergencyCompressed,
          applied: level.name,
          warnings
        }
      }
    } catch (error) {
      console.error(`[Payload Recovery] Emergency level ${level.name} failed:`, error)
      continue
    }
  }
  
  // If all emergency levels fail, return a fallback error payload
  warnings.push('All compression attempts failed - analysis may be skipped')
  warnings.push('Consider analyzing a smaller section of the page')
  
  return {
    compressedScreenshot: originalScreenshot,
    applied: 'none',
    warnings
  }
}

/**
 * Create a graceful error response for payload issues
 */
export function createPayloadErrorResponse(
  validation: { sizeKB: number; limitKB: number; error?: string },
  context: string = 'analysis'
): any {
  return {
    success: false,
    error: 'payload_too_large',
    message: `Unable to process ${context} due to large screenshot size`,
    details: {
      actualSizeKB: validation.sizeKB,
      limitKB: validation.limitKB,
      suggestions: [
        'The screenshot is too complex or large for processing',
        'Try analyzing a simpler page or specific section',
        'Consider reducing browser window size before capture',
        'Contact support if this issue persists'
      ]
    },
    fallback: {
      recommendation: 'Skip AI analysis for this capture and proceed with prediction data',
      hasBasicAnalysis: true
    }
  }
}

 