-- Migration: 024_advisor_and_heartbeat
-- Description: Create advisor_chat_history and add updated_at to kitchen_sessions

-- 1. Create advisor_chat_history table
CREATE TABLE IF NOT EXISTS public.advisor_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    reply TEXT NOT NULL,
    usage JSONB DEFAULT '{}'::jsonb,
    provider TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add updated_at column to kitchen_sessions
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'kitchen_sessions' AND column_name = 'updated_at') THEN
        ALTER TABLE public.kitchen_sessions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 3. Enable RLS for advisor_chat_history
ALTER TABLE public.advisor_chat_history ENABLE ROW LEVEL SECURITY;

-- 4. Policies for advisor_chat_history
CREATE POLICY "Users can view their own advisor chat history" 
ON public.advisor_chat_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own advisor chat history" 
ON public.advisor_chat_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 5. Indexing for performance
CREATE INDEX IF NOT EXISTS idx_advisor_chat_user_id ON public.advisor_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_sessions_updated_at ON public.kitchen_sessions(updated_at);
