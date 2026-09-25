// Caffè D'oro API · Supabase Edge Function (Deno).
// The site reaches it as /api/* through a Vercel rewrite, so the browser only ever talks to its own origin.
// Rules: validate every field, recompute every price on the server, never trust the client,
// keep personal data out of logs, and rate-limit anything that writes.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SITE = 'https://caffedoro-shinnare.vercel.app';
const ORIGINS = new Set([SITE, 'http://localhost:8080', 'http://127.0.0.1:8080']);
const STORE = { lat: -23.5646, lon: -46.6647 };
// the three SHINNARE partners get a WhatsApp alert for every reservation, order and Pix.
// Each person's CallMeBot key lives in the function secrets (WA_KEY_*), never in code.
const TEAM = [
  { name: 'Gustavo', phone: '5511933914350', secret: 'WA_KEY_GUSTAVO' },
  { name: 'Guilherme', phone: '5511968326459', secret: 'WA_KEY_GUILHERME' },
  { name: 'Kevin', phone: '5511934361722', secret: 'WA_KEY_KEVIN' },
];

/* ---------------- catalog (the only source of prices) ---------------- */
const COFFEE: Record<string, { name: string; price: Record<string, number> }> = {
  arabica: { name: 'Arábica', price: { graos: 74, po: 62, caps: 63 } },
  bourbon: { name: 'Bourbon', price: { graos: 76, po: 64, caps: 65 } },
  caturra: { name: 'Caturra', price: { graos: 74, po: 62, caps: 63 } },
  excelsa: { name: 'Excelsa', price: { graos: 78, po: 66, caps: 67 } },
  geisha: { name: 'Geisha', price: { graos: 80, po: 68, caps: 69 } },
  liberica: { name: 'Liberica', price: { graos: 78, po: 66, caps: 67 } },
  maragogipe: { name: 'Maragogipe', price: { graos: 79, po: 66, caps: 67 } },
  robusta: { name: 'Robusta', price: { graos: 72, po: 60, caps: 61 } },
  typica: { name: 'Typica', price: { graos: 76, po: 64, caps: 65 } },
};
const PIECES: Record<string, { name: string; price: number }> = {
  'xicara-preta': { name: 'Xícara Noite', price: 68 }, 'xicara-branca': { name: 'Xícara Jardim', price: 72 },
  'xicara-folhas': { name: 'Xícara Folhagem', price: 76 }, 'xicara-colmeia': { name: 'Xícara Colmeia', price: 79 },
  'caneca-preta': { name: 'Caneca Essencial', price: 64 }, 'caneca-classica': { name: 'Caneca Clássica', price: 74 },
  'caneca-folhas': { name: 'Caneca Folhas de Ouro', price: 78 }, 'caneca-marmore': { name: 'Caneca Mármore', price: 80 },
};
const FMT_LABEL: Record<string, string> = { graos: 'em grãos 250 g', po: 'moído 250 g', caps: 'cápsulas 10 un' };
const GRINDS = new Set(['whole', 'espresso', 'filter', 'press']);
const SEATS = [0, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 10, 4, 4, 4, 4, 4, 2, 2, 4, 4];

/* ---------------- small helpers ---------------- */
class HttpError extends Error { constructor(public status: number, public code: string) { super(code); } }
const bad = (code: string) => new HttpError(400, code);
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const clean = (v: unknown, min: number, max: number, field: string) => {
  // collapse whitespace and drop control characters; reject anything outside the length window
  const s = String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length < min || s.length > max) throw bad('invalid_' + field);
  return s;
};
const email = (v: unknown) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.length > 120 || !/^[^\s@<>()[\]\\,;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(s)) throw bad('invalid_email');
  return s;
};
const lang = (v: unknown) => (v === 'en' ? 'en' : 'pt');
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randCode = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => ALPHA[b % ALPHA.length]).join('');
const b64url = (buf: Uint8Array) => btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const money = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');
const later = (p: Promise<unknown>) => { try { (globalThis as any).EdgeRuntime?.waitUntil(p.catch(() => {})); } catch { /* fine */ } };

