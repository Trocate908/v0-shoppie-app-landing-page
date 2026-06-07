-- Admin Control Center tables
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_email ON audit_logs(admin_email);

CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID,
  reporter_email TEXT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('site_name', 'ShoppieApp', 'Platform display name'),
  ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
  ('registration_enabled', 'true', 'Allow new user registrations'),
  ('homepage_banner', '', 'Banner text shown on homepage'),
  ('vendor_approval_required', 'false', 'Require admin approval for new vendors')
ON CONFLICT (key) DO NOTHING;

-- RLS: only service role can access these tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default. Deny all for anon/authenticated.
CREATE POLICY IF NOT EXISTS "deny_all_audit_logs" ON audit_logs FOR ALL USING (false);
CREATE POLICY IF NOT EXISTS "deny_all_reports" ON reports FOR ALL USING (false);
CREATE POLICY IF NOT EXISTS "read_platform_settings" ON platform_settings FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "deny_write_platform_settings" ON platform_settings FOR ALL USING (false);
