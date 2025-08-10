// Size limits for client-side validation (matching server-side)
export const CLIENT_SIZE_LIMITS = {
  SAFE_PAYLOAD: 3 * 1024 * 1024, // 3MB safe limit with JSON overhead
  VERCEL_FUNCTION: 4.5 * 1024 * 1024, // 4.5MB Vercel limit
} as const

// Progressive compression levels for client-side
const CLIENT_COMPRESSION_LEVELS = [
  { quality: 0.2, maxWidth: 1200, maxHeight: 1600, name: 'standard' },
  { quality: 0.15, maxWidth: 1000, maxHeight: 1400, name: 'aggressive' },
  { quality: 0.1, maxWidth: 800, maxHeight: 1200, name: 'maximum' },
  { quality: 0.08, maxWidth: 600, maxHeight: 1000, name: 'emergency' },
] as const

/**
 * Calculate the size of a base64 string in bytes (client-side)
 */
function getClientBase64SizeInBytes(base64String: string): number {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '')
  // Base64 encoding adds ~33% overhead, so actual size is roughly 3/4 of the string length
  return Math.ceil((base64Data.length * 3) / 4)
}

/**
 * Smart client-side compression with progressive quality reduction
 */
export async function compressScreenshotClientSmart(
  base64Image: string,
  deviceType: 'desktop' | 'mobile' = 'desktop',
  targetSizeBytes: number = CLIENT_SIZE_LIMITS.SAFE_PAYLOAD
): Promise<{
  compressedImage: string
  originalSizeKB: number
  compressedSizeKB: number
  compressionRatio: number
  appliedQuality: number
  warnings: string[]
}> {
  const originalSizeBytes = getClientBase64SizeInBytes(base64Image)
  const originalSizeKB = Math.round(originalSizeBytes / 1024)
  const targetSizeKB = Math.round(targetSizeBytes / 1024)
  
  const warnings: string[] = []
  
  console.log(`[Client Smart Compression] Original: ${originalSizeKB}KB, Target: ${targetSizeKB}KB`)

  try {
    // Create image element
    const img = new Image()
    img.crossOrigin = "anonymous"
    
    // Load the image using the original base64 data
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = base64Image
    })
    
    // If original is already small enough, use standard compression
    if (originalSizeBytes <= targetSizeBytes) {
      const result = await compressWithLevel(img, deviceType, CLIENT_COMPRESSION_LEVELS[0])
      return {
        ...result,
        originalSizeKB,
        warnings
      }
    }

    // Try progressive compression levels
    for (let i = 0; i < CLIENT_COMPRESSION_LEVELS.length; i++) {
      const level = CLIENT_COMPRESSION_LEVELS[i]
      
      try {
        const result = await compressWithLevel(img, deviceType, level)
        const compressedSize = getClientBase64SizeInBytes(result.compressedImage)
        const compressedSizeKB = Math.round(compressedSize / 1024)
        
        console.log(`[Client Smart Compression] Level ${level.name}: ${compressedSizeKB}KB (quality: ${Math.round(level.quality * 100)}%)`)

        // Check if this compression level meets our target
        if (compressedSize <= targetSizeBytes) {
          if (i > 0) {
            warnings.push(`Applied ${level.name} compression due to large image size`)
          }
          
          return {
            compressedImage: result.compressedImage,
            originalSizeKB,
            compressedSizeKB,
            compressionRatio: compressedSize / originalSizeBytes,
            appliedQuality: Math.round(level.quality * 100),
            warnings
          }
        }
      } catch (error) {
        console.warn(`[Client Smart Compression] Level ${level.name} failed:`, error)
        continue
      }
    }

    // If all levels failed to meet target, return the most aggressive compression
    warnings.push('Unable to compress below target size - using maximum compression')
    const emergencyLevel = CLIENT_COMPRESSION_LEVELS[CLIENT_COMPRESSION_LEVELS.length - 1]
    const result = await compressWithLevel(img, deviceType, emergencyLevel)
    const compressedSize = getClientBase64SizeInBytes(result.compressedImage)
    
    return {
      compressedImage: result.compressedImage,
      originalSizeKB,
      compressedSizeKB: Math.round(compressedSize / 1024),
      compressionRatio: compressedSize / originalSizeBytes,
      appliedQuality: Math.round(emergencyLevel.quality * 100),
      warnings
    }
  } catch (error) {
    console.error('[Client Smart Compression] Failed:', error)
    // Return original if all compression attempts fail
    return {
      compressedImage: base64Image,
      originalSizeKB,
      compressedSizeKB: originalSizeKB,
      compressionRatio: 1,
      appliedQuality: 100,
      warnings: ['Compression failed - using original image']
    }
  }
}

