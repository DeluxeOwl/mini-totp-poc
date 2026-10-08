import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import { jsxRenderer } from 'hono/jsx-renderer'
import { generateSecret, generateURI, verify } from 'otplib'
import { qrcodeDataURI } from 'etiket/qr'

const app = new Hono()
const user = { username: 'demo', password: 'password', secret: '' }
const sessions = new Set<string>()
const isLoggedIn = (c: Context) => sessions.has(getCookie(c, 'session') ?? '')

app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await next()
})
app.use(csrf())
app.use(jsxRenderer(({ children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Mini TOTP</title>
      <link rel="icon" href="data:," />
      <style>{
        `
        * { box-sizing: border-box; }
        body { margin: 0; background: #f7f7f8; color: #202124; font: 16px/1.5 system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        main { max-width: 440px; margin: 48px auto; padding: 28px; background: white; border: 1px solid #ddd; border-radius: 12px; }
        header { margin-bottom: 28px; }
        h1 { margin: 4px 0 0; font-size: 28px; letter-spacing: -0.7px; }
        h2 { margin: 0; font-size: 20px; }
        p { margin: 12px 0 20px; }
        small, footer { color: #60646c; font-size: 13px; }
        form { display: grid; gap: 10px; margin-top: 16px; }
        input, button { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #bbb; border-radius: 6px; font: inherit; touch-action: manipulation; }
        button { background: #202124; border-color: #202124; color: white; cursor: pointer; }
        button.secondary { background: white; color: #202124; border-color: #bbb; }
        :focus-visible { outline: 2px solid #202124; outline-offset: 3px; }
        .error { color: #b42318; }
        .qr { display: block; width: 240px; height: auto; max-width: 100%; margin: 20px auto; }
        code { display: block; padding: 12px; background: #f1f2f4; border-radius: 6px; overflow-wrap: anywhere; user-select: all; }
        footer { margin-top: 28px; border-top: 1px solid #eee; padding-top: 16px; }
        @media (max-width: 480px) { main { margin: 20px 16px; padding: 24px; } }
      `
      }</style>
    </head>
    <body>
      <main>
        <header>
          <small>Bun + Hono JSX</small>
          <h1>TOTP demo</h1>
        </header>
        {children}
        <footer>Demo only. One hardcoded account. Restart the server to reset.</footer>
      </main>
    </body>
  </html>
)))

const Login = ({ error }: { error?: string }) => (
  <>
    <h2>Log in</h2>
    <p>{user.secret ? 'OTP is enabled. Use your authenticator code to log in.' : 'The demo credentials are prefilled.'}</p>
    {error && <p class="error" role="alert" id="login-error">{error}</p>}
    <form action="/login" method="post" aria-describedby={error ? 'login-error' : undefined}>
      <label for="username">Username</label>
      <input id="username" name="username" value={user.username} autocomplete="username" autocapitalize="none" spellcheck={false} required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" value={user.password} autocomplete="current-password" required />
      {user.secret && <>
        <label for="otp">OTP code</label>
        <input id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength={6} maxlength={6} placeholder="123456" aria-describedby="otp-help" required />
        <small id="otp-help">Enter the current six-digit code from your authenticator app.</small>
      </>}
      <button type="submit">Log in</button>
    </form>
  </>
)

app.get('/', (c) => {
  if (!isLoggedIn(c)) {
    const error = c.req.query('error')
    return c.render(<Login error={error === 'credentials' ? 'Wrong username or password.' : error === 'otp' ? 'Invalid OTP code. Use the current code from your authenticator app.' : undefined} />)
  }

  const qr = user.secret
    ? qrcodeDataURI(generateURI({ issuer: 'Mini TOTP', label: user.username, secret: user.secret }), { size: 240, margin: 4, ecLevel: 'M' })
    : undefined

  return c.render(<>
    <h2>Logged in as {user.username}</h2>
    {user.secret ? <>
      <p>OTP is enabled. Scan this QR code with your authenticator app.</p>
      <img class="qr" src={qr} width={240} height={240} alt="TOTP setup QR code for Mini TOTP: demo" />
      <p>Or enter this secret manually:</p>
      <code id="secret">{user.secret}</code>
      <p><small>Mini TOTP · demo · SHA-1 · 6 digits · 30 seconds</small></p>
      <p>After you add the account, log out. Your next login requires the code from your authenticator app.</p>
    </> : <>
      <p>Add an authenticator app to require an OTP code at your next login.</p>
      <form action="/otp" method="post">
        <button type="submit">Create OTP</button>
      </form>
    </>}
    <form action="/logout" method="post">
      <button class="secondary" type="submit">Log out</button>
    </form>
  </>)
})

app.post('/login', async (c) => {
  const form = await c.req.parseBody()
  if (form.username !== user.username || form.password !== user.password) {
    return c.redirect('/?error=credentials', 303)
  }

  if (user.secret && (typeof form.otp !== 'string' || !/^[0-9]{6}$/.test(form.otp) || !(await verify({ secret: user.secret, token: form.otp })).valid)) {
    return c.redirect('/?error=otp', 303)
  }

  sessions.delete(getCookie(c, 'session') ?? '')
  const session = crypto.randomUUID()
  sessions.add(session)
  setCookie(c, 'session', session, { httpOnly: true, sameSite: 'Strict', path: '/' })
  return c.redirect('/', 303)
})

app.post('/otp', (c) => {
  if (!isLoggedIn(c)) return c.redirect('/', 303)
  if (!user.secret) {
    user.secret = generateSecret()
    sessions.clear()
    sessions.add(getCookie(c, 'session')!)
  }
  return c.redirect('/', 303)
})

app.post('/logout', (c) => {
  sessions.delete(getCookie(c, 'session') ?? '')
  deleteCookie(c, 'session', { path: '/' })
  return c.redirect('/', 303)
})

export default { hostname: '127.0.0.1', port: Number(Bun.env.PORT ?? 3000), fetch: app.fetch }
