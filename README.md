# Pawtner in Care Web

React, TypeScript, and Vite web client for Pawtner in Care.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## GitHub Pages Deployment

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-github-pages.yml`.
On pushes to `main`, the workflow installs dependencies, builds the Vite app, uploads `dist`, and deploys it to GitHub Pages.

In the GitHub repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions**.

The workflow sets `VITE_BASE_PATH` automatically:

- `/` for repositories named `<owner>.github.io`
- `/<repository-name>/` for project pages repositories

For a local GitHub Pages-style build, set `VITE_BASE_PATH` before running:

```powershell
$env:VITE_BASE_PATH = "/pawtner-in-care-web/"
npm run build:github-pages
```

GitHub Pages serves only static files. The backend API and websocket endpoints must be publicly reachable by the browser. Configure repository variables as needed:

- `VITE_API_BASE_URL`
- `VITE_CHAT_WS_ENABLE_LEGACY_QUEUES`
- `VITE_CHAT_WS_URL`
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_FOLDER`
- `VITE_CLOUDINARY_UPLOAD_PRESET`

`npm run build:github-pages` also creates `dist/404.html` for direct route refreshes and `dist/.nojekyll` so GitHub Pages serves Vite assets normally.
