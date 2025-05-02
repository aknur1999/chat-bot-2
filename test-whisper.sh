#!/bin/bash

# Extract API key from .env file
API_KEY=$(grep OPENAI_API_KEY .env | cut -d'=' -f2)

echo "Testing OpenAI Whisper API with sample audio"
echo "-----------------------------------------"
echo "API key length: ${#API_KEY}"

# Create a small test file with silence
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 3 -q:a 9 -acodec libmp3lame test-audio.mp3

# Send the test file to OpenAI
echo "Sending test audio to OpenAI..."
curl --request POST \
  --url https://api.openai.com/v1/audio/transcriptions \
  --header "Authorization: Bearer $API_KEY" \
  --header "Content-Type: multipart/form-data" \
  --form file=@test-audio.mp3 \
  --form model=whisper-1

echo ""
echo "-----------------------------------------"
echo "If you received a JSON response, the API is working correctly." 