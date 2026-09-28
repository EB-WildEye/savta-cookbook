import { DRIVE, LINK_ORDER, LANG_NAMES, SUGGESTED, UI, PARTS, ALL_TASKS, STATUSES } from './content.js';
import { HEADER, FOOTER, ORNAMENT, MEDAL, DIVIDERS, DIAMOND, ROSETTE, bandSVG, glyphSVG, meterSVG } from './motifs.js';

const API = '/api/entries';
const LANG_KEY = 'savta-cookbook-lang';
const NAME_KEY = 'savta-cookbook-name';
const POLL_MS = 20000;
const FILTERS = ['all', 'open', 'noheb', 'everyone', 'mine'];

/* ---------- small helpers ---------- */
function store(key, val) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val);
  } catch (e) { /* storage unavailable: preferences just aren't remembered */ }
  return null;
}
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'svg') el.innerHTML = v;            // only ever our own generated SVG
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(3)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
function pickLang() {
  const saved = store(LANG_KEY);
  if (saved && UI[saved]) return saved;
  const nav = (navigator.language || '').toLowerCase();
  if (nav.startsWith('de')) return 'de';
  if (nav.startsWith('he') || nav.startsWith('iw')) return 'he';
  return 'en';
}
const sameName = (a, b) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/* ---------- state ---------- */
const S = {
  lang: pickLang(),
  entries: [],
  load: 'loading',            // 'loading' | 'ready' | 'error'
  pending: 0,
  filter: 'all',
  openTask: null,
  confirmId: null,
  draft: { name: store(NAME_KEY) || '', part: '', status: 'todo' },
  message: null,              // { text, error }
  flash: new Set()
};
const u = () => UI[S.lang];
const entriesFor = id => S.entries.filter(e => e.task === id);

