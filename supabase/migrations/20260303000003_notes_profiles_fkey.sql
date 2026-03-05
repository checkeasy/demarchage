-- Add FK from notes.created_by to profiles.id so PostgREST can join them
-- (The existing FK to auth.users is kept for referential integrity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notes_created_by_profiles_fkey'
      AND table_name = 'notes'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_created_by_profiles_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
