-- Early-access cohort activation report.
-- Run as the owner in the Supabase SQL editor (project qzzvxfbitixpmfuirvhq).
-- One row per real business created on or after the first invite date.
--
-- Activation event (the one number that matters in week one):
--   the business has at least one reviewed_send that was consumed into a
--   message, i.e. the owner reviewed a prepared reply and recorded sending it.
--
-- Change :since to the date the first invitation went out. Exclude the
-- owner's own test workspace by name if it was created after that date.

with since as (
  select timestamptz '2026-09-16 00:00:00+10' as at
),
owner as (
  select m.business_id, min(u.email) as owner_email
  from business_member m
  join app_user u on u.id = m.user_id
  group by m.business_id
),
enquiries as (
  select business_id,
         count(*) as enquiries,
         min(received_at) as first_enquiry_at,
         max(updated_at) as last_enquiry_touch_at
  from enquiry
  group by business_id
),
sends as (
  select business_id,
         count(*) filter (where consumed_at is not null) as recorded_sends,
         min(consumed_at) as first_recorded_send_at,
         count(*) filter (where consumed_at >= now() - interval '7 days') as sends_last_7d
  from reviewed_send
  group by business_id
),
activity as (
  select business_id,
         max(at) as last_action_at,
         count(*) filter (where at >= now() - interval '7 days') as actions_last_7d
  from audit_event
  group by business_id
)
select
  b.name,
  o.owner_email,
  b.created_at::date as joined,
  coalesce(e.enquiries, 0) as enquiries,
  e.first_enquiry_at,
  coalesce(s.recorded_sends, 0) as recorded_sends,
  s.first_recorded_send_at,
  case when s.first_recorded_send_at is not null then 'activated' else 'not yet' end as activation,
  extract(epoch from (s.first_recorded_send_at - b.created_at)) / 3600 as hours_to_first_value,
  coalesce(s.sends_last_7d, 0) as sends_last_7d,
  coalesce(a.actions_last_7d, 0) as actions_last_7d,
  a.last_action_at,
  case
    when a.last_action_at is null and b.created_at < now() - interval '3 days' then 'CONTACT: signed up, never acted'
    when a.last_action_at < now() - interval '7 days' then 'CONTACT: quiet for a week'
    else ''
  end as follow_up
from business b
left join owner o on o.business_id = b.id
left join enquiries e on e.business_id = b.id
left join sends s on s.business_id = b.id
left join activity a on a.business_id = b.id
cross join since
where b.created_at >= since.at
order by b.created_at;
