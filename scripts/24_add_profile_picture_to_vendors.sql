-- Add profile_picture_url column to vendors table
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS profile_picture_url text;
