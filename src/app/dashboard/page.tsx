'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import Link from 'next/link'

interface Message {
  id: string
  created_at: string
  user_id: string
  conversation_id: string
  content: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        fetchMessages(user.id)
      }
    }

    getUser()
  }, [router])

  const fetchMessages = async (userId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching messages:', error)
      return
    }

    setMessages(data || [])
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>
        
        <div className="mt-8 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Welcome, {user.email}</h2>
          <p className="mt-2 text-gray-600">
            You are now logged in to your account.
          </p>
        </div>

        <div className="mt-8 rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Messages</h2>
          {messages.length === 0 ? (
            <p className="text-gray-600">No messages found.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <Link 
                  key={message.id} 
                  href={`/dashboard/conversation/${message.conversation_id}`}
                  className="block border-b pb-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-sm text-gray-500">
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                    <span className="text-sm text-gray-500">
                      Conversation ID: {message.conversation_id}
                    </span>
                  </div>
                  <p className="mt-2">{message.content}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 