import React from 'react'
import ConversationClient from './ConversationClient'

// This is a server component
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  // Get the conversation ID from the params promise
  const { id: conversationId } = await params
  
  // Pass the ID to the client component
  return <ConversationClient conversationId={conversationId} />
} 