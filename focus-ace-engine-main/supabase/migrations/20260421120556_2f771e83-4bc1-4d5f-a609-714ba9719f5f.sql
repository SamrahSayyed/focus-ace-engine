-- Goals table: weekly minute targets per subject
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  weekly_target_minutes INTEGER NOT NULL CHECK (weekly_target_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject)
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own goals" ON public.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own goals" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own goals" ON public.goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own goals" ON public.goals FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER goals_set_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Scheduled tasks: persisted output of the smart scheduler
CREATE TABLE public.scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  schedule_date DATE NOT NULL,
  subject TEXT NOT NULL,
  start_time TEXT NOT NULL, -- "HH:MM"
  end_time TEXT NOT NULL,   -- "HH:MM"
  duration_minutes INTEGER NOT NULL,
  reason TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_tasks_user_date ON public.scheduled_tasks (user_id, schedule_date);

ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tasks" ON public.scheduled_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tasks" ON public.scheduled_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tasks" ON public.scheduled_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tasks" ON public.scheduled_tasks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER scheduled_tasks_set_updated_at
BEFORE UPDATE ON public.scheduled_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();