// Simple test script to verify OpenAI API connectivity
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
console.log('API key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');

async function testOpenAI() {
  try {
    console.log('Testing OpenAI API connection...');
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    console.log('API connection successful! Available models:');
    console.log(data.data.slice(0, 5).map(model => model.id).join(', ') + '...');
  } catch (error) {
    console.error('Error connecting to OpenAI:', error);
  }
}

testOpenAI(); 