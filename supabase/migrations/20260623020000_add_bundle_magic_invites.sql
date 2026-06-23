-- Per-bundle "magic invite link" support.
--
-- Each (organization, bundle) pair gets its own unique invite code (e.g.
-- "SMSB-AFE-2580"). A student opening /signup?code=<CODE> self-registers and is
-- granted a license for that exact bundle — bypassing Stripe entirely — as long
-- as that bundle still has seats available.
--
-- Three pieces:
--   1. org_bundle_invites          — stores one code per (org, bundle) pair.
--   2. get_or_create_bundle_invite_code(org, bundle)
--                                  — admin-facing: lazily mints/returns the code.
--   3. claim_bundle_seat(...)      — atomic seat claim (SELECT ... FOR UPDATE) used
--                                    by the join-via-code Edge Function.
--
-- Seat accounting mirrors get_bundle_seat_summary:
--   available = SUM(purchases.seats_purchased) - COUNT(licenses)  per (org, bundle)

-- ── 1. Storage: one invite code per (org, bundle) ───────────────────────────
create table if not exists public.org_bundle_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  bundle_id   uuid not null references public.course_bundles(id) on delete cascade,
  invite_code text not null unique,
  created_at  timestamptz not null default now(),
  unique (org_id, bundle_id)
);

alter table public.org_bundle_invites enable row level security;

-- Admins can read/manage invite codes for organizations they administer.
-- (admin_org_ids() is the SECURITY DEFINER helper from the RLS-recursion fix.)
drop policy if exists "Admins manage their bundle invites" on public.org_bundle_invites;
create policy "Admins manage their bundle invites"
  on public.org_bundle_invites
  for all
  to authenticated
  using (org_id in (select public.admin_org_ids()))
  with check (org_id in (select public.admin_org_ids()));

-- ── Helper: build a short UPPER alphanumeric abbreviation from a name ────────
-- "Sound Mind, Sound Body" -> "SMSB" ; "Advanced Financial Education" -> "AFE".
-- Falls back to the first alphanumerics of a single-word name.
create or replace function public.abbrev_name(p_name text, p_max int default 5)
returns text
language plpgsql
immutable
as $$
declare
  v_words text[];
  v_word  text;
  v_out   text := '';
begin
  v_words := regexp_split_to_array(coalesce(p_name, ''), '\s+');
  foreach v_word in array v_words loop
    v_word := regexp_replace(upper(v_word), '[^A-Z0-9]', '', 'g');
    if length(v_word) > 0 then
      v_out := v_out || substr(v_word, 1, 1);
    end if;
  end loop;
  -- Single-word name: take its first few characters instead of one initial.
  if length(v_out) <= 1 then
    v_out := substr(regexp_replace(upper(coalesce(p_name, 'ORG')), '[^A-Z0-9]', '', 'g'), 1, p_max);
  end if;
  if length(v_out) = 0 then
    v_out := 'ORG';
  end if;
  return substr(v_out, 1, p_max);
end;
$$;

