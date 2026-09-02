import { NextResponse, type NextRequest } from 'next/server';
import {
  applyAuthToResponse,
  clearAuthOnResponse,
  readAuthState,
  refreshWithKong,
} from './lib/auth-edge';

const PUBLIC_PREFIXES = ['/login', '/register', '/accept-invite', '/style'];
const REFRESH_SKEW_MS = 60_000;

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const { accessToken, refreshToken, expiresAt } = readAuthState(req);

  if (isPublic(pathname)) {
    if ((pathname === '/login' || pathname === '/register') && refreshToken) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!refreshToken) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const needsRefresh = !accessToken || Date.now() > expiresAt - REFRESH_SKEW_MS;
  if (needsRefresh) {
    const bundle = await refreshWithKong(refreshToken);
    if (!bundle) {
      const res = NextResponse.redirect(new URL('/login', req.url));
      clearAuthOnResponse(res);
      return res;
    }
    const res = NextResponse.next();
    applyAuthToResponse(res, bundle);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
