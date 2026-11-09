# Changelog

## 0.3.0 — 2026-11-09

Separated from En Croissant.

- Removed the En Croissant database/engine bridge, database tab, settings card, and app launch.
- Removed En Croissant engine auto-detection; Stockfish is discovered from config, env, PATH, or common install locations.
- The DSH plugin is now a standalone chess coach. En Croissant development continues in its own repository.
- Reverted to the pre-integration v0.1 DSH-only interface to keep the split immediate and unambiguous.

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