// São Paulo has no daylight saving time since 2019: UTC-3 all year
const spNow = () => new Date(Date.now() - 3 * 3600e3);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// the same seeded "already booked" pattern the page draws, so the demo always feels busy
const rng = (seed: number) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const hash = (str: string) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const demoBusy = (day: string, slot: string, n: number) => rng(hash(`${day} ${slot}#${n}`))() < 0.3;

function slotsFor(day: string) {
  const d = new Date(day + 'T12:00:00Z'), sunday = d.getUTCDay() === 0;
  const open = sunday ? 9 : 8, last = sunday ? 18.5 : 20.5, now = spNow(), today = day === isoDay(now), out: string[] = [];
  for (let h = open; h <= last; h += 0.5) {
    if (today && h <= now.getUTCHours() + now.getUTCMinutes() / 60 + 0.5) continue;
    out.push(`${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`);
  }
  return out;
}
function checkDay(v: unknown) {
  const day = String(v ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(Date.parse(day + 'T12:00:00Z'))) throw bad('invalid_day');
  const diff = (Date.parse(day + 'T12:00:00Z') - Date.parse(isoDay(spNow()) + 'T12:00:00Z')) / 864e5;
  if (diff < 0 || diff > 60) throw bad('invalid_day');
  return day;
}

async function config(key: string) {
  const { data } = await db.from('app_config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
async function ipHash(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0').split(',')[0].trim();
  const salt = (await config('ip_salt')) || 'caffedoro';
  return (await sha256(`${salt}|${isoDay(new Date())}|${ip}`)).slice(0, 32);   // rotates daily, never stored raw
}
// true when this subject already did `max` actions in the window; otherwise records one more
async function limited(bucket: string, subject: string, max: number, seconds: number) {
  const since = new Date(Date.now() - seconds * 1000).toISOString();
  const { count } = await db.from('rate_events').select('id', { count: 'exact', head: true })
    .eq('bucket', bucket).eq('subject', subject).gte('created_at', since);
  if ((count ?? 0) >= max) return true;
  await db.from('rate_events').insert({ bucket, subject });
  return false;
}
async function guard(req: Request, bucket: string, perIp: [number, number], global: [number, number]) {
  const ip = await ipHash(req);
  if (await limited(bucket, 'ip:' + ip, ...perIp)) throw new HttpError(429, 'too_many_requests');
  if (await limited(bucket, 'all', ...global)) throw new HttpError(429, 'busy');
  return ip;
}

/* ---------------- outbound: WhatsApp alerts and the Gmail sender ---------------- */
function notifyTeam(text: string) {
  const jobs = TEAM.map(async m => {
    const key = Deno.env.get(m.secret);
    if (!key) return;
    const url = `https://api.callmebot.com/whatsapp.php?phone=${m.phone}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(key)}`;
    await fetch(url, { signal: AbortSignal.timeout(8000) });
  });
  later(Promise.allSettled(jobs));
}
async function queueMail(kind: 'reservation' | 'club', ref: string) {
  const { data, error } = await db.from('mail_jobs').insert({ kind, ref }).select('id').single();
  if (error || !data) return false;
  const hook = await config('mail_webhook');           // the Google Apps Script web app (sends from Gmail)
  if (!hook || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(hook)) return false;
  later(fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job: data.id }), signal: AbortSignal.timeout(15000) }));
  return true;
}

