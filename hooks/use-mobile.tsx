"use client"

import { useState, useEffect } from "react"

/**
 * Hook to detect if the current device is mobile
 * Uses a combination of screen width and user agent detection
 */
export function useMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      // Primary check: screen width
      const isSmallScreen = window.innerWidth < breakpoint
      
      // Secondary check: user agent (for more accurate mobile detection)
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      
      // Touch capability check
      const hasTouchCapability = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      // Combine checks - mobile if small screen OR (mobile user agent AND touch capable)
      const isMobileDevice = isSmallScreen || (isMobileUserAgent && hasTouchCapability)
      
      setIsMobile(isMobileDevice)
    }

    // Check on mount
    checkMobile()

    // Add event listener for window resize
    window.addEventListener('resize', checkMobile)
    
    // Add event listener for orientation change (mobile devices)
    window.addEventListener('orientationchange', checkMobile)

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile)
      window.removeEventListener('orientationchange', checkMobile)
    }
  }, [breakpoint])

  return isMobile
}

/**
 * Hook to get device orientation
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')

  useEffect(() => {
    const checkOrientation = () => {
      if (window.innerHeight > window.innerWidth) {
        setOrientation('portrait')
      } else {
        setOrientation('landscape')
      }
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  return orientation
}

/**
 * Hook to get viewport dimensions
 */
export function useViewport() {
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
    }
  }, [])

  return viewport
}