import React from 'react'
import ConversationClient from './ConversationClient'

// This is a server component
export default function ConversationPage({ params }: { params: { id: string } }) {
  // Properly unwrap params in the server component
  const conversationId = React.use(Promise.resolve(params)).id
  
  // Pass the unwrapped ID to the client component
  return <ConversationClient conversationId={conversationId} />
} 