'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Try to find the latest conversation for the user
        const { data: latestConversation, error: convError } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        if (convError && convError.code !== 'PGRST116') {
          // PGRST116 is "Results contain 0 rows" - this is fine, we'll redirect to dashboard
          console.error('Error fetching latest conversation:', convError)
          router.push('/dashboard')
          return
        }

        if (latestConversation) {
          // Redirect to the latest conversation
          router.push(`/dashboard/conversation/${latestConversation.id}`)
        } else {
          // If no conversations exist, redirect to dashboard
          router.push('/dashboard')
        }
      } else {
        // Not logged in, redirect to login page
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  // Loading state while checking auth
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-pulse">Loading...</div>
    </div>
  )
}