/* ---------------- CEP lookup (server side, so the page never calls third parties) ---------------- */
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, rad = (x: number) => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const UA = { 'user-agent': 'CaffeDoro/1.0 (+https://caffedoro-shinnare.vercel.app)', accept: 'application/json' };
const cepCache = new Map<string, { at: number; v: Record<string, unknown> }>();
async function lookupCep(cep: string): Promise<Record<string, unknown>> {
  const hit = cepCache.get(cep);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.v;
  const pick = (v: unknown) => String(v ?? '').replace(/[<>]/g, '').slice(0, 90);
  const withDist = (out: Record<string, unknown>, lat: number, lon: number) => {
    if (Number.isFinite(lat) && Number.isFinite(lon)) { out.lat = lat; out.lon = lon; out.dist = Math.round(km(STORE, { lat, lon }) * 10) / 10; }
    return out;
  };
  let out: Record<string, unknown>;
  try {                                                  // street-level coordinates
    const r = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`, { headers: UA, signal: AbortSignal.timeout(6000) });
    if (r.status === 404 || r.status === 400) return { notFound: true };
    if (!r.ok) throw new Error('upstream');
    const j = await r.json();
    out = withDist({ street: pick(j.address), hood: pick(j.district), city: pick(j.city), state: pick(j.state) }, parseFloat(j.lat), parseFloat(j.lng));
  } catch {                                              // backup: address only. Without a precise position the
    // server never refuses a São Paulo address; it only refuses other cities (see inArea)
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, { headers: UA, signal: AbortSignal.timeout(6000) });
    if (r.status === 404 || r.status === 400) return { notFound: true };
    if (!r.ok) throw new HttpError(502, 'cep_unavailable');
    const j = await r.json();
    out = { street: pick(j.street), hood: pick(j.neighborhood), city: pick(j.city), state: pick(j.state) };
  }
  if (cepCache.size > 500) cepCache.clear();
  cepCache.set(cep, { at: Date.now(), v: out });
  return out;
}
const inArea = (r: Record<string, unknown>) => (typeof r.dist === 'number' ? r.dist <= 10 : (r.city === 'São Paulo' ? null : false));

/* ---------------- routes ---------------- */
async function availability(url: URL) {
  const day = checkDay(url.searchParams.get('day'));
  const slot = String(url.searchParams.get('slot') ?? '');
  if (!/^\d{2}:\d{2}$/.test(slot)) throw bad('invalid_slot');
  const { data } = await db.from('reservations').select('table_no').eq('day', day).eq('slot', slot);
  const busy = new Set((data ?? []).map(r => r.table_no));
  for (let n = 1; n <= 20; n++) if (demoBusy(day, slot, n)) busy.add(n);
  return { day, slot, busy: [...busy].sort((a, b) => a - b), open: slotsFor(day).includes(slot) };
}

async function reserve(req: Request, body: any) {
  if (body.website) throw bad('rejected');                       // honeypot field, invisible to people
  const day = checkDay(body.day);
  const slot = String(body.slot ?? '');
  if (!slotsFor(day).includes(slot)) throw bad('invalid_slot');
  const table = Number(body.table), people = Number(body.people);
  if (!Number.isInteger(table) || table < 1 || table > 20) throw bad('invalid_table');
  if (!Number.isInteger(people) || people < 1 || people > 10 || SEATS[table] < people) throw bad('invalid_people');
  const name = clean(body.name, 2, 60, 'name');
  const phone = digits(body.phone); if (phone.length < 10 || phone.length > 11) throw bad('invalid_phone');
  const mail = email(body.email);
  const lg = lang(body.lang);
  if (demoBusy(day, slot, table)) throw new HttpError(409, 'table_taken');
  const ip = await guard(req, 'reserve', [8, 600], [60, 3600]);
  if (await limited('reserve', 'phone:' + (await sha256(phone)).slice(0, 24), 3, 86400)) throw new HttpError(429, 'too_many_requests');

  let row: any = null;
  for (let i = 0; i < 4 && !row; i++) {
    const { data, error } = await db.from('reservations')
      .insert({ code: 'R-' + randCode(5), day, slot, table_no: table, people, name, phone, email: mail, lang: lg, ip_hash: ip })
      .select('id, code').single();
    if (!error) row = data;
    else if (error.code === '23505' && /day_slot_table/.test(error.message + error.details)) throw new HttpError(409, 'table_taken');
    else if (error.code !== '23505') throw new HttpError(500, 'db_error');
  }
  if (!row) throw new HttpError(500, 'db_error');
  const mailed = await queueMail('reservation', row.id);
  const [, m, d] = day.split('-');
  notifyTeam(`☕ Caffè D'oro · nova reserva ${row.code}\nMesa ${table} · ${d}/${m} às ${slot.replace(':', 'h')} · ${people} pessoa(s)\n${name.split(' ')[0]} · WhatsApp final ${phone.slice(-4)}`);
  return { code: row.code, mail: mailed };
}

function priceItems(raw: unknown) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 30) throw bad('invalid_items');
  const items: any[] = [];
  let sub = 0, hasSub = false;
  for (const it of raw) {
    const qty = Number(it?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw bad('invalid_items');
    if (it?.kind === 'coffee') {
      const c = COFFEE[it.id]; const fmt = String(it.fmt);
      if (!c || !(fmt in c.price)) throw bad('invalid_items');
      const grind = fmt === 'graos' && GRINDS.has(it.grind) ? it.grind : 'whole';
      const buy = it.buy === 'sub' ? 'sub' : 'once';
      if (buy === 'sub') hasSub = true;
      items.push({ kind: 'coffee', id: it.id, fmt, grind, buy, qty, unit: c.price[fmt], label: `Café ${c.name} ${FMT_LABEL[fmt]}${buy === 'sub' ? ' (assinatura)' : ''}` });
      sub += c.price[fmt] * qty;
    } else if (it?.kind === 'piece') {
      const p = PIECES[it.id]; if (!p) throw bad('invalid_items');
      items.push({ kind: 'piece', id: it.id, qty, unit: p.price, label: p.name });
      sub += p.price * qty;
    } else throw bad('invalid_items');
  }
  return { items, sub, hasSub };
}

