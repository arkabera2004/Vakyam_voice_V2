-- Seeds the demo organisation with the data the console used to hard-code in
-- src/console/store.tsx and the page constants, so the demo keeps working
-- once screens read from the database. Fixed UUIDs let later migrations and
-- the SPA refer to it. Everything here is MOCK demonstration data.

INSERT INTO public.organisations (id, slug, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'club-mahindra-demo', 'Club Mahindra (demo)');

-- shortcut: every account that exists when this migration runs becomes a
-- supervisor of the demo organisation, so current demo logins keep working.
-- Replace with explicit admin-managed membership once real clients exist.
INSERT INTO public.org_members (org_id, user_id, role)
SELECT '00000000-0000-4000-8000-000000000001', id, 'supervisor' FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.agents (id, org_id, name, description, live_version)
VALUES ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'Meera', 'Club Mahindra member concierge', 'v7');

INSERT INTO public.agent_versions (org_id, agent_id, version, title, qa_delta, persona_tone, persona_handoff, voice, speed, warmth, dictionary, created_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 'v5', 'Hindi and English code switching rules', '-0.6', 'Warm and brief', 'Refunds and upgrades', 'aarti', 1.05, 70, '[]', '2026-10-14'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 'v6', 'Pronunciation dictionary added', '+1.4', 'Warm and brief', 'Refunds and upgrades', 'aarti', 1.05, 70, '[]', '2026-10-29'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 'v7', 'Shorter holds, clearer consent line', '+2.1', 'Warm and brief', 'Refunds and upgrades', 'aarti', 1.05, 70,
   '[["Club Mahindra","klub muh-HIN-dra"],["Kumbhalgarh","koom-bhul-GARH"],["Lonavala","lo-NAV-la"],["Mussoorie","moo-SOO-ree"],["Member id 20418","two, zero, four, one, eight (digit by digit)"]]', '2026-11-10');

