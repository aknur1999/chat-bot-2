'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Message {
  id: string
  created_at: string
  user_id: string
  conversation_id: string
  content: string
  isUser: boolean
}

interface ConversationClientProps {
  conversationId: string
}

export default function ConversationClient({ conversationId }: ConversationClientProps) {
  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        fetchMessages(conversationId)
      }
    }

    getUser()
  }, [router, conversationId])

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return
    }

    setMessages(data || [])
    // Scroll to bottom immediately on first load
    setTimeout(() => scrollToBottom('auto'), 100)
  }

  // Function to get AI response from API
  const getAIResponse = async (message: string, messageHistory: Message[]): Promise<string> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message,
          history: messageHistory.map(msg => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.content
          }))
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }
      
      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error getting AI response:', error);
      return 'Sorry, I encountered an error processing your request.';
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !user) return
    
    setIsSubmitting(true)
    
    try {
      // Check if this is the first message by fetching current conversation
      let isNew = false;
      if (messages.length === 0) {
        const { data: conversationData } = await supabase
          .from('conversations')
          .select('title')
          .eq('id', conversationId)
          .single();
          
        // Check if this is a new conversation with default title
        isNew = conversationData?.title === 'New Conversation';
      }

      // Insert user message
      const { error: userMsgError } = await supabase
        .from('messages')
        .insert([
          {
            user_id: user.id,
            conversation_id: conversationId,
            content: newMessage.trim(),
            isUser: true
          }
        ])
      
      if (userMsgError) throw userMsgError
      
      // Fetch the updated messages to include the new user message
      const { data: updatedMessages, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
        
      if (fetchError) throw fetchError;
      
      // Get AI response from API, passing the conversation history
      const aiResponse = await getAIResponse(newMessage.trim(), updatedMessages || []);
      
      // Insert AI response to database
      const { error: aiMsgError } = await supabase
        .from('messages')
        .insert([
          {
            user_id: user.id,
            conversation_id: conversationId,
            content: aiResponse,
            isUser: false
          }
        ])
      
      if (aiMsgError) throw aiMsgError
      
      // Update the conversation title if this is a new conversation
      if (isNew) {
        // Limit title length to first 30 characters for readability
        const titleText = newMessage.trim().substring(0, 30);
        // Add ellipsis if message was truncated
        const title = titleText.length < newMessage.trim().length ? `${titleText}...` : titleText;
        
        console.log('Updating conversation title to:', title);
        
        // Update the conversation title in the database
        const { error: titleError } = await supabase
          .from('conversations')
          .update({ title })
          .eq('id', conversationId);
          
        if (titleError) {
          console.error('Error updating conversation title:', titleError);
        }
        
        // Manually trigger an event to immediately update the UI
        // This works because Supabase broadcast channel names follow this pattern
        supabase.channel('realtime-updates').send({
          type: 'broadcast',
          event: 'postgres_changes',
          topic: 'public:conversations',
          payload: {
            type: 'UPDATE',
            table: 'conversations',
            schema: 'public',
            commit_timestamp: new Date().toISOString(),
            new: { id: conversationId, title }
          }
        });
      }
      
      // Refetch messages to update the UI
      fetchMessages(conversationId)
      setNewMessage('')
    } catch (error) {
      console.error('Error in conversation:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="mx-auto max-w-4xl w-full flex-1 p-8 overflow-y-auto h-[calc(100vh-8rem)]">
          {messages.length === 0 ? (
            <p className="text-gray-600">No messages in this conversation.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`p-4 rounded-lg mb-4 ${message.isUser 
                    ? 'bg-blue-100 ml-auto max-w-[80%]' 
                    : 'bg-gray-100 mr-auto max-w-[80%]'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-semibold">
                      {message.isUser ? 'You' : 'AI Assistant'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p>{message.content}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
      </div>
      
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t shadow-md">
        <div className="mx-auto max-w-4xl">
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message here..."
              className="flex-1"
              disabled={isSubmitting}
            />
            <Button type="submit" disabled={isSubmitting || !newMessage.trim()}>
              {isSubmitting ? 'Sending...' : 'Send'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
} 