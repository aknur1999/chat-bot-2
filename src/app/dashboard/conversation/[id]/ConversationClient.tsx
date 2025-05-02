'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ImageIcon, Mic } from 'lucide-react'
import { AudioRecordingIndicator } from '@/components/AudioRecordingIndicator'
import NextImage from 'next/image'

interface Message {
  id: string
  created_at: string
  user_id: string
  conversation_id: string
  content: string
  isUser: boolean
  is_image: boolean
  image_url?: string
}

interface ConversationClientProps {
  conversationId: string
}

export default function ConversationClient({ conversationId }: ConversationClientProps) {
  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [model, setModel] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' })
    }
  }, [messagesEndRef])

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  const fetchMessages = useCallback(async (conversationId: string) => {
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
  }, [scrollToBottom]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        fetchMessages(conversationId)
        fetchConversationModel(conversationId)
      }
    }

    getUser()
  }, [router, conversationId, fetchMessages, scrollToBottom])

  const fetchConversationModel = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('model')
      .eq('id', conversationId)
      .single()

    if (error) {
      console.error('Error fetching conversation model:', error)
      return
    }

    if (data?.model) {
      setModel(data.model)
    }
  }

  // Function to get AI response from API
  const getAIResponse = async (message: string, messageHistory: Message[], apiModel: string = model, imageUrl?: string | null): Promise<string> => {
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
            content: msg.content,
            is_image: msg.is_image
          })),
          conversationId,
          model: apiModel,
          imageUrl
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error response:', errorData);
        throw new Error(`Failed to get AI response: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error getting AI response:', error);
      return `Sorry, I encountered an error processing your request. ${error instanceof Error ? error.message : ''}`;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);

    try {
      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload the file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      // Set the uploaded image URL to state
      setUploadedImageUrl(urlData.publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if either text message or image is available
    if ((!newMessage.trim() && !uploadedImageUrl) || !user) return;
    
    setIsSubmitting(true);
    
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

      // Get content
      const content = newMessage.trim();
      const hasText = content.length > 0;
      const hasImage = !!uploadedImageUrl;

      // If using audio model, switch to a compatible model for API request
      let apiModel = model;
      if (model === 'gpt-4o-mini-audio-preview' && !hasImage) {
        // When no image is present, we can use the audio model directly
        // The text response will come from our chat API which uses regular text completions
        // Audio processing (recording/transcription) is handled separately via the /api/audio endpoint
        apiModel = model;
      } else if (model === 'gpt-4o-mini-audio-preview' && hasImage) {
        // If image is present, we need to switch to a vision-capable model
        apiModel = 'gpt-4.1-mini';
        console.log('Switching from audio model to gpt-4.1-mini for image processing');
      }

      // Insert user message
      const { error: userMsgError } = await supabase
        .from('messages')
        .insert([
          {
            user_id: user.id,
            conversation_id: conversationId,
            content: hasText ? content : (hasImage ? '[Image]' : ''),
            image_url: uploadedImageUrl,
            isUser: true,
            is_image: hasImage && !hasText
          }
        ]);
      
      if (userMsgError) throw userMsgError;
      
      // Fetch the updated messages to include the new user message
      const { data: updatedMessages, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
        
      if (fetchError) throw fetchError;
      
      // Get AI response from API, passing the conversation history
      const promptText = hasImage 
        ? (hasText ? `[Image uploaded] ${content}` : '[Image uploaded]')
        : content;
        
      // Pass the image URL to the AI response function and use the apiModel variable
      const aiResponse = await getAIResponse(promptText, updatedMessages || [], apiModel, uploadedImageUrl);
      
      // Insert AI response to database
      const { error: aiMsgError } = await supabase
        .from('messages')
        .insert([
          {
            user_id: user.id,
            conversation_id: conversationId,
            content: aiResponse,
            isUser: false,
            is_image: false
          }
        ]);
      
      if (aiMsgError) throw aiMsgError;
      
      // Update the conversation title if this is a new conversation
      if (isNew) {
        // Determine an appropriate title based on the message content
        let title;
        if (hasImage && hasText) {
          title = content.substring(0, 30);
          title = title.length < content.length ? `${title}... (with image)` : `${title} (with image)`;
        } else if (hasImage) {
          title = 'Image conversation';
        } else {
          title = content.substring(0, 30);
          title = title.length < content.length ? `${title}...` : title;
        }
        
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
      fetchMessages(conversationId);
      setNewMessage('');
      setUploadedImageUrl(null);
    } catch (error) {
      console.error('Error in conversation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removeUploadedImage = () => {
    setUploadedImageUrl(null);
  };

  const toggleAudioRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      // Start recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try to use WebM with Opus codec first (better compatibility)
      let mimeType = 'audio/webm;codecs=opus';
      
      // Fallback to other formats if not supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';  // Let browser decide
        }
      }
      
      console.log('Using audio MIME type:', mimeType || 'browser default');
      
      const mediaRecorder = new MediaRecorder(stream, 
        mimeType ? { mimeType } : undefined
      );
      
      const audioChunks: BlobPart[] = [];

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', async () => {
        // Create the audio blob
        const audioBlob = new Blob(audioChunks, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        
        console.log('Recording complete. Audio blob created with type:', 
          audioBlob.type, 'size:', audioBlob.size, 'bytes');
        
        try {
          // Convert speech to text and set as message
          await processAudioToText(audioBlob);
        } catch (error) {
          console.error('Error in audio processing:', error);
        } finally {
          // Stop all tracks to release microphone
          stream.getTracks().forEach((track) => track.stop());
        }
      });

      mediaRecorderRef.current = mediaRecorder;
      // Request data in smaller chunks for better handling
      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check your browser permissions.');
    }
  };

  const processAudioToText = async (audioBlob: Blob) => {
    try {
      setIsSubmitting(true);
      console.log('Processing audio: size =', audioBlob.size, 'bytes, type =', audioBlob.type);
      
      // Get file extension from MIME type
      let fileExtension = 'webm';
      if (audioBlob.type.includes('mp4')) {
        fileExtension = 'mp4';
      } else if (audioBlob.type.includes('mp3')) {
        fileExtension = 'mp3';
      } else if (audioBlob.type.includes('wav')) {
        fileExtension = 'wav';
      }
      
      const fileName = `recording.${fileExtension}`;
      console.log('Using filename:', fileName);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName);
      
      console.log('Sending audio to API...');
      const response = await fetch('/api/audio', {
        method: 'POST',
        body: formData,
      });
      
      console.log('API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage = '';
        try {
          const errorData = await response.json();
          console.error('API error details:', errorData);
          errorMessage = errorData.error || errorData.details || response.statusText;
        } catch {
          // If response is not JSON
          const text = await response.text();
          console.error('API error text:', text);
          errorMessage = text || response.statusText;
        }
        throw new Error(`API error: ${errorMessage}`);
      }
      
      const data = await response.json();
      console.log('Transcription result:', data);
      setNewMessage(data.response);
    } catch (error) {
      console.error('Error processing audio:', error);
      alert(`Error processing audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!user || isSubmitting || isUploading) return;
    
    const clipboardItems = e.clipboardData.items;
    const imageItem = Array.from(clipboardItems).find(item => 
      item.type.indexOf('image') !== -1
    );
    
    if (imageItem && model === 'gpt-4.1-mini') {
      e.preventDefault();
      
      try {
        setIsUploading(true);
        
        // Get the image as a blob
        const blob = imageItem.getAsFile();
        if (!blob) return;
        
        // Create a unique file path
        const fileExt = blob.type.split('/')[1] || 'png';
        const fileName = `clipboard_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        // Upload the file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(filePath, blob);
        
        if (uploadError) throw uploadError;
        
        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('chat-images')
          .getPublicUrl(filePath);
        
        // Set the uploaded image URL to state
        setUploadedImageUrl(urlData.publicUrl);
      } catch (error) {
        console.error('Error uploading pasted image:', error);
        alert('Failed to upload pasted image');
      } finally {
        setIsUploading(false);
      }
    }
  }, [user, isSubmitting, isUploading, model]);

  if (!user) {
    return null;
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
                  {message.image_url ? (
                    <div className="mt-2">
                      <NextImage 
                        src={message.image_url} 
                        alt="Uploaded image" 
                        className="max-w-full rounded-md mb-2" 
                        width={300}
                        height={300}
                        style={{ maxHeight: '300px', objectFit: 'contain' }}
                        unoptimized={true}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          console.error('Error loading image in message:', message.id);
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM4ODg4ODgiPkltYWdlIGZhaWxlZCB0byBsb2FkPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                      {message.content && message.content !== '[Image]' && <p className="mt-2">{message.content}</p>}
                    </div>
                  ) : message.is_image ? (
                    <div className="mt-2">
                      <div className="bg-gray-200 rounded-md p-4 text-center text-gray-500">
                        <p>Image unavailable</p>
                      </div>
                    </div>
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
      </div>
      
      {/* Audio recording indicator */}
      <AudioRecordingIndicator isRecording={isRecording} />
      
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t shadow-md">
        <div className="mx-auto max-w-4xl">
          {uploadedImageUrl && (
            <div className="mb-2 relative inline-block">
              <NextImage 
                src={uploadedImageUrl} 
                alt="Upload preview" 
                className="h-20 rounded-md"
                width={80}
                height={80}
                style={{ objectFit: 'contain' }}
                unoptimized={true}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  console.error('Error loading image preview for URL:', uploadedImageUrl);
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjODg4ODg4Ij5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                }}
              />
              <button 
                onClick={removeUploadedImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                title="Remove image"
              >
                ×
              </button>
            </div>
          )}
          <form onSubmit={sendMessage} className="flex gap-2">
            {model === 'gpt-4.1-mini' && (
              <button 
                type="button" 
                onClick={handleImageUpload}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                title="Upload image"
                disabled={isUploading || isSubmitting}
              >
                <ImageIcon size={20} className={`${isUploading ? 'text-gray-400' : 'text-gray-600'}`} />
              </button>
            )}
            {model === 'gpt-4o-mini-audio-preview' && (
              <button 
                type="button" 
                className={`p-2 rounded-md hover:bg-gray-100 transition-colors ${isRecording ? 'bg-red-100' : ''}`}
                title={isRecording ? "Stop recording" : "Record audio"}
                disabled={isSubmitting}
                onClick={toggleAudioRecording}
              >
                <Mic size={20} className={isRecording ? "text-red-600 animate-pulse" : "text-gray-600"} />
              </button>
            )}
            <Input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isUploading ? "Uploading image from clipboard..." : "Type your message here..."}
              className="flex-1"
              disabled={isSubmitting || isUploading}
              onPaste={handlePaste}
            />
            <Button 
              type="submit" 
              disabled={isSubmitting || isUploading || (!newMessage.trim() && !uploadedImageUrl)}
            >
              {isSubmitting ? 'Sending...' : 'Send'}
            </Button>
            
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </form>
        </div>
      </div>
    </div>
  )
} 