"use client"

import { useState, useEffect } from "react"

interface ViewportInfo {
  width: number
  height: number
  isSmallHeight: boolean
  isVerySmallHeight: boolean
  isLandscapeMobile: boolean
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}

/**
 * Hook to get responsive viewport information for dynamic layout adjustments
 * Specifically helps with height-based responsiveness for better UX
 */
export function useViewportResponsive(): ViewportInfo {
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
    width: 0,
    height: 0,
    isSmallHeight: false,
    isVerySmallHeight: false,
    isLandscapeMobile: false,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
  })

  useEffect(() => {
    const updateViewportInfo = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      // Height classifications
      const isSmallHeight = height <= 600
      const isVerySmallHeight = height <= 500
      const isLandscapeMobile = height <= 500 && width > height
      
      // Width classifications
      const isMobile = width < 768
      const isTablet = width >= 768 && width < 1024
      const isDesktop = width >= 1024

      setViewportInfo({
        width,
        height,
        isSmallHeight,
        isVerySmallHeight,
        isLandscapeMobile,
        isMobile,
        isTablet,
        isDesktop,
      })
    }

    // Initial check
    updateViewportInfo()

    // Add event listeners
    window.addEventListener('resize', updateViewportInfo)
    window.addEventListener('orientationchange', updateViewportInfo)

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateViewportInfo)
      window.removeEventListener('orientationchange', updateViewportInfo)
    }
  }, [])

  return viewportInfo
}

/**
 * Hook to get dynamic CSS classes based on viewport
 */
export function useResponsiveClasses() {
  const viewport = useViewportResponsive()
  
  const getResponsiveClasses = () => {
    const classes = []
    
    if (viewport.isSmallHeight) classes.push('compact-height')
    if (viewport.isVerySmallHeight) classes.push('ultra-compact')
    if (viewport.isLandscapeMobile) classes.push('landscape-mobile')
    
    return classes.join(' ')
  }
  
  const shouldHideOnSmallHeight = () => viewport.isVerySmallHeight
  
  const getCompactSpacing = () => {
    if (viewport.isVerySmallHeight) return 'p-1 space-y-1'
    if (viewport.isSmallHeight) return 'p-2 space-y-2'
    return 'p-3 sm:p-4 space-y-3 sm:space-y-4'
  }
  
  return {
    viewport,
    getResponsiveClasses,
    shouldHideOnSmallHeight,
    getCompactSpacing,
  }
}
