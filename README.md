# DMO-structure

Interactive React + Three.js visualization for Jahn-Teller distortion in Mn³⁺ octahedra.

## Current project structure
This repository is now a complete Vite + React project with:
- `src/RobustJTVisualizer.jsx` (3D + 2D JT visualization)
- `src/App.jsx` and `src/main.jsx` (app entry)
- `package.json` scripts (`dev`, `build`, `preview`)
- `.github/workflows/deploy.yml` for GitHub Pages deployment

## Run locally (optional)
```bash
npm install
npm run dev
```
Open the URL printed by Vite (usually `http://localhost:5173`).

## Deploy with GitHub Actions (no local setup required)
1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, select **Source: GitHub Actions**.
4. Push to `main` (or run the workflow manually from **Actions**).
5. After the workflow succeeds, your site appears at:
   - `https://<your-username>.github.io/DMO-structure/`

## Important notes
- `vite.config.js` sets `base: '/DMO-structure/'` for GitHub Pages project-site routing.
- If your repository name changes, update the `base` value accordingly.


## CI dependency install behavior
- If `package-lock.json` exists, workflow uses `npm ci`.
- If no lock file exists yet, workflow falls back to `npm install` so deployment can still proceed.
- For reproducible builds, commit a lock file later when your environment can generate one.
