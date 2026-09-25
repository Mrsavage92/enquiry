-- Founding members: businesses that paid for (or were given) the founding plan.
--
-- Written by the Stripe webhook (src/routes/api/stripe-webhook.ts) when a
-- Payment Link checkout completes, and by the owner by hand for invited
-- testers (source = 'invited'). When the launch_settings row founding_gate is
-- 'on', a workspace can only be created for an email with an access status
-- here (src/lib/server/workspace.ts completeOnboarding).
--
-- Production apply (owner role) also needs:
--   grant select, insert, update, delete on founding_member to enquiry_app;

create table if not exists founding_member (
  email text primary key,
  status text not null default 'active',
  source text not null default 'stripe',
  stripe_customer_id text,
  stripe_subscription_id text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table founding_member enable row level security;
