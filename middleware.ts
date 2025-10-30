import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Halaman publik yang boleh diakses tanpa login
  const publicPaths = ["/", "/login"]

  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  // Ambil cookie login
  const uid = req.cookies.get("uid")?.value
  const role = req.cookies.get("role")?.value

  // Kalau belum login, redirect ke login
  if (!uid || !role) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dosen/:path*",
    "/panitia/:path*",
  ],
}
