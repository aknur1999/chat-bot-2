import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Check if the API key is set
if (!process.env.OPENAI_API_KEY) {
  console.error('Missing environment variable: OPENAI_API_KEY');
  throw new Error('Missing environment variable: OPENAI_API_KEY');
}

// Create a new OpenAI instance with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define message types
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  is_image?: boolean;
}

export async function POST(request: Request) {
  try {
    const { message, history = [], conversationId, imageUrl, model: requestModel } = await request.json();
    
    console.log('API request received:', { 
      messageLength: message?.length, 
      historyLength: history?.length, 
      conversationId,
      hasImage: !!imageUrl,
      requestModel
    });
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get the conversation to determine which model to use
    let model = 'gpt-3.5-turbo'; // Default model
    
    // Use the model specified in the request if provided
    if (requestModel) {
      model = requestModel;
    } else if (conversationId) {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('model')
        .eq('id', conversationId)
        .single();
      
      if (!error && conversation?.model) {
        model = conversation.model;
      }
    }
    
    // Build messages array with system message, history and the current message
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...history.map((msg: Message) => {
        // Handle image messages in history
        if (msg.role === 'user' && msg.content === '[Image uploaded]' && msg.is_image) {
          return {
            role: 'user',
            content: 'I uploaded an image but it cannot be shown in this history.'
          };
        }
        return msg;
      }),
      { role: 'user', content: message }
    ];
    
    // Check if we need to use GPT-4 Vision API for image input
    if (imageUrl && model === 'gpt-4.1-mini') {
      // Extract text content if it exists alongside the image
      const textContent = message.startsWith('[Image uploaded]') 
        ? message.replace('[Image uploaded]', '').trim() 
        : '';
        
      try {
        // Use GPT-4.1-mini for vision tasks
        const response = await openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that can see images.' },
            ...history.map((msg: Message) => {
              // Handle image messages in history
              if (msg.role === 'user' && msg.is_image) {
                return {
                  role: 'user',
                  content: 'I uploaded an image but it cannot be shown in this history.'
                };
              }
              return msg;
            }),
            {
              role: 'user',
              content: [
                { 
                  type: 'text', 
                  text: textContent 
                    ? `This is the image I want to discuss with the following comment: ${textContent}` 
                    : 'Please analyze this image' 
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl }
                }
              ]
            }
          ],
          response_format: {
            type: "text"
          },
          temperature: 1,
          max_tokens: 2048,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });
        
        const aiResponse = response.choices[0]?.message?.content || 
          'Sorry, I could not analyze the image.';
          
        return NextResponse.json({ response: aiResponse });
      } catch (error) {
        console.error('Error in Vision API:', error);
        // Fallback to regular completion if Vision API fails
        return NextResponse.json({ 
          response: `I'm sorry, I couldn't process the image. ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    } else if (model === 'gpt-4o-audio-preview-2024-12-17' || model === 'gpt-4o-mini-audio-preview') {
      // For the audio model in chat context (without actual audio input)
      // We use a direct fetch to have more control over the API parameters
      try {
        const payload = {
          model: model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
          modalities: ['text', 'audio'],  // Include audio modality
          audio: {
            voice: 'alloy',
            format: 'pcm16'
          }
        };
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('OpenAI API error:', errorData);
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('OpenAI API response:', data.choices[0].message.audio.transcript);
        const aiResponse = data.choices[0]?.message?.audio?.transcript || 
          'Sorry, I could not generate a response.';
          
        return NextResponse.json({ response: aiResponse });
      } catch (error) {
        console.error('Error with audio model:', error);
        // Fallback to regular model if the audio model fails
        return NextResponse.json({ 
          response: `I'm sorry, there was an issue with processing your request with the audio model. ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    } else {
      // Regular text completion
      const response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      });
      
      const aiResponse = response.choices[0]?.message?.content || 
        'Sorry, I could not generate a response.';
        
      return NextResponse.json({ response: aiResponse });
    }
  } catch (error) {
    console.error('Error in chat API:', error);
    // Provide more detailed error information
    const errorMessage = error instanceof Error 
      ? `${error.name}: ${error.message}` 
      : 'Unknown error occurred';
    
    console.error('Error details:', errorMessage);
    
    return NextResponse.json(
      { error: 'Failed to generate AI response', details: errorMessage },
      { status: 500 }
    );
  }
} 