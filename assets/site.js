/* Caffè D'oro · vanilla JS, no build step */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ss = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const money = v => brl.format(v);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: fine */ } }
  };
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const rng = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const hash = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const root = document.documentElement;

  /* ---------------- Split headlines into words, once ---------------- */
  $$('.split').forEach((el, n) => {
    const raw = el.textContent.trim().replace(/\s+/g, ' ');
    const text = raw.replace(/ \/ /g, ' ');
    const words = raw.split(' ');
    const fx = el.dataset.fx;
    const r = rng(n * 97 + 13);
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = text;
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    words.forEach((w, i) => {
      if (w === '/') { vis.appendChild(document.createElement('br')); return; }   // designed line break
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = w;
      s.style.setProperty('--th', ((i / Math.max(1, words.length - 1)) * 0.5 + r() * 0.05).toFixed(3));
      if (fx === 'part') s.style.setProperty('--dir', i < words.length / 2 ? -1 : 1);
      vis.appendChild(s);
      if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });
    el.append(sr, vis);
  });

  /* ---------------- HERO: layered scenes scrubbed by scroll ---------------- */
  const hero = $('.hero');
  const stage = $('#stage');
  const logoWrap = $('#logoWrap');
  const sD = $('#sD');
  const cue = $('#cue');
  const ramos = $$('.ramo');
  const bags = $$('.bag').map(el => ({ el, i: +el.dataset.i, t: '', o: -1 }));
  const bands = $$('.band').map(el => ({
    el, a: +el.dataset.a, b: +el.dataset.b, op: -1, k: -1, vis: null,
    first: el.classList.contains('b1'), last: el.classList.contains('b4'), done: null
  }));
  bags.forEach(b => { b.el.style.zIndex = String(10 - Math.abs(b.i)); });
  // branches and bags only appear after some scrolling: fetch them right after the first screen is painted
  let deferredDone = false;
  function loadDeferred() {
    if (deferredDone) return;
    deferredDone = true;
    $$('img[data-src]').forEach(img => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
  }
  addEventListener('scroll', loadDeferred, { passive: true, once: true });
  addEventListener('load', () => ('requestIdleCallback' in window ? requestIdleCallback(loadDeferred, { timeout: 1500 }) : setTimeout(loadDeferred, 600)));
  setTimeout(loadDeferred, 4000);   // safety net

  // a picture that fails to load simply disappears; the page stays complete without it
  $$('.stage img').forEach(img => {
    const hide = () => img.classList.add('broken');
    if (img.complete && img.naturalWidth === 0 && img.src) hide();
    img.addEventListener('error', hide);
  });

  let vw = innerWidth, vh = innerHeight, heroRange = 1, heroTop = 0, bw = 200, portrait = false;
  let target = 0, shown = 0, rafId = null, lastTick = 0, heroOn = true, scrubOn = false, loadK = 0;
  const cache = new Map();
  const put = (el, prop, val) => {             // delta-gated style writes
    let c = cache.get(el); if (!c) { c = {}; cache.set(el, c); }
    if (c[prop] === val) return;
    c[prop] = val;
    if (prop.startsWith('--')) el.style.setProperty(prop, val); else el.style[prop] = val;
  };

  function measure() {
    vw = innerWidth; vh = stage.offsetHeight || innerHeight;
    heroTop = hero.offsetTop;
    heroRange = Math.max(1, hero.offsetHeight - stage.offsetHeight);
    portrait = matchMedia('(max-aspect-ratio: 4/5)').matches;
    const center = bags.find(b => b.i === 0);
    bw = center ? center.el.offsetWidth : 200;
  }
  const heroProgress = () => clamp((scrollY - heroTop) / heroRange, 0, 1);

  function renderScenes(p) {
    // A: the golden bean, the camera pushes into it
    const tA = ss(p, 0.14, 0.3);
    put(logoWrap, 'transform', `scale(${(1 + 2.9 * tA * tA).toFixed(4)})`);
    put(logoWrap, 'opacity', (1 - ss(p, 0.19, 0.27)).toFixed(3));

    // B: branches part in from both edges, then pass upward
    const enter = easeOut(ss(p, 0.16, 0.34));
    const exit = ss(p, 0.47, 0.58);
    const fade = ss(p, 0.16, 0.24) * (1 - exit);
    const [r1, r2, r3] = ramos;
    put(r1, 'transform', `translate3d(${(-(1 - enter) * 0.62 * vw).toFixed(1)}px,${(-exit * 0.55 * vh).toFixed(1)}px,0) rotate(${(-16 + 8 * enter).toFixed(2)}deg)`);
    put(r2, 'transform', `translate3d(${((1 - enter) * 0.62 * vw).toFixed(1)}px,${(-exit * 0.8 * vh).toFixed(1)}px,0) rotate(${(12 - 6 * enter).toFixed(2)}deg)`);
    put(r3, 'transform', `translate3d(${(-(1 - enter) * 0.2 * vw).toFixed(1)}px,${(((1 - enter) * 0.5 - exit * 1.4) * vh).toFixed(1)}px,0) rotate(-6deg)`);
    put(r1, 'opacity', fade.toFixed(3));
    put(r2, 'opacity', fade.toFixed(3));
    put(r3, 'opacity', (fade * 0.7).toFixed(3));

    // C: nine bags drop one by one, outside in, Geisha lands last in the center
    const vExit = ss(p, 0.76, 0.86);
    const spread = portrait ? 0.5 : 0.62;
    const maxI = portrait ? 2 : 4;
    bags.forEach(b => {
      const ai = Math.abs(b.i);
      if (ai > maxI) return;
      const st = ai === 0 ? (portrait ? 0.6 : 0.62) : 0.5 + (maxI - ai) * (portrait ? 0.045 : 0.03);
      const e = easeOutQuart(clamp((p - st) / 0.07, 0, 1));
      const s = 1 - ai * (portrait ? 0.1 : 0.075);
      const x = b.i * bw * spread - bw / 2;
      const y = -ai * vh * 0.012 - (1 - e) * vh * 1.15 + vExit * vh * 0.75;
      const rot = (1 - e) * (b.i % 2 ? 9 : -9);
      const t = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(3)})`;
      if (t !== b.t) { b.t = t; b.el.style.transform = t; }
      const o = (ss(p, st, st + 0.008) * (1 - vExit)).toFixed(3);
      if (o !== b.o) { b.o = o; b.el.style.opacity = o; }
    });

    // D: the pour rises into place
    const tD = ss(p, 0.74, 0.9);
    put(sD, 'opacity', tD.toFixed(3));
    put(sD, 'transform', `translate3d(0,${((1 - tD) * 0.06 * vh).toFixed(1)}px,0) scale(${(1.16 - 0.16 * easeOut(tD)).toFixed(4)})`);

    cue.classList.toggle('gone', p > 0.03);
  }

  function renderBands(p) {
    bands.forEach(bd => {
      const { a, b } = bd;
      const f = Math.min(0.04, (b - a) / 4);
      let op, k;
      if (bd.first) { op = 1 - ss(p, b - f, b); k = loadK; }
      else if (bd.last) {
        op = ss(p, a, a + f);
        k = clamp((p - a) / 0.12, 0, 1);
      } else {
        op = ss(p, a, a + f) * (1 - ss(p, b - f, b));
        k = clamp((p - a) / Math.min(0.06, (b - a) * 0.35), 0, 1);
      }
      if (Math.abs(op - bd.op) > 0.004 || (op === 0) !== (bd.op === 0) || (op === 1) !== (bd.op === 1)) {
        bd.op = op; bd.el.style.opacity = op.toFixed(3);
        const vis = op < 0.005 ? 'hidden' : 'visible';
        if (vis !== bd.vis) { bd.vis = vis; bd.el.style.visibility = vis; }
      }
      if (Math.abs(k - bd.k) > 0.008 || (k === 1 && bd.k !== 1) || (k === 0 && bd.k !== 0)) {
        bd.k = k;
        bd.el.style.setProperty('--k', k.toFixed(3));
        if (bd.last) {
          bd.el.style.setProperty('--kc0', clamp(k * 4, 0, 1).toFixed(3));
          bd.el.style.setProperty('--ks', clamp((k - 0.6) * 4, 0, 1).toFixed(3));
          bd.el.style.setProperty('--kb', clamp((k - 0.75) * 5, 0, 1).toFixed(3));
          const done = k > 0.95;
          if (done !== bd.done) { bd.done = done; bd.el.classList.toggle('done', done); }
        }
      }
    });
  }

  function render(p) { renderScenes(p); renderBands(p); }

  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const k = 0.14;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    if (Math.abs(target - shown) < 0.0003) { shown = target; rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
    render(shown);
  }
  function onHeroScroll() {
    target = heroProgress();
    if (rafId === null && heroOn) rafId = requestAnimationFrame(tick);
  }

  // band one assembles on load, then hands over to scroll
  let loadStart = 0;
  function loadRamp(now) {
    if (!loadStart) loadStart = now;
    loadK = easeOut(clamp((now - loadStart - 350) / 1500, 0, 1));
    if (scrubOn) renderBands(shown);
    if (loadK < 1) requestAnimationFrame(loadRamp);
  }

  const GATES = [
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  const MQLS = GATES.map(q => matchMedia(q));

  function clearInline() {
    [logoWrap, sD, ...ramos, ...bags.map(b => b.el)].forEach(el => { el.style.transform = ''; el.style.opacity = ''; });
    bands.forEach(bd => {
      ['opacity', 'visibility'].forEach(pr => { bd.el.style[pr] = ''; });
      ['--k', '--ks', '--kb', '--kc0'].forEach(v => bd.el.style.removeProperty(v));
      bd.el.classList.remove('done');
    });
    cache.clear();
    bags.forEach(b => { b.t = ''; b.o = -1; });
  }
  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    root.classList.add('scrub');
    measure();
    bands.forEach(b => { b.op = -1; b.k = -1; b.vis = null; b.done = null; });
    cache.clear();
    addEventListener('scroll', onHeroScroll, { passive: true });
    shown = target = heroProgress();
    render(shown);
    requestAnimationFrame(loadRamp);
  }
  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    removeEventListener('scroll', onHeroScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    root.classList.remove('scrub');
    clearInline();
  }
  function applyHeroMode() {
    if (MQLS.some(m => m.matches)) disableScrub(); else enableScrub();
    rebuildSoon();
  }
  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));

  new IntersectionObserver(es => {
    es.forEach(e => {
      heroOn = e.isIntersecting;
      hero.classList.toggle('live', heroOn);
      if (heroOn && scrubOn) onHeroScroll();
    });
  }).observe(hero);

  /* ---------------- Nav ---------------- */
  const nav = $('#nav');
  const menuBtn = $('#menuBtn');
  const mMenu = $('#mMenu');
  let navSolid = null;
  function onNavScroll() {
    const solid = scrollY > hero.offsetHeight - 90;
    if (solid !== navSolid) { navSolid = solid; nav.classList.toggle('solid', solid); }
  }
  addEventListener('scroll', onNavScroll, { passive: true });
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    mMenu.hidden = !open;
    if (open) nav.classList.add('solid'); else { navSolid = null; onNavScroll(); }
  }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  $$('a', mMenu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ---------------- The golden thread ---------------- */
  const main = $('#main');
  const thread = $('#thread');
  const tPath = $('#threadPath');
  const spark = $('#spark');
  tPath.removeAttribute('pathLength');
  let tLen = 0, lut = [], nodes = [], tLast = -1, mainTop = 0, tRaf = null;

  function buildThread() {
    thread.style.height = '0px';
    const W = main.clientWidth;
    const H = main.scrollHeight;
    mainTop = main.getBoundingClientRect().top + scrollY;
    thread.setAttribute('viewBox', `0 0 ${W} ${H}`);
    thread.style.height = H + 'px';
    const secs = $$('.sec', main);
    const wrapW = Math.min(1200, W);
    const gutter = (W - wrapW) / 2;
    const inset = gutter > 90 ? gutter * 0.5 : Math.max(8, Math.min(18, W * 0.025));
    const xl = inset, xr = W - inset, cx = W / 2;
    const padOf = s => parseFloat(getComputedStyle(s).paddingTop) || 100;
    let side = 0;
    let d = `M ${cx} 0`;
    const nodePts = [];
    secs.forEach((s, i) => {
      const top = s.offsetTop, pad = padOf(s), bottom = top + s.offsetHeight;
      const x = side === 0 ? xl : xr;
      if (i === 0) d += ` C ${cx} ${top + pad * 0.45}, ${x} ${top + pad * 0.3}, ${x} ${top + pad * 0.85}`;
      if (i === secs.length - 1) {
        const mark = $('.final-mark', s);
        const my = mark ? mark.getBoundingClientRect().top - main.getBoundingClientRect().top - 18 : top + pad;
        d += ` C ${x} ${my - pad * 0.2}, ${cx} ${my - pad * 0.7}, ${cx} ${my}`;
        nodePts.push([cx, my]);
        return;
      }
      const yEnd = bottom - pad * 0.55;
      d += ` L ${x} ${yEnd}`;
      const next = secs[i + 1];
      const nPad = padOf(next);
      const yTo = next.offsetTop + nPad * 0.55;
      const yMid = (yEnd + yTo) / 2;
      const nx = side === 0 ? xr : xl;
      d += ` C ${x} ${yMid}, ${nx} ${yMid}, ${nx} ${yTo}`;
      nodePts.push([cx, yMid]);
      side = 1 - side;
    });
    tPath.setAttribute('d', d);
    tLen = tPath.getTotalLength();
    tPath.style.strokeDasharray = `${tLen} ${tLen}`;
    // length lookup by y (the path only ever goes down)
    lut = [];
    const N = Math.ceil(tLen / 10);
    for (let i = 0; i <= N; i++) { const l = (i / N) * tLen; lut.push([tPath.getPointAtLength(l).y, l]); }
    $$('.node', thread).forEach(n => n.remove());
    nodes = nodePts.map(([x, y]) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'node'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 4.5);
      thread.insertBefore(c, spark);
      return { el: c, len: lenAtY(y), lit: false };
    });
    tLast = -1;
    drawThread();
  }
  function lenAtY(y) {
    if (!lut.length) return 0;
    let lo = 0, hi = lut.length - 1;
    if (y <= lut[0][0]) return 0;
    if (y >= lut[hi][0]) return tLen;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lut[m][0] < y) lo = m; else hi = m; }
    const [y0, l0] = lut[lo], [y1, l1] = lut[hi];
    return l0 + (l1 - l0) * ((y - y0) / Math.max(0.0001, y1 - y0));
  }
  function drawThread() {
    tRaf = null;
    if (!tLen) return;
    const y = scrollY + innerHeight * 0.62 - mainTop;
    const len = RM.matches ? tLen : clamp(lenAtY(y), 0, tLen);
    if (Math.abs(len - tLast) < 0.5) return;
    tLast = len;
    tPath.style.strokeDashoffset = (tLen - len).toFixed(1);
    const on = len > 2 && len < tLen - 2 && !RM.matches;
    spark.classList.toggle('on', on);
    if (on) { const pt = tPath.getPointAtLength(len); spark.setAttribute('cx', pt.x.toFixed(1)); spark.setAttribute('cy', pt.y.toFixed(1)); }
    nodes.forEach(n => { const lit = len >= n.len - 1; if (lit !== n.lit) { n.lit = lit; n.el.classList.toggle('lit', lit); } });
  }
  addEventListener('scroll', () => { if (tRaf === null) tRaf = requestAnimationFrame(drawThread); }, { passive: true });
  let rebuildT = 0;
  function rebuildSoon() { clearTimeout(rebuildT); rebuildT = setTimeout(() => { measure(); buildThread(); if (scrubOn) { target = shown = heroProgress(); render(shown); } onNavScroll(); }, 160); }
  addEventListener('resize', rebuildSoon);
  if ('ResizeObserver' in window) new ResizeObserver(rebuildSoon).observe(main);
  addEventListener('load', rebuildSoon);

  /* ---------------- Reveals, counters, living sections ---------------- */
  const counters = $$('.count');
  function runCount(el) {
    const to = +el.dataset.to; const t0 = performance.now(); let lastV = -1;
    const step = now => {
      const v = Math.round(to * easeOut(clamp((now - t0) / 1400, 0, 1)));
      if (v !== lastV) { lastV = v; el.textContent = v; }
      if (v < to) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  }
  const revealIO = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('in');
      revealIO.unobserve(el);
      if (!RM.matches) $$('.count', el).forEach(runCount);
      if (el.classList.contains('pecas-grid')) setTimeout(() => el.classList.add('settled'), 1500);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => revealIO.observe(el));
  const liveIO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '10% 0px' });
  $$('.sec').forEach(s => liveIO.observe(s));
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  function pinToFinalStates() {
    $$('.reveal').forEach(el => el.classList.add('in'));
    counters.forEach(c => { c.textContent = c.dataset.to; });
    $('#pecasGrid').classList.add('in', 'settled');
    tLast = -1; drawThread();
  }
  RM.addEventListener('change', e => { if (e.matches) pinToFinalStates(); else { tLast = -1; drawThread(); } });

  /* ---------------- Shop data ---------------- */
  const V = [
    { id: 'arabica', name: 'Arábica', tag: 'Suave e aromático', line: 'O café do dia a dia, feito com cuidado de fim de semana.', notes: ['Floral', 'Acidez média', 'Final adocicado'], int: 3, sw: '#8a4a22', halo: 'rgba(176,102,52,.36)', price: { graos: 139, po: 42, caps: 29 } },
    { id: 'bourbon', name: 'Bourbon', tag: 'Doce e balanceado', line: 'Doce sem precisar de açúcar. Pede uma conversa longa.', notes: ['Caramelo', 'Chocolate', 'Corpo suave'], int: 3, sw: '#6b3419', halo: 'rgba(150,80,40,.36)', price: { graos: 149, po: 45, caps: 31 } },
    { id: 'caturra', name: 'Caturra', tag: 'Sabor intenso', line: 'Para quem gosta de sentir o café do primeiro ao último gole.', notes: ['Frutas vermelhas', 'Corpo firme', 'Equilíbrio'], int: 4, sw: '#2b4f8a', halo: 'rgba(60,100,170,.32)', price: { graos: 139, po: 42, caps: 29 } },
    { id: 'excelsa', name: 'Excelsa', tag: 'Frutado e ácido', line: 'Surpreende quem acha que já provou de tudo.', notes: ['Cítrico', 'Acidez viva', 'Aroma complexo'], int: 3, sw: '#3a332c', halo: 'rgba(217,167,74,.24)', price: { graos: 169, po: 49, caps: 33 } },
    { id: 'geisha', name: 'Geisha', tag: 'Floral e elegante', line: 'O mais raro da casa. Beba devagar.', notes: ['Jasmim', 'Chá', 'Final delicado'], int: 2, sw: '#e8d8ae', halo: 'rgba(240,215,160,.34)', price: { graos: 289, po: 79, caps: 49 } },
    { id: 'liberica', name: 'Liberica', tag: 'Defumado e floral', line: 'Um sabor que você não encontra em qualquer lugar.', notes: ['Defumado', 'Floral', 'Grão grande'], int: 4, sw: '#8a3420', halo: 'rgba(170,70,45,.34)', price: { graos: 189, po: 52, caps: 35 } },
    { id: 'maragogipe', name: 'Maragogipe', tag: 'Gigante em sabor', line: 'Grão enorme, xícara macia.', notes: ['Adocicado', 'Corpo aveludado', 'Grão gigante'], int: 3, sw: '#23603b', halo: 'rgba(50,120,80,.32)', price: { graos: 199, po: 55, caps: 36 } },
    { id: 'robusta', name: 'Robusta', tag: 'Mais cafeína', line: 'Para as manhãs que começam cedo demais.', notes: ['Intenso', 'Encorpado', 'Mais cafeína'], int: 5, sw: '#5a2c70', halo: 'rgba(120,60,150,.32)', price: { graos: 119, po: 36, caps: 27 } },
    { id: 'typica', name: 'Typica', tag: 'Perfil limpo', line: 'Limpo, claro e direto. Café sem ruído.', notes: ['Acidez brilhante', 'Refinado', 'Aroma elegante'], int: 3, sw: '#2b2723', halo: 'rgba(217,167,74,.24)', price: { graos: 159, po: 46, caps: 32 } }
  ];
  const FMT = { graos: { label: 'Em grãos', size: '1 kg' }, po: { label: 'Moído', size: '250 g' }, caps: { label: 'Cápsulas', size: '10 un' } };
  const imgFor = (v, f) => `assets/img/${f}-${v.id}.webp`;

  const vList = $('#vList');
  const vImgs = [$('#vImgA'), $('#vImgB')];
  let front = 0, cur = V[0], fmt = 'graos', swapN = 0;
  V.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'v-tab'; b.setAttribute('role', 'tab'); b.id = 'tab-' + v.id;
    b.setAttribute('aria-controls', 'vPanel');
    b.setAttribute('aria-selected', String(i === 0));
    b.tabIndex = i === 0 ? 0 : -1;
    b.style.setProperty('--sw', v.sw);
    b.innerHTML = `<span class="sw"></span><span class="nm">${v.name}</span><span class="tg">${v.tag}</span>`;
    b.addEventListener('click', () => selectVariety(v));
    vList.appendChild(b);
  });
  vList.addEventListener('keydown', e => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    let i = V.indexOf(cur);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') i = (i + 1) % V.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') i = (i - 1 + V.length) % V.length;
    else if (e.key === 'Home') i = 0; else i = V.length - 1;
    selectVariety(V[i]);
    $('#tab-' + V[i].id).focus();
  });
  $$('input[name="fmt"]').forEach(r => r.addEventListener('change', () => { fmt = r.value; updatePanel(true); }));

  function selectVariety(v) {
    if (v === cur) return;
    cur = v;
    $$('.v-tab', vList).forEach(t => {
      const on = t.id === 'tab-' + v.id;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      if (on && matchMedia('(max-width: 980px)').matches) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: RM.matches ? 'auto' : 'smooth' });
    });
    updatePanel(true);
  }
  function swapImage(src, alt) {
    const n = ++swapN;
    const back = vImgs[1 - front];
    back.onload = null;
    const show = () => {
      if (n !== swapN) return;
      back.alt = alt;
      back.classList.add('on');
      vImgs[front].classList.remove('on');
      vImgs[front].alt = '';
      front = 1 - front;
    };
    back.src = src;
    if (back.complete && back.naturalWidth) show();
    else back.onload = show;
  }
  function updatePanel(animate) {
    const v = cur, f = FMT[fmt];
    $('#vTag').textContent = v.tag;
    $('#vName').textContent = v.name;
    $('#vLine').textContent = v.line;
    $('#vNotes').innerHTML = v.notes.map(n => `<li>${n}</li>`).join('');
    $('#vInt').innerHTML = `<span>Intensidade</span><span class="dots" aria-label="${v.int} de 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= v.int ? 'f' : ''}"></i>`).join('')}</span>`;
    $('#vPrice').textContent = money(v.price[fmt]);
    $('#vPanel').setAttribute('aria-labelledby', 'tab-' + v.id);
    $('.halo').style.setProperty('--halo', v.halo);
    const alt = `Café ${v.name}, ${f.label.toLowerCase()}, ${f.size}`;
    if (animate) swapImage(imgFor(v, fmt), alt);
    else { vImgs[0].src = imgFor(v, fmt); vImgs[0].alt = alt; vImgs[0].classList.add('on'); }
  }
  updatePanel(false);
  $('#vAdd').addEventListener('click', e => {
    const f = FMT[fmt];
    addToCart({ key: `${cur.id}-${fmt}`, name: `Café ${cur.name}`, sub: `${f.label} · ${f.size}`, price: cur.price[fmt], img: imgFor(cur, fmt) }, vImgs[front]);
    e.currentTarget.blur();
  });

  const P = [
    { id: 'xicara-preta', type: 'Xícara com pires', name: 'Noite', desc: 'Preta fosca com filetes dourados.', price: 89 },
    { id: 'xicara-branca', type: 'Xícara com pires', name: 'Jardim', desc: 'Porcelana branca com folhas em ouro.', price: 99 },
    { id: 'xicara-folhas', type: 'Xícara com pires', name: 'Folhagem', desc: 'Preta com ramos dourados pintados à mão.', price: 109 },
    { id: 'xicara-colmeia', type: 'Xícara com pires', name: 'Colmeia', desc: 'Base dourada com relevo de colmeia.', price: 119 },
    { id: 'caneca-preta', type: 'Caneca', name: 'Essencial', desc: 'Preta fosca, alça dourada reta.', price: 79 },
    { id: 'caneca-classica', type: 'Caneca', name: 'Clássica', desc: 'Com pé, acabamento espelhado.', price: 119 },
    { id: 'caneca-folhas', type: 'Caneca', name: 'Folhas de Ouro', desc: 'Ilustração dourada e interior em ouro.', price: 129 },
    { id: 'caneca-marmore', type: 'Caneca', name: 'Mármore', desc: 'Mármore negro com veios dourados.', price: 139 }
  ];
  const grid = $('#pecasGrid');
  grid.innerHTML = P.map(p => `
    <article class="peca">
      <div class="pimg"><img src="assets/img/${p.id}.webp" alt="${p.type} ${p.name}: ${p.desc}" width="680" height="680" loading="lazy"></div>
      <p class="ptype">${p.type}</p>
      <h3>${p.name}</h3>
      <p class="pdesc">${p.desc}</p>
      <div class="prow"><b>${money(p.price)}</b><button class="add-mini" type="button" data-id="${p.id}" aria-label="Adicionar ${p.type} ${p.name} à sacola"><svg width="16" height="16" aria-hidden="true"><use href="#i-plus"/></svg>Sacola</button></div>
    </article>`).join('');
  revealIO.observe(grid);
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.add-mini'); if (!btn) return;
    const p = P.find(x => x.id === btn.dataset.id);
    addToCart({ key: p.id, name: `${p.type === 'Caneca' ? 'Caneca' : 'Xícara'} ${p.name}`, sub: p.type, price: p.price, img: `assets/img/${p.id}.webp` }, btn.closest('.peca').querySelector('img'));
  });

  /* ---------------- Cart ---------------- */
  let cart = store.get('cdo-sacola', []);
  if (!Array.isArray(cart)) cart = [];
  const bagBtn = $('#bagBtn'), bagCount = $('#bagCount');
  const drawer = $('#drawer'), veil = $('#veil');
  const viewCart = $('#viewCart'), viewCheckout = $('#viewCheckout'), viewDone = $('#viewDone');
  const drMain = $('#drMain'), drFoot = $('#drFoot');
  let view = 'cart', lastFocus = null;
  const subtotal = () => cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = s => (s === 0 || s >= 150 ? 0 : 12);

  function saveCart() { store.set('cdo-sacola', cart); renderCart(); }
  function renderCart() {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    bagCount.textContent = n;
    bagCount.classList.toggle('on', n > 0);
    bagBtn.setAttribute('aria-label', `Abrir sacola, ${n} ${n === 1 ? 'item' : 'itens'}`);
    $('#cartList').innerHTML = cart.map(i => `
      <li class="cart-item" data-key="${i.key}">
        <img src="${i.img}" alt="" width="72" height="80">
        <div><p class="ci-name">${i.name}</p><p class="ci-sub">${i.sub}</p>
          <div class="ci-qty"><button type="button" data-act="dec" aria-label="Diminuir quantidade de ${i.name}"><svg width="14" height="14"><use href="#i-minus"/></svg></button><span>${i.qty}</span><button type="button" data-act="inc" aria-label="Aumentar quantidade de ${i.name}"><svg width="14" height="14"><use href="#i-plus"/></svg></button></div>
        </div>
        <p class="ci-price">${money(i.price * i.qty)}</p>
      </li>`).join('');
    $('#cartEmpty').classList.toggle('on', cart.length === 0);
    const s = subtotal(), sh = shipping(s);
    $('#tSub').textContent = money(s);
    $('#tShip').textContent = s === 0 ? money(0) : (sh === 0 ? 'Grátis' : money(sh));
    $('#tTotal').textContent = money(s + sh);
    $('#shipHint').textContent = s === 0 ? '' : (s < 150 ? `Faltam ${money(150 - s)} para o frete grátis.` : 'Frete grátis garantido.');
    setMainButton();
  }
  function setMainButton() {
    drFoot.hidden = view === 'done';
    if (view === 'cart') { drMain.textContent = 'Finalizar pedido'; drMain.disabled = cart.length === 0; }
    else if (view === 'checkout') { drMain.textContent = `Confirmar pedido · ${money(subtotal() + shipping(subtotal()))}`; drMain.disabled = false; }
  }
  $('#cartList').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const key = b.closest('.cart-item').dataset.key;
    const it = cart.find(i => i.key === key); if (!it) return;
    it.qty += b.dataset.act === 'inc' ? 1 : -1;
    if (it.qty <= 0) cart = cart.filter(i => i !== it);
    saveCart();
    const again = $(`.cart-item[data-key="${key}"] button[data-act="${b.dataset.act}"]`);
    if (again) again.focus(); else drawer.querySelector('#drawerClose').focus();
  });

  const toast = $('#toast'); let toastT = 0;
  function say(msg) { toast.textContent = msg; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 2400); }

  function addToCart(item, fromImg) {
    const ex = cart.find(i => i.key === item.key);
    if (ex) ex.qty++; else cart.push({ ...item, qty: 1 });
    saveCart();
    say(`${item.name} está na sacola.`);
    if (fromImg && !RM.matches) {
      const a = fromImg.getBoundingClientRect(), b = bagBtn.getBoundingClientRect();
      if (a.width) {
        const f = document.createElement('img');
        f.src = item.img; f.className = 'fly'; f.alt = '';
        f.style.left = (a.left + a.width / 2 - 45) + 'px'; f.style.top = (a.top + a.height / 2 - 55) + 'px';
        document.body.appendChild(f);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          f.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px,${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(.18)`;
          f.style.opacity = '0.2';
        }));
        setTimeout(() => { f.remove(); bagBtn.classList.remove('bump'); void bagBtn.offsetWidth; bagBtn.classList.add('bump'); }, 900);
      }
    } else { bagBtn.classList.remove('bump'); void bagBtn.offsetWidth; bagBtn.classList.add('bump'); }
  }

  function showView(v) {
    view = v;
    viewCart.hidden = v !== 'cart';
    viewCheckout.hidden = v !== 'checkout';
    viewDone.hidden = v !== 'done';
    viewDone.classList.toggle('show', v === 'done');
    $('#drawerTitle').textContent = v === 'checkout' ? 'Finalizar pedido' : (v === 'done' ? 'Obrigado' : 'Sua sacola');
    setMainButton();
    $('#drBody').scrollTop = 0;
  }
  function openDrawer() {
    lastFocus = document.activeElement;
    if (view === 'done') showView('cart');
    veil.hidden = false; drawer.hidden = false;
    void drawer.offsetWidth;
    veil.classList.add('on'); drawer.classList.add('on');
    root.style.overflow = 'hidden';
    setTimeout(() => $('#drawerClose').focus(), 50);
  }
  function closeDrawer() {
    veil.classList.remove('on'); drawer.classList.remove('on');
    root.style.overflow = '';
    setTimeout(() => { if (!drawer.classList.contains('on')) { veil.hidden = true; drawer.hidden = true; } }, 700);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  bagBtn.addEventListener('click', openDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  veil.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDrawer(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!drawer.hidden) closeDrawer();
      else if (menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    }
    if (e.key === 'Tab' && !drawer.hidden) {       // keep focus inside the open drawer
      const f = $$('button:not([disabled]),a[href],input,select', drawer).filter(el => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  $('#coBack').addEventListener('click', () => showView('cart'));
  drMain.addEventListener('click', () => {
    if (view === 'cart' && cart.length) { showView('checkout'); setTimeout(() => $('#cName').focus(), 60); }
    else if (view === 'checkout') viewCheckout.requestSubmit();
  });

  /* ---------------- CEP lookup + 10 km radius ---------------- */
  const STORE = { lat: -23.5646, lon: -46.6647 };
  const digits = s => (s || '').replace(/\D/g, '');
  const maskCep = el => el.addEventListener('input', () => { const d = digits(el.value).slice(0, 8); el.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; });
  const maskPhone = el => el.addEventListener('input', () => {
    const d = digits(el.value).slice(0, 11);
    el.value = d.length <= 2 ? (d ? '(' + d : '') : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  });
  function km(a, b) {
    const R = 6371, rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const cepCache = new Map();
  async function getJson(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (r.status === 404 || r.status === 400) return { notFound: true };
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  function settle(res) {
    res.inArea = res.dist != null ? res.dist <= 10 : (res.city === 'São Paulo' ? null : false);
    return res;
  }
  async function lookupCep(cep) {
    if (cepCache.has(cep)) return cepCache.get(cep);
    let res;
    try {
      // street-level coordinates, so the 10 km check is real
      const j = await getJson(`https://cep.awesomeapi.com.br/json/${cep}`);
      if (j.notFound) res = { notFound: true };
      else {
        res = { street: j.address || '', hood: j.district || '', city: j.city || '', state: j.state || '' };
        const lat = parseFloat(j.lat), lon = parseFloat(j.lng);
        if (Number.isFinite(lat) && Number.isFinite(lon)) res.dist = km(STORE, { lat, lon });
        settle(res);
      }
    } catch {
      // backup service: address only (its coordinates are city-level, so they are not used)
      const j = await getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      res = j.notFound ? { notFound: true } : settle({ street: j.street || '', hood: j.neighborhood || '', city: j.city || '', state: j.state || '' });
    }
    cepCache.set(cep, res);
    return res;
  }
  const fmtKm = d => d.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  const cepIn = $('#cepIn'), cepOut = $('#cepOut');
  maskCep(cepIn);
  $('#cepForm').addEventListener('submit', async e => {
    e.preventDefault();
    const cep = digits(cepIn.value);
    cepOut.className = 'cep-out';
    if (cep.length !== 8) { cepOut.classList.add('no'); cepOut.textContent = 'Digite os 8 números do CEP.'; cepIn.focus(); return; }
    cepOut.textContent = 'Consultando seu CEP...';
    try {
      const r = await lookupCep(cep);
      if (r.notFound) { cepOut.classList.add('no'); cepOut.textContent = 'Não encontramos esse CEP. Confere os números?'; return; }
      const place = r.hood ? `${r.hood}, ${r.city}` : r.city;
      if (r.inArea === true) { cepOut.classList.add('ok'); cepOut.textContent = `Entregamos aí! ${place} fica a ${fmtKm(r.dist)} km da loja. Pedindo até as 16h, chega hoje.`; }
      else if (r.inArea === null) { cepOut.classList.add('ok'); cepOut.textContent = `Seu CEP é de ${place}. Confirmamos a distância exata quando você fechar o pedido.`; }
      else if (r.dist != null) { cepOut.classList.add('no'); cepOut.textContent = `Ainda não chegamos em ${place}: são ${fmtKm(r.dist)} km da loja, e o nosso limite é 10 km. O salão fica de portas abertas para você.`; }
      else { cepOut.classList.add('no'); cepOut.textContent = `Ainda não entregamos em ${r.city}. Nosso raio é de 10 km a partir dos Jardins.`; }
    } catch {
      cepOut.classList.add('no'); cepOut.textContent = 'Não conseguimos consultar agora. Tente de novo em instantes.';
    }
  });

  // checkout
  const cCep = $('#cCep'), cAddr = $('#cAddr'), cMsg = $('#cMsg');
  maskCep(cCep); maskPhone($('#cPhone'));
  let coArea = null, coAddr = null, cepSeq = 0;
  cCep.addEventListener('input', async () => {
    const cep = digits(cCep.value);
    coArea = null; coAddr = null; cAddr.className = 'co-addr'; cAddr.textContent = '';
    if (cep.length !== 8) return;
    const n = ++cepSeq;
    cAddr.textContent = 'Buscando endereço...';
    try {
      const r = await lookupCep(cep);
      if (n !== cepSeq) return;
      if (r.notFound) { cAddr.classList.add('no'); cAddr.textContent = 'CEP não encontrado.'; coArea = false; return; }
      coAddr = r;
      const line = [r.street, r.hood].filter(Boolean).join(', ') || r.city;
      if (r.inArea === false) { coArea = false; cAddr.classList.add('no'); cAddr.textContent = `${line}. Fora da nossa área de entrega${r.dist != null ? ` (${fmtKm(r.dist)} km)` : ''}.`; }
      else { coArea = true; cAddr.classList.add('ok'); cAddr.textContent = `${line}${r.dist != null ? ` · a ${fmtKm(r.dist)} km da loja` : ''}`; }
    } catch { if (n === cepSeq) { coArea = true; cAddr.textContent = 'Não conseguimos conferir o CEP agora. Confirmamos pelo WhatsApp.'; } }
  });
  viewCheckout.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#cName'), phone = $('#cPhone'), num = $('#cNum');
    const bad = [];
    [name, phone, cCep, num].forEach(el => el.removeAttribute('aria-invalid'));
    if (name.value.trim().length < 2) bad.push(name);
    if (digits(phone.value).length < 10) bad.push(phone);
    if (digits(cCep.value).length !== 8) bad.push(cCep);
    if (!num.value.trim()) bad.push(num);
    if (bad.length) { bad.forEach(el => el.setAttribute('aria-invalid', 'true')); cMsg.textContent = 'Confira os campos marcados.'; bad[0].focus(); return; }
    if (coArea === false) { cMsg.textContent = 'Esse endereço fica fora do nosso raio de 10 km.'; cCep.focus(); return; }
    cMsg.textContent = '';
    const early = new Date().getHours() < 16;
    const where = coAddr && coAddr.street ? `${coAddr.street}, ${num.value.trim()}` : 'seu endereço';
    $('#coSum').textContent = `${name.value.trim().split(' ')[0]}, seu café chega ${early ? 'hoje, até as 20h' : 'amanhã, até as 12h'}, em ${where}. Pagamento: ${viewCheckout.querySelector('input[name="pay"]:checked').value}.`;
    cart = []; saveCart();
    viewCheckout.reset(); cAddr.textContent = ''; coArea = null; coAddr = null;
    showView('done');
    setTimeout(() => viewDone.focus(), 60);
  });

  /* ---------------- Reservation: the real floor plan ---------------- */
  const TABLES = [
    { n: 1, x: 158, y: 245, shape: 'round', seats: 2, zone: 'junto à parede de origens' },
    { n: 2, x: 155, y: 328, shape: 'round', seats: 2, zone: 'junto à parede de origens' },
    { n: 3, x: 152, y: 417, shape: 'round', seats: 2, zone: 'junto à parede de origens' },
    { n: 4, x: 147, y: 495, shape: 'round', seats: 2, zone: 'junto à parede de origens' },
    { n: 5, x: 330, y: 283, shape: 'sq', seats: 4, zone: 'de frente para o balcão' },
    { n: 6, x: 488, y: 283, shape: 'sq', seats: 4, zone: 'de frente para o balcão' },
    { n: 7, x: 670, y: 283, shape: 'sq', seats: 4, zone: 'de frente para o balcão' },
    { n: 8, x: 828, y: 283, shape: 'sq', seats: 4, zone: 'de frente para o balcão' },
    { n: 9, x: 330, y: 418, shape: 'sq', seats: 4, zone: 'no centro do salão' },
    { n: 10, x: 461, y: 418, shape: 'sq', seats: 4, zone: 'no centro do salão' },
    { n: 11, x: 622, y: 418, shape: 'long', seats: 10, zone: 'mesa comunitária' },
    { n: 12, x: 806, y: 418, shape: 'sq', seats: 4, zone: 'no centro do salão' },
    { n: 13, x: 330, y: 557, shape: 'sq', seats: 4, zone: 'perto da entrada' },
    { n: 14, x: 486, y: 557, shape: 'sq', seats: 4, zone: 'perto da entrada' },
    { n: 15, x: 655, y: 557, shape: 'sq', seats: 4, zone: 'perto da entrada' },
    { n: 16, x: 809, y: 557, shape: 'sq', seats: 4, zone: 'perto da entrada' },
    { n: 17, x: 1025, y: 270, shape: 'round', seats: 2, zone: 'cantinho reservado' },
    { n: 18, x: 1032, y: 365, shape: 'round', seats: 2, zone: 'cantinho reservado' },
    { n: 19, x: 1028, y: 507, shape: 'round', seats: 4, zone: 'lounge com sofá' },
    { n: 20, x: 1028, y: 655, shape: 'round', seats: 4, zone: 'lounge com sofá' }
  ];
  const SIZES = { round: [84, 84], sq: [104, 108], long: [196, 104] };
  const W0 = 1165, H0 = 870;
  const pad2 = n => String(n).padStart(2, '0');
  const svgNS = 'http://www.w3.org/2000/svg';
  const planSvg = $('#planSvg'), planHit = $('#planHit'), planChip = $('#planChip');
  const rDate = $('#rDate'), rTime = $('#rTime'), rPeople = $('#rPeople'), rList = $('#rTableList');
  const rMsg = $('#rMsg'), rSubmit = $('#rSubmit');
  const mine = new Set(store.get('cdo-reservas', []));
  let selected = null;

  function shapeFor(t, cls) {
    const [w, h] = SIZES[t.shape];
    let el;
    if (t.shape === 'round') { el = document.createElementNS(svgNS, 'circle'); el.setAttribute('cx', t.x); el.setAttribute('cy', t.y); el.setAttribute('r', w / 2); }
    else { el = document.createElementNS(svgNS, 'rect'); el.setAttribute('x', t.x - w / 2); el.setAttribute('y', t.y - h / 2); el.setAttribute('width', w); el.setAttribute('height', h); el.setAttribute('rx', 18); }
    el.setAttribute('class', cls);
    return el;
  }
  TABLES.forEach(t => {
    t.shapeEl = shapeFor(t, 't');
    planSvg.appendChild(t.shapeEl);
    const [w, h] = SIZES[t.shape];
    const b = document.createElement('button');
    b.type = 'button';
    b.style.left = (t.x / W0 * 100) + '%'; b.style.top = (t.y / H0 * 100) + '%';
    b.style.width = (w / W0 * 100) + '%'; b.style.height = (h / H0 * 100) + '%';
    b.addEventListener('click', () => pickTable(t, true));
    b.addEventListener('mouseenter', () => t.shapeEl.classList.add('hover'));
    b.addEventListener('mouseleave', () => t.shapeEl.classList.remove('hover'));
    b.addEventListener('focus', () => t.shapeEl.classList.add('hover'));
    b.addEventListener('blur', () => t.shapeEl.classList.remove('hover'));
    t.btn = b;
    planHit.appendChild(b);
  });
  let ringEl = null;

  const isoDay = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function slotsFor(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const sunday = d.getDay() === 0;
    const open = sunday ? 9 : 8, lastSlot = sunday ? 18.5 : 20.5;   // last booking 1h30 before closing
    const now = new Date();
    const today = dateStr === isoDay(now);
    const out = [];
    for (let h = open; h <= lastSlot; h += 0.5) {
      if (today && h <= now.getHours() + now.getMinutes() / 60 + 0.5) continue;
      out.push(`${pad2(Math.floor(h))}:${h % 1 ? '30' : '00'}`);
    }
    return out;
  }
  function fillTimes(keep) {
    const slots = slotsFor(rDate.value);
    rTime.innerHTML = slots.length ? slots.map(s => `<option>${s}</option>`).join('') : '<option value="">Sem horários neste dia</option>';
    if (keep && slots.includes(keep)) rTime.value = keep;
    else if (slots.includes('19:00')) rTime.value = '19:00';
  }
  function initDates() {
    const now = new Date();
    let d = new Date(now);
    if (!slotsFor(isoDay(d)).length) d.setDate(d.getDate() + 1);
    const max = new Date(now); max.setDate(max.getDate() + 60);
    rDate.min = isoDay(now); rDate.max = isoDay(max); rDate.value = isoDay(d);
    fillTimes();
  }
  const slotKey = () => `${rDate.value} ${rTime.value}`;
  function tableState(t) {
    const people = +rPeople.value;
    const r = rng(hash(slotKey() + '#' + t.n));
    const busy = mine.has(slotKey() + '#' + t.n) || r() < 0.3;
    return busy ? 'busy' : (t.seats < people ? 'small' : 'free');
  }
  function describe(t) { return `Mesa ${pad2(t.n)} · ${t.seats} lugares · ${t.zone}`; }
  function refreshTables() {
    const people = +rPeople.value;
    if (!rTime.value) { TABLES.forEach(t => { t.state = 'busy'; }); }
    else TABLES.forEach(t => { t.state = tableState(t); });
    TABLES.forEach(t => {
      t.shapeEl.classList.toggle('busy', t.state === 'busy');
      t.shapeEl.classList.toggle('small', t.state === 'small');
      t.shapeEl.classList.toggle('sel', selected === t);
      t.btn.disabled = t.state !== 'free';
      t.btn.setAttribute('aria-pressed', String(selected === t));
      t.btn.setAttribute('aria-label', `Mesa ${t.n}, ${t.seats} lugares, ${t.zone}, ${t.state === 'free' ? (selected === t ? 'escolhida' : 'livre') : t.state === 'busy' ? 'reservada neste horário' : `pequena para ${people} pessoas`}`);
    });
    rList.innerHTML = '<option value="">Escolha uma mesa</option>' + TABLES.map(t => `<option value="${t.n}" ${t.state !== 'free' ? 'disabled' : ''} ${selected === t ? 'selected' : ''}>${describe(t)}${t.state === 'busy' ? ' (reservada)' : t.state === 'small' ? ' (pequena)' : ''}</option>`).join('');
    if (selected && selected.state !== 'free') {
      const lost = selected;
      pickTable(null);
      rMsg.className = 'f-msg';
      rMsg.textContent = lost.state === 'busy' ? `A mesa ${pad2(lost.n)} já está reservada nesse horário. Escolha outra.` : `A mesa ${pad2(lost.n)} é pequena para ${people} pessoas. Escolha outra.`;
    }
  }
  function pickTable(t, fromMap) {
    if (t && t.state !== 'free') return;
    selected = t;
    if (ringEl) { ringEl.remove(); ringEl = null; }
    if (t) {
      ringEl = shapeFor(t, 'sel-ring');
      ringEl.setAttribute('pathLength', '1');
      if (t.shape === 'round') ringEl.setAttribute('r', SIZES.round[0] / 2 + 7);
      else { const [w, h] = SIZES[t.shape]; ringEl.setAttribute('x', t.x - w / 2 - 7); ringEl.setAttribute('y', t.y - h / 2 - 7); ringEl.setAttribute('width', w + 14); ringEl.setAttribute('height', h + 14); ringEl.setAttribute('rx', 24); }
      planSvg.appendChild(ringEl);
      requestAnimationFrame(() => ringEl && ringEl.classList.add('draw'));
      planChip.textContent = describe(t);
      rSubmit.textContent = `Reservar a mesa ${pad2(t.n)}`;
      rMsg.textContent = '';
    } else {
      planChip.textContent = 'Nenhuma mesa escolhida ainda.';
      rSubmit.textContent = 'Reservar mesa';
    }
    TABLES.forEach(x => {
      x.shapeEl.classList.toggle('sel', selected === x);
      x.btn.setAttribute('aria-pressed', String(selected === x));
    });
    rList.value = t ? String(t.n) : '';
    if (fromMap && t && matchMedia('(max-width: 980px)').matches) {
      // on small screens, bring the form into view after picking
      setTimeout(() => $('#resPanel').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' }), 350);
    }
  }
  rList.addEventListener('change', () => { const t = TABLES.find(x => String(x.n) === rList.value); pickTable(t || null); });
  rDate.addEventListener('change', () => { fillTimes(rTime.value); refreshTables(); });
  rTime.addEventListener('change', refreshTables);
  rPeople.addEventListener('change', refreshTables);
  maskPhone($('#rPhone'));
  initDates();
  refreshTables();

  const resForm = $('#resForm'), resDone = $('#resDone');
  resForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#rName'), phone = $('#rPhone');
    [name, phone].forEach(el => el.removeAttribute('aria-invalid'));
    rMsg.className = 'f-msg';
    if (!rTime.value) { rMsg.textContent = 'Escolha um dia com horários livres.'; rDate.focus(); return; }
    if (!selected) { rMsg.textContent = 'Escolha uma mesa na planta para continuar.'; return; }
    const bad = [];
    if (name.value.trim().length < 2) bad.push(name);
    if (digits(phone.value).length < 10) bad.push(phone);
    if (bad.length) { bad.forEach(el => el.setAttribute('aria-invalid', 'true')); rMsg.textContent = 'Confira seu nome e WhatsApp.'; bad[0].focus(); return; }
    const d = new Date(rDate.value + 'T12:00:00');
    let when = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
    when = when.charAt(0).toUpperCase() + when.slice(1);
    const people = +rPeople.value;
    $('#doneTitle').textContent = `Mesa ${pad2(selected.n)} reservada.`;
    $('#doneSum').textContent = `${when}, às ${rTime.value.replace(':', 'h')} · ${people} ${people > 1 ? 'pessoas' : 'pessoa'}, em nome de ${name.value.trim().split(' ')[0]}.`;
    mine.add(slotKey() + '#' + selected.n);
    store.set('cdo-reservas', [...mine]);
    resForm.hidden = true;
    resDone.hidden = false;
    resDone.classList.add('show');
    resDone.focus();
  });
  $('#resAgain').addEventListener('click', () => {
    resDone.hidden = true; resDone.classList.remove('show');
    resForm.hidden = false;
    pickTable(null);
    refreshTables();
    $('#rName').value = ''; $('#rPhone').value = '';
    rDate.focus();
  });

  /* ---------------- Boot ---------------- */
  renderCart();
  showView('cart');
  applyHeroMode();
  onNavScroll();
  if (RM.matches) pinToFinalStates();
})();
