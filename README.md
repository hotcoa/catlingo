# Catlingo

Catlingo is a static postcard-style language practice app with French, Korean, and Hebrew lesson decks.

## Local preview

- Open `index.html` directly for a quick local check of the published entry files.
- Or run `python -m http.server 8000` from the repository root and open `http://localhost:8000/`.

## Repository layout

- `index.html` - public entry file at the site root
- `lang.html` - main Catlingo app shell
- `lang-app.js`, `lang-auth*.js`, `lang-config.js`, `lang.css` - client code, auth bootstrap, config, and styles
- `data/` - lesson decks and language catalog
- `assets/` - static assets, including fallback cat photos

## GitHub Pages deployment

- Publish from the `main` branch and the `/ (root)` folder.
- Keep `CNAME` committed with `catlingo.hiyoglow.com`.
- Keep `.nojekyll` committed so Pages serves the site as plain static files.
- Add the DNS record `catlingo CNAME hotcoa.github.io`.
- In **Settings -> Pages**, set the custom domain to `catlingo.hiyoglow.com` and enable **Enforce HTTPS** after DNS is verified and the certificate is issued.
