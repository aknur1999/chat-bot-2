-- Add is_image column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_image BOOLEAN DEFAULT false; 