/**
 * Helper function to compress with a specific level
 */
async function compressWithLevel(
  img: HTMLImageElement,
  deviceType: 'desktop' | 'mobile',
  level: typeof CLIENT_COMPRESSION_LEVELS[0]
): Promise<{ compressedImage: string }> {
  // Create canvas for compression
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  
  if (!ctx) {
    throw new Error("Could not get canvas context")
  }
  
  // Calculate new dimensions based on device type and compression level
  const maxWidth = deviceType === 'mobile' ? Math.min(level.maxWidth, 800) : level.maxWidth
  const maxHeight = deviceType === 'mobile' ? Math.min(level.maxHeight, 1200) : level.maxHeight
  
  // Calculate scale to fit within max dimensions while maintaining aspect ratio
  const scaleX = maxWidth / img.width
  const scaleY = maxHeight / img.height
  const scale = Math.min(1, scaleX, scaleY)
  
  canvas.width = img.width * scale
  canvas.height = img.height * scale
  
  // Draw and compress the image
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  
  // Convert to JPEG with specified quality
  const compressedDataUrl = canvas.toDataURL("image/jpeg", level.quality)
  
  return { compressedImage: compressedDataUrl }
}

// Enhanced client-side compression function with smart detection
export async function compressScreenshotClient(
  base64Image: string,
  deviceType: 'desktop' | 'mobile' = 'desktop'
): Promise<string> {
  try {
    const result = await compressScreenshotClientSmart(base64Image, deviceType, CLIENT_SIZE_LIMITS.SAFE_PAYLOAD)
    
    // Log compression results
    console.log(`[Client Compression] ${result.originalSizeKB}KB → ${result.compressedSizeKB}KB (${Math.round(result.compressionRatio * 100)}%)`)
    
    if (result.warnings.length > 0) {
      console.warn('[Client Compression] Warnings:', result.warnings)
    }
    
    return result.compressedImage
  } catch (error) {
    console.error('[Client Compression] Smart compression failed, falling back to basic:', error)
    
    // Fallback to basic compression if smart compression fails
    return await basicCompression(base64Image, deviceType)
  }
}

/**
 * Basic fallback compression function
 */
async function basicCompression(
  base64Image: string,
  deviceType: 'desktop' | 'mobile' = 'desktop'
): Promise<string> {
  try {
    // Create image element
    const img = new Image()
    img.crossOrigin = "anonymous"
    
    // Load the image using the original base64 data
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = base64Image
    })
    
    // Create canvas for compression
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    
    if (!ctx) {
      throw new Error("Could not get canvas context")
    }
    
    // More aggressive fallback settings
    const maxWidth = deviceType === 'mobile' ? 600 : 800
    const maxHeight = deviceType === 'mobile' ? 800 : 1000
    
    // Calculate scale to fit within max dimensions while maintaining aspect ratio
    const scaleX = maxWidth / img.width
    const scaleY = maxHeight / img.height
    const scale = Math.min(1, scaleX, scaleY)
    
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    
    // Draw and compress the image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    
    // Convert to JPEG with very low quality for emergency compression
    const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.08)
    
    return compressedDataUrl
  } catch (error) {
    console.warn('[Client Basic Compression] Failed to compress image:', error)
    // Return original if compression fails
    return base64Image
  }
}