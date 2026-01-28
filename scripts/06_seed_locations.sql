-- Seed sample locations data
insert into public.locations (country, city, market_name) values
  ('Nigeria', 'Lagos', 'Ikeja Market'),
  ('Nigeria', 'Lagos', 'Balogun Market'),
  ('Nigeria', 'Lagos', 'Computer Village'),
  ('Nigeria', 'Abuja', 'Wuse Market'),
  ('Nigeria', 'Abuja', 'Garki Market'),
  ('Nigeria', 'Port Harcourt', 'Mile 1 Market'),
  ('Kenya', 'Nairobi', 'Gikomba Market'),
  ('Kenya', 'Nairobi', 'Toi Market'),
  ('Kenya', 'Mombasa', 'Kongowea Market'),
  ('Ghana', 'Accra', 'Makola Market'),
  ('Ghana', 'Accra', 'Kaneshie Market'),
  ('Ghana', 'Kumasi', 'Kejetia Market')
on conflict do nothing;
