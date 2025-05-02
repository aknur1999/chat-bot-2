// Simple test script to verify Whisper API availability
const fs = require('fs');
const path = require('path');

// Manually read the API key from .env file
function getApiKey() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/OPENAI_API_KEY=([^\r\n]+)/);
    return match ? match[1].trim() : null;
  } catch (error) {
    console.error('Error reading .env file:', error.message);
    return null;
  }
}

const apiKey = getApiKey();
console.log('API key length:', apiKey ? apiKey.length : 0);

async function testWhisper() {
  try {
    console.log('Testing Whisper model availability...');
    const response = await fetch('https://api.openai.com/v1/models/whisper-1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      console.log('Whisper model may not be available in your OpenAI account or API plan');
      return;
    }

    const data = await response.json();
    console.log('Whisper model is available!', data);
  } catch (error) {
    console.error('Error checking Whisper availability:', error);
  }
}

testWhisper(); 