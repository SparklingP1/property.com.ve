import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const locale = searchParams.get('locale') || 'es';
  const redirectTo = searchParams.get('redirect') || `/${locale === 'en' ? 'en/' : ''}dashboard`;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const url = request.nextUrl.clone();
      url.pathname = redirectTo;
      url.searchParams.delete('code');
      url.searchParams.delete('locale');
      url.searchParams.delete('redirect');
      return NextResponse.redirect(url);
    }
  }

  // If code exchange fails, redirect to login
  const url = request.nextUrl.clone();
  url.pathname = locale === 'en' ? '/en/login' : '/login';
  return NextResponse.redirect(url);
}