async function order(req: Request, body: any) {
  if (body.website) throw bad('rejected');
  const { items, sub, hasSub } = priceItems(body.items);
  const disc = String(body.coupon ?? '').trim().toUpperCase() === 'BEMVINDO' ? Math.round(sub * 10) / 100 : 0;
  const ship = sub - disc >= 150 || hasSub ? 0 : 12;
  const total = Math.round((sub - disc + ship) * 100) / 100;
  const name = clean(body.name, 2, 60, 'name');
  const phone = digits(body.phone); if (phone.length < 10 || phone.length > 11) throw bad('invalid_phone');
  const cep = digits(body.cep); if (cep.length !== 8) throw bad('invalid_cep');
  const number = clean(body.number, 1, 10, 'number');
  const complement = clean(body.complement ?? '', 0, 60, 'complement');
  const win = String(body.window ?? '');
  const early = spNow().getUTCHours() < 16;
  if (!['tmAm', 'tmPm'].concat(early ? ['today'] : []).includes(win)) throw bad('invalid_window');
  const pay = body.pay === 'card' ? 'card' : body.pay === 'pix' ? 'pix' : null;
  if (!pay) throw bad('invalid_pay');
  const ip = await guard(req, 'order', [10, 600], [80, 3600]);

  let addr: Record<string, unknown> = {};
  try { addr = await lookupCep(cep); } catch { /* the address check is a convenience, not a gate */ }
  if (addr.notFound) throw bad('invalid_cep');
  if (addr.city && inArea(addr) === false) throw new HttpError(422, 'outside_area');

  const token = pay === 'pix' ? b64url(crypto.getRandomValues(new Uint8Array(32))) : null;
  const expires = pay === 'pix' ? new Date(Date.now() + 15 * 60e3).toISOString() : null;
  let row: any = null;
  for (let i = 0; i < 4 && !row; i++) {
    const { data, error } = await db.from('orders').insert({
      code: 'CD-' + randCode(5), items, subtotal: sub, discount: disc, shipping: ship, total, pay_method: pay,
      status: pay === 'pix' ? 'awaiting_payment' : 'confirmed', name, phone, cep,
      address: { street: addr.street ?? '', hood: addr.hood ?? '', city: addr.city ?? '', number, complement },
      delivery_window: win, lang: lang(body.lang), pix_token_hash: token ? await sha256(token) : null, pix_expires_at: expires, ip_hash: ip,
    }).select('id, code').single();
    if (!error) row = data; else if (error.code !== '23505') throw new HttpError(500, 'db_error');
  }
  if (!row) throw new HttpError(500, 'db_error');
  const lines = items.map(i => `${i.qty}× ${i.label}`).join('\n');
  notifyTeam(`🛍️ Caffè D'oro · pedido ${row.code} · ${money(total)} (${pay === 'pix' ? 'Pix, aguardando' : 'cartão na entrega'})\n${lines}\n${name.split(' ')[0]} · ${addr.hood || 'CEP ' + cep}`);
  return { id: row.id, code: row.code, total, subtotal: sub, discount: disc, shipping: ship, status: pay === 'pix' ? 'awaiting_payment' : 'confirmed', pix: token ? { token, expiresAt: expires } : null };
}

