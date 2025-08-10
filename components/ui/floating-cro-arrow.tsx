"use client"

import { useState, useEffect } from "react"
import { ChevronDown } from "lucide-react"

interface FloatingCROArrowProps {
  targetId?: string
}

export function FloatingCROArrow({ targetId = "cro-results" }: FloatingCROArrowProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const checkVisibility = () => {
      // Get the current scroll position
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      
      // Check if the CRO section is in view
      const targetElement = document.getElementById(targetId)
      let isTargetInView = false
      
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect()
        // Check if the CRO section is visible in the viewport (with some buffer)
        // Show arrow until the CRO section is fully in view
        isTargetInView = rect.top < windowHeight * 0.8 && rect.bottom > 0
      }
      
      // Show arrow when:
      // 1. User is at the top of the page, OR
      // 2. CRO section is not yet in view
      const shouldShow = scrollY < 200 || !isTargetInView
      
      setIsVisible(shouldShow)
    }

    // Check visibility on scroll and resize
    const handleScroll = () => checkVisibility()
    const handleResize = () => checkVisibility()

    // Initial check
    checkVisibility()

    // Add event listeners
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleResize, { passive: true })

    // Cleanup
    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleResize)
    }
  }, [targetId])

  const scrollToCROBrief = () => {
    const targetElement = document.getElementById(targetId)
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    } else {
      // Fallback: scroll to bottom of page
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth"
      })
    }
  }

  if (!isVisible) {
    return null
  }

  return (
    <button
      onClick={scrollToCROBrief}
      className="group relative bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 animate-bounce"
              aria-label="Scroll to Click Prediction Report"
      style={{
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
      }}
    >
      {/* Pulsing notification dot */}
      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse">
        <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
      </div>

      {/* Arrow icon */}
      <ChevronDown className="w-6 h-6" />

      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
        View Click Report
        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </button>
  )
}
