/* Cross-stitch embroidery drawn as SVG. Shapes follow traditional Bulgarian symbols. */
/* Grids: 'r' dark red stitch, 'g' deep green stitch, '.' bare linen. Shapes follow traditional Bulgarian symbols. */
function blank(w, hgt) { return Array.from({ length: hgt }, () => Array(w).fill('.')); }
function stamp(g, rows, ox, oy) { rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') g[oy + y][ox + x] = c; })); }
function toRows(g) { return g.map(r => r.join('')); }
function diamondGrid(radius, fn) {
  const n = radius * 2 + 1, g = blank(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = Math.abs(x - radius), dy = Math.abs(y - radius), d = dx + dy;
    const c = fn(d, dx, dy, x, y);
    if (c) g[y][x] = c;
  }
  return g;
}
/* Слънце (sun): open diamond with small caps at the four tips */
const SLANTSE = toRows(diamondGrid(8, (d, dx, dy) =>
  d === 7 ? 'r' : (d === 8 && Math.min(dx, dy) <= 1) ? 'g' : ''));
/* Любов (love): diamond with a small heart-diamond inside and curled hooks at the tips */
function lyubov() {
  const R = 9, g = diamondGrid(R, (d) => d === 6 ? 'r' : d === 2 ? 'r' : d === 0 ? 'g' : '');
  const hook = [[0, -7], [0, -8], [1, -9], [2, -9], [2, -8]];      // top tip curling to one side
  const rot = ([x, y], k) => { for (let i = 0; i < k; i++) [x, y] = [-y, x]; return [x, y]; };
  for (let k = 0; k < 4; k++) hook.forEach(p => { const [x, y] = rot(p, k); g[R + y][R + x] = 'g'; });
  return toRows(g);
}
const LYUBOV = lyubov();
/* Общност (community): diamond holding four small diamonds around a centre */
function obshtnost() {
  const R = 7, g = diamondGrid(R, d => d === 7 ? 'r' : d === 0 ? 'g' : '');
  [[0, -3], [0, 3], [-3, 0], [3, 0]].forEach(([cx, cy]) => {
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (Math.abs(x) + Math.abs(y) === 1) g[R + cy + y][R + cx + x] = 'r';
  });
  return toRows(g);
}
const OBSHTNOST = obshtnost();
/* Затворена опитност: solid diamond with an eight-pointed star left in the linen */
const ZATVORENA = toRows(diamondGrid(6, (d, dx, dy) => {
  if (d > 6) return '';
  const star = (dx === 0 && dy <= 4) || (dy === 0 && dx <= 4) || (dx === dy && dx <= 2);
  if (d === 0) return 'g';
  return star ? '' : 'r';
}));
/* Вечност (eternity): toothed outer ring, concentric rings, point at the heart */
const VECHNOST = toRows(diamondGrid(9, (d, dx, dy, x) =>
  d === 9 ? 'r' : d === 8 ? (x % 2 ? 'r' : '') : d === 6 ? 'r' : d === 4 ? 'g' : d === 2 ? 'r' : d === 0 ? 'r' : ''));
export const DIAMOND = toRows(diamondGrid(2, d => d === 2 ? 'g' : d === 0 ? 'r' : ''));
export const ROSETTE = toRows(diamondGrid(2, d => d === 2 ? 'r' : d === 1 ? 'g' : ''));
const SMALL_RING = toRows(diamondGrid(3, d => d === 3 ? 'r' : d === 0 ? 'g' : ''));

function headerGrid() {
  const W = 40, H = 23, g = blank(W, H), mid = 11;
  // любов spans cols 0-18, общност cols 22-36; the hooks reach across the gaps
  stamp(g, LYUBOV, 0, 2);
  stamp(g, OBSHTNOST, 22, 4);
  for (const x of [38]) g[mid][x] = 'r';
  for (let x = 0; x < W; x += 2) { g[0][x] = 'r'; g[H - 1][x] = 'r'; }
  return g;
}
function footerGrid() {
  const W = 8, g = blank(W, 11);
  stamp(g, SMALL_RING, 0, 2);
  g[5][7] = 'g';
  for (let x = 0; x < W; x += 2) { g[0][x] = 'r'; g[10][x] = 'r'; }
  return g;
}
/* the tall towel ornament from the first reference */
function ornamentRows() {
  const W = 21, c = 10, top = blank(W, 18);
  const put = (y, xs, ch) => xs.forEach(x => { top[y][x] = ch || 'r'; });
  put(0, [c]); put(1, [c]);
  put(2, [c]); put(3, [c - 1, c + 1]); put(4, [c]);
  put(5, [c]);
  put(6, [c - 2, c, c + 2]); put(7, [c - 1, c, c + 1]);
  put(8, [c]);
  put(9, [c]); put(10, [c - 1, c + 1]); put(11, [c - 2, c + 2]); put(11, [c], 'g'); put(12, [c - 1, c + 1]); put(13, [c]);
  const side = toRows(diamondGrid(2, (d, dx, dy) => d === 2 || (dx === 1 && dy === 1) ? 'r' : d === 0 ? 'g' : ''));
  stamp(top, side, 1, 9); stamp(top, side, 15, 9);
  put(14, [c]);
  put(15, [c - 2, c, c + 2]); put(16, [c - 1, c, c + 1]);
  put(17, [c]);
  const t = toRows(top);
  return t.concat(VECHNOST.map(r => '.' + r + '.'), t.slice().reverse());
}
function dividerRows(symbol) {
  const n = symbol.length, arm = 20, W = n + arm * 2, g = blank(W, n), cy = (n - 1) / 2;
  stamp(g, symbol, arm, 0);
  for (let x = 4; x < arm - 1; x += 2) { g[cy][x] = 'r'; g[cy][W - 1 - x] = 'r'; }
  const ring = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  ring.forEach(([dx, dy]) => { g[cy + dy][1 + dx] = 'g'; g[cy + dy][W - 2 + dx] = 'g'; });
  return toRows(g);
}
export const HEADER = headerGrid();
export const FOOTER = footerGrid();
export const ORNAMENT = ornamentRows();
export const MEDAL = SLANTSE;
export const DIVIDERS = [dividerRows(ZATVORENA), dividerRows(LYUBOV), dividerRows(OBSHTNOST)];
let svgSeq = 0;
function crossPath(x, y, cell) {
  const p = cell * 0.22, x0 = x * cell + p, y0 = y * cell + p, x1 = (x + 1) * cell - p, y1 = (y + 1) * cell - p;
  return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'L' + x1.toFixed(1) + ' ' + y1.toFixed(1)
    + 'M' + x1.toFixed(1) + ' ' + y0.toFixed(1) + 'L' + x0.toFixed(1) + ' ' + y1.toFixed(1);
}
function stitchPaths(grid, cell) {
  const paths = { r: '', g: '' };
  grid.forEach((row, y) => [...row].forEach((c, x) => { if (paths[c] !== undefined) paths[c] += crossPath(x, y, cell); }));
  const sw = Math.max(1, cell * 0.24).toFixed(2);
  return ['r', 'g'].map(c => paths[c]
    ? '<path class="st-' + c + '" fill="none" stroke-linecap="round" stroke-width="' + sw + '" d="' + paths[c] + '"/>' : '').join('');
}
export function bandSVG(grid, cell) {
  const H = grid.length, W = grid[0].length, id = 'stitch' + (++svgSeq);
  return '<svg class="band" width="100%" height="' + (H * cell) + '" aria-hidden="true" focusable="false">'
    + '<defs><pattern id="' + id + '" width="' + (W * cell) + '" height="' + (H * cell) + '" patternUnits="userSpaceOnUse">'
    + stitchPaths(grid, cell) + '</pattern></defs><rect width="100%" height="100%" fill="url(#' + id + ')"/></svg>';
}
export function glyphSVG(rows, cell, cls) {
  const w = rows[0].length * cell, hh = rows.length * cell;
  return '<svg class="glyph ' + (cls || '') + '" width="' + w + '" height="' + hh + '" viewBox="0 0 ' + w + ' ' + hh
    + '" aria-hidden="true" focusable="false">' + stitchPaths(rows, cell) + '</svg>';
}
export function meterSVG(flags) {
  const cell = 14, gap = 6, w = flags.length * (cell + gap) - gap;
  let out = '';
  flags.forEach((on, i) => {
    const x0 = i * (cell + gap) + 2, y0 = 2, x1 = x0 + cell - 4, y1 = cell - 2;
    out += '<path class="' + (on ? (i % 2 ? 'st-g' : 'st-r') : 'st-f') + '" d="M' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y1 + 'M' + x1 + ' ' + y0 + 'L' + x0 + ' ' + y1 + '"/>';
  });
  return '<svg width="' + w + '" height="' + cell + '" viewBox="0 0 ' + w + ' ' + cell + '" aria-hidden="true" focusable="false" fill="none" stroke-width="2.6" stroke-linecap="round">' + out + '</svg>';
}

