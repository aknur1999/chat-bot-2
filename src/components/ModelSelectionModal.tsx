'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
}

interface ModelSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModel: (modelId: string) => void;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Optimized for text-based conversations with enhanced capabilities.',
  },
  {
    id: 'gpt-4o-mini-audio-preview',
    name: 'GPT-4o Mini Audio',
    description: 'Supports audio processing in addition to text conversations.'
  }
];

export function ModelSelectionModal({ isOpen, onClose, onSelectModel }: ModelSelectionModalProps) {
  const [selectedModelId, setSelectedModelId] = useState<string>(MODEL_OPTIONS[0].id);

  const handleSubmit = () => {
    onSelectModel(selectedModelId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="mb-4">Select Model for this Conversation</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {MODEL_OPTIONS.map((model) => (
            <div 
              key={model.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedModelId === model.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
              onClick={() => setSelectedModelId(model.id)}
            >
              <div className="flex items-center gap-2">
                <input 
                  type="radio" 
                  id={model.id} 
                  name="model" 
                  checked={selectedModelId === model.id}
                  onChange={() => setSelectedModelId(model.id)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor={model.id} className="text-base font-medium cursor-pointer">
                  {model.name}
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-1 ml-6">{model.description}</p>
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4">
          <Button onClick={handleSubmit} className="w-full sm:w-auto">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 