async function pixStatus(id: string) {
  const { data } = await db.from('orders').select('status, paid_at, pix_expires_at').eq('id', id).eq('pay_method', 'pix').maybeSingle();
  if (!data) throw new HttpError(404, 'not_found');
  const expired = data.status === 'awaiting_payment' && Date.parse(data.pix_expires_at) < Date.now();
  return { status: expired ? 'expired' : data.status, paidAt: data.paid_at, expiresAt: data.pix_expires_at };
}
async function pixCheckToken(id: string, body: any) {
  const token = String(body.token ?? '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(403, 'forbidden');
  return await sha256(token);
}
async function pixView(req: Request, id: string, body: any) {
  await guard(req, 'pixview', [30, 600], [600, 3600]);
  const th = await pixCheckToken(id, body);
  const { data } = await db.from('orders').select('code, total, status, items, pix_expires_at, pix_token_hash, paid_at').eq('id', id).maybeSingle();
  if (!data || data.pix_token_hash !== th) throw new HttpError(403, 'forbidden');
  const expired = data.status === 'awaiting_payment' && Date.parse(data.pix_expires_at) < Date.now();
  return { code: data.code, total: Number(data.total), status: expired ? 'expired' : data.status, expiresAt: data.pix_expires_at, paidAt: data.paid_at, count: (data.items as any[]).reduce((s, i) => s + i.qty, 0) };
}
async function pixConfirm(req: Request, id: string, body: any) {
  await guard(req, 'pixconfirm', [20, 600], [300, 3600]);
  const th = await pixCheckToken(id, body);
  const { data, error } = await db.rpc('confirm_pix', { p_order: id, p_token_hash: th });
  if (error) throw new HttpError(500, 'db_error');
  if (data && data.length) {
    notifyTeam(`✅ Caffè D'oro · Pix confirmado no pedido ${data[0].code} · ${money(Number(data[0].total))}`);
    return { status: 'paid', paidAt: data[0].paid_at };
  }
  const v = await pixView(req, id, body);                     // wrong state: explain which one
  if (v.status === 'paid') return { status: 'paid', paidAt: v.paidAt };
  throw new HttpError(v.status === 'expired' ? 410 : 409, v.status);
}

async function club(req: Request, body: any) {
  if (body.website) throw bad('rejected');
  const mail = email(body.email);
  await guard(req, 'club', [5, 600], [100, 3600]);
  const { error } = await db.from('club_members').insert({ email: mail, lang: lang(body.lang) });
  if (error && error.code !== '23505') throw new HttpError(500, 'db_error');
  const fresh = !error;
  if (fresh) await queueMail('club', mail);
  return { ok: true, fresh };
}

// called by the Google Apps Script that sends from Gmail: it proves nothing by itself,
// it only receives the data of a job that the server created seconds earlier and that was never claimed
async function mailJob(id: string) {
  const { data } = await db.rpc('claim_mail_job', { p_id: id });
  if (!data || !data.length) throw new HttpError(404, 'not_found');
  const { kind, ref } = data[0];
  if (kind === 'club') {
    const { data: m } = await db.from('club_members').select('email, lang').eq('email', ref).maybeSingle();
    if (!m) throw new HttpError(404, 'not_found');
    return { kind, to: m.email, lang: m.lang, site: SITE };
  }
  const { data: r } = await db.from('reservations').select('code, day, slot, table_no, people, name, email, lang').eq('id', ref).maybeSingle();
  if (!r) throw new HttpError(404, 'not_found');
  return { kind, to: r.email, lang: r.lang, site: SITE, code: r.code, day: r.day, slot: String(r.slot).slice(0, 5), table: r.table_no, people: r.people, name: r.name };
}
async function mailDone(id: string, body: any) {
  await db.from('mail_jobs').update({ status: body.ok ? 'sent' : 'failed', done_at: new Date().toISOString() }).eq('id', id).eq('status', 'claimed');
  return { ok: true };
}

/* ---------------- HTTP plumbing ---------------- */
function headers(origin: string | null) {
  const h: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cross-origin-resource-policy': 'same-origin',
    vary: 'Origin',
  };
  if (origin && ORIGINS.has(origin)) {
    h['access-control-allow-origin'] = origin;
    h['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    h['access-control-allow-headers'] = 'content-type';
    h['access-control-max-age'] = '600';
  }
  return h;
}
const json = (data: unknown, status: number, origin: string | null) => new Response(JSON.stringify(data), { status, headers: headers(origin) });

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  // browsers always send Origin on cross-site writes: refuse any site that is not ours (CSRF, embedding)
  if (origin && !ORIGINS.has(origin)) return json({ error: 'forbidden_origin' }, 403, null);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/(functions\/v1\/)?api/, '') || '/';
    let body: any = {};
    if (req.method === 'POST') {
      if (!(req.headers.get('content-type') || '').startsWith('application/json')) throw new HttpError(415, 'json_only');
      const text = await req.text();
      if (text.length > 16384) throw new HttpError(413, 'too_large');
      try { body = JSON.parse(text || '{}'); } catch { throw bad('invalid_json'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('invalid_json');
    } else if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');

    const G = req.method === 'GET', P = req.method === 'POST';
    let m: RegExpMatchArray | null;
    if (G && path === '/health') return json({ ok: true }, 200, origin);
    if (G && path === '/availability') return json(await availability(url), 200, origin);
    if (G && (m = path.match(/^\/cep\/(\d{8})$/))) {
      await guard(req, 'cep', [40, 600], [2000, 3600]);
      const r = await lookupCep(m[1]);
      return json({ ...r, inArea: r.notFound ? false : inArea(r) }, 200, origin);
    }
    if (P && path === '/reservations') return json(await reserve(req, body), 201, origin);
    if (P && path === '/orders') return json(await order(req, body), 201, origin);
    if (P && path === '/club') return json(await club(req, body), 200, origin);
    if ((m = path.match(/^\/pix\/([0-9a-f-]{36})(\/view|\/confirm)?$/)) && UUID.test(m[1])) {
      if (G && !m[2]) return json(await pixStatus(m[1]), 200, origin);
      if (P && m[2] === '/view') return json(await pixView(req, m[1], body), 200, origin);
      if (P && m[2] === '/confirm') return json(await pixConfirm(req, m[1], body), 200, origin);
    }
    if ((m = path.match(/^\/mail-job\/([0-9a-f-]{36})(\/done)?$/)) && UUID.test(m[1]) && !origin) {
      if (G && !m[2]) return json(await mailJob(m[1]), 200, origin);
      if (P && m[2]) return json(await mailDone(m[1], body), 200, origin);
    }
    return json({ error: 'not_found' }, 404, origin);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status, origin);
    console.error('unexpected', (e as Error)?.name);                 // no request data in logs
    return json({ error: 'server_error' }, 500, origin);
  }
});
