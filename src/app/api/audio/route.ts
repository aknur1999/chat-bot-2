import { NextResponse } from 'next/server';

// Check if the API key is set
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Missing environment variable: OPENAI_API_KEY is not defined');
}

export async function POST(request: Request) {
  try {
    if (!apiKey) {
      console.error('API key is missing or empty when handling request');
      return NextResponse.json(
        { error: 'Server configuration error: API key is missing' },
        { status: 500 }
      );
    }
    
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    console.log('Audio file received:', audioFile.name, audioFile.type, audioFile.size, 'bytes');

    // Create new FormData to forward to OpenAI
    const openAIFormData = new FormData();
    openAIFormData.append('file', audioFile);
    openAIFormData.append('model', 'whisper-1');
    
    console.log('Sending request to OpenAI Whisper API');
    
    try {
      // Make request to OpenAI API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: openAIFormData,
      });

      console.log('Received response from OpenAI:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error response:', errorText);
        return NextResponse.json(
          { error: 'OpenAI API error', details: errorText },
          { status: 500 }
        );
      }
      
      const data = await response.json();
      console.log('OpenAI response data:', data);
      
      const responseText = data.text || 'Sorry, I could not transcribe the audio.';
      
      return NextResponse.json({ response: responseText });
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return NextResponse.json(
        { error: 'Failed to call OpenAI API', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in audio API:', error);
    return NextResponse.json(
      { error: 'Failed to process audio', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 