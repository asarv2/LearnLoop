import { Database } from '@/database.types'
import { createClient } from '@supabase/supabase-js'

let client: ReturnType<typeof createClient<Database>> | undefined

function getSupabaseApiClient() {
  if (client) {
    return client
  }

  client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SERVICE_ROLE_KEY!
  )

  return client
}

export const createApiClient = getSupabaseApiClient
export default getSupabaseApiClient 