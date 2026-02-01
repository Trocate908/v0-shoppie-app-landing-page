-- Create contact submissions table
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.contact_submissions enable row level security;

-- Allow anyone to insert contact submissions
create policy "Anyone can submit contact form"
on public.contact_submissions
for insert
with check (true);

-- Only admins can view submissions (you'll need to manage this separately)
create policy "Admins can view submissions"
on public.contact_submissions
for select
using (false); -- Set to false for now, you can update this with admin role logic later

-- Create index for faster lookups
create index idx_contact_submissions_created_at on public.contact_submissions(created_at desc);
