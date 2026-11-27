import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_session";
const CUSTOMER_COOKIE = "customer_session";

async function verifyToken(
  request: NextRequest,
  cookieName: string,
  expectedType: "admin" | "customer",
): Promise<boolean> {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return false;
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );
    // Admin tokens have no `typ` claim (legacy); customer tokens carry typ=customer.
    if (expectedType === "customer") return payload.typ === "customer";
    return payload.typ !== "customer";
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Admin routes (unchanged behaviour) ---
  if (pathname === "/admin/login") {
    if (await verifyToken(request, ADMIN_COOKIE, "admin")) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin")) {
    if (!(await verifyToken(request, ADMIN_COOKIE, "admin"))) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // --- Customer routes ---
  if (pathname.startsWith("/account")) {
    if (!(await verifyToken(request, CUSTOMER_COOKIE, "customer"))) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Logged-in customers visiting /login or /register go to their dashboard.
  if (pathname === "/login" || pathname === "/register") {
    if (await verifyToken(request, CUSTOMER_COOKIE, "customer")) {
      const next = request.nextUrl.searchParams.get("next");
      return NextResponse.redirect(
        new URL(next && next.startsWith("/") ? next : "/account", request.url),
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/login", "/register"],
};
