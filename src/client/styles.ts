import { PIECE_CSS } from './piece-theme.ts'

const STYLE_ID = 'dsh-chess-coach-styles'

const BASE_CSS = `
.cc-tab-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.cc-tab-title svg { flex: none; }

.cc-root {
  --cc-bg: var(--dsw-alias-bg-base, #ffffff);
  --cc-layer: var(--dsw-alias-bg-layer-1, #f6f7f9);
  --cc-layer-2: var(--dsw-alias-bg-layer-2, #eef0f4);
  --cc-layer-3: var(--dsw-alias-bg-layer-3, #e4e7ed);
  --cc-text: var(--dsw-alias-label-primary, #1b1c1e);
  --cc-secondary: var(--dsw-alias-label-secondary, #555b66);
  --cc-muted: var(--dsw-alias-label-tertiary, #858b96);
  --cc-border: var(--dsw-alias-border-l2, rgba(15, 20, 30, .09));
  --cc-border-strong: var(--dsw-alias-border-l3, rgba(15, 20, 30, .16));
  --cc-accent: var(--dsw-alias-brand-primary, #4d6bfe);
  --cc-accent-soft: color-mix(in srgb, var(--cc-accent) 12%, transparent);
  --cc-good: var(--dsw-alias-state-success-primary, #168f52);
  --cc-warn: var(--dsw-alias-state-warn-primary, #b87900);
  --cc-danger: var(--dsw-alias-state-error-primary, #d64545);
  --cc-board-light: #f0d9b5;
  --cc-board-dark: #b58863;
  --cc-white-bar: #f5f4ef;
  --cc-black-bar: #292b2f;
  --cc-draw-bar: #9aa0a9;
  --cc-metric-white: #cfc8b9;
  --cc-metric-black: #2b2d31;
  --cc-radius: 12px;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--cc-text);
  background: var(--cc-bg);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif);
  font-size: 13px;
  line-height: 1.5;
}
body[data-ds-dark-theme] .cc-root {
  --cc-bg: #17181a;
  --cc-layer: #202125;
  --cc-layer-2: #282a2f;
  --cc-layer-3: #32343a;
  --cc-text: #eceef2;
  --cc-secondary: #b9bdc6;
  --cc-muted: #858b96;
  --cc-border: rgba(255, 255, 255, .09);
  --cc-border-strong: rgba(255, 255, 255, .16);
  --cc-board-light: #d8c3a5;
  --cc-board-dark: #8f6b4e;
  --cc-white-bar: #ece7dc;
  --cc-black-bar: #161719;
  --cc-draw-bar: #777d87;
  --cc-metric-white: #d8d0c0;
  --cc-metric-black: #0e0f10;
}

.cc-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--cc-border);
  background: var(--cc-bg);
  z-index: 3;
}
.cc-brand { display: flex; align-items: center; gap: 9px; min-width: 0; }
.cc-brand-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  color: var(--cc-accent);
  background: var(--cc-accent-soft);
  flex: none;
}
.cc-brand-title { font-weight: 650; font-size: 14px; letter-spacing: .01em; }
.cc-brand-sub { font-size: 10.5px; color: var(--cc-muted); margin-top: 1px; }
.cc-header-actions { display: flex; gap: 4px; }

.cc-icon-btn {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cc-secondary);
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: inline-grid;
  place-items: center;
  padding: 0;
}
.cc-icon-btn:hover { background: var(--cc-layer-2); color: var(--cc-text); }
.cc-icon-btn:focus-visible, .cc-btn:focus-visible, .cc-move:focus-visible, .cc-square:focus-visible, .cc-line:focus-visible, .cc-opening-move:focus-visible {
  outline: 2px solid var(--cc-accent);
  outline-offset: 1px;
}

.cc-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 12px 16px;
  scrollbar-width: thin;
}

.cc-board-section { display: flex; flex-direction: column; gap: 7px; }
.cc-board-frame {
  position: relative;
  width: min(100%, 460px);
  margin-inline: auto;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, .16), 0 0 0 1px rgba(0, 0, 0, .12);
  background: var(--cc-board-light);
}
.cc-board {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  container-type: inline-size;
  touch-action: manipulation;
}

.cc-square {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
  min-height: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  background: transparent;
  user-select: none;
  -webkit-user-select: none;
}
.cc-light { background: var(--cc-board-light); }
.cc-dark { background: var(--cc-board-dark); }
.cc-square::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.cc-last::before { background: rgba(255, 204, 51, .38); }
.cc-selected::before { background: rgba(76, 175, 80, .45); }
.cc-check::before { background: radial-gradient(circle at 50% 50%, rgba(230, 40, 40, .8) 0%, rgba(230, 40, 40, .38) 42%, transparent 72%); }
.cc-square:hover::before { background: rgba(255, 255, 255, .14); }
.cc-selected:hover::before { background: rgba(76, 175, 80, .5); }

.cc-piece {
  position: relative;
  z-index: 2;
  font-family: "Segoe UI Symbol", "Arial Unicode MS", "Noto Sans Symbols 2", sans-serif;
  font-size: min(9.2cqw, 44px);
  line-height: .92;
  pointer-events: none;
  font-variant-emoji: text;
  transform: translateY(-1%);
}
.cc-piece-w {
  color: #fffdf8;
  text-shadow:
    0 0 1px #2f2a24,
    0 1px 0 #3d352b,
    1px 0 0 #3d352b,
    -1px 0 0 #3d352b,
    0 -1px 0 #3d352b,
    0 3px 3px rgba(0, 0, 0, .28);
}
.cc-piece-b {
  color: #1d2025;
  text-shadow: 0 1px 0 rgba(255, 255, 255, .18), 0 2px 3px rgba(0, 0, 0, .25);
}

.cc-target-dot {
  position: absolute;
  z-index: 3;
  width: 22%;
  height: 22%;
  border-radius: 50%;
  background: rgba(20, 28, 24, .34);
  pointer-events: none;
}
.cc-capture .cc-target-dot {
  width: 72%;
  height: 72%;
  background: transparent;
  border: 4px solid rgba(20, 28, 24, .32);
  box-sizing: border-box;
}

.cc-coord {
  position: absolute;
  z-index: 2;
  font-size: 8.5px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
  opacity: .78;
}
.cc-coord-rank { top: 3px; left: 3px; }
.cc-coord-file { right: 4px; bottom: 3px; }
.cc-light .cc-coord { color: #6d5339; }
.cc-dark .cc-coord { color: #f3e6d4; }

.cc-arrows {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 4;
  pointer-events: none;
  overflow: visible;
}

.cc-eval { display: flex; flex-direction: column; gap: 4px; }
.cc-eval-track {
  position: relative;
  height: 7px;
  border-radius: 99px;
  overflow: hidden;
  background: var(--cc-black-bar);
  border: 1px solid var(--cc-border);
}
.cc-eval-white { height: 100%; background: var(--cc-white-bar); transition: width .32s ease; }
.cc-eval-mid { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(120, 120, 120, .45); }
.cc-eval-readout { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.cc-eval-value { font-weight: 750; font-size: 15px; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.cc-eval-negative { color: var(--cc-secondary); }
.cc-eval-source { color: var(--cc-muted); font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cc-result-banner {
  border-radius: 8px;
  padding: 7px 10px;
  font-weight: 650;
  color: var(--cc-text);
  background: linear-gradient(90deg, var(--cc-accent-soft), transparent);
  border: 1px solid var(--cc-border);
}

.cc-board-meta { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--cc-secondary); min-height: 18px; }
.cc-turn { font-weight: 650; color: var(--cc-text); }
.cc-turn::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; background: #f3f0e6; border: 1px solid #8a7c66; }
.cc-turn-b::before { background: #26282d; border-color: #26282d; }
.cc-muted { color: var(--cc-muted); }
.cc-small { font-size: 11px; }

.cc-controls { display: flex; align-items: center; gap: 3px; }
.cc-controls-gap { flex: 1; }
.cc-btn {
  appearance: none;
  border: 1px solid var(--cc-border);
  background: var(--cc-layer);
  color: var(--cc-text);
  border-radius: 8px;
  min-height: 30px;
  padding: 0 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 550;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-decoration: none;
  white-space: nowrap;
}
.cc-btn:hover:not(:disabled) { background: var(--cc-layer-2); border-color: var(--cc-border-strong); }
.cc-btn:disabled { opacity: .38; cursor: default; }
.cc-btn-icon { width: 30px; padding: 0; font-size: 13px; }
.cc-btn-ghost { background: transparent; }
.cc-btn-ghost:hover:not(:disabled) { background: var(--cc-layer-2); }
.cc-btn-primary { background: var(--cc-accent); border-color: var(--cc-accent); color: #fff; }
.cc-btn-primary:hover:not(:disabled) { filter: brightness(1.06); background: var(--cc-accent); }

.cc-library-actions { display: flex; flex-wrap: wrap; gap: 5px; }
.cc-link-btn { color: var(--cc-accent); }

.cc-move-list {
  max-height: 156px;
  overflow-y: auto;
  border: 1px solid var(--cc-border);
  border-radius: 9px;
  padding: 4px;
  background: var(--cc-layer);
  scrollbar-width: thin;
}
.cc-move-row { display: grid; grid-template-columns: 28px 1fr 1fr; align-items: center; gap: 2px; border-radius: 5px; }
.cc-move-row:nth-child(odd) { background: color-mix(in srgb, var(--cc-text) 2.5%, transparent); }
.cc-move-number { color: var(--cc-muted); font-size: 10.5px; text-align: right; padding-right: 5px; font-variant-numeric: tabular-nums; }
.cc-move {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--cc-text);
  font: inherit;
  font-size: 12px;
  text-align: left;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-move:hover:not(:disabled) { background: var(--cc-layer-2); }
.cc-move.is-current { background: var(--cc-accent); color: #fff; font-weight: 650; }
.cc-move:disabled { cursor: default; opacity: .25; }
.cc-move-empty { margin: 7px 6px; font-size: 11.5px; }

.cc-analysis-section, .cc-coach-section { margin-top: 10px; }
.cc-analysis-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--cc-secondary);
  padding: 7px 9px;
  border: 1px solid var(--cc-border);
  border-bottom: 0;
  border-radius: 9px 9px 0 0;
  background: var(--cc-layer);
}
.cc-analysis-score { margin-left: auto; font-weight: 700; color: var(--cc-text); font-variant-numeric: tabular-nums; }
.cc-live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--cc-muted); flex: none; }
.cc-live-dot.is-live { background: var(--cc-good); }
.cc-live-dot.is-loading { background: var(--cc-warn); animation: cc-pulse 1s ease-in-out infinite; }
@keyframes cc-pulse { 0%, 100% { opacity: .35; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.15); } }

.cc-lines { border: 1px solid var(--cc-border); border-radius: 0 0 9px 9px; overflow: hidden; background: var(--cc-bg); }
.cc-line {
  appearance: none;
  border: 0;
  border-bottom: 1px solid var(--cc-border);
  background: transparent;
  color: var(--cc-text);
  font: inherit;
  width: 100%;
  display: grid;
  grid-template-columns: 16px 46px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  text-align: left;
  cursor: pointer;
  font-size: 11.5px;
}
.cc-line:last-child { border-bottom: 0; }
.cc-line:hover { background: var(--cc-layer); }
.cc-line.is-active { background: var(--cc-accent-soft); }
.cc-line-rank { color: var(--cc-muted); font-size: 10px; }
.cc-line-eval { font-weight: 700; font-variant-numeric: tabular-nums; }
.cc-line-san { color: var(--cc-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cc-line-depth { color: var(--cc-muted); font-size: 9.5px; text-align: right; }
.cc-analysis-hint { padding: 8px 2px 0; font-size: 11.5px; }

.cc-inline-error {
  margin-top: 6px;
  padding: 7px 9px;
  border-radius: 8px;
  color: var(--cc-danger);
  background: color-mix(in srgb, var(--cc-danger) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--cc-danger) 22%, transparent);
  font-size: 11.5px;
}
.cc-inline-error-quiet { color: var(--cc-muted); background: var(--cc-layer); border-color: var(--cc-border); }

.cc-coach { display: flex; flex-direction: column; gap: 9px; }
.cc-section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 10.5px;
  font-weight: 750;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--cc-muted);
  padding-top: 3px;
}
.cc-section-aside { text-transform: none; letter-spacing: 0; font-weight: 500; font-size: 10.5px; }
.cc-verdict {
  border: 1px solid var(--cc-border);
  background: linear-gradient(145deg, var(--cc-layer), var(--cc-bg));
  border-radius: var(--cc-radius);
  padding: 10px 11px;
}
.cc-verdict-top { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
.cc-verdict p { margin: 0; font-size: 12px; color: var(--cc-secondary); }
.cc-verdict-pill { font-size: 10.5px; font-weight: 750; padding: 2px 7px; border-radius: 99px; background: var(--cc-layer-2); }
.cc-verdict-white { color: #3b5bdb; background: rgba(77, 107, 254, .11); }
.cc-verdict-black { color: #c2410c; background: rgba(194, 65, 12, .11); }
.cc-verdict-equal { color: var(--cc-secondary); }
.cc-phase { font-size: 10.5px; color: var(--cc-muted); border-left: 1px solid var(--cc-border); padding-left: 6px; }

.cc-next {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--cc-accent) 22%, var(--cc-border));
  background: linear-gradient(135deg, var(--cc-accent-soft), transparent 72%);
  border-radius: var(--cc-radius);
  padding: 10px 11px;
  overflow: hidden;
}
.cc-next::after {
  content: "♞";
  position: absolute;
  right: 7px;
  top: -13px;
  font-size: 61px;
  line-height: 1;
  color: var(--cc-accent);
  opacity: .08;
  pointer-events: none;
}
.cc-next-label { font-size: 10px; font-weight: 700; letter-spacing: .08em; color: var(--cc-accent); text-transform: uppercase; }
.cc-next-move { font-size: 24px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2; margin: 1px 0 3px; font-variant-numeric: tabular-nums; }
.cc-next p { margin: 0; font-size: 11.5px; color: var(--cc-secondary); position: relative; z-index: 1; }

.cc-tactics { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.cc-tactics li {
  position: relative;
  padding: 6px 8px 6px 23px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--cc-warn) 7%, var(--cc-layer));
  border: 1px solid color-mix(in srgb, var(--cc-warn) 16%, var(--cc-border));
  font-size: 11.5px;
}
.cc-tactics li::before { content: "!"; position: absolute; left: 8px; top: 6px; color: var(--cc-warn); font-weight: 800; }

.cc-plan { border: 1px solid var(--cc-border); border-radius: 9px; padding: 8px 9px; background: var(--cc-bg); }
.cc-plan-mine { border-color: color-mix(in srgb, var(--cc-accent) 20%, var(--cc-border)); }
.cc-plan-title { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; font-weight: 700; margin-bottom: 4px; }
.cc-side-dot { width: 9px; height: 9px; border-radius: 50%; border: 1px solid var(--cc-border-strong); }
.cc-side-dot-w { background: #f5f1e7; }
.cc-side-dot-b { background: #26282d; }
.cc-plan ul { margin: 0; padding-left: 15px; display: flex; flex-direction: column; gap: 2px; }
.cc-plan li { font-size: 11.5px; color: var(--cc-secondary); }

.cc-metrics { display: flex; flex-direction: column; gap: 6px; }
.cc-metric { display: flex; flex-direction: column; gap: 3px; }
.cc-metric-head { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--cc-muted); }
.cc-metric-values { font-variant-numeric: tabular-nums; color: var(--cc-secondary); display: inline-flex; gap: 3px; align-items: baseline; }
.cc-metric-values b { font-weight: 600; color: var(--cc-text); }
.cc-metric-values i { font-style: normal; opacity: .5; }
.cc-metric-bar { height: 5px; border-radius: 99px; overflow: hidden; display: flex; background: var(--cc-black-bar); border: 1px solid var(--cc-border); }
.cc-metric-white { background: var(--cc-metric-white); height: 100%; }
.cc-metric-black { background: var(--cc-metric-black); height: 100%; flex: 1; }

.cc-facts { display: flex; flex-wrap: wrap; gap: 4px; }
.cc-facts span {
  font-size: 10.5px;
  color: var(--cc-secondary);
  border: 1px solid var(--cc-border);
  border-radius: 99px;
  padding: 2px 7px;
  background: var(--cc-layer);
}

.cc-cloud { border: 1px solid var(--cc-border); border-radius: 9px; padding: 8px 9px; background: var(--cc-layer); }
.cc-cloud-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cc-cloud-title { font-size: 10.5px; font-weight: 700; letter-spacing: .04em; color: var(--cc-secondary); }
.cc-cloud-eval { font-weight: 750; font-variant-numeric: tabular-nums; }
.cc-cloud-depth { color: var(--cc-muted); font-size: 10px; margin: 1px 0 4px; }
.cc-cloud-line { display: flex; gap: 7px; font-size: 11px; padding-top: 3px; border-top: 1px solid var(--cc-border); margin-top: 3px; }
.cc-cloud-line-eval { font-weight: 650; flex: none; font-variant-numeric: tabular-nums; }
.cc-pv-line { font-size: 11px; color: var(--cc-secondary); line-height: 1.45; word-break: break-word; }
.cc-cloud-hint { font-size: 10.5px; line-height: 1.45; }

.cc-opening { border: 1px solid var(--cc-border); border-radius: 9px; padding: 8px 9px; background: var(--cc-bg); }
.cc-opening-name { font-size: 12px; font-weight: 700; }
.cc-opening-moves { display: flex; flex-direction: column; gap: 2px; margin: 5px 0; }
.cc-opening-move {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--cc-text);
  font: inherit;
  display: grid;
  grid-template-columns: 42px 36px minmax(40px, 1fr) 30px;
  align-items: center;
  gap: 5px;
  padding: 3px 2px;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
}
.cc-opening-move:hover { background: var(--cc-layer); }
.cc-opening-san { font-size: 11.5px; font-weight: 600; }
.cc-opening-count { font-size: 9.5px; color: var(--cc-muted); font-variant-numeric: tabular-nums; }
.cc-opening-bar { display: flex; height: 4px; border-radius: 99px; overflow: hidden; background: var(--cc-layer-2); }
.cc-opening-bar i { height: 100%; }
.cc-opening-pct { font-size: 9.5px; color: var(--cc-muted); text-align: right; font-variant-numeric: tabular-nums; }
.cc-opening-footer { font-size: 9.5px; }

.cc-empty { border: 1px dashed var(--cc-border-strong); border-radius: 9px; padding: 10px; background: var(--cc-layer); }
.cc-empty strong { font-size: 12px; }
.cc-empty p { margin: 4px 0 0; font-size: 11.5px; color: var(--cc-secondary); }
.cc-empty-small { padding: 8px; }
.cc-empty-small p { margin: 0 0 4px; }
.cc-empty-warn { border-color: color-mix(in srgb, var(--cc-warn) 28%, var(--cc-border)); }
.cc-empty-result { text-align: center; padding: 16px 10px; border-style: solid; }
.cc-empty-result strong { font-size: 14px; }

.cc-skeleton { border: 1px solid var(--cc-border); border-radius: 9px; padding: 12px; background: var(--cc-layer); display: flex; flex-direction: column; gap: 7px; }
.cc-skeleton span { display: block; height: 8px; border-radius: 4px; background: var(--cc-layer-3); animation: cc-shimmer 1.4s ease-in-out infinite; }
.cc-skeleton span:nth-child(2) { width: 82%; animation-delay: .15s; }
.cc-skeleton span:nth-child(3) { width: 64%; animation-delay: .3s; }
.cc-skeleton p { margin: 2px 0 0; font-size: 11px; color: var(--cc-muted); }
@keyframes cc-shimmer { 0%, 100% { opacity: .45; } 50% { opacity: .95; } }

.cc-footer { display: flex; flex-direction: column; gap: 3px; padding: 14px 2px 2px; font-size: 10px; color: var(--cc-muted); line-height: 1.45; }
.cc-text-btn { appearance: none; border: 0; background: none; color: var(--cc-accent); font: inherit; font-size: 10.5px; padding: 0; cursor: pointer; text-align: left; width: fit-content; }

.cc-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: rgba(10, 12, 16, .48);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}
.cc-modal {
  width: min(560px, calc(100vw - 24px));
  max-height: min(760px, calc(100vh - 24px));
  overflow-y: auto;
  background: var(--cc-bg);
  color: var(--cc-text);
  border: 1px solid var(--cc-border-strong);
  border-radius: 16px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, .32);
  padding: 16px;
}
.cc-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.cc-modal-head h3 { margin: 0; font-size: 16px; letter-spacing: -.01em; }
.cc-modal-head p { margin: 2px 0 0; font-size: 11px; color: var(--cc-muted); }
.cc-modal-body { display: flex; flex-direction: column; gap: 10px; }
.cc-modal-actions { display: flex; justify-content: flex-end; gap: 6px; padding-top: 2px; }
.cc-settings-section { border-top: 1px solid var(--cc-border); padding-top: 10px; display: flex; flex-direction: column; gap: 9px; }
.cc-settings-section:first-child { border-top: 0; padding-top: 0; }
.cc-settings-section h4 { margin: 0; font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em; color: var(--cc-muted); }
.cc-engine-card { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--cc-border); border-radius: 9px; padding: 8px; background: var(--cc-layer); }
.cc-engine-state { display: flex; align-items: flex-start; gap: 7px; min-width: 0; }
.cc-engine-state b { display: block; font-size: 11.5px; }
.cc-engine-state small { display: block; font-size: 9.5px; color: var(--cc-muted); line-height: 1.35; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-engine-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--cc-danger); flex: none; margin-top: 4px; }
.cc-engine-card.is-ready .cc-engine-dot { background: var(--cc-good); }
.cc-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--cc-secondary); }
.cc-field > span { display: flex; justify-content: space-between; gap: 8px; }
.cc-field b { color: var(--cc-text); }
.cc-field select, .cc-field input[type="range"] { width: 100%; }
.cc-field select {
  border: 1px solid var(--cc-border);
  border-radius: 7px;
  background: var(--cc-layer);
  color: var(--cc-text);
  padding: 6px 7px;
  font: inherit;
  font-size: 10.5px;
}
.cc-field input[type="range"] { accent-color: var(--cc-accent); }
.cc-toggle-row { display: flex; align-items: center; gap: 10px; cursor: pointer; position: relative; }
.cc-toggle-row > span { flex: 1; display: flex; flex-direction: column; }
.cc-toggle-row b { font-size: 11.5px; font-weight: 600; }
.cc-toggle-row small { font-size: 10px; color: var(--cc-muted); }
.cc-toggle-row input { position: absolute; opacity: 0; pointer-events: none; }
.cc-toggle-row i { width: 30px; height: 18px; border-radius: 99px; background: var(--cc-layer-3); position: relative; flex: none; transition: background .15s ease; }
.cc-toggle-row i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s ease; box-shadow: 0 1px 2px rgba(0, 0, 0, .25); }
.cc-toggle-row input:checked + i { background: var(--cc-accent); }
.cc-toggle-row input:checked + i::after { transform: translateX(12px); }
.cc-segmented { display: flex; gap: 2px; padding: 2px; border-radius: 7px; background: var(--cc-layer-2); width: fit-content; }
.cc-segmented button { appearance: none; border: 0; background: transparent; color: var(--cc-secondary); font: inherit; font-size: 11px; padding: 4px 12px; border-radius: 5px; cursor: pointer; }
.cc-segmented button.is-active { background: var(--cc-bg); color: var(--cc-text); box-shadow: 0 1px 2px rgba(0, 0, 0, .12); font-weight: 600; }
.cc-textarea { width: 100%; min-height: 92px; resize: vertical; border: 1px solid var(--cc-border); border-radius: 8px; padding: 8px; background: var(--cc-layer); color: var(--cc-text); font-family: var(--ds-font-family-code, Consolas, monospace); font-size: 10.5px; line-height: 1.45; box-sizing: border-box; }
.cc-fen-input { min-height: 76px; }
.cc-pgn-input { min-height: 190px; }
.cc-form-error { margin: 0; font-size: 11px; color: var(--cc-danger); }

.cc-promotion-backdrop { position: fixed; inset: 0; z-index: 2147483001; background: rgba(10, 12, 16, .35); display: flex; align-items: center; justify-content: center; }
.cc-promotion { background: var(--cc-bg); border: 1px solid var(--cc-border-strong); border-radius: 14px; box-shadow: 0 12px 40px rgba(0, 0, 0, .3); padding: 12px; display: flex; align-items: center; gap: 4px; }
.cc-promotion-title { font-size: 11px; color: var(--cc-muted); padding: 0 6px; }
.cc-promotion-choice { appearance: none; border: 1px solid var(--cc-border); background: var(--cc-layer); border-radius: 8px; width: 42px; height: 42px; font-size: 29px; line-height: 1; cursor: pointer; display: grid; place-items: center; }
.cc-promotion-choice:hover { background: var(--cc-layer-2); }
.cc-promotion-choice.cc-piece-w { color: #fff; text-shadow: 0 0 1px #333, 0 1px 0 #333, 1px 0 0 #333, -1px 0 0 #333; }
.cc-promotion-choice.cc-piece-b { color: #1d2025; }
.cc-promotion-cancel { appearance: none; border: 0; background: none; color: var(--cc-muted); font: inherit; font-size: 10px; cursor: pointer; padding: 0 4px; }

.cc-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 2147483002; background: var(--dsw-alias-toast-bg, #26282d); color: var(--dsw-alias-toast-label, #fff); font-size: 11.5px; padding: 7px 13px; border-radius: 99px; box-shadow: 0 4px 20px rgba(0, 0, 0, .25); max-width: min(420px, calc(100vw - 32px)); text-align: center; }
.cc-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 380px) {
  .cc-header { padding-inline: 10px; }
  .cc-scroll { padding-inline: 8px; }
  .cc-brand-sub { display: none; }
  .cc-btn { min-height: 28px; padding-inline: 7px; }
  .cc-line { grid-template-columns: 14px 40px minmax(0, 1fr) 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .cc-root *, .cc-root *::before, .cc-root *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}
`

