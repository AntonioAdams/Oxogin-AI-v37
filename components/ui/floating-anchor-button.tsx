"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface FloatingAnchorButtonProps {
  targetId?: string
  className?: string
  showScrollToTop?: boolean
}

export function FloatingAnchorButton({
  targetId = "cro-results",
  className,
  showScrollToTop = true,
}: FloatingAnchorButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      
      // Show button when user scrolls down a bit
      setIsVisible(scrollY > 200)
      
      // Check if user is near bottom
      const isNearBottom = scrollY + windowHeight >= documentHeight - 100
      setIsAtBottom(isNearBottom)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToBottom = () => {
    const targetElement = document.getElementById(targetId)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" })
    } else {
      // Fallback: scroll to bottom of page
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      })
    }
  }

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  if (!isVisible) return null

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-40 flex flex-col gap-2",
      className
    )}>
      {showScrollToTop && isAtBottom && (
        <Button
          onClick={scrollToTop}
          size="sm"
          className="h-10 w-10 rounded-full bg-gray-800 hover:bg-gray-700 text-white shadow-lg transition-all duration-200 hover:scale-105"
          title="Scroll to top"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
      
      {!isAtBottom && (
        <Button
          onClick={scrollToBottom}
          size="sm"
          className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-200 hover:scale-105"
          title="View CRO results"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
} 