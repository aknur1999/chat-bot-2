-- Add model column to conversations table
ALTER TABLE conversations ADD COLUMN model TEXT DEFAULT 'gpt-3.5-turbo'; 