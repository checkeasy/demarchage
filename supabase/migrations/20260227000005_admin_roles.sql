-- =============================================================================
-- Migration: Systeme multi-utilisateurs avec Super Admin
-- Ajoute role + is_active sur profiles, RLS pour super_admin
-- IMPORTANT: Les policies utilisent auth.jwt() au lieu de SELECT profiles
-- pour eviter la recursion infinie RLS sur la table profiles.
-- =============================================================================

-- 1. Ajouter colonnes role et is_active sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Ajouter le CHECK constraint (separement pour eviter les conflits IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'user'));
  END IF;
END $$;

-- 2. Promouvoir le premier utilisateur en super_admin
UPDATE public.profiles
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1
);

-- 3. Mettre a jour auth.users app_metadata pour le super_admin
-- (necessaire pour le check JWT dans les RLS policies)
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
WHERE id = (
  SELECT id FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1
);

-- =============================================================================
-- RLS POLICIES pour super_admin
-- On utilise auth.jwt() -> app_metadata ->> 'role' pour eviter la recursion
-- infinie qui se produit quand une policy sur profiles fait SELECT FROM profiles.
-- =============================================================================

-- 4. super_admin peut voir tous les profiles (via JWT, pas de recursion)
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- 5. super_admin peut modifier tous les profiles (via JWT)
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;
CREATE POLICY "Super admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'super_admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- 6. super_admin a acces total aux workspace_members (via JWT)
DROP POLICY IF EXISTS "Super admins can view all workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Super admins can manage workspace members" ON public.workspace_members;
CREATE POLICY "Super admins can manage workspace members"
  ON public.workspace_members
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'super_admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- 7. super_admin peut voir tous les workspaces (via JWT)
DROP POLICY IF EXISTS "Super admins can view all workspaces" ON public.workspaces;
CREATE POLICY "Super admins can view all workspaces"
  ON public.workspaces
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
