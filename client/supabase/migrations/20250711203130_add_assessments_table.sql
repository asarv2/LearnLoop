-- Create assessments table
CREATE TABLE IF NOT EXISTS assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    responses JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by chat_id
CREATE INDEX IF NOT EXISTS idx_assessments_chat_id ON assessments(chat_id);

-- Add RLS policy
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on assessments" 
    ON assessments 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
