export interface CaptureOptions {
  url: string
  timeout?: number
  width?: number
  height?: number
  foldLinePosition?: number
  isMobile?: boolean
}

export interface ElementCoordinates {
  x: number
  y: number
  width: number
  height: number
}

export interface ButtonData {
  text: string
  type: string
  className: string
  id: string
  isVisible: boolean
  isAboveFold: boolean
  formAction: string | null
  distanceFromTop: number
  coordinates: ElementCoordinates
}

export interface LinkData {
  text: string
  href: string
  className: string
  id: string
  isVisible: boolean
  isAboveFold: boolean
  hasButtonStyling: boolean
  distanceFromTop: number
  coordinates: ElementCoordinates
}

export interface FormData {
  action: string
  method: string
  inputs: number
  inputTypes: string[]
  hasSubmitButton: boolean
  submitButtonText: string
  isAboveFold: boolean
  distanceFromTop: number
  coordinates: ElementCoordinates
}

export interface FormFieldData {
  type: string
  name: string
  value: string
  required: boolean
  coordinates: ElementCoordinates
  attributes: Record<string, string>
}

export interface HeadingData {
  text: string
  level: number
  className: string
  id: string
  isVisible: boolean
  isAboveFold: boolean
  distanceFromTop: number
  coordinates: ElementCoordinates
}

export interface TextData {
  text: string
  tagName: string
  className: string
  id: string
  isVisible: boolean
  isAboveFold: boolean
  distanceFromTop: number
  coordinates: ElementCoordinates
  wordCount: number
}

export interface ImageData {
  src: string
  alt: string
  className: string
  id: string
  isVisible: boolean
  isAboveFold: boolean
  distanceFromTop: number
  coordinates: ElementCoordinates
  hasLazyLoading: boolean
}

export interface VideoData {
  src: string
  poster?: string
  className: string
  id: string
  isVisible: boolean
  isAboveFold: boolean
  distanceFromTop: number
  coordinates: ElementCoordinates
  hasControls: boolean
  isAutoplay: boolean
}

export interface FoldLineMetrics {
  position: number
  aboveFoldButtons: number
  belowFoldButtons: number
  aboveFoldLinks: number
  belowFoldLinks: number
  aboveFoldHeadings: number
  belowFoldHeadings: number
  aboveFoldImages: number
  belowFoldImages: number
  aboveFoldVideos: number
  belowFoldVideos: number
  aboveFoldTextBlocks: number
  belowFoldTextBlocks: number
}

export interface DOMData {
  title: string
  description: string
  url: string
  buttons: ButtonData[]
  links: LinkData[]
  forms: FormData[]
  formFields?: FormFieldData[]
  headings: HeadingData[]
  textBlocks: TextData[]
  images: ImageData[]
  videos: VideoData[]
  foldLine: FoldLineMetrics
}

export interface CaptureResult {
  screenshot: string
  domData: DOMData
  synchronized: boolean
  timestamp: string
  isMobile?: boolean
}
