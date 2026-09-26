import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail } from "@/lib/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const db = createAdminClient()

  const tables = [
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      admin_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details JSONB,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS reports (
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
    )`,
    `CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `INSERT INTO platform_settings (key, value, description) VALUES
      ('site_name', 'ShoppieApp', 'Platform display name'),
      ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
      ('registration_enabled', 'true', 'Allow new user registrations'),
      ('homepage_banner', '', 'Banner text shown on homepage'),
      ('vendor_approval_required', 'false', 'Require admin approval for new vendors')
    ON CONFLICT (key) DO NOTHING`,
    // Vendor discounts and promotions. `price` remains what shoppers pay;
    // `original_price` is the struck-through "was" price, so an active
    // discount is simply original_price > price. All IF NOT EXISTS, so this
    // is safe to re-run.
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_label TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)`,
    `CREATE INDEX IF NOT EXISTS idx_products_on_promotion
      ON products(original_price, promo_ends_at)
      WHERE original_price IS NOT NULL`,
  ]

  const errors: string[] = []
  for (const sql of tables) {
    const { error } = await db.rpc("exec_sql" as never, { sql } as never).single()
    if (error && !error.message.includes("already exists")) {
      errors.push(error.message)
    }
  }

  return NextResponse.json({ ok: true, errors })
}
