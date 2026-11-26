# Deploying StuckPoint

Free setup: **Vercel** runs the app at a `.vercel.app` link, **Turso** stores the data,
**Gemini** (free tier) runs the AI. No card is needed for any of them.

## 1. Turso: the database

1. Sign up at turso.tech with your GitHub account.
2. Create a database named `stuckpoint`. Pick a US East location (near Washington, D.C.) if offered:
   Vercel runs the app there by default, and the app talks to the database many times per page.
3. Copy the database URL (starts with `libsql://`).
4. Create a token for the database and copy it. Treat it like a password.

The tables are created automatically on the first request.

## 2. Vercel: the app

1. Sign up at vercel.com with your GitHub account.
2. Add a new project and import the `stuckpoint` repository. Vercel detects Next.js.
3. Before deploying, add these environment variables:

| Name | Value |
| --- | --- |
| `LLM_PROVIDER` | `google` |
| `LLM_MODEL` | `gemini-3.8-flash` |
| `LLM_FALLBACK_MODEL` | `gemini-3.5-flash-lite` |
| `LLM_API_KEY` | your Gemini key |
| `TURSO_DATABASE_URL` | the `libsql://` URL from Turso |
| `TURSO_AUTH_TOKEN` | the Turso token |
| `STUDY_MODE` | `false` for testing, `true` for the study |
| `TEACHER_PIN` | a PIN only the teacher knows |

4. Deploy. The link looks like `stuckpoint.vercel.app`, or similar if that name is taken.

Every push to `main` on GitHub redeploys the site automatically.

## Changing a setting later

Change it in Vercel (project settings, environment variables), then redeploy from the Deployments tab.
Settings are read when the app starts, so a change does nothing until the redeploy.

## Running on your own computer

Nothing changes: leave the Turso values out of `.env` and the data goes in `data/stuckpoint.db`.
