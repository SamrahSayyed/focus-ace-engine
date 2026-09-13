-- Enum for session type
DO $$ BEGIN
  CREATE TYPE public.session_type AS ENUM ('deep_work', 'revision', 'casual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS distraction_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_type public.session_type NOT NULL DEFAULT 'deep_work';

-- Sanity constraints
ALTER TABLE public.study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_distraction_count_check,
  ADD CONSTRAINT study_sessions_distraction_count_check CHECK (distraction_count >= 0);

ALTER TABLE public.study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_break_minutes_check,
  ADD CONSTRAINT study_sessions_break_minutes_check CHECK (break_minutes >= 0);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_start
  ON public.study_sessions(user_id, start_time DESC);