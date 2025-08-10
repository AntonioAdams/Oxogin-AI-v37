"use client"

import { useCallback } from "react"

interface HeapEvent {
  [key: string]: any
}

export function useHeapAnalytics() {
  const getCurrentUserId = useCallback(() => {
    if (typeof window !== "undefined") {
      // Check if user is authenticated (you can modify this based on your auth state)
      const isAuthenticated = document.cookie.includes('auth') || localStorage.getItem('user_id')
      
      if (isAuthenticated) {
        return localStorage.getItem('user_id') || 'authenticated_user'
      } else {
        // Return anonymous ID for tracking
        return localStorage.getItem('heap_anonymous_id') || 'anonymous_user'
      }
    }
    return 'unknown_user'
  }, [])

  const trackEvent = useCallback((eventName: string, properties?: HeapEvent) => {
    if (typeof window !== "undefined" && (window as any).heap) {
      try {
        const enhancedProperties = {
          ...properties,
          userId: getCurrentUserId(),
          userType: localStorage.getItem('heap_anonymous_id') ? 'anonymous' : 'authenticated',
          timestamp: new Date().toISOString()
        }
        
        (window as any).heap.track(eventName, enhancedProperties)
        console.log(`📊 Heap: Tracked event "${eventName}"`, enhancedProperties)
      } catch (error) {
        console.error(`❌ Heap: Error tracking event "${eventName}"`, error)
      }
    }
  }, [getCurrentUserId])

  const addUserProperties = useCallback((properties: HeapEvent) => {
    if (typeof window !== "undefined" && (window as any).heap) {
      try {
        (window as any).heap.addUserProperties(properties)
        console.log('📊 Heap: Added user properties', properties)
      } catch (error) {
        console.error('❌ Heap: Error adding user properties', error)
      }
    }
  }, [])

  const identify = useCallback((userId: string) => {
    if (typeof window !== "undefined" && (window as any).heap) {
      try {
        (window as any).heap.identify(userId)
        console.log('📊 Heap: Identified user', userId)
      } catch (error) {
        console.error('❌ Heap: Error identifying user', error)
      }
    }
  }, [])

  const resetIdentity = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).heap) {
      try {
        (window as any).heap.resetIdentity()
        console.log('📊 Heap: Reset identity')
      } catch (error) {
        console.error('❌ Heap: Error resetting identity', error)
      }
    }
  }, [])

  return {
    trackEvent,
    addUserProperties,
    identify,
    resetIdentity,
    getCurrentUserId
  }
} 