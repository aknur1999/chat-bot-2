import React from 'react';
import { Mic } from 'lucide-react';

interface AudioRecordingIndicatorProps {
  isRecording: boolean;
}

export function AudioRecordingIndicator({ isRecording }: AudioRecordingIndicatorProps) {
  if (!isRecording) return null;
  
  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-full px-4 py-2 flex items-center gap-2 border border-red-200 z-50">
      <Mic size={18} className="text-red-500 animate-pulse" />
      <span className="text-sm font-medium">Recording audio...</span>
    </div>
  );
} 