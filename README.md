# Catlingo

Catlingo is a static postcard-style language practice app with French, Korean,
Hebrew, and Spanish lesson decks.

## Local preview

- Open `index.html` directly for a quick local check of the published entry files.
- Or run `python -m http.server 8000` from the repository root and open `http://localhost:8000/`.

## Repository layout

- `index.html` - main Catlingo app at the site root
- `lang.html` - compatibility redirect to `index.html`
- `lang-app.js`, `lang-auth*.js`, `lang-config.js`, `lang.css` - client code, auth bootstrap, config, and styles
- `data/` - lesson decks and language catalog
- `assets/` - static assets, including fallback cat photos

## Publishing

The repository does not configure a custom domain. If GitHub Pages is enabled
later, publish from the `main` branch and the `/ (root)` folder. `.nojekyll`
keeps the site served as plain static files.
