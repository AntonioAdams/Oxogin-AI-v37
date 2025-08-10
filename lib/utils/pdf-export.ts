import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface PDFExportOptions {
  filename?: string
  pageSize?: 'a4' | 'letter' | 'legal'
  orientation?: 'portrait' | 'landscape'
  margin?: number
  imageQuality?: number
}

export const exportAnalysisToPDF = async (
  element: HTMLElement,
  options: PDFExportOptions = {}
): Promise<void> => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('PDF export is only available in the browser')
  }

  const {
    filename = 'oxogin-analysis.pdf',
    pageSize = 'a4',
    orientation = 'portrait',
    margin = 20,
    imageQuality = 1.0
  } = options

  try {
    // Create a clean clone of the element for PDF export
    const clone = element.cloneNode(true) as HTMLElement
    
    // Apply comprehensive PDF-specific styling for better quality
    clone.style.cssText = `
      background-color: white !important;
      color: black !important;
      font-family: Arial, sans-serif !important;
      line-height: 1.6 !important;
      margin: 0 !important;
      padding: 30px !important;
      width: 1000px !important;
      position: relative !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      box-sizing: border-box !important;
      transform: none !important;
      font-size: 14px !important;
    `
    
    // Remove any interactive elements and floating components
    const elementsToRemove = clone.querySelectorAll(
      'button, .floating-cro-arrow, .floating-anchor-button, [data-interactive], .capture-notification'
    )
    elementsToRemove.forEach(el => el.remove())
    
    // Ensure all hidden elements are visible for PDF export
    const hiddenElements = clone.querySelectorAll('[class*="hidden"], [style*="display: none"], [style*="visibility: hidden"]')
    hiddenElements.forEach(el => {
      const element = el as HTMLElement
      element.style.cssText += `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      `
    })
    
    // Ensure all content is visible
    const allElements = clone.querySelectorAll('*')
    allElements.forEach(el => {
      const element = el as HTMLElement
      if (element.style) {
        // Remove any display: none or visibility: hidden
        if (element.style.display === 'none') {
          element.style.display = 'block'
        }
        if (element.style.visibility === 'hidden') {
          element.style.visibility = 'visible'
        }
      }
    })
    
    // Enhanced image handling for better quality
    const images = clone.querySelectorAll('img')
    images.forEach(img => {
      img.style.cssText += `
        max-width: 100% !important;
        height: auto !important;
        display: block !important;
        margin: 20px 0 !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 8px !important;
        image-rendering: -webkit-optimize-contrast !important;
        image-rendering: crisp-edges !important;
      `
      // Ensure images load at full quality
      if (img.complete) {
        img.style.width = img.naturalWidth + 'px'
        img.style.height = img.naturalHeight + 'px'
      }
    })
    
    // Enhanced card styling for better PDF layout
    const cards = clone.querySelectorAll('[class*="card"], [class*="Card"]')
    cards.forEach(card => {
      const cardElement = card as HTMLElement
      cardElement.style.cssText += `
        margin-bottom: 25px !important;
        page-break-inside: avoid !important;
        page-break-before: auto !important;
        page-break-after: auto !important;
        background-color: white !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 12px !important;
        padding: 20px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        break-inside: avoid !important;
      `
    })
    
    // Enhanced heading styling
    const headings = clone.querySelectorAll('h1, h2, h3, h4, h5, h6')
    headings.forEach(heading => {
      const headingElement = heading as HTMLElement
      headingElement.style.cssText += `
        color: #1f2937 !important;
        margin-top: 25px !important;
        margin-bottom: 15px !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        font-weight: bold !important;
      `
    })
    
    // Enhanced paragraph styling
    const paragraphs = clone.querySelectorAll('p')
    paragraphs.forEach(p => {
      const pElement = p as HTMLElement
      pElement.style.cssText += `
        margin-bottom: 12px !important;
        line-height: 1.7 !important;
        text-align: justify !important;
      `
    })
    
    // Enhanced list styling
    const lists = clone.querySelectorAll('ul, ol')
    lists.forEach(list => {
      const listElement = list as HTMLElement
      listElement.style.cssText += `
        margin-bottom: 20px !important;
        padding-left: 25px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      `
    })
    
    // Enhanced list item styling
    const listItems = clone.querySelectorAll('li')
    listItems.forEach(li => {
      const liElement = li as HTMLElement
      liElement.style.cssText += `
        margin-bottom: 8px !important;
        line-height: 1.6 !important;
      `
    })
    
    // Enhanced badge and button styling
    const badges = clone.querySelectorAll('[class*="badge"], [class*="Badge"]')
    badges.forEach(badge => {
      const badgeElement = badge as HTMLElement
      badgeElement.style.cssText += `
        margin: 2px 4px !important;
        padding: 4px 8px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        display: inline-block !important;
      `
    })
    
    // Add the clone to the DOM temporarily for proper rendering
    clone.style.position = 'absolute'
    clone.style.left = '-9999px'
    clone.style.top = '-9999px'
    clone.style.zIndex = '-9999'
    document.body.appendChild(clone)
    
    // Wait for any dynamic content to render and images to load
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Convert the element to canvas using html2canvas with enhanced settings
    const canvas = await html2canvas(clone, {
      scale: 3, // Higher scale for better quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 1000,
      height: undefined,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1000,
      windowHeight: 1500,
      logging: false,
      removeContainer: false,
      foreignObjectRendering: false,
      imageTimeout: 15000, // Longer timeout for images
      onclone: (clonedDoc) => {
        // Additional processing on the cloned document
        const clonedElement = clonedDoc.body.firstChild as HTMLElement
        if (clonedElement) {
          // Ensure all images are loaded at full quality
          const images = clonedElement.querySelectorAll('img')
          images.forEach(img => {
            if (img.complete && img.naturalWidth > 0) {
              img.style.width = img.naturalWidth + 'px'
              img.style.height = img.naturalHeight + 'px'
            }
          })
        }
      }
    })
    
    // Clean up the temporary element
    if (document.body.contains(clone)) {
      document.body.removeChild(clone)
    }
    
    // Calculate PDF dimensions with better proportions
    const pdfWidth = 210 // A4 width in mm
    const pdfHeight = 297 // A4 height in mm
    const marginMM = margin
    const contentWidth = pdfWidth - (marginMM * 2)
    const contentHeight = pdfHeight - (marginMM * 2)
    
    // Calculate image dimensions maintaining aspect ratio
    const imgWidth = contentWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    
    // Create PDF with better settings
    const pdf = new jsPDF('p', 'mm', 'a4')
    
    // Add image to PDF with better quality settings
    const imgData = canvas.toDataURL('image/png', imageQuality)
    
    // Handle multi-page content with better page breaks
    let heightLeft = imgHeight
    let position = 0
    let pageNumber = 1
    
    while (heightLeft >= 0) {
      // Add image to current page
      pdf.addImage(imgData, 'PNG', marginMM, position, imgWidth, imgHeight)
      
      // Add page number if not the first page
      if (pageNumber > 1) {
        pdf.setFontSize(10)
        pdf.setTextColor(128, 128, 128)
        pdf.text(`Page ${pageNumber}`, pdfWidth / 2, pdfHeight - 10, { align: 'center' })
      }
      
      heightLeft -= contentHeight
      
      if (heightLeft >= 0) {
        pdf.addPage()
        position = heightLeft - imgHeight
        pageNumber++
      }
    }
    
    // Save the PDF
    pdf.save(filename)
    
  } catch (error) {
    console.error('PDF export failed:', error)
    throw new Error('Failed to export PDF. Please try again.')
  }
}

