-- Invitation-only membership (Phase 2): membership status, invitation expiry
-- and the record of which auth user an invitation created, acceptance on
-- email confirmation, a DB-level guard against granting super_admin by
-- invite, and an RPC for deactivating members. Additive on top of
-- 20261117100000.

-- ---------------------------------------------------------------- membership status
ALTER TABLE public.org_members
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  ADD COLUMN disabled_at TIMESTAMPTZ,
  ADD COLUMN disabled_by UUID REFERENCES auth.users(id);

-- A disabled member has no role anywhere: every RLS policy and tier helper
-- goes through org_role(), so this one change locks them out.
CREATE OR REPLACE FUNCTION public.org_role(org UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.org_members WHERE org_id = org AND user_id = auth.uid() AND status = 'active';
$$;

-- Managers deactivate or reactivate a member; never themselves. Audited.
CREATE OR REPLACE FUNCTION public.set_member_status(org UUID, member UUID, new_status TEXT)
RETURNS public.org_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.org_members;
BEGIN
  IF NOT public.can_manage_org(org) THEN
    RAISE EXCEPTION 'not allowed to manage members of this organisation' USING ERRCODE = '42501';
  END IF;
  IF member = auth.uid() THEN
    RAISE EXCEPTION 'you cannot change your own membership status' USING ERRCODE = 'P0001';
  END IF;
  IF new_status NOT IN ('active', 'disabled') THEN
    RAISE EXCEPTION 'status must be active or disabled' USING ERRCODE = '22023';
  END IF;
  UPDATE public.org_members SET
    status = new_status,
    disabled_at = CASE WHEN new_status = 'disabled' THEN now() ELSE NULL END,
    disabled_by = CASE WHEN new_status = 'disabled' THEN auth.uid() ELSE NULL END
  WHERE org_id = org AND user_id = member
  RETURNING * INTO m;
  IF m.user_id IS NULL THEN RAISE EXCEPTION 'member not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.log_audit(org, 'member.' || new_status || ' ' || member::TEXT);
  RETURN m;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_member_status(UUID, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------- invitations
ALTER TABLE public.invitations
  ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  ADD COLUMN invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  DROP CONSTRAINT invitations_status_check,
  ADD CONSTRAINT invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked', 'expired', 'failed'));

-- Only a super_admin may invite a super_admin, whoever calls (defence in
-- depth behind the Edge Function's canAssignRole check).
CREATE OR REPLACE FUNCTION public.guard_invitation_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'super_admin' AND public.org_role(NEW.org_id) IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'only a super_admin can invite a super_admin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invitations_guard_role
  BEFORE INSERT OR UPDATE OF role ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.guard_invitation_role();

-- Acceptance: when an invited user confirms their email (sets a password via
-- the invite link), the newest pending invitation for that address becomes
-- membership. Expired invitations are marked and grant nothing. Matching on
-- the confirmed address means a forged invitation_id in user metadata cannot
-- redirect an invitation to another account.
CREATE OR REPLACE FUNCTION public.accept_invitation_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invitations;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR NEW.email IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO inv FROM public.invitations
   WHERE status = 'pending' AND lower(email) = lower(NEW.email)
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF inv.id IS NULL THEN RETURN NEW; END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = inv.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.org_members (org_id, user_id, role) VALUES (inv.org_id, NEW.id, inv.role)
    ON CONFLICT (org_id, user_id) DO UPDATE
      SET role = EXCLUDED.role, status = 'active', disabled_at = NULL, disabled_by = NULL;
  UPDATE public.invitations SET status = 'accepted', accepted_user_id = NEW.id, accepted_at = now() WHERE id = inv.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.accept_invitation_for_user();

-- Members may see colleagues' names and emails (for invitation and review
-- screens); profiles stay self-editable only.
CREATE POLICY "members see colleague profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_members mine
      JOIN public.org_members theirs ON theirs.org_id = mine.org_id
      WHERE mine.user_id = auth.uid() AND mine.status = 'active' AND theirs.user_id = profiles.user_id
    )
  );
