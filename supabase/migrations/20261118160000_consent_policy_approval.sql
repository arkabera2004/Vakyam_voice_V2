-- Consent policy approval workflow (Compliance screen, Phase 2): a policy's
-- wording is frozen once it has ever been approved -- calls.consent_policy_id
-- and recordings.consent_policy_id both reference it, so editing the text in
-- place after approval would silently reinterpret what every call using it
-- actually disclosed, the same risk already guarded for agent_versions.
-- approve_consent_policy() is the one path that changes which policy is
-- approved, retiring whichever one held that status first, consistent with
-- the existing one-approved-at-a-time unique index. Additive on top of
-- 20261118150000.

CREATE OR REPLACE FUNCTION public.guard_consent_policy_content()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'approved' AND (
    NEW.disclosure_text IS DISTINCT FROM OLD.disclosure_text OR
    NEW.requires_explicit_consent IS DISTINCT FROM OLD.requires_explicit_consent
  ) THEN
    RAISE EXCEPTION 'an approved consent policy''s wording cannot be changed; approve a new version instead' USING ERRCODE = '0A000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER consent_policies_content_immutable
  BEFORE UPDATE ON public.consent_policies
  FOR EACH ROW EXECUTE FUNCTION public.guard_consent_policy_content();

CREATE OR REPLACE FUNCTION public.approve_consent_policy(target_policy_id UUID)
RETURNS public.consent_policies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  policy_row public.consent_policies;
BEGIN
  SELECT * INTO policy_row FROM public.consent_policies WHERE id = target_policy_id;
  IF policy_row.id IS NULL THEN RAISE EXCEPTION 'policy not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_org(policy_row.org_id) THEN
    RAISE EXCEPTION 'not allowed to approve consent policies in this organisation' USING ERRCODE = '42501';
  END IF;
  IF policy_row.status = 'retired' THEN
    RAISE EXCEPTION 'a retired policy cannot be re-approved; create a new version' USING ERRCODE = 'P0001';
  END IF;
  IF policy_row.status = 'approved' THEN RETURN policy_row; END IF;

  -- Only ever one approved policy per org; retire whichever one held that
  -- status first. This UPDATE only ever touches `status`, never content, so
  -- the immutability trigger above does not block it.
  UPDATE public.consent_policies SET status = 'retired' WHERE org_id = policy_row.org_id AND status = 'approved' AND id <> target_policy_id;

  UPDATE public.consent_policies SET status = 'approved', approved_by = auth.uid(), approved_at = now()
    WHERE id = target_policy_id RETURNING * INTO policy_row;

  PERFORM public.log_audit(policy_row.org_id, format('consent_policy.approved version %s', policy_row.version), 'v' || policy_row.version::text);
  RETURN policy_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_consent_policy(UUID) TO authenticated;
