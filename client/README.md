# Client

This is the React client powered by Vite.

## Development

- Start dev server: `npm run dev`
- The client proxies `/api` to `http://localhost:5000` by default (see `vite.config.js`).

## API Base URL

The API base URL can be configured via an environment variable:

- Set `VITE_API_BASE_URL` to the full backend URL (e.g., `http://localhost:5000/api` or `/api`).
- If not set, it defaults to `/api` and relies on the dev proxy.

Example `.env` in `client/`:

```
VITE_API_BASE_URL=http://localhost:5000/api
```

Rebuild or restart the dev server after changing environment variables.
