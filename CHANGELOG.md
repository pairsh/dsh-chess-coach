# Changelog

## 0.2.0 — 2026-11-08

En Croissant integration, without losing the AI coach.

- Read-only En Croissant bridge: data directory/app detection, `engines.json` import, `.db3` metadata, game-header search, PGN-sidecar matching, Lichess export fallback, and app launch.
- En Croissant-style dark interface: Mantine-like tabs, gray board, cburnett pieces, player bars, four-tab analysis panel, and a board/analysis two-column layout in fullscreen.
- New database tab with filters, game list, loadable-source markers, read-only guarantees, and explicit errors when the move BLOB has no safe PGN source.
- AI coach, Stockfish UCI analysis, Lichess cloud evaluation, FEN/PGN tools, and per-conversation persistence retained.
- En Croissant engines are merged into the picker; Lc0 is intentionally hidden until weights/backend configuration is supported.
- Added third-party notices and GPL-2.0 text for the cburnett piece artwork.
- 15 tests, including real Stockfish and En Croissant file-bridge coverage.

## 0.1.0 — 2026-11-08

First release.

- Native DSH right-sidebar tab with guide entry and live chip title.
- Interactive board: click/drag moves, legal-target hints, promotion, last-move/check highlights, flip.
- Local Stockfish UCI service: auto-detection, engine switching, cancellation of superseded searches, serialized analysis.
- Coach report: summary, engine recommendation, tactical alerts, White/Black plans, positional metrics, concrete facts.
- FEN load, PGN import/export, copy FEN, move navigation, undo, Lichess analysis link.
- Optional Lichess cloud evaluation and masters opening explorer, proxied and cached by the host.
- Per-conversation study persistence and persisted settings.
- Unit tests, real Stockfish integration tests, and a publishable DSH bundle manifest.
