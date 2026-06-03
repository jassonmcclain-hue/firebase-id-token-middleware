import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

/**
 * The shape we need from an incoming request. This is structurally compatible
 * with the Web `Request` used by the Next.js App Router (`NextRequest`),
 * as well as anything else that exposes a `headers.get()` method.
 */
export interface RequestLike {
  headers: {
    get(name: string): string | null;
  };
}

/**
 * Error thrown when a token is missing, malformed, or fails verification.
 * `status` is provided as a convenience for mapping to an HTTP response.
 */
export class TokenVerificationError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "TokenVerificationError";
    this.status = status;
  }
}

/**
 * Extract the Bearer token from an `Authorization` header value.
 * Returns `null` when the header is absent or not a Bearer scheme.
 */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match) {
    return null;
  }

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Verify the Firebase ID token carried by a request's `Authorization` header.
 *
 * Extracts the Bearer token, verifies it with the Firebase Admin SDK's
 * `verifyIdToken()`, and returns the decoded token (including `uid`).
 *
 * The Firebase Admin app must already be initialized (see the README).
 *
 * @param request   A Next.js / Web request exposing `headers.get()`.
 * @param checkRevoked  When `true`, also checks whether the token has been
 *                      revoked. Defaults to `false`.
 * @returns The decoded ID token.
 * @throws {TokenVerificationError} If the token is missing or invalid.
 */
export async function verifyFirebaseToken(
  request: RequestLike,
  checkRevoked = false,
): Promise<DecodedIdToken> {
  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    throw new TokenVerificationError(
      "Missing or malformed Authorization header. Expected 'Bearer <token>'.",
    );
  }

  try {
    return await getAuth().verifyIdToken(token, checkRevoked);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    throw new TokenVerificationError(`Failed to verify Firebase ID token: ${reason}`);
  }
}

export type { DecodedIdToken };

export default verifyFirebaseToken;
