# Frontend Deployment

## Vercel Deployment

This frontend is configured to deploy to Vercel with the following settings:

- **Framework**: SvelteKit
- **Build Command**: `npm run build`
- **Output Directory**: `.svelte-kit`
- **Install Command**: `npm install`

## Environment Variables

Make sure to set the following environment variable in Vercel:

```
VITE_API_BASE_URL=https://win-api-sensay.cyberpunk.work
```

## Local Development

```bash
npm install
npm run dev
```

The app will run on `http://localhost:5173` and connect to the backend at `http://localhost:4001`.