INSERT INTO public.calls (org_id, agent_id, number, caller_name, caller_tier, language, hindi_share, step, step_hot, sentiment, status, started_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4812, 'Rohan Mehta', 'Platinum', 'Hindi lean', 35, 'handoff, waiting approval', true, 'Frustrated', 'live', now() - interval '6 minutes 48 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4815, 'Meenal Joshi', 'Silver', 'Hindi', 50, 'warm transfer to Asha', true, 'Frustrated', 'live', now() - interval '9 minutes 2 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4821, 'Priya Sharma', 'Gold', 'prefers Hindi', 80, 'check_availability, Lonavala 1BR', false, 'Positive', 'live', now() - interval '4 minutes 12 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4822, 'Anita Iyer', 'Gold', 'mixes both', 55, 'place_hold, Goa 2BR', false, 'Neutral', 'live', now() - interval '3 minutes 5 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4823, 'Neha Kulkarni', 'Silver', 'Hindi', 90, 'lookup_caller', false, 'Positive', 'live', now() - interval '1 minute 22 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4824, 'Imran Qureshi', 'Gold', 'English lean', 20, 'create_case, billing query', false, 'Neutral', 'live', now() - interval '7 minutes 30 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4825, 'Sunil Deshmukh', 'Silver', 'Hindi', 60, 'check_availability, Mussoorie', false, 'Positive', 'live', now() - interval '2 minutes 41 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4826, 'Kavya Nair', 'Platinum', 'English', 30, 'answering cancellation policy', false, 'Neutral', 'live', now() - interval '5 minutes 17 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4827, 'Arjun Bhatt', 'Gold', 'Hindi', 75, 'lookup_caller', false, 'Neutral', 'live', now() - interval '48 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4828, 'Farhan Sheikh', 'Gold', 'English lean', 40, 'place_hold, Kumbhalgarh', false, 'Positive', 'live', now() - interval '3 minutes 36 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4829, 'Lata Menon', 'Silver', 'Hindi', 85, 'check_availability, Goa', false, 'Neutral', 'live', now() - interval '2 minutes 9 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4830, 'Vikram Rao', 'Gold', 'mixes both', 45, 'place_hold, Lonavala', false, 'Positive', 'live', now() - interval '4 minutes 55 seconds'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 4790, 'Anita Iyer', 'Gold', 'mixes both', 38, 'resolved', false, 'Positive', 'ended', now() - interval '1 day');

INSERT INTO public.transfers (org_id, call_id, state, to_name, summary)
SELECT '00000000-0000-4000-8000-000000000001', id, 'ringing', 'Asha Nair', ARRAY[
  'Rohan cancelled a Goa 2BR stay for 12 to 16 November after a family emergency.',
  'He asked for a full refund of ₹38,400 to the original card, not a credit note.',
  'Meera explained the cancellation window and drafted case #5521. It is above the ₹25,000 limit, so it needs a human.',
  'He also wants a Kumbhalgarh Studio in January. Meera placed a hold, nothing is confirmed.',
  'Tone is calm but anxious. He is happy to continue in Hindi.']
FROM public.calls WHERE number = 4812 AND org_id = '00000000-0000-4000-8000-000000000001';

INSERT INTO public.rubrics (org_id, version, weights)
VALUES ('00000000-0000-4000-8000-000000000001', 'v4',
  '{"Disclosure given":20,"Consent captured":20,"Intent understood":12,"Correct tool use":12,"Policy followed":12,"Tone":12,"Language match":12}');

INSERT INTO public.qa_scores (org_id, call_number, member_name, member_tier, desk, criterion, score, reviewer_name, scored_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', 4801, 'Rohan Mehta', 'Platinum', 'Club Mahindra desk', 'Policy followed', 52, 'Asha Nair', now()),
  ('00000000-0000-4000-8000-000000000001', 4795, 'Priya Sharma', 'Gold', 'Club Mahindra desk', 'Language match', 64, 'Kavita Rao', now()),
  ('00000000-0000-4000-8000-000000000001', 4790, 'Anita Iyer', 'Gold', 'Club Mahindra desk', 'Language match', 70, NULL, now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000001', 4783, 'Neha Kapoor', 'Gold', 'Club Mahindra desk', 'Tone', 66, 'Asha Nair', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000001', 4777, 'Vikram Joshi', 'Silver', 'Club Mahindra desk', 'Intent understood', 68, NULL, now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000001', 4768, 'Priya Sharma', 'Gold', 'Club Mahindra desk', 'Correct tool use', 71, 'Kavita Rao', now() - interval '3 days'),
  ('00000000-0000-4000-8000-000000000001', 4731, 'Sameer Khan', 'Gold', 'Goa resort desk', 'Tone', 69, NULL, now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000001', 4702, 'Deepa Rao', 'Silver', 'Goa resort desk', 'Language match', 73, NULL, now() - interval '9 days');

INSERT INTO public.adapters (org_id, name, kind, server, verbs, status)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Salesforce', 'crm', 'salesforce-mcp', 'lookup_caller, create_case, log_call', 'Connected'),
  ('00000000-0000-4000-8000-000000000001', 'Dynamics 365', 'crm', 'dynamics365-mcp', 'lookup_caller, check_availability, place_hold', 'Connected'),
  ('00000000-0000-4000-8000-000000000001', 'Zoho', 'crm', 'zoho-crm-mcp', 'lookup_caller, create_case', 'Not connected'),
  ('00000000-0000-4000-8000-000000000001', 'LeadSquared', 'crm', 'leadsquared-mcp', 'lookup_caller, log_call, create_case', 'Connected'),
  ('00000000-0000-4000-8000-000000000001', 'Freshdesk', 'ticketing', 'freshdesk-mcp', 'create_case, log_call', 'Degraded 1 retry'),
  ('00000000-0000-4000-8000-000000000001', 'HubSpot', 'crm', 'hubspot-mcp', 'lookup_caller, log_call', 'Not connected'),
  ('00000000-0000-4000-8000-000000000001', 'Exotel', 'telephony', NULL, 'media, handoff', 'Connected'),
  ('00000000-0000-4000-8000-000000000001', 'Twilio', 'telephony', NULL, 'media, handoff', 'Connected'),
  ('00000000-0000-4000-8000-000000000001', 'SIP trunk', 'telephony', NULL, 'media, handoff', 'Connected'),
  ('00000000-0000-4000-8000-000000000001', 'Azure Communication Services', 'telephony', NULL, 'media, handoff', 'Planned');

INSERT INTO public.campaigns (org_id, emoji, name, sub, dialed, total, connected, dlt, series, status)
VALUES
  ('00000000-0000-4000-8000-000000000001', '🌿', 'Renewal reminder, Gold members', 'Hindi first, 4,200 contacts', 2730, 4200, 1184, 'CLBMHN', '160 service', 'Running'),
  ('00000000-0000-4000-8000-000000000001', '💬', 'Stay feedback calls', 'Checked out in the last 3 days', 1120, 1850, 548, 'CLBMHN', '160 service', 'Running'),
  ('00000000-0000-4000-8000-000000000001', '🧥', 'Winter offer, Platinum members', 'Promotional, starts tomorrow 09:00', 0, 960, 0, 'CLBMHP', '140 promotional', 'Scheduled'),
  ('00000000-0000-4000-8000-000000000001', '⏳', 'Arrival reminder, Lonavala stays', 'Finished yesterday 20:40', 640, 640, 402, 'CLBMHN', '160 service', 'Completed');

INSERT INTO public.knowledge_sources (org_id, emoji, name, sub, live)
VALUES
  ('00000000-0000-4000-8000-000000000001', '📘', 'Booking and cancellation', '86 articles, updated 10 Nov, owner Kavita Rao', true),
  ('00000000-0000-4000-8000-000000000001', '🏨', 'Resort amenities', '142 articles, updated 4 Nov, owner Asha Nair', true),
  ('00000000-0000-4000-8000-000000000001', '🌿', 'Member benefits', '64 articles, updated 29 Oct, owner Kavita Rao', false),
  ('00000000-0000-4000-8000-000000000001', '📒', 'Billing', '38 articles, updated 11 Nov, owner Asha Nair', true);

INSERT INTO public.policy_gates (org_id, name, sub, approver, sla, enabled, triggered_7d)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Upgrade room type', 'Studio to 1BR or 2BR, any resort', 'Asha Nair queue', 'SLA 5 min', true, 41),
  ('00000000-0000-4000-8000-000000000001', 'Refund above 25,000 rupees', 'Any cancellation refund over the limit', 'Asha Nair queue', 'SLA 5 min', true, 27),
  ('00000000-0000-4000-8000-000000000001', 'Waive cancellation fee', 'Full or partial waiver', 'Asha Nair queue', 'SLA 10 min', true, 33),
  ('00000000-0000-4000-8000-000000000001', 'Hold extension beyond 24 h', 'place_hold past the standard window', 'Asha Nair queue', 'SLA 15 min', true, 19),
  ('00000000-0000-4000-8000-000000000001', 'Reschedule inside 48 h', 'One change per booking, same resort', 'Asha Nair queue', 'Limit 1 change', false, 112);

INSERT INTO public.knowledge_versions (org_id, label, created_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Billing updated · Asha Nair', '2026-11-11 16:40'),
  ('00000000-0000-4000-8000-000000000001', 'Booking and cancellation updated · Kavita Rao', '2026-11-10 09:30'),
  ('00000000-0000-4000-8000-000000000001', 'Reschedule inside 48 h gate turned off · Kavita Rao', '2026-11-06 11:00');

INSERT INTO public.disclosure_versions (org_id, version, text, created_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'v4.2',
  'Namaste, main Meera hoon, Club Mahindra ki AI assistant. Yeh call quality aur training ke liye record hoti hai. Kya aap is recording ke liye sahmat hain?', '2026-11-12 11:20');

INSERT INTO public.pii_settings (org_id, field, redact)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Phone number', true),
  ('00000000-0000-4000-8000-000000000001', 'Card number', true),
  ('00000000-0000-4000-8000-000000000001', 'Aadhaar', true),
  ('00000000-0000-4000-8000-000000000001', 'Email address', true);

INSERT INTO public.deletion_requests (org_id, ref, member_name, reason, status, created_at, closed_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'DR 214', 'Priya Sharma', 'Member asked under DPDP', 'closed', '2026-11-10', '2026-11-11 17:45');

INSERT INTO public.audit_log (org_id, actor_name, change, version, created_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Kavita Rao', 'Opening disclosure approved', 'v4.2', '2026-11-12 11:20'),
  ('00000000-0000-4000-8000-000000000001', 'Asha Nair', 'Deletion request closed for Priya Sharma', 'DR 214', '2026-11-11 17:45'),
  ('00000000-0000-4000-8000-000000000001', 'Kavita Rao', 'Aadhaar redaction set to full', 'PII 3', '2026-11-10 09:12'),
  ('00000000-0000-4000-8000-000000000001', 'System', 'DLT consent registry sync completed', 'Auto', '2026-11-08 14:30'),
  ('00000000-0000-4000-8000-000000000001', 'Kavita Rao', 'Call audio retention set to 90 days', 'RET 2', '2026-11-06 10:05');