export const prepareAnalysisForPDF = (analysisElement: HTMLElement): HTMLElement => {
  // Create a clean version of the analysis for PDF export
  const pdfContainer = document.createElement('div')
  pdfContainer.className = 'pdf-export-container'
  pdfContainer.style.cssText = `
    background-color: white !important;
    color: black !important;
    font-family: Arial, sans-serif !important;
    line-height: 1.6 !important;
    margin: 0 !important;
    padding: 30px !important;
    width: 1000px !important;
    box-sizing: border-box !important;
    font-size: 14px !important;
  `
  
  // Add professional header
  const header = document.createElement('div')
  header.innerHTML = `
    <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #3b82f6; padding-bottom: 25px;">
      <h1 style="color: #1f2937; font-size: 32px; margin: 0 0 15px 0; font-weight: bold;">Oxogin AI Analysis Report</h1>
      <p style="color: #6b7280; font-size: 16px; margin: 0 0 10px 0;">Professional Website Conversion Rate Optimization Analysis</p>
      <p style="color: #9ca3af; font-size: 14px; margin: 0;">Generated on ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
    </div>
  `
  pdfContainer.appendChild(header)
  
  // Clone the analysis content
  const analysisClone = analysisElement.cloneNode(true) as HTMLElement
  
  // Clean up the cloned content for PDF
  const elementsToRemove = analysisClone.querySelectorAll(
    'button, .floating-cro-arrow, .floating-anchor-button, [data-interactive], .capture-notification'
  )
  elementsToRemove.forEach(el => el.remove())
  
  // Apply PDF-friendly styling to the cloned content
  analysisClone.style.cssText = `
    background-color: white !important;
    color: black !important;
    font-family: Arial, sans-serif !important;
    line-height: 1.6 !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    box-sizing: border-box !important;
    font-size: 14px !important;
  `
  
  // Ensure all hidden elements are visible for PDF export
  const hiddenElements = analysisClone.querySelectorAll('[class*="hidden"], [style*="display: none"], [style*="visibility: hidden"]')
  hiddenElements.forEach(el => {
    const element = el as HTMLElement
    element.style.cssText += `
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    `
  })
  
  // Ensure all content is visible
  const allElements = analysisClone.querySelectorAll('*')
  allElements.forEach(el => {
    const element = el as HTMLElement
    if (element.style) {
      // Remove any display: none or visibility: hidden
      if (element.style.display === 'none') {
        element.style.display = 'block'
      }
      if (element.style.visibility === 'hidden') {
        element.style.visibility = 'visible'
      }
    }
  })
  
  // Enhanced card styling for better PDF layout
  const cards = analysisClone.querySelectorAll('[class*="card"], [class*="Card"]')
  cards.forEach(card => {
    const cardElement = card as HTMLElement
    if (cardElement.style) {
      cardElement.style.cssText += `
        margin-bottom: 25px !important;
        page-break-inside: avoid !important;
        page-break-before: auto !important;
        page-break-after: auto !important;
        background-color: white !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 12px !important;
        padding: 20px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        break-inside: avoid !important;
      `
    }
  })
  
  // Enhanced image handling
  const images = analysisClone.querySelectorAll('img')
  images.forEach(img => {
    img.style.cssText += `
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 20px 0 !important;
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      image-rendering: -webkit-optimize-contrast !important;
      image-rendering: crisp-edges !important;
    `
  })
  
  // Enhanced heading styling
  const headings = analysisClone.querySelectorAll('h1, h2, h3, h4, h5, h6')
  headings.forEach(heading => {
    const headingElement = heading as HTMLElement
    headingElement.style.cssText += `
      color: #1f2937 !important;
      margin-top: 25px !important;
      margin-bottom: 15px !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      font-weight: bold !important;
    `
  })
  
  // Enhanced paragraph styling
  const paragraphs = analysisClone.querySelectorAll('p')
  paragraphs.forEach(p => {
    const pElement = p as HTMLElement
    pElement.style.cssText += `
      margin-bottom: 12px !important;
      line-height: 1.7 !important;
      text-align: justify !important;
    `
  })
  
  // Enhanced list styling
  const lists = analysisClone.querySelectorAll('ul, ol')
  lists.forEach(list => {
    const listElement = list as HTMLElement
    listElement.style.cssText += `
      margin-bottom: 20px !important;
      padding-left: 25px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    `
  })
  
  // Enhanced list item styling
  const listItems = analysisClone.querySelectorAll('li')
  listItems.forEach(li => {
    const liElement = li as HTMLElement
    liElement.style.cssText += `
      margin-bottom: 8px !important;
      line-height: 1.6 !important;
    `
  })
  
  // Enhanced badge and button styling
  const badges = analysisClone.querySelectorAll('[class*="badge"], [class*="Badge"]')
  badges.forEach(badge => {
    const badgeElement = badge as HTMLElement
    badgeElement.style.cssText += `
      margin: 2px 4px !important;
      padding: 4px 8px !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      display: inline-block !important;
    `
  })
  
  // Enhanced table styling
  const tables = analysisClone.querySelectorAll('table')
  tables.forEach(table => {
    const tableElement = table as HTMLElement
    tableElement.style.cssText += `
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 20px 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    `
  })
  
  // Enhanced table cell styling
  const tableCells = analysisClone.querySelectorAll('td, th')
  tableCells.forEach(cell => {
    const cellElement = cell as HTMLElement
    cellElement.style.cssText += `
      border: 1px solid #e5e7eb !important;
      padding: 8px 12px !important;
      text-align: left !important;
      vertical-align: top !important;
    `
  })
  
  pdfContainer.appendChild(analysisClone)
  
  return pdfContainer
} 