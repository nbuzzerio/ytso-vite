export interface SessionClaims {
  _id: string;
  name: string;
  exp: number;
}

// Decoding is only for displaying the name and checking local expiry.
// The API verifies the signature and authorization on every protected request.
export function decodeSession(token: string): SessionClaims | null {
  try {
    const part = token.split(".")[1];
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (character) =>
      character.charCodeAt(0),
    );
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    if (
      typeof claims._id !== "string" ||
      typeof claims.exp !== "number" ||
      !Number.isFinite(claims.exp)
    )
      return null;
    return {
      _id: claims._id,
      name: typeof claims.name === "string" ? claims.name : "",
      exp: claims.exp,
    };
  } catch {
    return null;
  }
}

export function isSessionValid(token: string, now = Date.now()): boolean {
  const claims = decodeSession(token);
  return !!claims && claims.exp * 1000 > now;
}

export function readSession(): string | null {
  const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    if (!cookie.startsWith("x-auth-token=")) continue;
    const token = cookie.slice("x-auth-token=".length);
    if (isSessionValid(token)) return token;
  }
  return null;
}

export function writeSession(token: string | null) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const segments = window.location.pathname.split("/").filter(Boolean);
  // Clear paths used by the previous implementation, including nested pages.
  const paths = new Set([
    "/",
    "/ytso",
    "/ytso/",
    ...segments.map((_, index) => `/${segments.slice(0, index + 1).join("/")}`),
  ]);
  for (const path of paths) {
    document.cookie = `x-auth-token=; Max-Age=0; Path=${path}; SameSite=Lax${secure}`;
  }
  if (token) {
    const claims = decodeSession(token);
    if (claims)
      document.cookie = `x-auth-token=${token}; Path=/ytso; Expires=${new Date(claims.exp * 1000).toUTCString()}; SameSite=Lax${secure}`;
  }
}