-- ── 2. Admin-facing: mint or fetch the code for one (org, bundle) ────────────
-- SECURITY DEFINER so it can write to org_bundle_invites, but it self-checks
-- that the caller actually administers the org before doing anything.
create or replace function public.get_or_create_bundle_invite_code(
  org_id_param    uuid,
  bundle_id_param uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin   boolean;
  v_existing   text;
  v_org_abbr   text;
  v_bundle_abbr text;
  v_code       text;
  v_try        int := 0;
begin
  -- Authorize: caller must be the org's admin.
  select exists(
    select 1 from public.organizations
    where id = org_id_param and admin_id = auth.uid()
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Not authorized for this organization' using errcode = '42501';
  end if;

  -- Already minted? Return it (idempotent).
  select invite_code into v_existing
  from public.org_bundle_invites
  where org_id = org_id_param and bundle_id = bundle_id_param;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Build the human-readable prefix from org + bundle names.
  select public.abbrev_name(name, 5) into v_org_abbr
  from public.organizations where id = org_id_param;
  select public.abbrev_name(name, 4) into v_bundle_abbr
  from public.course_bundles where id = bundle_id_param;

  if v_bundle_abbr is null then
    raise exception 'Bundle not found' using errcode = 'P0002';
  end if;

  -- Generate a collision-free code: PREFIX-BUNDLE-#### (4 random digits).
  loop
    v_try := v_try + 1;
    v_code := v_org_abbr || '-' || v_bundle_abbr || '-' ||
              lpad(((floor(random() * 9000) + 1000)::int)::text, 4, '0');

    begin
      insert into public.org_bundle_invites (org_id, bundle_id, invite_code)
      values (org_id_param, bundle_id_param, v_code)
      returning invite_code into v_code;
      return v_code;
    exception
      when unique_violation then
        -- Either the (org,bundle) row was just created concurrently, or the
        -- random code collided. Re-check for an existing row first.
        select invite_code into v_existing
        from public.org_bundle_invites
        where org_id = org_id_param and bundle_id = bundle_id_param;
        if v_existing is not null then
          return v_existing;
        end if;
        if v_try >= 10 then
          raise exception 'Could not generate a unique invite code';
        end if;
        -- else loop and retry with a new random suffix
    end;
  end loop;
end;
$$;

grant execute on function public.get_or_create_bundle_invite_code(uuid, uuid) to authenticated;

-- ── 3. Atomic seat claim used by the join-via-code Edge Function ────────────
-- Locks the organization row (SELECT ... FOR UPDATE) so concurrent joins for the
-- same org are serialized — preventing oversell when many students click at once.
--
-- Returns one of:
--   'joined'          — a new license was created and a seat consumed
--   'reactivated'     — a pre-existing INACTIVE license (from the legacy email
--                       invite flow) was activated and linked; NO extra seat
--                       consumed (that seat was already allocated on invite)
--   'already_member'  — the email already holds an active license for this bundle
--                       (idempotent: NO extra seat consumed)
--   'full'            — no seats remain for this bundle; nothing was written
create or replace function public.claim_bundle_seat(
  org_id_param      uuid,
  bundle_id_param   uuid,
  user_id_param     uuid,
  student_email_param text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock      uuid;
  v_purchased int;
  v_assigned  int;
  v_bundle_name text;
  v_existing  uuid;
begin
  -- Serialize concurrent claims for this organization.
  select id into v_lock
  from public.organizations
  where id = org_id_param
  for update;

  if v_lock is null then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  -- Idempotency: already has an active license for THIS bundle? Grant, no seat.
  select id into v_existing
  from public.licenses
  where org_id = org_id_param
    and bundle_id = bundle_id_param
    and lower(student_email) = lower(student_email_param)
    and is_active = true
  limit 1;

  if v_existing is not null then
    -- Ensure the row is linked to this auth user (covers re-signup / relink).
    update public.licenses
    set user_id = user_id_param
    where id = v_existing and user_id is distinct from user_id_param;
    return 'already_member';
  end if;

  -- Dedupe: an INACTIVE license already exists for this email+bundle (the admin
  -- pre-invited them via the legacy email flow, which already consumed a seat and
  -- bumped used_seats). Activate that row in place instead of inserting a second
  -- one — and do NOT touch the seat counters, since the seat is already allocated.
  select id into v_existing
  from public.licenses
  where org_id = org_id_param
    and bundle_id = bundle_id_param
    and lower(student_email) = lower(student_email_param)
    and is_active = false
  limit 1;

  if v_existing is not null then
    update public.licenses
    set is_active = true,
        user_id = user_id_param
    where id = v_existing;
    return 'reactivated';
  end if;

  -- Seat math for this specific (org, bundle), identical to get_bundle_seat_summary.
  select coalesce(sum(seats_purchased), 0) into v_purchased
  from public.purchases
  where org_id = org_id_param and bundle_id = bundle_id_param;

  select count(*) into v_assigned
  from public.licenses
  where org_id = org_id_param and bundle_id = bundle_id_param;

  if v_purchased - v_assigned <= 0 then
    return 'full';
  end if;

  select name into v_bundle_name from public.course_bundles where id = bundle_id_param;

  -- Consume the seat: create the active, user-linked license for this bundle.
  insert into public.licenses (org_id, bundle_id, student_email, user_id, is_active, course_type)
  values (org_id_param, bundle_id_param, student_email_param, user_id_param, true,
          coalesce(v_bundle_name, 'Fundamentals'));

  -- Keep the org headline counter (used_seats) in step with assignments.
  update public.organizations
  set used_seats = coalesce(used_seats, 0) + 1
  where id = org_id_param;

  return 'joined';
end;
$$;

-- Only the service role (Edge Function) should call this directly.
revoke all on function public.claim_bundle_seat(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_bundle_seat(uuid, uuid, uuid, text) to service_role;