/**
 * En Croissant's visual language: charcoal surfaces, Mantine blue actions,
 * gray board, on-square coordinates, and paper-like bordered panels.
 * Kept as an override layer so the DSH-oriented base remains readable.
 */
const CROISSANT_CSS = `
.cc-root.cc-croissant {
  --cc-bg: #141414;
  --cc-layer: #1f1f1f;
  --cc-layer-2: #262626;
  --cc-layer-3: #2f2f2f;
  --cc-text: #f1f3f5;
  --cc-secondary: #adb5bd;
  --cc-muted: #868e96;
  --cc-border: #343a40;
  --cc-border-strong: #495057;
  --cc-accent: #228be6;
  --cc-accent-soft: rgba(34, 139, 230, .14);
  --cc-good: #51cf66;
  --cc-warn: #fcc419;
  --cc-danger: #ff6b6b;
  --cc-board-light: #e9ecef;
  --cc-board-dark: #868e96;
  --cc-white-bar: #f1f3f5;
  --cc-black-bar: #212529;
  --cc-draw-bar: #868e96;
  --cc-metric-white: #ced4da;
  --cc-metric-black: #212529;
  --cc-radius: 4px;
  background: #141414;
  color: #f1f3f5;
  font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
}
.cc-croissant .cc-header {
  padding: 9px 13px;
  background: #181818;
  border-bottom: 1px solid #2b2b2b;
}
.cc-croissant .cc-brand { gap: 8px; }
.cc-croissant .cc-brand-icon {
  width: 30px;
  height: 30px;
  border-radius: 4px;
  background: #242424;
  border: 1px solid #343434;
  font-size: 16px;
}
.cc-croissant .cc-brand-title {
  font-family: Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", serif;
  font-size: 14.5px;
  font-weight: 650;
  color: #f8f9fa;
}
.cc-croissant .cc-brand-sub { color: #868e96; font-size: 10px; margin-top: 1px; }
.cc-ai-chip {
  display: inline-block;
  margin-left: 5px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(34, 139, 230, .16);
  color: #74c0fc;
  font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: .04em;
  vertical-align: 1px;
}
.cc-croissant .cc-icon-btn { color: #adb5bd; border-radius: 3px; }
.cc-croissant .cc-icon-btn:hover { background: #2b2b2b; color: #f8f9fa; }
.cc-croissant .cc-scroll { padding: 10px 13px 18px; container-type: inline-size; }
.cc-workspace { display: grid; grid-template-columns: minmax(0, 1fr); gap: 11px; align-items: start; }
.cc-board-column { min-width: 0; }
.cc-croissant .cc-board-frame {
  width: 100%;
  max-width: 580px;
  margin-inline: auto;
  border-radius: 2px;
  box-shadow: 0 0 0 1px #343a40, 0 2px 10px rgba(0, 0, 0, .25);
  background: #868e96;
}
.cc-croissant .cc-player-bar,
.cc-croissant .cc-eval,
.cc-croissant .cc-result-banner,
.cc-croissant .cc-board-meta,
.cc-croissant .cc-controls,
.cc-croissant .cc-library-actions {
  width: 100%;
  max-width: 580px;
  margin-inline: auto;
}
.cc-player-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 23px;
  padding: 1px 2px;
  color: #adb5bd;
  font-size: 11.5px;
}
.cc-player-bar-bottom { margin-top: 3px; }
.cc-player-name { color: #f1f3f5; font-weight: 600; }
.cc-player-elo { color: #868e96; font-size: 10px; font-variant-numeric: tabular-nums; }
.cc-player-dot { width: 9px; height: 9px; border-radius: 50%; border: 1px solid #495057; flex: none; }
.cc-player-dot-w { background: #f8f9fa; }
.cc-player-dot-b { background: #212529; border-color: #868e96; }
.cc-croissant .cc-square::before { z-index: 1; }
.cc-croissant .cc-last::before { background: rgba(34, 139, 230, .38); }
.cc-croissant .cc-selected::before { background: rgba(34, 139, 230, .48); }
.cc-croissant .cc-check::before { background: radial-gradient(circle at 50% 50%, rgba(224, 49, 49, .82) 0%, rgba(224, 49, 49, .38) 45%, transparent 72%); }
.cc-croissant .cc-square:hover::before { background: rgba(255, 255, 255, .12); }
.cc-croissant .cc-coord { font-size: 8px; font-weight: 600; opacity: .9; }
.cc-croissant .cc-light .cc-coord { color: #495057; }
.cc-croissant .cc-dark .cc-coord { color: #f1f3f5; }
.cc-croissant .cc-eval-track { height: 6px; border-radius: 0; background: #212529; border-color: #343a40; }
.cc-croissant .cc-eval-white { background: #f1f3f5; border-radius: 0; }
.cc-croissant .cc-eval-mid { background: rgba(255, 255, 255, .35); }
.cc-croissant .cc-eval-value { font-size: 14px; font-weight: 700; }
.cc-croissant .cc-eval-source { font-size: 10px; }
.cc-croissant .cc-board-meta { color: #adb5bd; font-size: 11px; }
.cc-croissant .cc-turn { color: #f1f3f5; }
.cc-croissant .cc-turn::before { border-radius: 2px; }
.cc-croissant .cc-controls { gap: 2px; }
.cc-croissant .cc-btn {
  background: #25262b;
  border-color: #373a40;
  color: #e9ecef;
  border-radius: 3px;
  font-size: 11.5px;
  min-height: 28px;
  font-weight: 500;
}
.cc-croissant .cc-btn:hover:not(:disabled) { background: #2c2e33; border-color: #4d5158; }
.cc-croissant .cc-btn-primary { background: #228be6; border-color: #228be6; color: #fff; }
.cc-croissant .cc-btn-primary:hover:not(:disabled) { background: #1c7ed6; border-color: #1c7ed6; }
.cc-croissant .cc-btn-ghost { background: transparent; }
.cc-croissant .cc-library-actions { gap: 4px; }
.cc-croissant .cc-link-btn { color: #74c0fc; }
.cc-croissant .cc-move-list { max-height: none; background: #1a1a1a; border-color: #343a40; border-radius: 3px; }
.cc-croissant .cc-move-row:nth-child(odd) { background: rgba(255, 255, 255, .025); }
.cc-croissant .cc-move { color: #dee2e6; border-radius: 2px; }
.cc-croissant .cc-move:hover:not(:disabled) { background: #2c2e33; }
.cc-croissant .cc-move.is-current { background: #228be6; color: #fff; }
.cc-croissant .cc-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-bottom: 1px solid #343a40;
  margin-bottom: 7px;
}
.cc-croissant .cc-tabs button {
  appearance: none;
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 7px 5px 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #868e96;
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
  white-space: nowrap;
}
.cc-croissant .cc-tabs button span { font-size: 11px; opacity: .8; }
.cc-croissant .cc-tabs button:hover { color: #ced4da; background: #1f1f1f; }
.cc-croissant .cc-tabs button.is-active {
  color: #f1f3f5;
  border-bottom-color: #228be6;
  background: #1f1f1f;
  font-weight: 600;
}
.cc-panel-content { min-width: 0; }
.cc-croissant .cc-coach-section { margin-top: 0; }
.cc-croissant .cc-coach { gap: 8px; }
.cc-croissant .cc-section-title { color: #868e96; font-size: 9.5px; letter-spacing: .09em; }
.cc-croissant .cc-verdict,
.cc-croissant .cc-next,
.cc-croissant .cc-plan,
.cc-croissant .cc-cloud,
.cc-croissant .cc-opening {
  background: #1a1a1a;
  border-color: #343a40;
  border-radius: 3px;
}
.cc-croissant .cc-verdict { background: #1a1a1a; }
.cc-croissant .cc-verdict p { color: #adb5bd; font-size: 11.5px; }
.cc-croissant .cc-verdict-pill { border-radius: 2px; }
.cc-croissant .cc-verdict-white { color: #74c0fc; background: rgba(34, 139, 230, .16); }
.cc-croissant .cc-verdict-black { color: #ff922b; background: rgba(255, 146, 43, .14); }
.cc-croissant .cc-next { background: linear-gradient(135deg, rgba(34, 139, 230, .13), #1a1a1a 70%); border-color: rgba(34, 139, 230, .38); }
.cc-croissant .cc-next::after { color: #228be6; opacity: .1; }
.cc-croissant .cc-next-label { color: #74c0fc; }
.cc-croissant .cc-next-move { font-family: Georgia, "Times New Roman", "Noto Serif SC", serif; font-size: 23px; color: #f8f9fa; }
.cc-croissant .cc-tactics li { background: rgba(252, 196, 25, .07); border-color: rgba(252, 196, 25, .2); border-radius: 3px; }
.cc-croissant .cc-tactics li::before { color: #fcc419; }
.cc-croissant .cc-plan-title { color: #f1f3f5; }
.cc-croissant .cc-plan li { color: #adb5bd; }
.cc-croissant .cc-metric-bar { border-radius: 2px; height: 4px; }
.cc-croissant .cc-metric-white { background: #ced4da; }
.cc-croissant .cc-facts span { background: #1f1f1f; border-color: #343a40; border-radius: 2px; }
.cc-croissant .cc-footer { color: #6c757d; padding-top: 10px; font-size: 9.5px; }
.cc-croissant .cc-text-btn { color: #74c0fc; }
.cc-engine-note { display: flex; align-items: center; gap: 6px; margin-top: 8px; color: #868e96; font-size: 10px; }
.cc-croissant .cc-inline-error { border-radius: 3px; }
.cc-croissant .cc-empty { background: #1a1a1a; border-color: #495057; border-radius: 3px; }
.cc-croissant .cc-empty strong { color: #f1f3f5; }
.cc-croissant .cc-empty p { color: #adb5bd; }
.cc-croissant .cc-modal { background: #1a1a1a; border-color: #495057; border-radius: 8px; }
.cc-croissant .cc-modal-head h3 { font-family: Georgia, "Noto Serif SC", serif; }
.cc-croissant .cc-settings-section h4 { color: #868e96; }
.cc-croissant .cc-engine-card { background: #1f1f1f; border-color: #343a40; border-radius: 3px; }
.cc-croissant .cc-field select, .cc-croissant .cc-field input { background: #1f1f1f; border-color: #495057; border-radius: 3px; color: #f1f3f5; }
.cc-croissant .cc-textarea { background: #1f1f1f; border-color: #495057; border-radius: 3px; color: #f1f3f5; }
.cc-croissant .cc-segmented { background: #262626; border-radius: 3px; }
.cc-croissant .cc-segmented button.is-active { background: #343a40; color: #fff; }
.cc-croissant .cc-toggle-row i { background: #343a40; }
.cc-croissant .cc-promotion { background: #1a1a1a; border-color: #495057; border-radius: 6px; }
.cc-croissant .cc-promotion-choice { background: #1f1f1f; border-color: #343a40; border-radius: 3px; }
.cc-croissant .cc-toast { background: #25262b; color: #f1f3f5; border-radius: 3px; }
.cc-croissant .cc-piece {
  display: block;
  width: 92%;
  height: 92%;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  font-size: 0;
  line-height: 0;
  transform: none;
  text-shadow: none;
  color: transparent;
}
.cc-croissant .cc-promotion-choice .cc-piece { width: 34px; height: 34px; }
.cc-croissant .cc-piece-w,
.cc-croissant .cc-piece-b { color: transparent; text-shadow: none; }

@container (min-width: 980px) {
  .cc-workspace { grid-template-columns: minmax(360px, 1fr) 360px; gap: 14px; }
  .cc-board-column { position: sticky; top: 0; }
  .cc-croissant .cc-board-frame,
  .cc-croissant .cc-player-bar,
  .cc-croissant .cc-eval,
  .cc-croissant .cc-result-banner,
  .cc-croissant .cc-board-meta,
  .cc-croissant .cc-controls,
  .cc-croissant .cc-library-actions { max-width: 700px; }
  .cc-panel-content { max-height: calc(100vh - 172px); overflow-y: auto; scrollbar-width: thin; padding-right: 2px; }
}
@container (max-width: 979px) {
  .cc-panel-content { margin-top: 2px; }
}
@media (max-width: 430px) {
  .cc-tabs button { font-size: 9.5px; gap: 2px; }
  .cc-croissant .cc-scroll { padding-inline: 9px; }
}

/* En Croissant database browser */
.ec-panel { display: flex; flex-direction: column; gap: 8px; }
.ec-status-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ec-status { display: inline-flex; align-items: center; gap: 5px; color: #ced4da; font-size: 11px; font-weight: 600; }
.ec-status-actions { display: flex; gap: 4px; }
.ec-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.ec-dot.is-on { background: #51cf66; box-shadow: 0 0 0 2px rgba(81, 207, 102, .12); }
.ec-dot.is-off { background: #ff6b6b; }
.ec-field { display: flex; flex-direction: column; gap: 3px; font-size: 10px; color: #868e96; }
.ec-field select, .ec-field input {
  width: 100%;
  box-sizing: border-box;
  background: #1f1f1f;
  border: 1px solid #3b3f45;
  color: #e9ecef;
  border-radius: 3px;
  padding: 5px 6px;
  font: inherit;
  font-size: 11px;
  min-height: 27px;
}
.ec-field select:focus, .ec-field input:focus { outline: 1px solid #228be6; border-color: #228be6; }
.ec-filter-grid { display: grid; grid-template-columns: 1fr 1fr 0.8fr; gap: 5px; }
.ec-db-meta { display: flex; gap: 7px; flex-wrap: wrap; color: #868e96; font-size: 9.5px; }
.ec-db-meta span + span::before { content: "·"; margin-right: 7px; color: #495057; }
.ec-search-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ec-game-list { display: flex; flex-direction: column; border: 1px solid #343a40; border-radius: 3px; overflow: hidden; background: #1a1a1a; }
.ec-game-row {
  appearance: none;
  display: grid;
  grid-template-columns: 66px minmax(0, 1fr) 34px 55px;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: 0;
  border-bottom: 1px solid #2b2b2b;
  background: transparent;
  color: #dee2e6;
  text-align: left;
  padding: 5px 7px;
  font: inherit;
  cursor: pointer;
  position: relative;
}
.ec-game-row:last-child { border-bottom: 0; }
.ec-game-row:hover:not(:disabled) { background: #25262b; }
.ec-game-row:disabled { opacity: .55; cursor: default; }
.ec-game-date { color: #868e96; font-size: 9.5px; font-variant-numeric: tabular-nums; }
.ec-game-players { min-width: 0; display: flex; align-items: baseline; gap: 3px; flex-wrap: wrap; font-size: 10.5px; }
.ec-game-players b { color: #f1f3f5; font-weight: 600; overflow: hidden; text-overflow: ellipsis; max-width: 46%; }
.ec-game-players small { color: #868e96; font-size: 8.5px; }
.ec-game-players i { color: #495057; font-style: normal; font-size: 8.5px; }
.ec-game-result { font-size: 9px; color: #adb5bd; text-align: center; background: #262626; border-radius: 2px; padding: 1px 3px; }
.ec-game-result.ec-result-10 { color: #74c0fc; }
.ec-game-result.ec-result-01 { color: #ff922b; }
.ec-game-source { font-size: 8.5px; color: #6c757d; text-align: right; }
.ec-game-source.is-loadable { color: #74c0fc; }
.ec-row-spinner {
  position: absolute;
  right: 5px;
  bottom: 3px;
  width: 8px;
  height: 8px;
  border: 1px solid #495057;
  border-top-color: #228be6;
  border-radius: 50%;
  animation: cc-spin .7s linear infinite;
}
@keyframes cc-spin { to { transform: rotate(360deg); } }
.ec-load-more { align-self: center; }
.ec-note { margin: 1px 0 0; color: #6c757d; font-size: 9px; line-height: 1.45; }
.ec-note code { color: #adb5bd; }
.ec-empty, .ec-empty-small {
  border: 1px dashed #495057;
  border-radius: 3px;
  padding: 10px;
  background: #1a1a1a;
  color: #ced4da;
}
.ec-empty strong { display: block; font-size: 11.5px; color: #f1f3f5; }
.ec-empty p { margin: 4px 0 0; font-size: 10.5px; }
.ec-empty code, .ec-empty-small code { color: #adb5bd; background: #262626; padding: 1px 3px; border-radius: 2px; }
.ec-empty-small { font-size: 10.5px; }
`

const CSS = `${BASE_CSS}\n${PIECE_CSS}\n${CROISSANT_CSS}`

/**
 * Inject one scoped stylesheet for the plugin. The style element is append-only
 * for the page lifetime; HMR reloads reuse it instead of duplicating rules.
 */
export function injectStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
