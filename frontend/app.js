const $ = (selector) => document.querySelector(selector);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency = (cents) => cents == null ? 'Precio a cotizar' : new Intl.NumberFormat('es-PE', {style:'currency', currency:'PEN'}).format(cents / 100);
const api = async (path, opts = {}) => {
  const response = await fetch(path, {headers:{'Content-Type':'application/json'}, ...opts});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'No se pudo procesar la solicitud.');
  return data;
};
let products = [];
let filter = 'todos';
let search = '';
let cart = {};
let lastQuote = null;
try { const stored = JSON.parse(localStorage.getItem('apex_cart') || '{}'); if (stored && typeof stored === 'object' && !Array.isArray(stored)) cart = stored; } catch { cart = {}; }
const saveCart = () => { localStorage.setItem('apex_cart', JSON.stringify(cart)); updateCount(); };
const itemCount = () => Object.values(cart).reduce((n, q) => n + (Number.isInteger(q) ? Math.max(0, q) : 0), 0);
const updateCount = () => { $('#cart-count').textContent = itemCount(); };
const toast = (message) => { const t = $('#toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 3400); };

function renderCatalog() {
  const matched = products.filter(p => (filter === 'todos' || p.kind === filter) && `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(search));
  $('#catalog-grid').innerHTML = matched.length ? matched.map(p => `
    <article class="product-card">
      <div class="product-media ${p.kind === 'servicio' ? 'media-service' : 'media-product'}">
        <span class="product-emoji" aria-hidden="true">${esc(p.emoji)}</span><span class="media-label">${esc(p.kind === 'servicio' ? 'SERVICIO' : 'PRODUCTO')}</span>
      </div>
      <div class="product-body"><span class="product-category">${esc(p.category)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="product-bottom"><span class="price">${esc(currency(p.price_cents))}</span><button type="button" class="add-button" data-add="${p.id}" ${p.stock === 0 ? "disabled" : ""} aria-label="Agregar ${esc(p.name)} al carrito">${p.stock === 0 ? "Agotado" : "+ Agregar"}</button></div></div>
    </article>`).join('') : '<div class="empty-state">No encontramos resultados. Prueba otra búsqueda o categoría.</div>';
}

function renderCart() {
  const chosen = products.filter(p => Number(cart[p.id]) > 0);
  const list = $('#cart-items');
  list.innerHTML = chosen.length ? chosen.map(p => `<div class="cart-item"><div class="cart-thumb">${esc(p.emoji)}</div><div class="cart-item-info"><strong>${esc(p.name)}</strong><span>${esc(currency(p.price_cents))}</span><div class="quantity"><button type="button" data-dec="${p.id}" aria-label="Restar unidad de ${esc(p.name)}">−</button><span>${Math.min(50, Number(cart[p.id]))}</span><button type="button" data-inc="${p.id}" aria-label="Sumar unidad de ${esc(p.name)}">+</button></div></div><button type="button" class="remove-button" data-remove="${p.id}" aria-label="Quitar ${esc(p.name)}">✕</button></div>`).join('') : '<div class="cart-empty">🛒<h3>Tu carrito está vacío</h3><p>Explora nuestro catálogo y selecciona lo que deseas cotizar.</p></div>';
  const totalKnown = chosen.every(p => p.price_cents != null);
  const total = chosen.reduce((n, p) => n + ((p.price_cents || 0) * cart[p.id]), 0);
  const old = $('#cart-total'); if (old) old.remove();
  if (chosen.length) {const summary = document.createElement('div'); summary.className = 'cart-total'; summary.id = 'cart-total'; summary.innerHTML = `<span>${totalKnown ? 'Total referencial' : 'Presupuesto estimado'}</span><strong>${totalKnown ? esc(currency(total)) : 'Sujeto a cotización'}</strong>`; list.after(summary);}
  $('#quote-form').hidden = !chosen.length || Boolean(lastQuote);
  $('#quote-success').hidden = !lastQuote;
  updateCount();
}

function trapDrawerFocus(event) {
  if (event.key !== 'Tab' || !$('#cart-drawer').classList.contains('open')) return;
  const focusables = [...$('#cart-drawer').querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled)')]
    .filter(element => element.getClientRects().length && !element.closest('[hidden]'));
  if (!focusables.length) return;
  if (event.shiftKey && document.activeElement === focusables[0]) {event.preventDefault();focusables.at(-1).focus();}
  else if (!event.shiftKey && document.activeElement === focusables.at(-1)) {event.preventDefault();focusables[0].focus();}
}
document.addEventListener('keydown', trapDrawerFocus);
function openCart() { $('#cart-overlay').hidden = false; $('#cart-drawer').classList.add('open'); $('#cart-drawer').setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll'); document.querySelector('main').inert = true; renderCart(); $('#close-cart').focus(); }
function closeCart() { $('#cart-overlay').hidden = true; $('#cart-drawer').classList.remove('open'); $('#cart-drawer').setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll'); document.querySelector('main').inert = false; $('#open-cart').focus(); }
function adjust(id, delta) { const p = products.find(p => p.id === id); if (!p) return; const q = Number(cart[id]) || 0; let next = Math.min(50, Math.max(0, q + delta)); if (p.stock !== null) next = Math.min(next, p.stock); if (next) cart[id] = next; else delete cart[id]; saveCart(); renderCart(); if (delta > 0 && next === q) toast('Cantidad máxima o stock disponible alcanzado.'); }

$('#catalog-grid').addEventListener('click', e => {const button = e.target.closest('[data-add]'); if (!button) return; const id = Number(button.dataset.add); const before = Number(cart[id]) || 0; adjust(id, 1); if ((Number(cart[id]) || 0) > before) toast('Agregado a tu cotización'); });
$('#cart-items').addEventListener('click', e => {const b = e.target.closest('button'); if (!b) return; if (b.dataset.inc) adjust(Number(b.dataset.inc), 1); if (b.dataset.dec) adjust(Number(b.dataset.dec), -1); if (b.dataset.remove) { delete cart[Number(b.dataset.remove)]; saveCart(); renderCart(); }});
$('#open-cart').addEventListener('click', openCart);
$('#contact-cart').addEventListener('click', openCart);
$('#close-cart').addEventListener('click', closeCart);
$('#cart-overlay').addEventListener('click', closeCart);
document.addEventListener('keydown', e => {if (e.key === 'Escape' && $('#cart-drawer').classList.contains('open')) closeCart();});
$('#catalog-search').addEventListener('input', e => {search = e.target.value.trim().toLowerCase(); renderCatalog();});
document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {filter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(t => {t.classList.toggle('active', t === b); t.setAttribute('aria-pressed', String(t === b));}); renderCatalog();}));
$('#quote-form').addEventListener('submit', async e => {
  e.preventDefault();
  const error = $('#quote-error'); error.hidden = true;
  const items = products.filter(p => cart[p.id] > 0).map(p => ({product_id:p.id, quantity:Math.min(50, Number(cart[p.id]))}));
  if (!items.length) {error.textContent = 'Agrega al menos un artículo.'; error.hidden = false; return;}
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  if (!$('#privacy-consent').hidden && !$('#privacy-accepted').checked) {error.textContent='Debes leer y aceptar el aviso de privacidad antes de enviar.';error.hidden=false;return;}
  const btn = $('#send-quote'); btn.disabled = true; btn.textContent = 'Registrando...';
  try {
    lastQuote = await api('/api/quotes', {method:'POST', body:JSON.stringify({...data, items, privacy_accepted:$('#privacy-accepted').checked})});
    $('#quote-code').textContent = `Código de seguimiento: ${lastQuote.code}`;
    const link = $('#whatsapp-link'); link.hidden = !lastQuote.whatsapp_url;
    if (lastQuote.whatsapp_url) link.href = lastQuote.whatsapp_url;
    cart = {}; saveCart(); form.reset(); renderCart(); toast('Solicitud registrada correctamente');
  } catch (err) {error.textContent = err.message; error.hidden = false;}
  finally {btn.disabled = false; btn.innerHTML = 'Registrar solicitud <span>→</span>';}
});
$('#copy-quote').addEventListener('click', async () => {try { await navigator.clipboard.writeText(lastQuote?.message || ''); toast('Solicitud copiada al portapapeles'); } catch {toast('No se pudo copiar. Selecciona el texto manualmente.'); }});
$('#new-quote').addEventListener('click', () => {lastQuote = null; renderCart(); closeCart(); location.hash = '#catalogo';});
$('#track-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('#track-error').hidden = true; $('#track-result').hidden = true;
  const code = $('#track-code').value.trim().toUpperCase();
  const phone = $('#track-phone').value.trim();
  try {
    const result = await api('/api/quote-status', {method:'POST', body:JSON.stringify({code, phone})});
    const names = {nuevo:'Recibida',contactado:'En contacto',cotizado:'Cotización preparada',aprobado:'Aprobada',rechazado:'Cerrada'};
    $('#track-result').innerHTML = `<strong>${esc(result.code)}</strong><span>Estado: ${esc(names[result.status] || result.status)}</span><small>${result.items.map(i => esc(i.name)+' × '+Number(i.quantity)).join(' · ')}</small>`;
    $('#track-result').hidden = false;
  } catch (error) {$('#track-error').textContent = error.message; $('#track-error').hidden = false;}
});
$('#year').textContent = new Date().getFullYear();
async function init() {
  try {const [data, config] = await Promise.all([api('/api/products'), api('/api/config')]); products = data; if (config.demo_mode) $('#demo-banner').hidden = false;
    if (config.privacy_notice_url) {$('#privacy-consent').hidden=false;$('#privacy-url').href=config.privacy_notice_url;}
    if (!config.demo_mode && !config.privacy_notice_url) {$('#send-quote').disabled=true;$('#privacy-unavailable').hidden=false;}
    for (const [id, quantity] of Object.entries(cart)) {const p = products.find(p => p.id === Number(id)); if (!p || !Number.isInteger(quantity) || quantity < 1) delete cart[id]; else cart[id] = Math.min(50, quantity, p.stock ?? 50); }
    saveCart(); renderCatalog(); renderCart();
  } catch {$('#catalog-grid').innerHTML = '<div class="empty-state">No pudimos cargar el catálogo. Actualiza la página para reintentar.</div>';}
}
init();
