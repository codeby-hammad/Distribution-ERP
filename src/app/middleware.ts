import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccess } from '@/lib/access';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/confirm', '/welcome'];
const AUTH_FLOW_PATHS = ['/forgot-password', '/reset-password', '/auth/confirm'];

const matches = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(p + '/'));

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;

  if (!user && !matches(path, PUBLIC_PATHS)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (matches(path, AUTH_FLOW_PATHS)) return res;

  const role = user?.app_metadata?.role as string | undefined;
  if (user && role && !canAccess(role, path)) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return res;
}

export const config = { matcher: ['/((?!_next|favicon.ico|api).*)'] };