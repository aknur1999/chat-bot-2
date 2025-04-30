import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Check if the API key is set
if (!process.env.OPENAI_API_KEY) {
  console.error('Missing environment variable: OPENAI_API_KEY');
  throw new Error('Missing environment variable: OPENAI_API_KEY');
}

// Create a new OpenAI instance with the API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { message, history = [] } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Build messages array with system message, history and the current message
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...history,
      { role: 'user', content: message }
    ];
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const aiResponse = response.choices[0]?.message?.content || 
      'Sorry, I could not generate a response.';
      
    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    );
  }
} 