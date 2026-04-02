import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyUserByEmail(email: string) {
  try {
    console.log(`[Verification] Finding user with email: ${email}`)

    // Get user from Supabase Auth
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.error('Error listing users:', listError)
      process.exit(1)
    }

    const user = users.users.find(u => u.email === email)

    if (!user) {
      console.error(`User with email ${email} not found`)
      process.exit(1)
    }

    console.log(`[Verification] Found user: ${user.id}`)
    console.log(`[Verification] Email confirmed at: ${user.email_confirmed_at}`)

    // Update user to confirm email
    const { data, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        email_confirmed_at: new Date().toISOString(),
      }
    )

    if (updateError) {
      console.error('Error confirming email:', updateError)
      process.exit(1)
    }

    console.log(`[Verification] ✅ Successfully confirmed email for ${email}`)
    console.log(`[Verification] Email confirmed at: ${data.user.email_confirmed_at}`)
    console.log(`[Verification] User can now log in!`)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

const email = process.argv[2]
if (!email) {
  console.error('Usage: ts-node verify-user.ts <email>')
  process.exit(1)
}

verifyUserByEmail(email)
