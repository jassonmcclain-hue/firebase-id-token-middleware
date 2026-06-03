# @homidu/firebase-id-token-middleware

Firebase ID token verification for Next.js App Router route handlers. It extracts the Bearer token from the incoming request's `Authorization` header, verifies it with the Firebase Admin SDK's `verifyIdToken()`, and returns the decoded token — including the user's `uid` — so you can authorize requests server-side.

## Features

- Pulls the `Bearer <token>` value out of the `Authorization` header for you.
- Verifies the token with the Firebase Admin SDK.
- Returns the fully decoded ID token (`uid`, `email`, custom claims, etc.).
- Throws a typed `TokenVerificationError` with an HTTP `status` for easy error mapping.
- Works with any request that exposes `headers.get()` (e.g. `NextRequest` / the Web `Request`).

## Installation

```bash
npm install @homidu/firebase-id-token-middleware firebase-admin
```

`firebase-admin` is a peer dependency, so install it alongside this package.

## Firebase Admin SDK setup

This package calls `getAuth().verifyIdToken()`, which requires an initialized Firebase Admin app. Initialize it **once** in a module that your route handlers import. Initializing more than once throws, so guard against re-initialization (handy with hot reload in development):

```ts
// lib/firebase-admin.ts
import { getApps, initializeApp, cert } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Private keys stored in env vars typically have escaped newlines.
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
```

Import this module before (or at the top of) any route handler that verifies tokens so the app is guaranteed to be initialized.

## Environment variables

Create the service account credentials in the [Firebase console](https://console.firebase.google.com/) → **Project settings → Service accounts → Generate new private key**, then set:

```bash
# .env.local
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

Notes:

- Wrap `FIREBASE_PRIVATE_KEY` in double quotes and keep the literal `\n` sequences — the setup snippet above converts them back into real newlines.
- Never commit these values. Keep them in `.env.local` (gitignored) or your hosting provider's secret store.

## Usage — Next.js App Router route handler

```ts
// app/api/profile/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { verifyFirebaseToken, TokenVerificationError } from "@homidu/firebase-id-token-middleware";

// Ensures the Firebase Admin app is initialized (see "Firebase Admin SDK setup").
import "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyFirebaseToken(request);

    // `decoded` contains the verified claims, including the user's uid.
    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email ?? null,
    });
  } catch (error) {
    if (error instanceof TokenVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```

The client must send the token in the `Authorization` header:

```ts
const idToken = await firebaseUser.getIdToken();

await fetch("/api/profile", {
  headers: { Authorization: `Bearer ${idToken}` },
});
```

## API

### `verifyFirebaseToken(request, checkRevoked?)`

- `request` — any object with a `headers.get(name)` method (e.g. `NextRequest`).
- `checkRevoked` — optional `boolean` (default `false`). When `true`, also checks whether the token has been revoked.
- **Returns** `Promise<DecodedIdToken>` — the decoded Firebase ID token.
- **Throws** `TokenVerificationError` when the header is missing/malformed or the token fails verification. The error carries a `status` (defaults to `401`).

Also exported as the package's default export.

### `extractBearerToken(authorizationHeader)`

Helper that returns the raw token string from an `Authorization` header value, or `null` if it is absent or not a Bearer scheme.

### `TokenVerificationError`

`Error` subclass with a numeric `status` property.

## License

MIT
