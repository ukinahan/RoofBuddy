/**
 * Server-side Supabase client. Used in Server Components, Server Actions
 * and Route Handlers. Reads/writes the auth cookie via Next's cookies() API
 * so the user stays signed in across requests.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll throws when called from a Server Component (Next prevents
            // mutating cookies during render). Safe to ignore — middleware
            // refreshes the session on the next request.
          }
        },
      },
    },
  );
}
