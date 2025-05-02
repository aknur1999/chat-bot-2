-- Create a new storage bucket for chat images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up public access policy
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'chat-images');

-- Set up authenticated users insert policy
CREATE POLICY "Authenticated users can upload" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'chat-images');

-- Set up owner access policy
CREATE POLICY "Owners can manage their images" ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'chat-images' AND owner = auth.uid()); 