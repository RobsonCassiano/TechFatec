# TechFatec

The app is a plain HTML, CSS, and JavaScript project served and built with Vite.

## Main files

- `index.html` is the HTML entry point.
- `app.js` renders the screens and handles client-side navigation and demo interactions.
- `styles.css` contains the shared responsive wireframe styles.
- `src/imports/pasted_text/techFatec.md` is the product brief for the required screens and journeys.
- `vite.config.js` configures the Vite development server and production build.
- `package.json` contains the Vite and formatting scripts.

## Development

The Vite development server uses port `8443` by default. Run `pnpm dev` to start it, `pnpm build` to check the production build, and `pnpm format` to format the source.

Do not add React or TypeScript unless the project requirements change. API-backed behavior is intentionally not implemented yet; demo actions should clearly indicate where API integration is still needed.

## UI conventions

Keep the low-fidelity, monochrome visual language consistent across authentication and each user profile. Use semantic HTML, accessible labels, responsive layouts, and the existing shared CSS classes.
