"use client"

import { useState } from "react"
import { Database, Copy, CheckCircle, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const SQL = `-- ShoppieApp Admin Control Center — Database Setup
-- Run this entire block in your Supabase Dashboard → SQL Editor

-- 1. Audit Logs
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

-- 2. Reports
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

-- 3. Platform Settings
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
  ('vendor_approval_required', 'false', 'Require admin approval for new vendors'),
  ('max_products_per_vendor', '0', 'Max products per vendor (0 = unlimited)'),
  ('contact_email', 'contact@shoppieapp.co.zw', 'Public support email')
ON CONFLICT (key) DO NOTHING;

-- 4. Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience TEXT DEFAULT 'all',
  expires_at TIMESTAMPTZ,
  created_by UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Notifications Log
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience TEXT DEFAULT 'all',
  notification_type TEXT DEFAULT 'admin_broadcast',
  recipients INTEGER DEFAULT 0,
  onesignal_id TEXT,
  sent_by TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_log_created_at ON notifications_log(created_at DESC);

-- 6. Product admin columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- 7. RLS: deny direct access; service role bypasses automatically
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- Allow reading active announcements publicly (used for the banner)
DROP POLICY IF EXISTS "public_read_announcements" ON announcements;
CREATE POLICY "public_read_announcements" ON announcements
  FOR SELECT USING (is_active = true);

-- Allow reading platform settings publicly
DROP POLICY IF EXISTS "public_read_settings" ON platform_settings;
CREATE POLICY "public_read_settings" ON platform_settings FOR SELECT USING (true);

-- Allow anyone to submit a report
DROP POLICY IF EXISTS "anyone_insert_reports" ON reports;
CREATE POLICY "anyone_insert_reports" ON reports FOR INSERT WITH CHECK (true);`

export default function AdminSetupPage() {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  function copy() {
    navigator.clipboard.writeText(SQL).then(() => {
      setCopied(true)
      toast({ title: "SQL copied!", description: "Paste it into your Supabase SQL Editor" })
      setTimeout(() => setCopied(false), 3000)
    })
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0]
  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : "https://supabase.com/dashboard"

  const tables = [
    { name: "audit_logs", description: "Records every admin action with IP and timestamp" },
    { name: "reports", description: "User-submitted abuse/spam reports" },
    { name: "platform_settings", description: "Key-value store for platform config" },
    { name: "announcements", description: "Banners shown to users in the app" },
    { name: "notifications_log", description: "History of sent push notifications" },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-violet-600" />Database Setup
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Run this SQL once to create all admin tables and required columns.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">⚠ One-time setup required</p>
        <p className="text-sm text-amber-700 dark:text-amber-400">
          The admin control center needs 5 tables and 2 extra columns. Copy the SQL below and run it in your Supabase SQL Editor. You only need to do this once — all statements are idempotent.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tables.map(t => (
          <div key={t.name} className="bg-card border border-border rounded-lg p-3">
            <p className="font-mono text-sm font-semibold">{t.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Migration SQL</h2>
          <div className="flex gap-2">
            <a
              href={sqlEditorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4" />Open SQL Editor
            </a>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors"
            >
              {copied ? <CheckCircle className="h-4 w-4" /> : <Database className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy SQL"}
            </button>
          </div>
        </div>

        <pre className="bg-card border border-border rounded-xl p-5 text-xs overflow-x-auto leading-relaxed font-mono text-muted-foreground whitespace-pre-wrap max-h-[500px] overflow-y-auto">
          {SQL}
        </pre>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Instructions</h2>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Click <strong className="text-foreground">Open SQL Editor</strong> to go directly to your Supabase project</li>
          <li>Click <strong className="text-foreground">Copy SQL</strong> and paste it into the editor</li>
          <li>Click <strong className="text-foreground">Run</strong> to execute — all statements are safe to re-run</li>
          <li>Return here and navigate to any admin section — everything will work immediately</li>
        </ol>
      </div>
    </div>
  )
}
