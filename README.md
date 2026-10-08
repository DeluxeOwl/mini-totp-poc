# Mini TOTP

A tiny Bun + Hono JSX demo. One application file: [src/index.tsx](src/index.tsx).
Server-rendered HTML and plain forms. No React, client JavaScript, code comments, or test files.

## Run

Requires [Bun](https://bun.sh). From the repo directory:

```sh
bun install
bun run dev
```

Open http://127.0.0.1:3000. Press `Ctrl+C` to stop.

If port 3000 is occupied, run `PORT=3001 bun run dev` and open http://127.0.0.1:3001.

## Try it

1. Log in with the prefilled credentials: `demo` / `password`.
2. Click **Create OTP**.
3. Scan the QR code with an authenticator app, or enter the displayed secret manually.
4. Log out.
5. Log in again with the credentials and the current six-digit authenticator code.

Manual configuration: issuer `Mini TOTP`, account `demo`, SHA-1, six digits, 30-second period.

Restart the server to reset the account, secret, and sessions. The development command also resets them after each source change.

## Libraries

- [otplib](https://github.com/yeojz/otplib) 13 generates the Base32 secret and `otpauth://` URI, then verifies the code. Verification uses its `.valid` result, not object truthiness. [API](https://otplib.yeojz.dev/api/functional).
- [etiket](https://github.com/productdevbook/etiket) is a good fit here: zero runtime dependencies, server-side SVG, no canvas or native modules. The `etiket/qr` entry generates a 240px SVG data URI with a four-module quiet zone and medium error correction. The displayed QR decoded successfully during browser verification. [QR API](https://github.com/productdevbook/etiket/blob/v0.12.0/docs/qr-code/index.md).

Only the generated SVG reaches the browser. Etiket supports many other formats, but this demo needs only QR generation.

## Demo limits

One shared account with a plaintext password. All state stays in memory. OTP becomes required immediately after creation, without a confirmation step.
Verification accepts only the current period, so the authenticator clock must be synchronized.
No persistence, recovery codes, rate limits, or OTP replay prevention. The server binds to loopback. Do not deploy this as production authentication.

## Verification

`bun run typecheck` checks the TypeScript source.
The flow was verified with `agent-browser`: invalid credentials, QR decoding, logout, invalid and valid OTP codes, and missing or malformed codes.
Mobile layout and accessibility checks passed. No test suite or test files were added.