/* ---------- server ---------- */
async function api(method, body) {
  const res = await fetch(API, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
  if (!res.ok) { const err = new Error((data && data.error) || 'http_' + res.status); err.code = err.message; throw err; }
  return data;
}
function setEntries(next, markChanges) {
  if (markChanges) {
    const before = new Map(S.entries.map(e => [e.id, e.updatedAt]));
    next.forEach(e => { if (before.get(e.id) !== e.updatedAt) S.flash.add(e.id); });
  }
  S.entries = next;
}
async function refresh({ quiet } = {}) {
  try {
    const data = await api('GET');
    setEntries(data.entries, S.load === 'ready');
    S.load = 'ready';
  } catch (e) {
    if (!quiet || S.load !== 'ready') S.load = S.load === 'ready' ? 'ready' : 'error';
  }
  render();
}
function errorText(code) {
  if (code === 'rate_limited') return u().rate;
  if (code === 'not_found') return u().gone;
  return u().error;
}
async function mutate(body, optimistic) {
  const before = S.entries;
  S.entries = optimistic(S.entries.map(e => ({ ...e })));
  S.pending++; S.message = null;
  render();
  try {
    const data = await api('POST', body);
    setEntries(data.entries, false);
  } catch (e) {
    S.entries = before;
    S.message = { text: errorText(e.code), error: true };
    if (e.code === 'not_found') refresh({ quiet: true });
  } finally {
    S.pending--;
    render();
  }
}
function addEntry(task) {
  const name = S.draft.name.trim();
  if (!name) return false;
  store(NAME_KEY, name);
  const temp = { id: 'tmp-' + Date.now(), task: task.id, name, part: S.draft.part.trim(), status: S.draft.status, createdAt: Date.now(), updatedAt: Date.now() };
  S.flash.add(temp.id);
  S.openTask = null;
  S.draft = { name, part: '', status: 'todo' };
  mutate({ action: 'add', task: task.id, name: temp.name, part: temp.part, status: temp.status },
    list => [...list, temp]);
  return true;
}
function setStatus(entry, status) {
  if (entry.status === status || entry.id.startsWith('tmp-')) return;
  S.flash.add(entry.id);
  mutate({ action: 'status', id: entry.id, status },
    list => list.map(e => e.id === entry.id ? { ...e, status } : e));
}
function removeEntry(entry) {
  S.confirmId = null;
  mutate({ action: 'remove', id: entry.id }, list => list.filter(e => e.id !== entry.id));
}

/* ---------- filtering ---------- */
function matches(task) {
  const list = entriesFor(task.id);
  const me = store(NAME_KEY);
  switch (S.filter) {
    case 'open': return task.all || list.length < SUGGESTED;
    case 'noheb': return task.badge === 'noheb';
    case 'everyone': return !!task.all;
    case 'mine': return !!me && list.some(e => sameName(e.name, me));
    default: return true;
  }
}

/* ---------- rendering ---------- */
function statusControl(entry) {
  const t = u();
  return h('div', { class: 'seg', role: 'group', 'aria-label': t.statusLabel + ': ' + entry.name },
    STATUSES.map(s => h('button', {
      type: 'button', id: 'st-' + entry.id + '-' + s, 'data-s': s, 'aria-pressed': String(entry.status === s),
      disabled: entry.id.startsWith('tmp-'),
      onclick: () => setStatus(entry, s)
    }, t['st_' + s])));
}
function entryItem(entry) {
  const t = u(), confirming = S.confirmId === entry.id;
  const me = store(NAME_KEY);
  return h('li', {
    class: 'entry' + (S.flash.has(entry.id) ? ' flash' : '') + (me && sameName(entry.name, me) ? ' mine' : ''),
    'data-status': entry.status
  },
    h('span', { class: 'entry-who' },
      h('span', { class: 'entry-name', text: entry.name }),
      entry.part ? h('span', { class: 'entry-part', text: entry.part }) : null),
    statusControl(entry),
    confirming
      ? h('span', { class: 'confirm' }, t.removeQ,
          h('button', { type: 'button', class: 'yes', id: 'confirm-yes', onclick: () => removeEntry(entry) }, t.yes),
          h('button', { type: 'button', onclick: () => { S.confirmId = null; render(); } }, t.no))
      : h('button', {
          type: 'button', class: 'x', 'aria-label': t.remove + ': ' + entry.name, title: t.remove,
          disabled: entry.id.startsWith('tmp-'),
          onclick: () => { S.confirmId = entry.id; render('confirm-yes'); }
        }, '×'));
}
function joinForm(task) {
  const t = u();
  const name = h('input', { id: 'f-name', type: 'text', maxlength: 40, required: true, autocomplete: 'name',
    oninput: e => { S.draft.name = e.target.value; } });
  name.value = S.draft.name;
  const part = h('input', { id: 'f-part', type: 'text', maxlength: 80, placeholder: task.ex[S.lang],
    oninput: e => { S.draft.part = e.target.value; } });
  part.value = S.draft.part;
  const status = h('select', { id: 'f-status', onchange: e => { S.draft.status = e.target.value; } },
    STATUSES.map(s => h('option', { value: s, selected: S.draft.status === s }, t['st_' + s])));
  return h('form', {
    class: 'join-form',
    onsubmit: ev => { ev.preventDefault(); if (!addEntry(task)) { name.focus(); name.reportValidity(); } }
  },
    h('label', null, t.nameLabel, name),
    h('label', null, t.partLabel, part),
    h('label', null, t.statusLabel, status),
    h('div', { class: 'actions' },
      h('button', { type: 'submit', class: 'btn btn-primary' }, t.add),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { S.openTask = null; render('take-' + task.id); } }, t.cancel)));
}
function taskRow(task) {
  const t = u(), list = entriesFor(task.id);
  const left = SUGGESTED - list.length, crowded = !task.all && left <= 0;
  const isOpen = S.openTask === task.id;
  return h('tr', { id: 'task-' + task.id },
    h('td', { class: 'c-task', 'data-label': t.colTask },
      h('h3', { class: 'serif' }, h('span', { svg: glyphSVG(ROSETTE, 3.4) }), task.t[S.lang]),
      task.badge ? h('span', { class: 'badge ' + task.badge, text: t['badge_' + task.badge] }) : null,
      h('p', { class: 'task-desc', text: task.d[S.lang] }),
      h('p', { class: 'task-links' }, task.links.map(k => h('a', { href: DRIVE[k], target: '_blank', rel: 'noopener' }, t['link_' + k])))),
    h('td', { class: 'c-tip', 'data-label': t.colTip }, h('p', { text: task.tip[S.lang] })),
    h('td', { class: 'c-who', 'data-label': t.colWho },
      S.load === 'loading' ? h('p', { class: 'muted', text: t.loading })
        : list.length ? h('ul', { class: 'entries' }, list.map(entryItem))
        : h('p', { class: 'muted nobody', text: t.nobody }),
      S.load === 'ready' && !isOpen ? h('div', { class: 'join-row' },
        h('button', {
          type: 'button', id: 'take-' + task.id, class: 'btn ' + (crowded ? 'btn-soft' : 'btn-primary'),
          onclick: () => { S.openTask = task.id; S.confirmId = null; render('f-name'); }
        }, t.take),
        !task.all && list.length ? h('span', { class: 'slots', text: crowded ? t.crowded : t.slots(left) }) : null) : null,
      isOpen ? joinForm(task) : null));
}
function stats() {
  const t = u(), counts = { todo: 0, doing: 0, done: 0 };
  S.entries.forEach(e => { counts[e.status]++; });
  const total = S.entries.length || 1;
  return h('div', { class: 'stats', role: 'group', 'aria-label': t.statsLabel },
    h('div', { class: 'bar', 'aria-hidden': 'true' },
      ['done', 'doing', 'todo'].map(s => h('span', { class: 'bar-' + s, style: 'width:' + (counts[s] / total * 100) + '%' }))),
    h('ul', { class: 'stat-list' },
      STATUSES.map(s => h('li', null, h('span', { class: 'dot dot-' + s, 'aria-hidden': 'true' }), h('b', { text: counts[s] }), ' ', t['st_' + s]))));
}
function render(focusId) {
  const t = u();
  const active = document.activeElement;
  const keepFocus = focusId || (active && active.id) || null;
  const caret = active && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;

  const root = document.documentElement;
  root.lang = S.lang; root.dir = S.lang === 'he' ? 'rtl' : 'ltr';
  document.title = t.title;

  const coverage = ALL_TASKS.map(task => entriesFor(task.id).length > 0);
  const covered = coverage.filter(Boolean).length;

  const cloth = h('div', { class: 'cloth' },
    h('div', { svg: bandSVG(HEADER, 3.8) }),
    h('div', { class: 'wrap topbar' },
      h('div', { class: 'langs', role: 'group', 'aria-label': t.langLabel },
        Object.keys(LANG_NAMES).map(code => h('button', {
          type: 'button', class: 'lang', id: 'lang-' + code, lang: code, 'aria-pressed': String(code === S.lang),
          onclick: () => { S.lang = code; store(LANG_KEY, code); render(); }
        }, LANG_NAMES[code])))),
    h('header', { class: 'wrap hero' },
      h('div', { class: 'hero-orn', svg: glyphSVG(ORNAMENT, 3.6) }),
      h('div', { class: 'hero-text' },
        h('h1', { class: 'serif', text: t.title }),
        h('p', { class: 'bg-line serif', lang: 'bg', text: 'Рецептите на баба' }),
        h('p', { class: 'purpose serif', text: t.purpose }),
        h('p', { class: 'intro', text: t.intro }),
        h('div', { class: 'meter' },
          h('div', { svg: meterSVG(coverage) }),
          h('p', { text: t.progress.replace('{a}', covered).replace('{b}', ALL_TASKS.length) }))),
      h('div', { class: 'hero-orn', svg: glyphSVG(ORNAMENT, 3.6) })));

  const drive = h('section', { class: 'wrap drive', 'aria-labelledby': 'drive-title' },
    h('h2', { id: 'drive-title', class: 'serif', text: t.driveTitle }),
    h('p', { text: t.driveSub }),
    h('ul', { class: 'drive-links' },
      LINK_ORDER.map(k => h('li', null, h('a', { href: DRIVE[k], target: '_blank', rel: 'noopener' },
        h('span', { svg: glyphSVG(DIAMOND, 2.8) }), t['link_' + k])))));

  const board = h('section', { class: 'wrap board', 'aria-labelledby': 'board-title' },
    h('h2', { id: 'board-title', class: 'serif', text: t.tableTitle }),
    h('p', { class: 'board-sub', text: t.tableSub }),
    S.load === 'ready' && S.entries.length ? stats() : null,
    h('div', { class: 'filters', role: 'group', 'aria-label': t.filterLabel },
      FILTERS.filter(f => f !== 'mine' || store(NAME_KEY)).map(f => h('button', {
        type: 'button', class: 'filter', id: 'filter-' + f, 'aria-pressed': String(S.filter === f),
        onclick: () => { S.filter = f; render(); }
      }, t['f_' + f]))),
    S.load === 'error' ? h('div', { class: 'notice', role: 'alert' },
      h('p', { text: t.loadError }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { S.load = 'loading'; render(); refresh(); } }, t.retry))) : null);

  const visibleParts = PARTS.map((p, i) => ({ p, i, tasks: p.tasks.filter(matches) })).filter(x => x.tasks.length);
  const parts = visibleParts.map(({ p, i, tasks }) => [
    h('div', { class: 'divider', svg: glyphSVG(DIVIDERS[i % DIVIDERS.length], 4) }),
    h('section', { class: 'wrap wide part', 'aria-labelledby': 'part-' + i },
      h('div', { class: 'part-head' },
        h('div', { class: 'medal', 'aria-hidden': 'true' },
          h('div', { class: 'medal-art', svg: glyphSVG(MEDAL, 4.6) }), h('span', { class: 'serif', text: p.num })),
        h('h2', { id: 'part-' + i, class: 'serif', text: p.t[S.lang] })),
      h('p', { class: 'part-sub', text: p.sub[S.lang] }),
      h('div', { class: 'table-card' },
        h('table', { class: 'tasks' },
          h('colgroup', null, h('col', { class: 'col-task' }), h('col', { class: 'col-tip' }), h('col', { class: 'col-who' })),
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: t.colTask }), h('th', { scope: 'col', text: t.colTip }), h('th', { scope: 'col', text: t.colWho }))),
          h('tbody', null, tasks.map(taskRow)))))
  ]);

  document.getElementById('app').replaceChildren(...[
    cloth, drive, board,
    parts.length ? parts : h('p', { class: 'wrap empty', text: t.emptyFilter }),
    h('div', { class: 'wrap' }, h('p', {
      class: 'status' + (S.message && S.message.error ? ' error' : ''), role: 'status', 'aria-live': 'polite',
      text: S.pending ? t.saving : (S.message ? S.message.text : '')
    })),
    h('div', { class: 'foot', svg: bandSVG(FOOTER, 3.5) })
  ].flat(3).filter(Boolean));

  S.flash.clear();
  if (keepFocus) {
    const el = document.getElementById(keepFocus);
    if (el) {
      el.focus({ preventScroll: true });
      if (caret && !focusId && 'setSelectionRange' in el) { try { el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* not a text field */ } }
    }
  }
}

/* ---------- start ---------- */
render();
refresh();
setInterval(() => {
  if (document.visibilityState === 'visible' && !S.pending && !S.openTask && !S.confirmId) refresh({ quiet: true });
}, POLL_MS);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !S.pending) refresh({ quiet: true });
});
