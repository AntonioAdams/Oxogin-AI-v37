"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth/context"

interface HeapProviderProps {
  children: React.ReactNode
}

export function HeapProvider({ children }: HeapProviderProps) {
  const { user } = useAuth()

  useEffect(() => {
    // Wait for Heap to be ready
    const waitForHeap = () => {
      if (typeof window !== "undefined" && (window as any).heap) {
        return Promise.resolve((window as any).heap)
      }
      
      return new Promise<void>((resolve) => {
        const checkHeap = () => {
          if (typeof window !== "undefined" && (window as any).heap) {
            resolve()
          } else {
            setTimeout(checkHeap, 100)
          }
        }
        checkHeap()
      })
    }

    const identifyUser = async () => {
      try {
        await waitForHeap()
        const heap = (window as any).heap
        
        if (user) {
          // Identify the authenticated user with their unique ID
          heap.identify(user.id)
          
          // Add user properties for better segmentation
          heap.addUserProperties({
            'Email': user.email || 'unknown',
            'User ID': user.id,
            'Created At': user.created_at,
            'Last Sign In': user.last_sign_in_at,
            'Email Confirmed': user.email_confirmed_at ? 'Yes' : 'No',
            'User Type': 'authenticated'
          })
          
          console.log('✅ Heap: Authenticated user identified', {
            userId: user.id,
            email: user.email
          })
        } else {
          // For anonymous users, create a persistent anonymous ID
          let anonymousId = localStorage.getItem('heap_anonymous_id')
          
          if (!anonymousId) {
            // Generate a unique anonymous ID
            anonymousId = 'anon_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
            localStorage.setItem('heap_anonymous_id', anonymousId)
          }
          
          // Identify anonymous user with persistent ID
          heap.identify(anonymousId)
          
          // Add anonymous user properties
          heap.addUserProperties({
            'User Type': 'anonymous',
            'Anonymous ID': anonymousId,
            'First Visit': localStorage.getItem('heap_first_visit') || new Date().toISOString(),
            'Session Count': parseInt(localStorage.getItem('heap_session_count') || '0') + 1
          })
          
          // Update session count
          const sessionCount = parseInt(localStorage.getItem('heap_session_count') || '0') + 1
          localStorage.setItem('heap_session_count', sessionCount.toString())
          
          // Set first visit if not already set
          if (!localStorage.getItem('heap_first_visit')) {
            localStorage.setItem('heap_first_visit', new Date().toISOString())
          }
          
          console.log('✅ Heap: Anonymous user identified', {
            anonymousId,
            sessionCount
          })
        }
      } catch (error) {
        console.error('❌ Heap: Error identifying user:', error)
      }
    }

    identifyUser()
  }, [user])

  return <>{children}</>
} 