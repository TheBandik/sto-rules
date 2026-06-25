# STO rules web viewer

Client-side PDF viewer for GitHub Pages.

## Commands

- `npm run dev` - prepare assets and start Vite
- `npm run build` - generate indexes and build static files
- `npm run preview` - preview `dist`

## Generated files

Build scripts create files in `public`:

- `sto-rules.pdf` - copied from the repository root
- `rules-index.json` - TOC, rule anchors, positions and build info
- `search-index.json` - rule-level search index

## Deployment

GitHub Pages is configured by `.github/workflows/pages.yml`.
