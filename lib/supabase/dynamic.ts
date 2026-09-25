import type { createAdminClient } from "@/lib/supabase/admin"
import type { createClient } from "@/lib/supabase/server"

// This project does not provide generated Supabase `Database` types yet, so any
// `.from("table")` call resolves to `never` and every column access errors.
// These helpers keep table access dynamic until those types are introduced.
// See `lib/notifications/dispatch.ts` for the original usage.

type AdminClient = Omit<ReturnType<typeof createAdminClient>, "from"> & {
  from: (table: string) => any
}

type UserClient = Omit<Awaited<ReturnType<typeof createClient>>, "from"> & {
  from: (table: string) => any
}

export function asAdmin(client: ReturnType<typeof createAdminClient>): AdminClient {
  return client as AdminClient
}

export function asUser(client: Awaited<ReturnType<typeof createClient>>): UserClient {
  return client as UserClient
}

export type { AdminClient, UserClient }
