/* Caffè D'oro · Pix confirmation page.
   The link carries the order id and a one-time token in the #fragment, which browsers never send
   to servers or in Referer headers. The token goes to our API only in a POST body. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const T = {
    pt: {
      kick: 'Pix de demonstração', loading: 'Carregando o pagamento...', amount: 'Valor', expires: 'Expira em', confirm: 'Confirmar pagamento',
      confirming: 'Confirmando...', note: 'Nada é cobrado. Ao confirmar, a tela do pedido atualiza sozinha.',
      paidT: 'Pagamento confirmado!', paidP: 'Pode voltar para a tela do pedido: ela já mostra que foi pago.',
      foot: 'Conexão segura · Um projeto SHINNARE', order: 'Pedido {c}', items: '{n} itens', item: '1 item',
      badT: 'Link inválido', badP: 'Este link de pagamento não é válido. Gere um novo Pix na tela do pedido.',
      expT: 'Este Pix expirou', expP: 'Os códigos valem 15 minutos. Gere um novo Pix na tela do pedido.',
      netT: 'Sem conexão', netP: 'Não conseguimos falar com o servidor. Confira a internet e tente de novo.',
      manyT: 'Muitas tentativas', manyP: 'Espere alguns minutos e tente de novo.',
    },
    en: {
      kick: 'Demo Pix', loading: 'Loading the payment...', amount: 'Amount', expires: 'Expires in', confirm: 'Confirm payment',
      confirming: 'Confirming...', note: 'Nothing is charged. Once you confirm, the order screen updates on its own.',
      paidT: 'Payment confirmed!', paidP: 'You can go back to the order screen: it already shows the payment.',
      foot: 'Secure connection · A SHINNARE project', order: 'Order {c}', items: '{n} items', item: '1 item',
      badT: 'Invalid link', badP: 'This payment link is not valid. Create a new Pix on the order screen.',
      expT: 'This Pix has expired', expP: 'Codes are valid for 15 minutes. Create a new Pix on the order screen.',
      netT: 'No connection', netP: 'We could not reach the server. Please check your internet and try again.',
      manyT: 'Too many attempts', manyP: 'Please wait a few minutes and try again.',
    },
  };
  let lang = (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
  try { const s = JSON.parse(localStorage.getItem('cdo-lang') || 'null'); if (s === 'en' || s === 'pt') lang = s; } catch { /* private mode */ }
  const t = (k, v) => (T[lang][k] || k).replace(/\{(\w)\}/g, (_, n) => (v && v[n] != null ? v[n] : ''));
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  const money = v => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const show = id => ['sLoading', 'sPay', 'sPaid', 'sError'].forEach(s => { $('#' + s).hidden = s !== id; });
  const fail = (k) => { $('#errT').textContent = t(k + 'T'); $('#errP').textContent = t(k + 'P'); show('sError'); };

  // read the capability from the fragment, then take it out of the address bar
  const q = new URLSearchParams(location.hash.slice(1));
  const id = q.get('o') || '', token = q.get('t') || '';
  try { history.replaceState(null, '', location.pathname); } catch { /* fine */ }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(token)) { fail('bad'); return; }

  async function post(path) {
    const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch('/api/pix/' + id + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }), credentials: 'omit', cache: 'no-store', signal: ctrl.signal });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, data };
    } catch { return { ok: false, status: 0, data: {} }; } finally { clearTimeout(tm); }
  }
  const byStatus = r => (r.status === 0 ? 'net' : r.status === 429 ? 'many' : r.status === 410 ? 'exp' : 'bad');

  let expires = 0, timer = 0;
  function tick() {
    const left = Math.min(900, Math.max(0, Math.round((expires - Date.now()) / 1000)));
    $('#timer').textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
    if (!left) { clearInterval(timer); fail('exp'); }
  }
  function paid(code) { clearInterval(timer); $('#paidCode').textContent = t('order', { c: code }); show('sPaid'); if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(60); }

  let code = '';
  (async () => {
    const r = await post('/view');
    if (!r.ok) { fail(byStatus(r)); return; }
    const d = r.data; code = d.code;
    if (d.status === 'paid') { paid(code); return; }
    if (d.status !== 'awaiting_payment') { fail('exp'); return; }
    $('#amount').textContent = money(d.total);
    $('#orderCode').textContent = t('order', { c: d.code });
    $('#count').textContent = d.count === 1 ? t('item') : t('items', { n: d.count });
    expires = Date.parse(d.expiresAt); tick(); timer = setInterval(tick, 1000);
    show('sPay');
  })();

  $('#confirm').addEventListener('click', async () => {
    const b = $('#confirm'), label = $('#confirm span');
    b.disabled = true; label.textContent = t('confirming');
    const r = await post('/confirm');
    if (r.ok && r.data.status === 'paid') { paid(code); return; }
    b.disabled = false; label.textContent = t('confirm');
    fail(byStatus(r));
  });
})();
