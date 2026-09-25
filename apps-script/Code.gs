/**
 * Caffè D'oro · e-mail sender (Google Apps Script, runs on the owner's Gmail).
 *
 * How it stays safe without any password or key:
 *  - the site's server calls this web app with only a random job id;
 *  - this script asks the server for that job's data (valid once, for 30 minutes);
 *  - so a stranger who finds this URL can only make it look up ids that do not exist.
 * Setup: paste into script.google.com > Deploy > New deployment > Web app,
 * "Execute as: Me", "Who has access: Anyone". Send the /exec URL to the developer.
 */
const API = 'https://caffedoro-shinnare.vercel.app/api';
const SITE = 'https://caffedoro-shinnare.vercel.app';
const DAILY_LIMIT = 80;                       // Gmail allows 100 per day on personal accounts
const CAL_NAME = 'Caffè D’oro · Reservas';
const ADDRESS = 'Alameda dos Cafezais, 180 · Jardins, São Paulo';

function doGet() {
  return json({ ok: true, service: 'caffe-doro-mail' });
}

function doPost(e) {
  let id = '';
  try { id = String(JSON.parse((e && e.postData && e.postData.contents) || '{}').job || ''); } catch (err) { return json({ ok: false }); }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return json({ ok: false });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json({ ok: false, busy: true });
  let ok = false;
  try {
    if (!underDailyLimit()) return json({ ok: false, limit: true });
    const res = UrlFetchApp.fetch(API + '/mail-job/' + id, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return json({ ok: false });
    const job = JSON.parse(res.getContentText());
    if (!/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(job.to || '')) return json({ ok: false });
    if (job.kind === 'reservation') sendReservation(job);
    else if (job.kind === 'club') sendClub(job);
    ok = true;
  } catch (err) {
    console.error('mail job failed', String(err && err.message || err).slice(0, 120));
  } finally {
    try { UrlFetchApp.fetch(API + '/mail-job/' + id + '/done', { method: 'post', contentType: 'application/json', payload: JSON.stringify({ ok: ok }), muteHttpExceptions: true }); } catch (err) { /* the server times it out anyway */ }
    lock.releaseLock();
  }
  return json({ ok: ok });
}

/* ---------------- messages ---------------- */
function sendReservation(j) {
  const en = j.lang === 'en';
  const start = new Date(j.day + 'T' + j.slot + ':00-03:00');         // São Paulo, no daylight saving
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const when = Utilities.formatDate(start, 'America/Sao_Paulo', en ? "EEEE, MMMM d 'at' h:mm a" : "EEEE, d 'de' MMMM 'às' HH'h'mm");
  const table = ('0' + j.table).slice(-2);
  const people = j.people + (en ? (j.people > 1 ? ' guests' : ' guest') : (j.people > 1 ? ' pessoas' : ' pessoa'));
  const first = String(j.name || '').split(' ')[0];
  const subject = en ? `Table ${table} is booked · Caffè D’oro (${j.code})` : `Mesa ${table} reservada · Caffè D’oro (${j.code})`;
  const rows = [
    [en ? 'Code' : 'Código', j.code], [en ? 'When' : 'Quando', cap(when)], [en ? 'Table' : 'Mesa', table],
    [en ? 'Guests' : 'Pessoas', people], [en ? 'Where' : 'Onde', ADDRESS],
  ];
  const body = frame(
    en ? `Your table is ready, ${esc(first)}.` : `Sua mesa está pronta, ${esc(first)}.`,
    (en ? 'We are holding the table below for you. It stays yours for 15 minutes after the time.' : 'Guardamos a mesa abaixo para você. Ela fica reservada por 15 minutos depois do horário.'),
    table_(rows),
    en ? 'A calendar invite is on its way too.' : 'O convite para a sua agenda também está a caminho.',
    en);
  GmailApp.sendEmail(j.to, subject, plain(rows), { htmlBody: body, name: 'Caffè D’oro' });
  try {
    const cal = CalendarApp.getCalendarsByName(CAL_NAME)[0] || CalendarApp.createCalendar(CAL_NAME, { color: CalendarApp.Color.YELLOW });
    cal.createEvent(en ? `Caffè D’oro · Table ${table}` : `Caffè D’oro · Mesa ${table}`, start, end, {
      location: ADDRESS, guests: j.to, sendInvites: true,
      description: (en ? 'Booking ' : 'Reserva ') + j.code + ' · ' + people + '\n' + SITE,
    });
  } catch (err) { console.error('calendar failed', String(err && err.message || err).slice(0, 120)); }
  count();
}

function sendClub(j) {
  const en = j.lang === 'en';
  const subject = en ? 'Welcome to Club D’oro · your code BEMVINDO' : 'Bem-vindo ao Clube D’oro · seu cupom BEMVINDO';
  const rows = [[en ? 'Code' : 'Cupom', 'BEMVINDO'], [en ? 'Perk' : 'Vantagem', en ? '10% off your first order' : '10% no primeiro pedido']];
  const body = frame(
    en ? 'Welcome to the club.' : 'Bem-vindo ao clube.',
    en ? 'One card, three perks: 10% on your first order, 1 free coffee every 10 at the house and free delivery for subscribers.' : 'Um cartão, três vantagens: 10% no primeiro pedido, 1 café grátis a cada 10 no salão e frete grátis para quem assina.',
    table_(rows), '', en);
  GmailApp.sendEmail(j.to, subject, plain(rows), { htmlBody: body, name: 'Caffè D’oro' });
  count();
}

/* ---------------- look ---------------- */
function frame(title, intro, content, outro, en) {
  return `<!doctype html><html><body style="margin:0;background:#130c08;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#f2e7d5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#21160f;border:1px solid #5a4222;border-radius:20px">
    <tr><td align="center" style="padding:30px 28px 6px"><img src="${SITE}/assets/email/logo.png" width="190" alt="Caffè D’oro" style="display:block;width:190px;max-width:70%;height:auto"></td></tr>
    <tr><td style="padding:14px 32px 0;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#fbf3e6;text-align:center">${title}</td></tr>
    <tr><td style="padding:12px 32px 4px;font-size:15px;line-height:1.6;color:#c9b69a;text-align:center">${intro}</td></tr>
    <tr><td style="padding:18px 28px">${content}</td></tr>
    ${outro ? `<tr><td style="padding:0 32px 10px;font-size:14px;color:#c9b69a;text-align:center">${outro}</td></tr>` : ''}
    <tr><td align="center" style="padding:10px 28px 28px"><a href="${SITE}" style="display:inline-block;background:#d9a74a;color:#1c1109;text-decoration:none;font-weight:bold;letter-spacing:2px;font-size:12px;padding:14px 26px;border-radius:999px">${en ? 'VISIT THE SITE' : 'VISITAR O SITE'}</a></td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #3a2a18;font-size:11px;line-height:1.5;color:#8f7d68;text-align:center">${en
      ? 'Caffè D’oro is a fictional brand, a SHINNARE portfolio project. Nothing is charged.'
      : 'Caffè D’oro é uma marca fictícia, projeto de portfólio da SHINNARE. Nada é cobrado.'}</td></tr>
  </table></td></tr></table></body></html>`;
}
function table_(rows) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #3a2a18;border-radius:14px">' +
    rows.map(r => `<tr><td style="padding:10px 16px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a39079;border-bottom:1px solid #2e2016">${esc(r[0])}</td><td style="padding:10px 16px;font-size:15px;color:#f2e7d5;text-align:right;border-bottom:1px solid #2e2016">${esc(r[1])}</td></tr>`).join('') +
    '</table>';
}
function plain(rows) { return rows.map(r => r[0] + ': ' + r[1]).join('\n') + '\n\n' + SITE; }

/* ---------------- helpers ---------------- */
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function dayKey() { return 'sent-' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd'); }
function underDailyLimit() { return Number(CacheService.getScriptCache().get(dayKey()) || 0) < DAILY_LIMIT; }
function count() { const c = CacheService.getScriptCache(), k = dayKey(); c.put(k, String(Number(c.get(k) || 0) + 1), 21600); }

/** Run this once from the editor (select "authorize" and press Run) to grant Gmail and Calendar access. */
function authorize() {
  GmailApp.getAliases();
  CalendarApp.getDefaultCalendar();
  UrlFetchApp.fetch(API + '/health');
}
