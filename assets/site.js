/* Caffè D'oro v2 · vanilla JS, no build step. A SHINNARE concept. */
(() => {
  'use strict';

  /* ================= utilities ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ss = (p, a, b) => { const x = clamp((p - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeOutQuart = x => 1 - Math.pow(1 - x, 4);
  const lerp = (a, b, x) => a + (b - a) * x;
  const rng = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const hash = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode is fine */ } }
  };
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const LITE = root.classList.contains('lite');
  const FINE = matchMedia('(pointer: fine)').matches && matchMedia('(hover: hover)').matches;
  const digits = s => (s || '').replace(/\D/g, '');
  const pad2 = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  root.classList.toggle('reduced', RM.matches);

  /* ================= language ================= */
  const DICT = window.I18N || { pt: {}, en: {} };
  let LANG = root.dataset.lang === 'en' ? 'en' : 'pt';
  const nb = s => s.replace(/(\d) (km|ml|°C|kg|g\b|un\b|pcs\b)/g, '$1 $2');
  const t = (k, v) => {
    let s = (DICT[LANG] && DICT[LANG][k]) ?? DICT.pt[k] ?? k;
    if (v) s = s.replace(/\{(\w+)\}/g, (_, n) => (v[n] ?? ''));
    return nb(s);
  };
  const locale = () => (LANG === 'en' ? 'en-US' : 'pt-BR');
  const money = v => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'BRL' }).format(v);
  const CURSOR_WORDS = { pt: { view: 'Ver', drag: 'Arraste', hold: 'Segure' }, en: { view: 'View', drag: 'Drag', hold: 'Hold' } };
  const langHooks = [];

  function splitWords(el, text) {                       // hero bands: word spans driven by --k
    const words = text.trim().split(/\s+/);
    const r = rng(hash(text));
    const n = words.filter(w => w !== '/').length;
    el.textContent = '';
    const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = text.replace(/ \/ /g, ' ');
    const vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
    let i = 0;
    words.forEach((w, wi) => {
      if (w === '/') { vis.appendChild(document.createElement('br')); return; }
      const s = document.createElement('span');
      s.className = 'w'; s.textContent = w;
      s.style.setProperty('--th', ((i / Math.max(1, n - 1)) * 0.5 + r() * 0.05).toFixed(3));
      if (el.dataset.fx === 'part') s.style.setProperty('--dir', i < n / 2 ? -1 : 1);
      vis.appendChild(s); i++;
      if (wi < words.length - 1 && words[wi + 1] !== '/') vis.appendChild(document.createTextNode(' '));
    });
    el.append(sr, vis);
  }
  function splitReveal(el, text) {                      // section headings: masked words rise in
    el.textContent = '';
    let i = 0;
    text.split(' / ').forEach((line, li) => {
      if (li) el.appendChild(document.createElement('br'));
      const words = line.trim().split(/\s+/);
      words.forEach((w, wi) => {
        const o = document.createElement('span'); o.className = 'rw';
        const inner = document.createElement('span'); inner.className = 'rwi';
        inner.style.setProperty('--d', (i++ * 0.06).toFixed(2) + 's');
        inner.textContent = w; o.appendChild(inner); el.appendChild(o);
        if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
      });
    });
  }
  let manWords = [], manLit = -1;
  function splitManifesto(el, text) {
    const keys = LANG === 'en' ? ['time.', 'time', 'pick,', 'roast', 'pour.'] : ['tempo.', 'tempo', 'colher,', 'torrar', 'servir.'];
    el.textContent = '';
    text.split(/\s+/).forEach((w, i, a) => {
      const s = document.createElement('span');
      s.className = 'mw' + (keys.includes(w.toLowerCase()) ? ' key' : '');
      s.textContent = w; el.appendChild(s);
      if (i < a.length - 1) el.appendChild(document.createTextNode(' '));
    });
    manWords = $$('.mw', el); manLit = -1;
  }
  function applyI18n(scope = document) {
    $$('[data-i18n]', scope).forEach(el => {
      const s = t(el.dataset.i18n);
      if (el.classList.contains('split')) splitWords(el, s);
      else if (el.classList.contains('rv')) splitReveal(el, s);
      else if (el.id === 'manText') splitManifesto(el, s);
      else el.textContent = s.replace(/ \/ /g, ' ');
    });
    $$('[data-i18n-attr]', scope).forEach(el => el.dataset.i18nAttr.split(';').forEach(pair => {
      const [a, k] = pair.split(':'); el.setAttribute(a, t(k));
    }));
  }
  function setLang(l) {
    LANG = l === 'en' ? 'en' : 'pt';
    root.dataset.lang = LANG; root.lang = LANG === 'en' ? 'en' : 'pt-BR';
    store.set('cdo-lang', LANG);
    document.title = t('meta.title');
    $('meta[name="description"]').setAttribute('content', t('meta.desc'));
    $$('button[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
    applyI18n();
    langHooks.forEach(fn => fn());
  }
  $$('button[data-lang]').forEach(b => b.addEventListener('click', () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang); }));

  /* ================= theme ================= */
  function syncTheme() {
    const th = root.dataset.theme;
    $$('[data-theme-toggle]').forEach(b => b.setAttribute('aria-label', t(th === 'dark' ? 'theme.toLight' : 'theme.toDark')));
    $('meta[name="theme-color"]').setAttribute('content', th === 'light' ? '#f4ede2' : '#130c08');
  }
  function setTheme(th, origin) {
    const apply = () => { root.dataset.theme = th; store.set('cdo-theme', th); syncTheme(); };
    if (document.startViewTransition && !RM.matches && origin) {
      const r = origin.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      root.style.setProperty('--vtx', x + 'px'); root.style.setProperty('--vty', y + 'px');
      root.style.setProperty('--vtr', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
      document.startViewTransition(apply);
    } else apply();
  }
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', b)));
  langHooks.push(syncTheme);

  /* ================= hero: layered scenes scrubbed by scroll ================= */
  const hero = $('.hero'), stage = $('#stage'), logoWrap = $('#logoWrap'), sD = $('#sD'), cue = $('#cue');
  const ramos = $$('.ramo');
  const bags = $$('.bag').map(el => ({ el, i: +el.dataset.i, t: '', o: '' }));
  const hbs = $$('.hb').filter(el => !(LITE && el.classList.contains('x-lite')))
    .map(el => ({ el, x: +el.dataset.x, y: +el.dataset.y, z: +el.dataset.z, r: +el.dataset.r, t: '', o: '' }));
  const bands = $$('.band').map(el => ({ el, a: +el.dataset.a, b: +el.dataset.b, op: -1, k: -1, vis: null, done: null, first: el.classList.contains('b1'), last: el.classList.contains('b4') }));
  bags.forEach(b => { b.el.style.zIndex = String(10 - Math.abs(b.i)); });

  let deferredDone = false;
  function loadDeferred() {                             // branches and bags appear later in the journey
    if (deferredDone) return; deferredDone = true;
    $$('img[data-src]').forEach(img => {
      if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.removeAttribute('data-srcset'); }
      img.src = img.dataset.src; img.removeAttribute('data-src');
    });
  }
  $$('.stage img').forEach(img => img.addEventListener('error', () => img.classList.add('broken')));

  let vw = innerWidth, vh = innerHeight, heroTop = 0, heroH = 0, heroRange = 1, bw = 200, portrait = false, lastW = innerWidth;
  let target = 0, shown = 0, rafId = null, lastTick = 0, heroOn = true, scrubOn = false, loadK = 0;
  const cache = new Map();
  const put = (el, prop, val) => {
    let c = cache.get(el); if (!c) { c = {}; cache.set(el, c); }
    if (c[prop] === val) return; c[prop] = val;
    if (prop.startsWith('--')) el.style.setProperty(prop, val); else el.style[prop] = val;
  };
  function measure() {
    vw = innerWidth; vh = stage.offsetHeight || innerHeight;
    heroTop = hero.offsetTop; heroH = hero.offsetHeight; heroRange = Math.max(1, heroH - stage.offsetHeight);
    docH = 0;
    portrait = matchMedia('(max-aspect-ratio: 4/5)').matches;
    const c = bags.find(b => b.i === 0); bw = c ? c.el.offsetWidth : 200;
  }
  const heroProgress = () => clamp((scrollY - heroTop) / heroRange, 0, 1);

  function renderScenes(p) {
    // A: the golden bean; the camera pushes in and loose beans fly past
    const tA = ss(p, 0.1, 0.26);
    put(logoWrap, 'transform', `scale(${(1 + 2.9 * tA * tA).toFixed(4)})`);
    put(logoWrap, 'opacity', (1 - ss(p, 0.15, 0.23)).toFixed(3));
    const push = ss(p, 0.03, 0.27), beanFade = 1 - ss(p, 0.19, 0.27);
    const yk = portrait ? 0.5 : 1;                     // on tall screens keep beans out of the text bands
    hbs.forEach(b => {
      const k = 1 + push * push * b.z * 2.6;
      const tr = `translate3d(${(b.x * k * vw / 100).toFixed(1)}px,${(b.y * yk * k * vh / 100).toFixed(1)}px,0) rotate(${(b.r + push * 70 * Math.sign(b.x)).toFixed(1)}deg) scale(${(1 + push * push * b.z * 1.6).toFixed(3)})`;
      if (tr !== b.t) { b.t = tr; b.el.style.transform = tr; }
      const o = beanFade.toFixed(3); if (o !== b.o) { b.o = o; b.el.style.opacity = o; }
    });
    // B: branches part in from both edges, then pass upward
    const enter = easeOut(ss(p, 0.13, 0.3)), exit = ss(p, 0.4, 0.5), fade = ss(p, 0.13, 0.2) * (1 - exit);
    const [r1, r2, r3] = ramos;
    put(r1, 'transform', `translate3d(${(-(1 - enter) * 0.62 * vw).toFixed(1)}px,${(-exit * 0.55 * vh).toFixed(1)}px,0) rotate(${(-16 + 8 * enter).toFixed(2)}deg)`);
    put(r2, 'transform', `translate3d(${((1 - enter) * 0.62 * vw).toFixed(1)}px,${(-exit * 0.8 * vh).toFixed(1)}px,0) rotate(${(12 - 6 * enter).toFixed(2)}deg)`);
    put(r3, 'transform', `translate3d(${(-(1 - enter) * 0.2 * vw).toFixed(1)}px,${(((1 - enter) * 0.5 - exit * 1.4) * vh).toFixed(1)}px,0) rotate(-6deg)`);
    put(r1, 'opacity', fade.toFixed(3)); put(r2, 'opacity', fade.toFixed(3)); put(r3, 'opacity', (fade * 0.7).toFixed(3));
    // C: nine bags drop one by one, outside in; Geisha lands last, then the headline arrives
    const vExit = ss(p, 0.76, 0.85), spread = portrait ? 0.5 : 0.62, maxI = portrait ? 2 : 4;
    bags.forEach(b => {
      const ai = Math.abs(b.i); if (ai > maxI) return;
      const st = ai === 0 ? 0.49 : 0.42 + (maxI - ai) * (portrait ? 0.025 : 0.016);
      const e = easeOutQuart(clamp((p - st) / 0.06, 0, 1));
      const s = 1 - ai * (portrait ? 0.1 : 0.075);
      const x = b.i * bw * spread - bw / 2;
      const y = -ai * vh * 0.012 - (1 - e) * vh * 1.15 + vExit * vh * 0.75;
      const tr = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${((1 - e) * (b.i % 2 ? 9 : -9)).toFixed(2)}deg) scale(${s.toFixed(3)})`;
      if (tr !== b.t) { b.t = tr; b.el.style.transform = tr; }
      const o = (ss(p, st, st + 0.008) * (1 - vExit)).toFixed(3); if (o !== b.o) { b.o = o; b.el.style.opacity = o; }
    });
    // D: the pour rises into place
    const tD = ss(p, 0.77, 0.9);
    put(sD, 'opacity', tD.toFixed(3));
    put(sD, 'transform', `translate3d(0,${((1 - tD) * 0.06 * vh).toFixed(1)}px,0) scale(${(1.16 - 0.16 * easeOut(tD)).toFixed(4)})`);
    cue.classList.toggle('gone', p > 0.02);
  }
  function renderBands(p) {
    bands.forEach(bd => {
      const { a, b } = bd, f = Math.min(0.035, (b - a) / 4);
      let op, k;
      if (bd.first) { op = 1 - ss(p, b - f, b); k = loadK; }
      else if (bd.last) { op = ss(p, a, a + f); k = clamp((p - a) / 0.1, 0, 1); }
      else { op = ss(p, a, a + f) * (1 - ss(p, b - f, b)); k = clamp((p - a) / Math.min(0.06, (b - a) * 0.35), 0, 1); }
      if (Math.abs(op - bd.op) > 0.004 || (op === 0) !== (bd.op === 0) || (op === 1) !== (bd.op === 1)) {
        bd.op = op; bd.el.style.opacity = op.toFixed(3);
        const vis = op < 0.005 ? 'hidden' : 'visible'; if (vis !== bd.vis) { bd.vis = vis; bd.el.style.visibility = vis; }
      }
      if (Math.abs(k - bd.k) > 0.008 || (k === 1 && bd.k !== 1) || (k === 0 && bd.k !== 0)) {
        bd.k = k; bd.el.style.setProperty('--k', k.toFixed(3));
        if (bd.last) {
          bd.el.style.setProperty('--kc0', clamp(k * 4, 0, 1).toFixed(3));
          bd.el.style.setProperty('--ks', clamp((k - 0.6) * 4, 0, 1).toFixed(3));
          bd.el.style.setProperty('--kb', clamp((k - 0.75) * 5, 0, 1).toFixed(3));
          const done = k > 0.95; if (done !== bd.done) { bd.done = done; bd.el.classList.toggle('done', done); }
        }
      }
    });
  }
  const render = p => { renderScenes(p); renderBands(p); };
  const K = LITE ? 0.22 : 0.13;
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now)); lastTick = now;
    shown += (target - shown) * (1 - Math.pow(1 - K, dt / 16.667));
    if (Math.abs(target - shown) < 0.0003) { shown = target; rafId = null; lastTick = 0; } else rafId = requestAnimationFrame(tick);
    render(shown);
  }
  function onHeroScroll() {
    target = heroProgress();
    if (target > 0.005) loadDeferred();
    if (rafId === null && heroOn) rafId = requestAnimationFrame(tick);
  }
  let loadStart = 0;
  function loadRamp(now) {
    if (!loadStart) loadStart = now;
    loadK = easeOut(clamp((now - loadStart - 500) / 1500, 0, 1));
    if (scrubOn) renderBands(shown);
    if (loadK < 1) requestAnimationFrame(loadRamp);
  }
  const GATES = ['(orientation: landscape) and (pointer: coarse) and (max-height: 560px)', '(prefers-reduced-motion: reduce)'];
  const MQLS = GATES.map(q => matchMedia(q));
  function clearInline() {
    [logoWrap, sD, ...ramos, ...bags.map(b => b.el), ...hbs.map(b => b.el)].forEach(el => { el.style.transform = ''; el.style.opacity = ''; });
    bands.forEach(bd => { bd.el.style.opacity = ''; bd.el.style.visibility = ''; ['--k', '--ks', '--kb', '--kc0'].forEach(v => bd.el.style.removeProperty(v)); bd.el.classList.remove('done'); });
    cache.clear(); bags.forEach(b => { b.t = ''; b.o = ''; }); hbs.forEach(b => { b.t = ''; b.o = ''; });
  }
  function enableScrub() {
    if (scrubOn) return; scrubOn = true;
    root.classList.add('scrub'); measure();
    bands.forEach(b => { b.op = -1; b.k = -1; b.vis = null; b.done = null; }); cache.clear();
    addEventListener('scroll', onHeroScroll, { passive: true });
    shown = target = heroProgress(); render(shown);
    if (root.classList.contains('go')) { loadStart = 0; requestAnimationFrame(loadRamp); }
  }
  function disableScrub() {
    if (!scrubOn) return; scrubOn = false;
    removeEventListener('scroll', onHeroScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    root.classList.remove('scrub'); clearInline();
  }
  function applyHeroMode() { if (MQLS.some(m => m.matches)) disableScrub(); else enableScrub(); rebuildSoon(); }
  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));
  new IntersectionObserver(es => es.forEach(e => {
    heroOn = e.isIntersecting; hero.classList.toggle('live', heroOn);
    if (heroOn && scrubOn) onHeroScroll();
  })).observe(hero);

  /* ================= intro (project presentation) ================= */
  const intro = $('#intro');
  function go() {
    root.classList.add('go');
    if (scrubOn) { loadStart = 0; requestAnimationFrame(loadRamp); }
    setTimeout(loadDeferred, 900);
  }
  if (root.classList.contains('intro-on')) {
    const behind = $$('body > header, body > section, body > main, body > footer, body > .skip');
    behind.forEach(el => { el.inert = true; });
    const enterBtn = $('#introEnter');
    setTimeout(() => enterBtn.focus({ preventScroll: true }), 900);
    const assets = ['assets/img/logo-s.webp', 'assets/img/grao-ouro.webp', 'assets/img/bean-1.webp', 'assets/img/bean-2b.webp', 'assets/img/bean-3.webp', 'assets/img/bean-4b.webp',
      innerWidth > 1000 ? 'assets/img/servido.webp' : 'assets/img/servido-m.webp', 'assets/img/xicara-ritual.webp'];
    let done = 0; const total = assets.length + 1;
    const bump = () => {
      done++;
      const f = done / total;
      $('#introBar').style.transform = `scaleX(${f})`;
      $('#introPct').textContent = f >= 1 ? t('intro.ready') : Math.round(f * 100) + '%';
    };
    assets.forEach(src => { const im = new Image(); im.onload = im.onerror = bump; im.src = src; });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(bump);
    intro.addEventListener('keydown', e => {                 // keep focus inside the dialog
      if (e.key !== 'Tab') return;
      const f = $$('button', intro); const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    enterBtn.addEventListener('click', () => {
      try { sessionStorage.setItem('cdo-intro', '1'); } catch { /* fine */ }
      window.scrollTo(0, 0);
      if (RM.matches) { root.classList.remove('intro-on'); behind.forEach(el => { el.inert = false; }); go(); return; }
      intro.classList.add('leaving');
      setTimeout(go, 350);
      setTimeout(() => { root.classList.remove('intro-on'); behind.forEach(el => { el.inert = false; }); rebuildSoon(); }, 1100);
    });
  } else go();

  /* ================= nav, progress, menu ================= */
  const nav = $('#nav'), menuBtn = $('#menuBtn'), mMenu = $('#mMenu'), prog = $('#progress');
  let navSolid = null, progLast = -1;
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', t(open ? 'nav.menuClose' : 'nav.menuOpen'));
    mMenu.hidden = !open;
    if (open) nav.classList.add('solid'); else { navSolid = null; frame(); }
  }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  $$('a', mMenu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  langHooks.push(() => menuBtn.setAttribute('aria-label', t(menuBtn.getAttribute('aria-expanded') === 'true' ? 'nav.menuClose' : 'nav.menuOpen')));

  /* ================= the golden thread ================= */
  const main = $('#main'), thread = $('#thread'), tPath = $('#threadPath'), spark = $('#spark');
  let tLen = 0, lut = [], tNodes = [], tLast = -1, mainTop = 0;
  function buildThread() {
    thread.style.height = '0px';
    const W = main.clientWidth, H = main.scrollHeight;
    mainTop = main.getBoundingClientRect().top + scrollY;
    thread.setAttribute('viewBox', `0 0 ${W} ${H}`); thread.style.height = H + 'px';
    const secs = $$('.sec', main);
    const gutter = (W - Math.min(1240, W)) / 2;
    const inset = gutter > 90 ? gutter * 0.5 : Math.max(8, Math.min(18, W * 0.025));
    const xl = inset, xr = W - inset, cx = W / 2;
    const padOf = s => parseFloat(getComputedStyle(s).paddingTop) || 100;
    let side = 0, d = '';
    const nodePts = [];
    secs.forEach((s, i) => {
      const top = s.offsetTop, pad = padOf(s), bottom = top + s.offsetHeight, x = side === 0 ? xl : xr;
      if (i === 0) d = `M ${cx} ${top} C ${cx} ${top + pad * 0.45}, ${x} ${top + pad * 0.3}, ${x} ${top + pad * 0.85}`;
      if (i === secs.length - 1) {
        const mark = $('.final-mark', s);
        const my = mark ? mark.getBoundingClientRect().top - main.getBoundingClientRect().top - 18 : top + pad;
        d += ` C ${x} ${my - pad * 0.2}, ${cx} ${my - pad * 0.7}, ${cx} ${my}`;
        nodePts.push([cx, my]); return;
      }
      const yEnd = bottom - pad * 0.55; d += ` L ${x} ${yEnd}`;
      const next = secs[i + 1], yTo = next.offsetTop + padOf(next) * 0.55, yMid = (yEnd + yTo) / 2, nx = side === 0 ? xr : xl;
      d += ` C ${x} ${yMid}, ${nx} ${yMid}, ${nx} ${yTo}`;
      nodePts.push([cx, yMid]); side = 1 - side;
    });
    tPath.setAttribute('d', d);
    tLen = tPath.getTotalLength();
    tPath.style.strokeDasharray = `${tLen} ${tLen}`;
    lut = [];
    const N = Math.ceil(tLen / (LITE ? 28 : 14));
    for (let i = 0; i <= N; i++) { const l = (i / N) * tLen; lut.push([tPath.getPointAtLength(l).y, l]); }
    $$('.node', thread).forEach(n => n.remove());
    tNodes = nodePts.map(([x, y]) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'node'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 4.5);
      thread.insertBefore(c, spark); return { el: c, len: lenAtY(y), lit: false };
    });
    tLast = -1; drawThread();
  }
  function lenAtY(y) {
    if (!lut.length) return 0;
    if (y <= lut[0][0]) return 0;
    let lo = 0, hi = lut.length - 1;
    if (y >= lut[hi][0]) return tLen;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lut[m][0] < y) lo = m; else hi = m; }
    const [y0, l0] = lut[lo], [y1, l1] = lut[hi];
    return l0 + (l1 - l0) * ((y - y0) / Math.max(0.0001, y1 - y0));
  }
  function drawThread() {
    if (!tLen) return;
    const len = RM.matches ? tLen : clamp(lenAtY(scrollY + innerHeight * 0.62 - mainTop), 0, tLen);
    if (Math.abs(len - tLast) < 0.5) return;
    tLast = len;
    tPath.style.strokeDashoffset = (tLen - len).toFixed(1);
    const on = len > 2 && len < tLen - 2 && !RM.matches;
    spark.classList.toggle('on', on);
    if (on) { const pt = tPath.getPointAtLength(len); spark.setAttribute('cx', pt.x.toFixed(1)); spark.setAttribute('cy', pt.y.toFixed(1)); }
    tNodes.forEach(n => { const lit = len >= n.len - 1; if (lit !== n.lit) { n.lit = lit; n.el.classList.toggle('lit', lit); } });
  }
  let rebuildT = 0, lastMainH = 0;
  function rebuildSoon() {
    clearTimeout(rebuildT);
    rebuildT = setTimeout(() => {
      measure(); buildThread(); lastMainH = main.offsetHeight;
      if (scrubOn) { target = shown = heroProgress(); render(shown); }
      marqueeMeasure(); navSolid = null; frame();
    }, 200);
  }
  // phones resize the viewport height while the URL bar slides; only real layout changes rebuild
  addEventListener('resize', () => {
    if (innerWidth !== lastW) { lastW = innerWidth; rebuildSoon(); }
    else if (scrubOn) { measure(); onHeroScroll(); }
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (Math.abs(main.offsetHeight - lastMainH) > 40) rebuildSoon(); }).observe(main);
  addEventListener('load', rebuildSoon);
  langHooks.push(rebuildSoon);

  /* ================= marquee (moves with the scroll's energy) ================= */
  const mqRows = $$('.mq-row').map(row => ({ row, track: $('.mq-track', row), dir: +row.dataset.dir, x: 0, half: 0 }));
  let mqOn = false, mqRaf = null, mqLast = 0, vel = 0, lastY = scrollY;
  function marqueeMeasure() {
    mqRows.forEach(m => {
      const tr = m.track;
      $$('.mq-clone', tr).forEach(c => c.remove());
      const base = [...tr.children];
      const unit = tr.scrollWidth || 1;
      // enough copies to cover two screens, and an even count so the -50% loop is seamless
      let copies = Math.max(2, Math.ceil((innerWidth * 2) / unit));
      if (copies % 2) copies++;
      for (let k = 1; k < copies; k++) base.forEach(n => { const c = n.cloneNode(true); c.classList.add('mq-clone'); c.removeAttribute('data-i18n'); tr.appendChild(c); });
      m.half = unit * copies / 2;
      m.x = m.dir > 0 ? -m.half : 0;
    });
  }
  function mqTick(now) {
    const dt = Math.min(0.05, (now - (mqLast || now)) / 1000); mqLast = now;
    vel *= Math.pow(0.9, dt * 60);
    mqRows.forEach(m => {
      m.x += m.dir * (40 + Math.min(900, Math.abs(vel) * 0.9)) * dt;
      if (m.x <= -m.half) m.x += m.half; if (m.x > 0) m.x -= m.half;
      m.track.style.transform = `translate3d(${m.x.toFixed(1)}px,0,0)`;
    });
    mqRaf = mqOn ? requestAnimationFrame(mqTick) : null;
    if (!mqRaf) mqLast = 0;
  }
  if (!LITE && !RM.matches) {
    new IntersectionObserver(es => es.forEach(e => {
      mqOn = e.isIntersecting && !RM.matches;
      if (mqOn && !mqRaf) mqRaf = requestAnimationFrame(mqTick);
    })).observe($('.marquee'));
  }

  /* ================= one scroll frame for the page-wide effects ================= */
  let frameReq = null, docH = 0;
  function frame() {
    frameReq = null;
    // reads first, writes after, so a scroll frame never forces an extra layout
    const y = scrollY;
    if (!docH) docH = document.documentElement.scrollHeight;
    const H = docH - innerHeight;
    const manRect = manVisible ? manText.getBoundingClientRect() : null;
    vel = vel * 0.6 + (y - lastY) * 0.4; lastY = y;
    const pr = H > 0 ? clamp(y / H, 0, 1) : 0;
    if (Math.abs(pr - progLast) > 0.001) { progLast = pr; prog.style.transform = `scaleX(${pr.toFixed(4)})`; }
    const solid = y > heroTop + heroH - 90 || menuBtn.getAttribute('aria-expanded') === 'true';
    if (solid !== navSolid) { navSolid = solid; nav.classList.toggle('solid', solid); }
    drawThread();
    manifestoUpdate(manRect);
  }
  addEventListener('scroll', () => { if (frameReq === null) frameReq = requestAnimationFrame(frame); }, { passive: true });

  /* ================= manifesto: words light up as you read ================= */
  const manText = $('#manText');
  let manVisible = false;
  new IntersectionObserver(es => es.forEach(e => { manVisible = e.isIntersecting; if (manVisible) manifestoUpdate(); }), { rootMargin: '10% 0px' }).observe(manText);
  function manifestoUpdate(rect) {
    if (!manVisible || !manWords.length) return;
    let n;
    if (RM.matches) n = manWords.length;
    else {
      const r = rect || manText.getBoundingClientRect(), vhh = innerHeight;
      const p = clamp((vhh * 0.85 - r.top) / (vhh * 0.4 + r.height), 0, 1);
      n = Math.round(p * manWords.length);
    }
    if (n === manLit) return;
    const from = Math.min(n, manLit < 0 ? 0 : manLit), to = Math.max(n, manLit < 0 ? manWords.length : manLit);
    for (let i = from; i < to; i++) manWords[i].classList.toggle('on', i < n);
    manLit = n;
  }

  /* ================= reveals, counters, living sections ================= */
  function runCount(el) {
    const to = +el.dataset.to, t0 = performance.now(); let lastV = -1;
    const step = now => { const v = Math.round(to * easeOut(clamp((now - t0) / 1400, 0, 1))); if (v !== lastV) { lastV = v; el.textContent = v; } if (v < to) requestAnimationFrame(step); };
    el.textContent = '0'; requestAnimationFrame(step);
  }
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; el.classList.add('in'); revealIO.unobserve(el);
    if (!RM.matches) $$('.count', el).forEach(runCount);
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => revealIO.observe(el));
  const liveIO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '10% 0px' });
  $$('.sec').forEach(s => liveIO.observe(s));
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  /* ================= cursor and magnetic buttons (mouse only) ================= */
  if (FINE && !LITE && !RM.matches) {
    root.classList.add('has-cursor');
    const cur = $('.cursor'), dot = $('.c-dot'), ringEl = $('.c-ring'), lab = $('.c-label');
    let mx = -100, my = -100, rx = -100, ry = -100, cRaf = null;
    const cTick = () => {
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      ringEl.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
      cRaf = Math.abs(mx - rx) + Math.abs(my - ry) > 0.3 ? requestAnimationFrame(cTick) : null;
    };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY; cur.classList.remove('hide');
      if (!cRaf) cRaf = requestAnimationFrame(cTick);
    }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.add('hide'));
    addEventListener('pointerdown', () => cur.classList.add('down'));
    addEventListener('pointerup', () => cur.classList.remove('down'));
    document.addEventListener('pointerover', e => {
      const el = e.target.closest('[data-cursor], a, button, summary, label, input, select');
      const word = el && el.dataset.cursor;
      cur.classList.toggle('label', !!word);
      cur.classList.toggle('hover', !!el && !word);
      lab.textContent = word ? CURSOR_WORDS[LANG][word] : '';
    });
    const mags = () => $$('.magnetic');
    document.addEventListener('pointermove', e => {
      const m = e.target.closest && e.target.closest('.magnetic'); if (!m) return;
      const r = m.getBoundingClientRect();
      m.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px,${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px)`;
    });
    document.addEventListener('pointerout', e => { const m = e.target.closest && e.target.closest('.magnetic'); if (m && !m.contains(e.relatedTarget)) m.style.transform = ''; });
    void mags;
  }

  /* ================= the ritual: hold to pour ================= */
  const rit = (() => {
    const stageEl = $('#ritStage'), cupEl = $('#ritCup'), cv = $('#ritCanvas'), ctx = cv.getContext('2d');
    const hold = $('#ritHold'), ringC = $('#holdRing'), label = $('#holdLabel'), mlEl = $('#ritMl'), doneEl = $('#ritDone'), again = $('#ritAgain');
    hold.dataset.cursor = 'hold';
    let W = 0, H = 0, cup = { cx: 0, cy: 0, rx: 0, ry: 0, s: 1 };
    let fill = 0, crema = 0, pouring = false, sTop = 0, sBot = 0, raf = null, last = 0, time = 0, visible = false, full = false, busy = false;
    let ripples = [], drops = [], rippleT = 0, dropT = 0, swirl = 0, uiT = 0;
    function measureRit() {
      const r = stageEl.getBoundingClientRect(); if (!r.width) return;
      const dpr = Math.min(devicePixelRatio || 1, LITE ? 1.5 : 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = cupEl.getBoundingClientRect(), s = c.width / 1254;
      cup = { cx: c.left - r.left + 622 * s, cy: c.top - r.top + 280 * s, rx: 322 * s, ry: 50 * s, s };
      draw();
    }
    const surf = f => { const e = easeOut(f); return { cy: cup.cy + (1 - e) * 72 * cup.s + 8 * cup.s * e, rx: cup.rx * (0.7 + 0.24 * e), ry: cup.ry * (0.66 + 0.24 * e) }; };
    const mix = (a, b, x) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * x)).join(',')})`;
    function draw() {
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      const { cx, cy, rx, ry, s } = cup;
      const S = surf(fill);
      const ix = cx - rx * 0.06, iy = S.cy - S.ry * 0.15;
      if (fill > 0.002) {
        ctx.save();
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
        ctx.beginPath(); ctx.ellipse(cx, S.cy, S.rx, S.ry, 0, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(ix, iy, 2, cx, S.cy, S.rx * 0.92);
        g.addColorStop(0, mix([92, 45, 18], [214, 156, 94], crema));
        g.addColorStop(0.4, mix([80, 38, 15], [176, 108, 52], crema));
        g.addColorStop(0.78, mix([54, 25, 10], [118, 62, 26], crema));
        g.addColorStop(1, '#2a1409');
        ctx.fillStyle = g; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(38,16,6,.55)'; ctx.lineWidth = 7 * s * 2;        // darker meniscus against the cup wall
        ctx.beginPath(); ctx.ellipse(cx, S.cy, S.rx, S.ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(255,236,200,${(0.1 + 0.12 * crema).toFixed(3)})`;   // soft light on the surface
        ctx.beginPath(); ctx.ellipse(cx - S.rx * 0.32, S.cy - S.ry * 0.28, S.rx * 0.22, S.ry * 0.2, -0.15, 0, Math.PI * 2); ctx.fill();
        if (crema > 0.05) {                            // crema swirl
          ctx.lineWidth = 1.6 * s * 2.2;
          for (let i = 0; i < 3; i++) {
            const R = S.rx * (0.25 + i * 0.2);
            ctx.strokeStyle = `rgba(236,190,130,${(0.2 - i * 0.05) * crema})`;
            ctx.beginPath(); ctx.ellipse(ix, iy, R, R * S.ry / S.rx, 0, swirl + i * 2.1, swirl + i * 2.1 + 1.6); ctx.stroke();
          }
        }
        ripples.forEach(rp => {                          // rings where the stream lands
          const R = rp.r * s;
          ctx.strokeStyle = `rgba(255,218,168,${(0.34 * (1 - rp.age)).toFixed(3)})`;
          ctx.lineWidth = 2 * s * 2;
          ctx.beginPath(); ctx.ellipse(ix, iy, R, R * S.ry / S.rx, 0, 0, Math.PI * 2); ctx.stroke();
        });
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,226,180,.3)'; ctx.lineWidth = 2.2 * s * 2;   // glossy back edge
        ctx.beginPath(); ctx.ellipse(cx, S.cy, S.rx * 0.97, S.ry * 0.9, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.restore();
      }
      if (sBot > sTop || drops.length) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, W, cy); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
        if (sBot > sTop) {
          const top = sTop, bot = Math.min(sBot, iy), w0 = 52 * s, w1 = 30 * s;
          const xo = y => { const k = 0.3 + 0.7 * (y / Math.max(1, iy)); return (Math.sin(y * 0.022 - time * 7) * 2.4 + Math.sin(y * 0.061 + time * 3.1) * 1.3) * k * (s * 2.4); };
          const wd = y => lerp(w0, w1, clamp(y / Math.max(1, iy), 0, 1)) * (1 + 0.05 * Math.sin(time * 15 + y * 0.05));
          const L = [], R = [];
          for (let y = top; y < bot; y += 9) { const x = ix + xo(y), w = wd(y) / 2; L.push([x - w, y]); R.push([x + w, y]); }
          const xb = ix + xo(bot), wb = wd(bot) / 2; L.push([xb - wb, bot]); R.push([xb + wb, bot]);
          ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
          for (const p of L) ctx.lineTo(p[0], p[1]);
          for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
          ctx.closePath();
          const g = ctx.createLinearGradient(ix - w0 / 2, 0, ix + w0 / 2, 0);
          g.addColorStop(0, '#140702'); g.addColorStop(0.22, '#46200b'); g.addColorStop(0.42, '#8a4a1f'); g.addColorStop(0.5, '#e3a86b');
          g.addColorStop(0.57, '#9a5626'); g.addColorStop(0.8, '#3a1908'); g.addColorStop(1, '#140702');
          ctx.fillStyle = g; ctx.fill();
          const len = bot - top;                        // light running down the stream
          if (len > 20) {
            ctx.strokeStyle = 'rgba(255,222,176,.5)'; ctx.lineWidth = 2 * s * 2; ctx.lineCap = 'round';
            for (let i = 0; i < 6; i++) {
              const yy = top + ((time * 1400 * Math.max(0.5, s * 2.4) + i * (len / 6)) % len), x = ix + xo(yy) - wd(yy) * 0.12;
              ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + xo(yy + 16) - xo(yy), Math.min(bot, yy + 22 * s * 2.4)); ctx.stroke();
            }
          }
          if (sBot >= iy) {                            // foam where it lands
            ctx.fillStyle = 'rgba(214,156,96,.55)';
            ctx.beginPath(); ctx.ellipse(xb, bot, w1 * 0.9, w1 * 0.9 * S.ry / S.rx, 0, 0, Math.PI * 2); ctx.fill();
          }
        }
        drops.forEach(d => {
          ctx.fillStyle = '#6e3514'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,210,160,.6)'; ctx.beginPath(); ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.35, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
      }
    }
    function update(dt) {
      time += dt;
      const S = surf(fill), iy = S.cy - S.ry * 0.15, ix = cup.cx - cup.rx * 0.06, speed = H * 3.2;
      if (pouring) {
        sBot = Math.min(iy, sBot + speed * dt);
        if (sBot >= iy) {
          fill = Math.min(1, fill + dt / 3.4);
          crema = ss(fill, 0.25, 1);
          rippleT -= dt; if (rippleT <= 0) { rippleT = 0.11; ripples.push({ r: 20, age: 0 }); }
          dropT -= dt;
          if (dropT <= 0 && !LITE) { dropT = 0.07; drops.push({ x: ix + (Math.random() - 0.5) * 24 * cup.s * 2, y: iy, vx: (Math.random() - 0.5) * 140 * cup.s * 2, vy: -(120 + Math.random() * 220) * cup.s * 2, r: (1.6 + Math.random() * 1.8) * cup.s * 2.2 }); }
        }
        if (fill >= 1) finish();
      } else if (sBot > 0) {
        sTop += speed * dt;
        if (sTop >= sBot) { sTop = 0; sBot = 0; }
      }
      ripples.forEach(r => { r.age += dt / 0.9; r.r += 150 * dt; }); ripples = ripples.filter(r => r.age < 1);
      drops.forEach(d => { d.vy += 1700 * cup.s * 2 * dt; d.x += d.vx * dt; d.y += d.vy * dt; }); drops = drops.filter(d => d.y < iy + 4);
      if (pouring || ripples.length) swirl += dt * 0.7;
      uiT -= dt; if (uiT <= 0) { uiT = 0.1; ui(); }
    }
    function ui() {
      ringC.style.strokeDashoffset = (1 - fill).toFixed(3);
      mlEl.textContent = t('rit.ml', { n: Math.round(fill * 60) });
      label.textContent = t(pouring ? 'rit.pouring' : 'rit.hold');
      cupEl.classList.toggle('steaming', fill > 0.55);
    }
    const activeNow = () => pouring || sBot > 0 || ripples.length || drops.length;
    function loop(now) {
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      update(dt); draw();
      if (activeNow() && visible) raf = requestAnimationFrame(loop); else { raf = null; last = 0; ui(); }
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    function start() { if (full || busy || RM.matches) return; if (!W) measureRit(); pouring = true; hold.classList.add('on', 'used'); kick(); }
    function stop() { if (!pouring) return; pouring = false; hold.classList.remove('on'); kick(); }
    function finish() {
      pouring = false; full = true; hold.classList.remove('on');
      stageEl.classList.add('full'); doneEl.hidden = false; ui();
    }
    function reset() {
      busy = true; cupEl.classList.add('away');
      setTimeout(() => {
        fill = 0; crema = 0; full = false; ripples = []; drops = []; sTop = sBot = 0;
        stageEl.classList.remove('full'); doneEl.hidden = true;
        cupEl.classList.remove('away'); cupEl.classList.add('enter');
        draw(); ui();
        requestAnimationFrame(() => requestAnimationFrame(() => { cupEl.classList.remove('enter'); }));
        setTimeout(() => { busy = false; measureRit(); hold.focus(); }, 900);
      }, 650);
    }
    hold.addEventListener('pointerdown', e => { e.preventDefault(); try { hold.setPointerCapture(e.pointerId); } catch { /* fine */ } start(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => hold.addEventListener(ev, stop));
    hold.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
    hold.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stop(); });
    hold.addEventListener('contextmenu', e => e.preventDefault());
    hold.addEventListener('click', e => e.preventDefault());
    again.addEventListener('click', reset);
    new IntersectionObserver(es => es.forEach(e => {
      visible = e.isIntersecting;
      if (visible) { measureRit(); if (activeNow()) kick(); } else stop();
    }), { rootMargin: '20% 0px' }).observe(stageEl);
    const cupImg = $('img', cupEl); if (cupImg.complete) measureRit(); else cupImg.addEventListener('load', measureRit);
    function pinFull() { fill = 1; crema = 1; full = true; stageEl.classList.add('full'); doneEl.hidden = false; again.hidden = true; ui(); draw(); }
    langHooks.push(ui);
    return { measure: measureRit, pinFull, unpin() { again.hidden = false; } };
  })();
  addEventListener('resize', () => { clearTimeout(rit._t); rit._t = setTimeout(rit.measure, 180); });

  /* ================= shop data ================= */
  const V = [
    { id: 'arabica', name: 'Arábica', sw: '#8a4a22', halo: 'rgba(176,102,52,.36)', int: 3, price: { graos: 74, po: 62, caps: 63 } },
    { id: 'bourbon', name: 'Bourbon', sw: '#6b3419', halo: 'rgba(150,80,40,.36)', int: 3, price: { graos: 76, po: 64, caps: 65 } },
    { id: 'caturra', name: 'Caturra', sw: '#2b4f8a', halo: 'rgba(60,100,170,.32)', int: 4, price: { graos: 74, po: 62, caps: 63 } },
    { id: 'excelsa', name: 'Excelsa', sw: '#3a332c', halo: 'rgba(217,167,74,.26)', int: 3, price: { graos: 78, po: 66, caps: 67 } },
    { id: 'geisha', name: 'Geisha', sw: '#e8d8ae', halo: 'rgba(240,215,160,.36)', int: 2, price: { graos: 80, po: 68, caps: 69 } },
    { id: 'liberica', name: 'Liberica', sw: '#8a3420', halo: 'rgba(170,70,45,.34)', int: 4, price: { graos: 78, po: 66, caps: 67 } },
    { id: 'maragogipe', name: 'Maragogipe', sw: '#23603b', halo: 'rgba(50,120,80,.32)', int: 3, price: { graos: 79, po: 66, caps: 67 } },
    { id: 'robusta', name: 'Robusta', sw: '#5a2c70', halo: 'rgba(120,60,150,.32)', int: 5, price: { graos: 72, po: 60, caps: 61 } },
    { id: 'typica', name: 'Typica', sw: '#2b2723', halo: 'rgba(217,167,74,.26)', int: 3, price: { graos: 76, po: 64, caps: 65 } }
  ];
  const PIECES = [
    { id: 'xicara-preta', name: 'Noite', kind: 'cup', price: 68 }, { id: 'xicara-branca', name: 'Jardim', kind: 'cup', price: 72 },
    { id: 'xicara-folhas', name: 'Folhagem', kind: 'cup', price: 76 }, { id: 'xicara-colmeia', name: 'Colmeia', kind: 'cup', price: 79 },
    { id: 'caneca-preta', name: 'Essencial', kind: 'mug', price: 64 }, { id: 'caneca-classica', name: 'Clássica', kind: 'mug', price: 74 },
    { id: 'caneca-folhas', name: 'Folhas de Ouro', kind: 'mug', price: 78 }, { id: 'caneca-marmore', name: 'Mármore', kind: 'mug', price: 80 }
  ];
  const CATS = ['graos', 'po', 'caps', 'xicaras', 'canecas'];
  const FMTS = ['graos', 'po', 'caps'];
  const GRINDS = ['whole', 'espresso', 'filter', 'press'];
  const imgOf = (id, fmt) => (fmt ? `assets/img/${fmt}-${id}.webp` : `assets/img/${id}.webp`);
  const coffeeName = v => t('v.coffee', { name: v.name });
  const pieceName = p => `${t(p.kind === 'cup' ? 'pc.word.cup' : 'pc.word.mug')} ${p.name}`;
  // one cart line describes itself from ids, so it can be re-rendered in any language
  function lineInfo(it) {
    if (it.kind === 'coffee') {
      const v = V.find(x => x.id === it.id);
      let sub = `${t('fmt.' + it.fmt)} · ${t('size.' + it.fmt)}`;
      if (it.fmt === 'graos' && it.grind && it.grind !== 'whole') sub += ` · ${t('grind.' + it.grind)}`;
      if (it.buy === 'sub') sub += ` · ${t('bag.subscription')}`;
      return { name: coffeeName(v), sub, img: imgOf(v.id, it.fmt), price: v.price[it.fmt] };
    }
    const p = PIECES.find(x => x.id === it.id);
    return { name: pieceName(p), sub: t(p.kind === 'cup' ? 'piece.cup' : 'piece.mug'), img: imgOf(p.id), price: p.price };
  }

  /* ================= shop grid ================= */
  const chips = $('#chips'), grid = $('#grid');
  let cat = 'graos', gridSeen = false;
  function renderChips() {
    chips.innerHTML = CATS.map(c => {
      const n = c === 'xicaras' || c === 'canecas' ? PIECES.filter(p => (c === 'xicaras') === (p.kind === 'cup')).length : V.length;
      return `<button class="chip" type="button" role="tab" id="chip-${c}" aria-controls="grid" aria-selected="${c === cat}" tabindex="${c === cat ? 0 : -1}" data-cat="${c}">${t('cat.' + c)}<small>${n}</small></button>`;
    }).join('');
  }
  function itemsOf(c) {
    if (FMTS.includes(c)) return V.map(v => ({ kind: 'coffee', v, fmt: c }));
    return PIECES.filter(p => (c === 'xicaras') === (p.kind === 'cup')).map(p => ({ kind: 'piece', p }));
  }
  function cardHTML(it, i) {
    if (it.kind === 'coffee') {
      const v = it.v, name = coffeeName(v);
      return `<article class="card" style="--halo:${v.halo};--sw:${v.sw}" data-i="${i}">
        <button class="card-hit" type="button" data-cursor="view" aria-label="${esc(t('card.view', { name }))}"></button>
        <div class="card-img"><img src="${imgOf(v.id, it.fmt)}" alt="" width="640" height="744" loading="lazy" decoding="async"></div>
        <div class="card-body"><p class="card-tag">${esc(t('v.' + v.id + '.tag'))}</p><h3><span class="sw"></span>${v.name}</h3>
          <p class="card-meta">${t('fmt.' + it.fmt)} · ${t('size.' + it.fmt)}</p>
          <div class="card-row"><b>${money(v.price[it.fmt])}</b><button class="card-add" type="button" aria-label="${esc(t('card.addAria', { name }))}"><svg width="14" height="14" aria-hidden="true"><use href="#i-plus"/></svg>${t('card.add')}</button></div></div></article>`;
    }
    const p = it.p, name = pieceName(p);
    return `<article class="card" data-i="${i}">
      <button class="card-hit" type="button" data-cursor="view" aria-label="${esc(t('card.view', { name }))}"></button>
      <div class="card-img"><img src="${imgOf(p.id)}" alt="" width="600" height="600" loading="lazy" decoding="async"></div>
      <div class="card-body"><p class="card-tag">${t(p.kind === 'cup' ? 'piece.cup' : 'piece.mug')}</p><h3>${p.name}</h3>
        <p class="card-meta">${esc(t('pc.' + p.id))}</p>
        <div class="card-row"><b>${money(p.price)}</b><button class="card-add" type="button" aria-label="${esc(t('card.addAria', { name }))}"><svg width="14" height="14" aria-hidden="true"><use href="#i-plus"/></svg>${t('card.add')}</button></div></div></article>`;
  }
  let gridItems = [], settleT = 0;
  function renderGrid() {
    gridItems = itemsOf(cat);
    grid.classList.remove('show', 'settled');
    grid.innerHTML = gridItems.map(cardHTML).join('');
    grid.setAttribute('aria-labelledby', 'chip-' + cat);
    if (gridSeen) { void grid.offsetWidth; grid.classList.add('show'); }
    clearTimeout(settleT); settleT = setTimeout(() => grid.classList.add('settled'), 1300);
  }
  chips.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b || b.dataset.cat === cat) return;
    cat = b.dataset.cat; renderChips(); renderGrid(); $('#chip-' + cat).focus();
  });
  chips.addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    let i = CATS.indexOf(cat);
    i = e.key === 'ArrowRight' ? (i + 1) % CATS.length : e.key === 'ArrowLeft' ? (i - 1 + CATS.length) % CATS.length : e.key === 'Home' ? 0 : CATS.length - 1;
    cat = CATS[i]; renderChips(); renderGrid(); $('#chip-' + cat).focus();
  });
  new IntersectionObserver((es, io) => es.forEach(e => {
    if (!e.isIntersecting) return; gridSeen = true; grid.classList.add('show'); io.disconnect();
  }), { threshold: 0.08 }).observe(grid);
  grid.addEventListener('click', e => {
    const card = e.target.closest('.card'); if (!card) return;
    const it = gridItems[+card.dataset.i];
    if (e.target.closest('.card-add')) {
      if (it.kind === 'coffee') addToCart({ kind: 'coffee', id: it.v.id, fmt: it.fmt, grind: 'whole', buy: 'once' }, 1, $('img', card));
      else addToCart({ kind: 'piece', id: it.p.id }, 1, $('img', card));
    } else if (e.target.closest('.card-hit')) openQV(it, card);
  });
  if (FINE && !LITE) {                                 // gentle 3D tilt that follows the mouse
    grid.addEventListener('pointermove', e => {
      const card = e.target.closest('.card'); if (!card || !grid.classList.contains('settled')) return;
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateY(-6px)`;
    });
    grid.addEventListener('pointerout', e => { const card = e.target.closest('.card'); if (card && !card.contains(e.relatedTarget)) card.style.transform = ''; });
  }
  renderChips(); renderGrid();
  langHooks.push(() => { renderChips(); renderGrid(); if (gridSeen) grid.classList.add('show', 'settled'); });

  /* ================= quick view ================= */
  const qv = $('#qv'), veil = $('#veil'), qvImg = $('#qvImg');
  let qs = null, qvReturn = null;
  function radio(name, val, checked, label, small) {
    return `<label><input type="radio" name="${name}" value="${val}" ${checked ? 'checked' : ''}><span>${label}${small ? `<small>${small}</small>` : ''}</span></label>`;
  }
  function qvPrice() {
    if (!qs) return 0;
    return (qs.kind === 'coffee' ? qs.v.price[qs.fmt] : qs.p.price) * qs.qty;
  }
  function qvRender(first) {
    const isC = qs.kind === 'coffee';
    qv.classList.toggle('piece', !isC);
    $('.halo', qv).style.setProperty('--halo', isC ? qs.v.halo : '');
    $('#qvTag').textContent = isC ? t('v.' + qs.v.id + '.tag') : t(qs.p.kind === 'cup' ? 'piece.cup' : 'piece.mug');
    $('#qvName').textContent = isC ? qs.v.name : qs.p.name;
    $('#qvLine').textContent = isC ? t('v.' + qs.v.id + '.line') : t('pc.' + qs.p.id);
    $('#qvNotes').innerHTML = isC ? t('v.' + qs.v.id + '.notes').split('|').map(n => `<li>${esc(n)}</li>`).join('') : '';
    $('#qvNotes').hidden = !isC;
    $('#qvInt').hidden = !isC;
    if (isC) $('#qvInt').innerHTML = `<span>${t('qv.int')}</span><span class="dots" role="img" aria-label="${t('qv.intOf', { n: qs.v.int })}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= qs.v.int ? 'f' : ''}"></i>`).join('')}</span>`;
    $('#qvFmt').hidden = !isC; $('#qvBuy').hidden = !isC; $('#qvGrind').hidden = !isC || qs.fmt !== 'graos';
    if (isC) {
      $('#qvFmtRow').innerHTML = FMTS.map(f => radio('qfmt', f, f === qs.fmt, t('fmt.' + f), t('size.' + f))).join('');
      $('#qvGrindRow').innerHTML = GRINDS.map(g => radio('qgrind', g, g === qs.grind, t('grind.' + g))).join('');
      $('#qvBuyRow').innerHTML = radio('qbuy', 'once', qs.buy === 'once', t('buy.once')) + radio('qbuy', 'sub', qs.buy === 'sub', t('buy.sub'));
      $('#qvSubNote').hidden = qs.buy !== 'sub';
      $('#qvThumbs').innerHTML = FMTS.map(f => `<button type="button" data-fmt="${f}" aria-pressed="${f === qs.fmt}" aria-label="${t('fmt.' + f)}"><img src="${imgOf(qs.v.id, f)}" alt="" width="64" height="74"></button>`).join('');
    } else $('#qvThumbs').innerHTML = '';
    $('#qvQty').textContent = qs.qty;
    $('#qvAdd').textContent = t('qv.add', { price: money(qvPrice()) });
    const src = isC ? imgOf(qs.v.id, qs.fmt) : imgOf(qs.p.id);
    if (first) { qvImg.src = src; }
    else if (!qvImg.src.endsWith(src)) {
      qvImg.classList.add('swap');
      setTimeout(() => { qvImg.onload = () => qvImg.classList.remove('swap'); qvImg.src = src; if (qvImg.complete) qvImg.classList.remove('swap'); }, 180);
    }
    qvImg.alt = isC ? `${coffeeName(qs.v)}, ${t('fmt.' + qs.fmt)} ${t('size.' + qs.fmt)}` : pieceName(qs.p);
  }
  function openOverlay(el) {
    veil.hidden = false; el.hidden = false; void el.offsetWidth;
    veil.classList.add('on'); el.classList.add('on');
    root.style.overflow = 'hidden';
  }
  function closeOverlay(el) {
    el.classList.remove('on');
    if (qv.hidden || !qv.classList.contains('on')) if (drawer.hidden || !drawer.classList.contains('on')) { veil.classList.remove('on'); root.style.overflow = ''; }
    setTimeout(() => { if (!el.classList.contains('on')) el.hidden = true; if (!veil.classList.contains('on')) veil.hidden = true; }, 650);
  }
  function openQV(it, from) {
    qvReturn = document.activeElement;
    qs = it.kind === 'coffee' ? { kind: 'coffee', v: it.v, fmt: it.fmt, grind: 'whole', buy: 'once', qty: 1 } : { kind: 'piece', p: it.p, qty: 1 };
    qvRender(true);
    openOverlay(qv);
    setTimeout(() => $('#qvClose').focus(), 60);
    void from;
  }
  function closeQV() { closeOverlay(qv); if (qvReturn && document.contains(qvReturn)) qvReturn.focus({ preventScroll: true }); }
  $('#qvClose').addEventListener('click', closeQV);
  qv.addEventListener('click', e => { if (e.target === qv) closeQV(); });
  qv.addEventListener('change', e => {
    const n = e.target.name;
    if (n === 'qfmt') qs.fmt = e.target.value; else if (n === 'qgrind') qs.grind = e.target.value; else if (n === 'qbuy') qs.buy = e.target.value; else return;
    const keep = n; qvRender(false);
    const back = $(`input[name="${keep}"]:checked`, qv); if (back) back.focus();
  });
  $('#qvThumbs').addEventListener('click', e => { const b = e.target.closest('button[data-fmt]'); if (!b) return; qs.fmt = b.dataset.fmt; qvRender(false); });
  $('#qvLess').addEventListener('click', () => { qs.qty = Math.max(1, qs.qty - 1); qvRender(false); });
  $('#qvMore').addEventListener('click', () => { qs.qty = Math.min(20, qs.qty + 1); qvRender(false); });
  $('#qvAdd').addEventListener('click', () => {
    const it = qs.kind === 'coffee' ? { kind: 'coffee', id: qs.v.id, fmt: qs.fmt, grind: qs.fmt === 'graos' ? qs.grind : 'whole', buy: qs.buy } : { kind: 'piece', id: qs.p.id };
    addToCart(it, qs.qty, qvImg);
    setTimeout(closeQV, 350);
  });
  langHooks.push(() => { if (qs && !qv.hidden) qvRender(false); });

  /* ================= bag and checkout ================= */
  let cart = store.get('cdo-bag-v2', []); if (!Array.isArray(cart)) cart = [];
  let coupon = store.get('cdo-coupon', '');
  const drawer = $('#drawer'), bagBtn = $('#bagBtn'), bagCount = $('#bagCount'), drMain = $('#drMain'), drBack = $('#drBack');
  const views = { cart: $('#vCart'), ship: $('#vShip'), pay: $('#vPay'), done: $('#vDone') };
  const ORDER = ['cart', 'ship', 'pay', 'done'];
  let view = 'cart', drReturn = null, windowSel = null, order = null;
  const keyOf = it => [it.kind, it.id, it.fmt || '', it.grind || '', it.buy || ''].join('|');
  const sums = () => {
    const sub = cart.reduce((s, it) => s + lineInfo(it).price * it.qty, 0);
    const disc = coupon === 'BEMVINDO' ? Math.round(sub * 10) / 100 : 0;
    const hasSub = cart.some(it => it.buy === 'sub');
    const ship = sub === 0 ? 0 : (sub - disc >= 150 || hasSub ? 0 : 12);
    return { sub, disc, ship, hasSub, total: sub - disc + ship, count: cart.reduce((s, it) => s + it.qty, 0) };
  };
  function save() { store.set('cdo-bag-v2', cart); store.set('cdo-coupon', coupon); renderBag(); }
  function renderBag() {
    const s = sums();
    bagCount.textContent = s.count; bagCount.classList.toggle('on', s.count > 0);
    bagBtn.setAttribute('aria-label', s.count === 1 ? t('nav.bag1') : t('nav.bag', { n: s.count }));
    $('#cartList').innerHTML = cart.map((it, i) => {
      const L = lineInfo(it);
      return `<li class="cart-item" data-i="${i}"><img src="${L.img}" alt="" width="70" height="78"><div><p class="ci-name">${esc(L.name)}</p><p class="ci-sub">${esc(L.sub)}</p>
        <div class="ci-qty"><button type="button" data-act="dec" aria-label="${esc(t('bag.less', { name: L.name }))}"><svg width="14" height="14"><use href="#i-minus"/></svg></button><span>${it.qty}</span><button type="button" data-act="inc" aria-label="${esc(t('bag.more', { name: L.name }))}"><svg width="14" height="14"><use href="#i-plus"/></svg></button></div></div>
        <div class="ci-side"><p class="ci-price">${money(L.price * it.qty)}</p><button class="ci-del" type="button" data-act="del" aria-label="${esc(t('bag.remove', { name: L.name }))}"><svg width="18" height="18"><use href="#i-trash"/></svg></button></div></li>`;
    }).join('');
    $('#cartEmpty').classList.toggle('on', cart.length === 0);
    $('#couponForm').hidden = cart.length === 0;
    $('#shipBar').hidden = cart.length === 0;
    const left = 150 - (s.sub - s.disc);
    $('#shipText').textContent = s.ship === 0 && s.sub > 0 ? t('bag.freeOk') : t('bag.freeLeft', { v: money(Math.max(0, left)) });
    $('#shipFill').style.transform = `scaleX(${s.hasSub ? 1 : clamp((s.sub - s.disc) / 150, 0, 1).toFixed(3)})`;
    $('#tSub').textContent = money(s.sub);
    $('#tDiscRow').hidden = !s.disc; $('#tDisc').textContent = '− ' + money(s.disc);
    $('#tShip').textContent = s.sub === 0 ? money(0) : (s.ship === 0 ? t('bag.free') : money(s.ship));
    $('#tTotal').textContent = money(s.total);
    setButtons();
  }
  function setButtons() {
    const s = sums();
    $('#drFoot').hidden = view === 'done';
    drBack.hidden = !(view === 'ship' || view === 'pay');
    if (view === 'cart') { drMain.textContent = t('bag.continue'); drMain.disabled = cart.length === 0; }
    if (view === 'ship') { drMain.textContent = t('bag.toPay'); drMain.disabled = false; }
    if (view === 'pay') { drMain.textContent = t('bag.place', { v: money(s.total) }); drMain.disabled = false; }
    const idx = ORDER.indexOf(view);
    $$('#stepper li').forEach((li, i) => { li.classList.toggle('on', i === idx); li.classList.toggle('done', i < idx); });
  }
  function showView(v) {
    view = v;
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== v; });
    views.done.classList.toggle('show', v === 'done');
    $('#drawerTitle').textContent = t(v === 'cart' ? 'bag.title' : v === 'done' ? 'step.4' : 'step.' + (ORDER.indexOf(v) + 1));
    if (v === 'ship') buildWindows();
    if (v === 'pay') buildPay();
    setButtons();
    $('#drBody').scrollTop = 0;
  }
  function openBag() {
    drReturn = document.activeElement;
    if (view === 'done') showView('cart');
    openOverlay(drawer);
    setTimeout(() => $('#drawerClose').focus(), 60);
  }
  function closeBag() { closeOverlay(drawer); if (drReturn && document.contains(drReturn)) drReturn.focus({ preventScroll: true }); }
  bagBtn.addEventListener('click', openBag);
  $('#drawerClose').addEventListener('click', closeBag);
  veil.addEventListener('click', () => { if (!qv.hidden) closeQV(); if (!drawer.hidden) closeBag(); });
  drawer.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeBag(); });
  $('#cartList').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const i = +b.closest('.cart-item').dataset.i, it = cart[i]; if (!it) return;
    if (b.dataset.act === 'inc') it.qty = Math.min(20, it.qty + 1);
    if (b.dataset.act === 'dec') it.qty -= 1;
    if (b.dataset.act === 'del' || it.qty <= 0) cart.splice(i, 1);
    save();
    const again = $(`.cart-item[data-i="${i}"] button[data-act="${b.dataset.act}"]`); (again || $('#drawerClose')).focus();
  });
  $('#couponForm').addEventListener('submit', e => {
    e.preventDefault();
    const c = $('#couponIn').value.trim().toUpperCase(), msg = $('#couponMsg');
    if (c === 'BEMVINDO') { coupon = c; msg.className = 'f-msg ok'; msg.textContent = t('bag.couponOk'); }
    else { coupon = ''; msg.className = 'f-msg'; msg.textContent = t('bag.couponBad'); }
    save();
  });
  drBack.addEventListener('click', () => showView(ORDER[ORDER.indexOf(view) - 1]));
  drMain.addEventListener('click', () => {
    if (view === 'cart' && cart.length) { showView('ship'); setTimeout(() => $('#cName').focus(), 60); }
    else if (view === 'ship') views.ship.requestSubmit();
    else if (view === 'pay') placeOrder();
  });

  const toast = $('#toast'); let toastT = 0;
  function say(msg) { toast.textContent = msg; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 2400); }
  function addToCart(item, qty, fromImg) {
    const k = keyOf(item), ex = cart.find(it => keyOf(it) === k);
    if (ex) ex.qty = Math.min(20, ex.qty + qty); else cart.push({ ...item, qty });
    save();
    const L = lineInfo(item);
    say(t('toast.added', { name: L.name }));
    const bump = () => { bagBtn.classList.remove('bump'); void bagBtn.offsetWidth; bagBtn.classList.add('bump'); };
    if (fromImg && !RM.matches) {
      const a = fromImg.getBoundingClientRect(), b = bagBtn.getBoundingClientRect();
      if (a.width) {
        const f = document.createElement('img');
        f.src = L.img; f.className = 'fly'; f.alt = '';
        f.style.left = (a.left + a.width / 2 - 45) + 'px'; f.style.top = (a.top + a.height / 2 - 55) + 'px';
        document.body.appendChild(f);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          f.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px,${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(.18)`;
          f.style.opacity = '0.2';
        }));
        setTimeout(() => { f.remove(); bump(); }, 900);
        return;
      }
    }
    bump();
  }

  /* --- delivery step --- */
  function buildWindows() {
    const early = new Date().getHours() < 16;
    const opts = (early ? ['today'] : []).concat(['tmAm', 'tmPm']);
    if (!opts.includes(windowSel)) windowSel = opts[0];
    $('#winRow').innerHTML = opts.map(o => radio('win', o, o === windowSel, t('co.' + o))).join('');
  }
  $('#winRow').addEventListener('change', e => { windowSel = e.target.value; });
  const maskCep = el => el.addEventListener('input', () => { const d = digits(el.value).slice(0, 8); el.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; });
  const maskPhone = el => el.addEventListener('input', () => {
    const d = digits(el.value).slice(0, 11);
    el.value = d.length <= 2 ? (d ? '(' + d : '') : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  });
  const STORE = { lat: -23.5646, lon: -46.6647 };
  function km(a, b) {
    const R = 6371, rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const cepCache = new Map();
  async function getJson(url) {
    const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (r.status === 404 || r.status === 400) return { notFound: true };
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } finally { clearTimeout(tm); }
  }
  const settle = res => { res.inArea = res.dist != null ? res.dist <= 10 : (res.city === 'São Paulo' ? null : false); return res; };
  async function lookupCep(cep) {
    if (cepCache.has(cep)) return cepCache.get(cep);
    let res;
    try {                                                // street-level coordinates, so the 10 km check is real
      const j = await getJson(`https://cep.awesomeapi.com.br/json/${cep}`);
      if (j.notFound) res = { notFound: true };
      else {
        res = { street: j.address || '', hood: j.district || '', city: j.city || '', state: j.state || '' };
        const lat = parseFloat(j.lat), lon = parseFloat(j.lng);
        if (Number.isFinite(lat) && Number.isFinite(lon)) { res.lat = lat; res.lon = lon; res.dist = km(STORE, { lat, lon }); }
        settle(res);
      }
    } catch {                                            // backup: address only (its coordinates are city-level)
      const j = await getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      res = j.notFound ? { notFound: true } : settle({ street: j.street || '', hood: j.neighborhood || '', city: j.city || '', state: j.state || '' });
    }
    cepCache.set(cep, res); return res;
  }
  const fmtKm = d => d.toLocaleString(locale(), { maximumFractionDigits: 1 });
  const cCep = $('#cCep'), cAddr = $('#cAddr');
  maskCep(cCep); maskPhone($('#cPhone'));
  let coArea = null, coAddr = null, cepSeq = 0;
  cCep.addEventListener('input', async () => {
    const cep = digits(cCep.value);
    coArea = null; coAddr = null; cAddr.className = 'co-addr'; cAddr.textContent = '';
    if (cep.length !== 8) return;
    const n = ++cepSeq; cAddr.textContent = t('co.searching');
    try {
      const r = await lookupCep(cep); if (n !== cepSeq) return;
      if (r.notFound) { cAddr.classList.add('no'); cAddr.textContent = t('co.notFound'); coArea = false; return; }
      coAddr = r;
      const line = [r.street, r.hood].filter(Boolean).join(', ') || r.city;
      if (r.inArea === false) { coArea = false; cAddr.classList.add('no'); cAddr.textContent = r.dist != null ? t('co.outside', { line, km: fmtKm(r.dist) }) : t('co.outsideNoKm', { line }); }
      else { coArea = true; cAddr.classList.add('ok'); cAddr.textContent = r.dist != null ? t('co.away', { line, km: fmtKm(r.dist) }) : line; }
    } catch { if (n === cepSeq) { coArea = true; cAddr.textContent = t('co.offline'); } }
  });
  views.ship.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#cName'), phone = $('#cPhone'), num = $('#cNum'), msg = $('#shipMsg');
    const bad = [];
    [name, phone, cCep, num].forEach(el => el.removeAttribute('aria-invalid'));
    if (name.value.trim().length < 2) bad.push(name);
    if (digits(phone.value).length < 10) bad.push(phone);
    if (digits(cCep.value).length !== 8) bad.push(cCep);
    if (!num.value.trim()) bad.push(num);
    if (bad.length) { bad.forEach(el => el.setAttribute('aria-invalid', 'true')); msg.textContent = t('co.fix'); bad[0].focus(); return; }
    if (coArea === false) { msg.textContent = t('co.far'); cCep.focus(); return; }
    msg.textContent = '';
    showView('pay');
  });

  /* --- payment step --- */
  function drawQR(seed) {
    const r = rng(seed), N = 29, cells = [];
    const finder = (x, y) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const edge = i === 0 || j === 0 || i === 6 || j === 6, core = i > 1 && i < 5 && j > 1 && j < 5; if (edge || core) cells.push([x + i, y + j]); } };
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      const inF = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      if (!inF && r() < 0.47) cells.push([x, y]);
    }
    $('#qr').innerHTML = cells.map(([x, y]) => `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`).join('');
  }
  function buildPay() {
    const s = sums();
    drawQR(hash(JSON.stringify(cart) + s.total));
    const pay = $('input[name="pay"]:checked', views.pay).value;
    $('#pixBox').hidden = pay !== 'pix'; $('#cardNote').hidden = pay !== 'card';
    $('#sumCount').textContent = s.count === 1 ? t('pay.item1') : t('pay.items', { n: s.count });
    $('#sumList').innerHTML = cart.map(it => { const L = lineInfo(it); return `<li><span>${it.qty} × ${esc(L.name)}</span><span>${money(L.price * it.qty)}</span></li>`; }).join('');
    const where = coAddr && coAddr.street ? `${coAddr.street}, ${$('#cNum').value.trim()}${$('#cComp').value.trim() ? ' · ' + $('#cComp').value.trim() : ''}` : '';
    $('#sumAddr').textContent = [where, windowSel ? t('co.' + windowSel) : ''].filter(Boolean).join(' · ');
    $('#pixCopy').textContent = t('pay.copy');
  }
  views.pay.addEventListener('change', buildPay);
  $('#pixCopy').addEventListener('click', async () => {
    const code = '00020126580014BR.GOV.BCB.PIX0136CAFFEDORO-DEMO-SHINNARE5204000053039865802BR5913CAFFE DORO6009SAO PAULO6304DEMO';
    try { await navigator.clipboard.writeText(code); } catch { /* clipboard may be blocked; the label still confirms */ }
    $('#pixCopy').textContent = t('pay.copied');
  });
  function placeOrder() {
    const s = sums();
    order = 'CD-' + String(1000 + Math.floor(Math.random() * 9000));
    const lower = x => x.charAt(0).toLowerCase() + x.slice(1);
    const where = coAddr && coAddr.street ? `${coAddr.street}, ${$('#cNum').value.trim()}` : t('done.yourAddr');
    $('#coTitle').textContent = t('done.title', { n: order });
    $('#coSum').textContent = t('done.eta', { when: lower(t('co.' + (windowSel || 'tmAm'))), where });
    const now = new Date(), hm = d => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(d);
    $('#tl1').textContent = hm(now); $('#tl2').textContent = hm(new Date(now.getTime() + 60000));
    void s;
    cart = []; coupon = ''; $('#couponIn').value = ''; $('#couponMsg').textContent = ''; save();
    views.ship.reset(); cAddr.textContent = ''; coArea = null; coAddr = null;
    showView('done');
    setTimeout(() => views.done.focus(), 60);
  }
  langHooks.push(() => { renderBag(); showView(view); if (view === 'done' && order) $('#coTitle').textContent = t('done.title', { n: order }); });

  /* ================= delivery section: CEP check with a pin on the rings ================= */
  const cepIn = $('#cepIn'), cepOut = $('#cepOut'), youPin = $('#youPin');
  maskCep(cepIn);
  let lastCep = null;
  function placePin(r) {
    if (!r || r.lat == null) { youPin.classList.remove('on'); return; }
    const kx = 111.32 * Math.cos(STORE.lat * Math.PI / 180), ky = 110.57;
    let dx = (r.lon - STORE.lon) * kx, dy = (r.lat - STORE.lat) * ky;
    const d = Math.hypot(dx, dy), max = 10.6;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    youPin.setAttribute('transform', `translate(${(260 + dx * 23.6).toFixed(1)} ${(260 - dy * 23.6).toFixed(1)})`);
    youPin.classList.toggle('far', r.dist > 10);
    youPin.classList.add('on');
  }
  function cepMessage(r) {
    const place = r.hood ? `${r.hood}, ${r.city}` : r.city;
    if (r.inArea === true) return ['ok', t('ent.ok', { place, km: fmtKm(r.dist) })];
    if (r.inArea === null) return ['ok', t('ent.maybe', { place })];
    if (r.dist != null) return ['no', t('ent.far', { place, km: fmtKm(r.dist) })];
    return ['no', t('ent.city', { city: r.city })];
  }
  $('#cepForm').addEventListener('submit', async e => {
    e.preventDefault();
    const cep = digits(cepIn.value);
    cepOut.className = 'cep-out';
    if (cep.length !== 8) { cepOut.classList.add('no'); cepOut.textContent = t('ent.need8'); cepIn.focus(); return; }
    cepOut.textContent = t('ent.checking');
    try {
      const r = await lookupCep(cep);
      if (r.notFound) { cepOut.classList.add('no'); cepOut.textContent = t('ent.notFound'); placePin(null); lastCep = null; return; }
      lastCep = r;
      const [cls, msg] = cepMessage(r); cepOut.classList.add(cls); cepOut.textContent = msg; placePin(r);
    } catch { cepOut.classList.add('no'); cepOut.textContent = t('ent.error'); }
  });
  langHooks.push(() => { if (lastCep) { const [cls, msg] = cepMessage(lastCep); cepOut.className = 'cep-out ' + cls; cepOut.textContent = msg; } });

  /* ================= reservation on the real floor plan ================= */
  const TABLES = [
    { n: 1, x: 158, y: 245, shape: 'round', seats: 2, zone: 'wall' }, { n: 2, x: 155, y: 328, shape: 'round', seats: 2, zone: 'wall' },
    { n: 3, x: 152, y: 417, shape: 'round', seats: 2, zone: 'wall' }, { n: 4, x: 147, y: 495, shape: 'round', seats: 2, zone: 'wall' },
    { n: 5, x: 330, y: 283, shape: 'sq', seats: 4, zone: 'bar' }, { n: 6, x: 488, y: 283, shape: 'sq', seats: 4, zone: 'bar' },
    { n: 7, x: 670, y: 283, shape: 'sq', seats: 4, zone: 'bar' }, { n: 8, x: 828, y: 283, shape: 'sq', seats: 4, zone: 'bar' },
    { n: 9, x: 330, y: 418, shape: 'sq', seats: 4, zone: 'center' }, { n: 10, x: 461, y: 418, shape: 'sq', seats: 4, zone: 'center' },
    { n: 11, x: 622, y: 418, shape: 'long', seats: 10, zone: 'long' }, { n: 12, x: 806, y: 418, shape: 'sq', seats: 4, zone: 'center' },
    { n: 13, x: 330, y: 557, shape: 'sq', seats: 4, zone: 'door' }, { n: 14, x: 486, y: 557, shape: 'sq', seats: 4, zone: 'door' },
    { n: 15, x: 655, y: 557, shape: 'sq', seats: 4, zone: 'door' }, { n: 16, x: 809, y: 557, shape: 'sq', seats: 4, zone: 'door' },
    { n: 17, x: 1025, y: 270, shape: 'round', seats: 2, zone: 'corner' }, { n: 18, x: 1032, y: 365, shape: 'round', seats: 2, zone: 'corner' },
    { n: 19, x: 1028, y: 507, shape: 'round', seats: 4, zone: 'lounge' }, { n: 20, x: 1028, y: 655, shape: 'round', seats: 4, zone: 'lounge' }
  ];
  const SIZES = { round: [84, 84], sq: [104, 108], long: [196, 104] };
  const svgNS = 'http://www.w3.org/2000/svg';
  const planSvg = $('#planSvg'), planHit = $('#planHit'), planChip = $('#planChip');
  const rDate = $('#rDate'), rTime = $('#rTime'), rPeople = $('#rPeople'), rList = $('#rTableList'), rMsg = $('#rMsg'), rSubmit = $('#rSubmit');
  const mine = new Set(store.get('cdo-reservas', []));
  let selected = null, ringEl = null, resMsgKey = null;
  function shapeFor(tb, cls) {
    const [w, h] = SIZES[tb.shape]; let el;
    if (tb.shape === 'round') { el = document.createElementNS(svgNS, 'circle'); el.setAttribute('cx', tb.x); el.setAttribute('cy', tb.y); el.setAttribute('r', w / 2); }
    else { el = document.createElementNS(svgNS, 'rect'); el.setAttribute('x', tb.x - w / 2); el.setAttribute('y', tb.y - h / 2); el.setAttribute('width', w); el.setAttribute('height', h); el.setAttribute('rx', 18); }
    el.setAttribute('class', cls); return el;
  }
  TABLES.forEach(tb => {
    tb.shapeEl = shapeFor(tb, 't'); planSvg.appendChild(tb.shapeEl);
    const [w, h] = SIZES[tb.shape], b = document.createElement('button');
    b.type = 'button';
    b.style.left = (tb.x / 1165 * 100) + '%'; b.style.top = (tb.y / 870 * 100) + '%';
    b.style.width = (w / 1165 * 100) + '%'; b.style.height = (h / 870 * 100) + '%';
    b.addEventListener('click', () => pickTable(tb, true));
    b.addEventListener('mouseenter', () => tb.shapeEl.classList.add('hover')); b.addEventListener('mouseleave', () => tb.shapeEl.classList.remove('hover'));
    b.addEventListener('focus', () => tb.shapeEl.classList.add('hover')); b.addEventListener('blur', () => tb.shapeEl.classList.remove('hover'));
    tb.btn = b; planHit.appendChild(b);
  });
  const isoDay = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function slotsFor(dateStr) {
    const d = new Date(dateStr + 'T12:00:00'), sunday = d.getDay() === 0, open = sunday ? 9 : 8, lastSlot = sunday ? 18.5 : 20.5;
    const now = new Date(), today = dateStr === isoDay(now), out = [];
    for (let h = open; h <= lastSlot; h += 0.5) { if (today && h <= now.getHours() + now.getMinutes() / 60 + 0.5) continue; out.push(`${pad2(Math.floor(h))}:${h % 1 ? '30' : '00'}`); }
    return out;
  }
  const fmtTime = hhmm => { const [h, m] = hhmm.split(':').map(Number); if (LANG === 'en') { const ap = h >= 12 ? 'pm' : 'am', hh = h % 12 || 12; return `${hh}:${pad2(m)} ${ap}`; } return `${h}h${pad2(m)}`; };
  function fillTimes(keep) {
    const slots = slotsFor(rDate.value);
    rTime.innerHTML = slots.length ? slots.map(s => `<option value="${s}">${fmtTime(s)}</option>`).join('') : `<option value="">${t('res.noSlots')}</option>`;
    if (keep && slots.includes(keep)) rTime.value = keep; else if (slots.includes('19:00')) rTime.value = '19:00';
  }
  function fillPeople() {
    const keep = rPeople.value || '2';
    rPeople.innerHTML = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${t(i ? 'res.persons' : 'res.person', { n: i + 1 })}</option>`).join('');
    rPeople.value = keep;
  }
  function initDates() {
    const now = new Date(), d = new Date(now);
    if (!slotsFor(isoDay(d)).length) d.setDate(d.getDate() + 1);
    const max = new Date(now); max.setDate(max.getDate() + 60);
    rDate.min = isoDay(now); rDate.max = isoDay(max); rDate.value = isoDay(d);
    fillTimes();
  }
  const slotKey = () => `${rDate.value} ${rTime.value}`;
  function tableState(tb) {
    const r = rng(hash(slotKey() + '#' + tb.n));
    const busy = mine.has(slotKey() + '#' + tb.n) || r() < 0.3;
    return busy ? 'busy' : (tb.seats < +rPeople.value ? 'small' : 'free');
  }
  const describe = tb => t('res.desc', { n: pad2(tb.n), s: tb.seats, zone: t('zone.' + tb.zone) });
  function refreshTables() {
    const people = +rPeople.value;
    TABLES.forEach(tb => { tb.state = rTime.value ? tableState(tb) : 'busy'; });
    TABLES.forEach(tb => {
      tb.shapeEl.classList.toggle('busy', tb.state === 'busy'); tb.shapeEl.classList.toggle('small', tb.state === 'small'); tb.shapeEl.classList.toggle('sel', selected === tb);
      tb.btn.disabled = tb.state !== 'free'; tb.btn.setAttribute('aria-pressed', String(selected === tb));
      const st = tb.state === 'free' ? (selected === tb ? t('res.stSel') : t('res.stFree')) : tb.state === 'busy' ? t('res.stBusy') : t('res.stSmall', { p: people });
      tb.btn.setAttribute('aria-label', t('res.aria', { n: tb.n, s: tb.seats, zone: t('zone.' + tb.zone), state: st }));
    });
    rList.innerHTML = `<option value="">${t('res.pick')}</option>` + TABLES.map(tb => `<option value="${tb.n}" ${tb.state !== 'free' ? 'disabled' : ''} ${selected === tb ? 'selected' : ''}>${describe(tb)}${tb.state === 'busy' ? t('res.optBusy') : tb.state === 'small' ? t('res.optSmall') : ''}</option>`).join('');
    if (selected && selected.state !== 'free') {
      const lost = selected; pickTable(null);
      rMsg.className = 'f-msg';
      rMsg.textContent = lost.state === 'busy' ? t('res.lostBusy', { n: pad2(lost.n) }) : t('res.lostSmall', { n: pad2(lost.n), p: people });
    }
  }
  function pickTable(tb, fromMap) {
    if (tb && tb.state !== 'free') return;
    selected = tb;
    if (ringEl) { ringEl.remove(); ringEl = null; }
    if (tb) {
      ringEl = shapeFor(tb, 'sel-ring'); ringEl.setAttribute('pathLength', '1');
      if (tb.shape === 'round') ringEl.setAttribute('r', SIZES.round[0] / 2 + 7);
      else { const [w, h] = SIZES[tb.shape]; ringEl.setAttribute('x', tb.x - w / 2 - 7); ringEl.setAttribute('y', tb.y - h / 2 - 7); ringEl.setAttribute('width', w + 14); ringEl.setAttribute('height', h + 14); ringEl.setAttribute('rx', 24); }
      planSvg.appendChild(ringEl);
      requestAnimationFrame(() => ringEl && ringEl.classList.add('draw'));
      rMsg.textContent = '';
    }
    updateResLabels();
    TABLES.forEach(x => { x.shapeEl.classList.toggle('sel', selected === x); x.btn.setAttribute('aria-pressed', String(selected === x)); });
    rList.value = tb ? String(tb.n) : '';
    if (fromMap && tb && matchMedia('(max-width: 980px)').matches) setTimeout(() => $('#resPanel').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' }), 350);
  }
  function updateResLabels() {
    planChip.textContent = selected ? describe(selected) : t('res.none');
    rSubmit.textContent = selected ? t('res.submitN', { n: pad2(selected.n) }) : t('res.submit');
  }
  rList.addEventListener('change', () => pickTable(TABLES.find(x => String(x.n) === rList.value) || null));
  rDate.addEventListener('change', () => { fillTimes(rTime.value); refreshTables(); });
  rTime.addEventListener('change', refreshTables);
  rPeople.addEventListener('change', refreshTables);
  maskPhone($('#rPhone'));
  fillPeople(); initDates(); refreshTables(); updateResLabels();
  const resForm = $('#resForm'), resDone = $('#resDone');
  let lastRes = null;
  function resSummary() {
    if (!lastRes) return;
    let when = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(lastRes.date + 'T12:00:00'));
    when = when.charAt(0).toUpperCase() + when.slice(1);
    $('#doneTitle').textContent = t('res.doneT', { n: pad2(lastRes.n) });
    $('#doneSum').textContent = t('res.doneS', { when, time: fmtTime(lastRes.time), people: t(lastRes.people > 1 ? 'res.persons' : 'res.person', { n: lastRes.people }), name: lastRes.name });
  }
  resForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#rName'), phone = $('#rPhone');
    [name, phone].forEach(el => el.removeAttribute('aria-invalid'));
    rMsg.className = 'f-msg';
    if (!rTime.value) { rMsg.textContent = t('res.errDay'); rDate.focus(); return; }
    if (!selected) { rMsg.textContent = t('res.errTable'); return; }
    const bad = [];
    if (name.value.trim().length < 2) bad.push(name);
    if (digits(phone.value).length < 10) bad.push(phone);
    if (bad.length) { bad.forEach(el => el.setAttribute('aria-invalid', 'true')); rMsg.textContent = t('res.errFields'); bad[0].focus(); return; }
    lastRes = { n: selected.n, date: rDate.value, time: rTime.value, people: +rPeople.value, name: name.value.trim().split(' ')[0] };
    resSummary();
    mine.add(slotKey() + '#' + selected.n); store.set('cdo-reservas', [...mine]);
    resForm.hidden = true; resDone.hidden = false; resDone.classList.add('show'); resDone.focus();
  });
  $('#resAgain').addEventListener('click', () => {
    resDone.hidden = true; resDone.classList.remove('show'); resForm.hidden = false;
    pickTable(null); refreshTables(); $('#rName').value = ''; $('#rPhone').value = ''; rDate.focus();
  });
  langHooks.push(() => { fillPeople(); fillTimes(rTime.value); refreshTables(); updateResLabels(); resSummary(); rMsg.textContent = ''; });

  /* ================= club ================= */
  const clubCard = $('#clubCard'), cardWrap = $('.club-card-wrap');
  if (FINE && !LITE && !RM.matches) {
    cardWrap.addEventListener('pointermove', e => {
      const r = cardWrap.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      clubCard.style.setProperty('--ry', (x * 26).toFixed(1) + 'deg'); clubCard.style.setProperty('--rx', (-y * 20).toFixed(1) + 'deg');
      clubCard.style.setProperty('--sx', (x * 120).toFixed(0) + '%');
    });
    cardWrap.addEventListener('pointerleave', () => { ['--rx', '--ry', '--sx'].forEach(v => clubCard.style.removeProperty(v)); });
  }
  let clubName = '';
  $('#clubForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#clubEmail').value.trim(), msg = $('#clubMsg');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { msg.className = 'f-msg'; msg.textContent = t('club.bad'); $('#clubEmail').focus(); return; }
    clubName = v.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 24);
    $('#ccName').textContent = clubName;
    msg.className = 'f-msg ok'; msg.textContent = t('club.ok');
    clubCard.animate?.([{ transform: 'rotateX(8deg) rotateY(-14deg) scale(1)' }, { transform: 'rotateX(0deg) rotateY(180deg) scale(1.04)' }, { transform: 'rotateX(8deg) rotateY(346deg) scale(1)' }], { duration: RM.matches ? 0 : 1100, easing: 'cubic-bezier(.65,0,.35,1)' });
  });
  langHooks.push(() => { if (clubName) $('#ccName').textContent = clubName; if ($('#clubMsg').textContent) $('#clubMsg').textContent = t($('#clubMsg').classList.contains('ok') ? 'club.ok' : 'club.bad'); });

  /* ================= reviews carousel ================= */
  const track = $('#revTrack');
  track.dataset.cursor = 'drag';
  const stepBy = dir => { const c = $('.rev', track); track.scrollBy({ left: dir * (c ? c.offsetWidth + 20 : 400), behavior: RM.matches ? 'auto' : 'smooth' }); };
  $('#revPrev').addEventListener('click', () => stepBy(-1));
  $('#revNext').addEventListener('click', () => stepBy(1));
  track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); stepBy(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); stepBy(-1); } });
  let dragX = null, dragS = 0, moved = false;
  track.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; dragX = e.clientX; dragS = track.scrollLeft; moved = false; track.classList.add('drag'); track.setPointerCapture(e.pointerId); });
  track.addEventListener('pointermove', e => { if (dragX === null) return; const dx = e.clientX - dragX; if (Math.abs(dx) > 3) moved = true; track.scrollLeft = dragS - dx; });
  const endDrag = () => { if (dragX === null) return; dragX = null; track.classList.remove('drag'); };
  track.addEventListener('pointerup', endDrag); track.addEventListener('pointercancel', endDrag);
  track.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } }, true);

  /* ================= keyboard: Escape closes the top layer ================= */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!qv.hidden && qv.classList.contains('on')) closeQV();
      else if (!drawer.hidden && drawer.classList.contains('on')) closeBag();
      else if (menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    }
    if (e.key === 'Tab') {                               // keep focus inside an open dialog
      const box = !qv.hidden && qv.classList.contains('on') ? qv : !drawer.hidden && drawer.classList.contains('on') ? drawer : null;
      if (!box) return;
      const f = $$('button:not([disabled]),a[href],input:not([type="radio"]),input[type="radio"]:checked,select,[tabindex="0"]', box).filter(el => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ================= reduced motion, live in both directions ================= */
  function pinToFinalStates() {
    $$('.reveal').forEach(el => el.classList.add('in'));
    $$('.count').forEach(c => { c.textContent = c.dataset.to; });
    grid.classList.add('show', 'settled');
    manLit = -1; manifestoUpdate();
    rit.pinFull();
    tLast = -1; drawThread();
  }
  RM.addEventListener('change', e => {
    root.classList.toggle('reduced', e.matches);
    if (e.matches) pinToFinalStates(); else { rit.unpin(); tLast = -1; drawThread(); manLit = -1; manifestoUpdate(); }
  });

  /* ================= boot ================= */
  applyI18n();
  document.title = t('meta.title');
  $$('button[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  syncTheme();
  renderBag(); showView('cart');
  applyHeroMode();
  frame();
  if (RM.matches) pinToFinalStates();
})();
