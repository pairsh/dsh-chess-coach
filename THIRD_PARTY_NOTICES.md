# Third-party notices

`dsh-chess-coach` reads data from a locally installed En Croissant application
but does not include or link En Croissant source code. En Croissant is a
separate GPL-3.0 project: <https://github.com/franciscoBSalgueiro/en-croissant>.
This plugin is not affiliated with or endorsed by En Croissant.

## cburnett chess pieces

The board renders the **cburnett** piece set. The artwork is by
[Colin M.L. Burnett](https://en.wikipedia.org/wiki/User:Cburnett), distributed
under **GPL-2.0-or-later**; the same set is offered by En Croissant and Lichess.
The encoded SVGs live in `src/client/piece-theme.ts`, generated from
En Croissant's `public/pieces/cburnett.css` (which in turn carries the Lichess
piece artwork). A copy of GPL-2.0 is in [`LICENSES/GPL-2.0.txt`](LICENSES/GPL-2.0.txt).

The plugin's TypeScript/React code is MIT-licensed; the cburnett artwork keeps
its own GPL-2.0-or-later terms.

## Stockfish

Stockfish is a separate GPL-3.0 program installed by the user. This plugin
spawns it over UCI and does not bundle its binary. See
<https://github.com/official-stockfish/Stockfish>.

## chess.js

Bundled into both the host and browser artifacts. BSD-2-Clause,
<https://github.com/jhlywa/chess.js>.

## Lichess

Cloud evaluation and PGN export use public Lichess endpoints. Lichess data is
subject to Lichess's terms and rate limits. This plugin does not bundle Lichess
code or databases.

## En Croissant visual language

The dark surface colours, Mantine-style tabs, and gray board are an independent
CSS implementation inspired by En Croissant's public UI. The board colours
(`#e9ecef` / `#868e96`) match En Croissant's `gray.svg` theme; no En Croissant
source file is copied.
