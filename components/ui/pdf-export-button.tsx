"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { FileDown } from "lucide-react"
import { exportAnalysisToPDF, prepareAnalysisForPDF } from "@/lib/utils/pdf-export"
import { toast } from "sonner"
import { debugLogCategory } from "@/lib/utils/logger"

interface PDFExportButtonProps {
  analysisElementId?: string
  filename?: string
  variant?: 'default' | 'sidebar'
  className?: string
}

export function PDFExportButton({
  analysisElementId = "analysis-content",
  filename,
  variant = 'default',
  className = ''
}: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleExport = async () => {
    if (!isClient) {
      toast.error("PDF export is not available during server-side rendering")
      return
    }

    setIsExporting(true)
    
    try {
      // Find the analysis content element - check for active tab first
      let analysisElement = document.getElementById(analysisElementId)
      
      // If not found, try to find any analysis-content element
      if (!analysisElement) {
        const allAnalysisElements = document.querySelectorAll(`[id="${analysisElementId}"]`)
        if (allAnalysisElements.length > 0) {
          // Use the first available one
          analysisElement = allAnalysisElements[0] as HTMLElement
        }
      }
      
      // If still not found, try to find elements with analysis-content in their class or data attributes
      if (!analysisElement) {
        const alternativeElements = document.querySelectorAll('[class*="analysis"], [data-analysis], .analysis-content')
        if (alternativeElements.length > 0) {
          analysisElement = alternativeElements[0] as HTMLElement
        }
      }
      
      if (!analysisElement) {
        throw new Error("Analysis content not found. Please ensure you have completed an analysis and the content is visible.")
      }

      // Check if the element has any content
      if (!analysisElement.innerHTML.trim()) {
        throw new Error("Analysis content is empty. Please ensure the analysis has been completed.")
      }

      // Debug: Log the content being exported
      debugLogCategory("PDF Export", "Debug:", {
        elementFound: !!analysisElement,
        elementId: analysisElement.id,
        elementClasses: analysisElement.className,
        contentLength: analysisElement.innerHTML.length,
        hasContent: analysisElement.innerHTML.trim().length > 0,
        contentPreview: analysisElement.innerHTML.substring(0, 200) + '...'
      })

      // Prepare the analysis for PDF export
      const pdfElement = prepareAnalysisForPDF(analysisElement)
      
      // Temporarily add to DOM for rendering
      pdfElement.style.position = 'absolute'
      pdfElement.style.left = '-9999px'
      pdfElement.style.top = '-9999px'
      pdfElement.style.width = '800px'
      pdfElement.style.backgroundColor = 'white'
      pdfElement.style.zIndex = '-9999'
      document.body.appendChild(pdfElement)

      // Wait for any dynamic content to render
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Generate filename with timestamp if not provided
      const defaultFilename = filename || `oxogin-analysis-${new Date().toISOString().split('T')[0]}.pdf`

      // Export to PDF using the new implementation
      await exportAnalysisToPDF(pdfElement, {
        filename: defaultFilename,
        pageSize: 'a4',
        orientation: 'portrait',
        margin: 15,
        imageQuality: 0.9
      })

      // Clean up
      if (document.body.contains(pdfElement)) {
        document.body.removeChild(pdfElement)
      }
      
      toast.success("PDF exported successfully!", {
        description: "Your analysis report has been downloaded."
      })

    } catch (error) {
      console.error("PDF export error:", error)
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "Please try again."
      })
    } finally {
      setIsExporting(false)
    }
  }

  if (!isClient) {
    return null
  }

  if (variant === 'sidebar') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
        className={`w-full justify-start gap-2 text-sm font-normal ${className}`}
      >
        <FileDown className="h-4 w-4" />
        {isExporting ? 'Exporting...' : 'Export to PDF'}
      </Button>
    )
  }

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      className={className}
    >
      <FileDown className="h-4 w-4 mr-2" />
      {isExporting ? 'Exporting...' : 'Export to PDF'}
    </Button>
  )
} 