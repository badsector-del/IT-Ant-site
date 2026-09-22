const db = window.itAntSupabase;
const modal = document.querySelector('#offer-modal');
const form = document.querySelector('#offer-form');
const list = document.querySelector('#offer-list');
const itemList = document.querySelector('#offer-item-list');
const statusFilter = document.querySelector('#offer-status-filter');
const detail = document.querySelector('#offer-detail');
const detailTitle = document.querySelector('#offer-detail-title');
const detailContent = document.querySelector('#offer-detail-content');
let companyId = null;
let taxRegime = 'pausal';
let offers = [];
const offerSearch = document.createElement('div');
offerSearch.className = 'search-controls';
offerSearch.innerHTML = '<label>Pretraži<input type="search" id="offer-search" placeholder="Unesite pojam"></label><label>Po čemu<select id="offer-search-field"><option value="number">Broj ponude</option><option value="client">Komitent</option><option value="issue_date">Datum izdavanja</option><option value="valid_until">Važi do</option><option value="total">Iznos</option></select></label>';
document.querySelector('.invoice-toolbar').append(offerSearch);
const offerSearchInput = document.querySelector('#offer-search');
const offerSearchField = document.querySelector('#offer-search-field');
const offerSort = { key: 'issue_date', direction: 'desc' };
const offerSortValue = (offer, key) => key === 'client' ? offer.clients?.name : key === 'items' ? (offer.offer_items?.length || 0) : offer[key];
function sortOffers(rows) {
  return [...rows].sort((a, b) => {
    const left = offerSortValue(a, offerSort.key);
    const right = offerSortValue(b, offerSort.key);
    const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''), 'sr');
    return offerSort.direction === 'asc' ? comparison : -comparison;
  });
}
function updateOfferSortIndicators() {
  document.querySelectorAll('.invoice-module th[data-sort]').forEach(header => header.dataset.direction = header.dataset.sort === offerSort.key ? offerSort.direction : '');
}

const money = value => `${Number(value || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const date = value => { if (!value) return '—'; const d = new Date(`${value}T00:00:00`); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (value, days) => { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const statusLabel = status => ({ draft: 'Nacrt', sent: 'Poslata', accepted: 'Prihvaćena', rejected: 'Odbijena', expired: 'Istekla' }[status] || status);
const statusClass = status => status === 'accepted' ? 'paid' : status === 'rejected' || status === 'expired' ? 'cancelled' : 'pending';

async function loadCompany() {
  await window.itAntContextReady;
  const { data, error } = await db.from('company_users').select('company_id,companies(name,tax_regime)').eq('company_id', window.itAntActiveCompanyId).single();
  if (error) throw error;
  companyId = data.company_id;
  taxRegime = data.companies?.tax_regime || 'pausal';
  document.querySelectorAll('[data-company-name]').forEach(element => { element.textContent = data.companies?.name || 'Preduzeće nije izabrano'; });
}

async function loadClients(selected = '') {
  const select = document.querySelector('#offer-client');
  const { data, error } = await db.from('clients').select('id,name').order('name', { ascending: true });
  if (error) { select.innerHTML = '<option value="">Komitenti nisu dostupni</option>'; return; }
  select.innerHTML = data.length ? '<option value="">Izaberite komitenta</option>' + data.map(client => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join('') : '<option value="">Prvo unesite komitenta</option>';
  select.value = selected;
}

function itemTemplate(item = {}) {
  const rate = String(item.vat_rate ?? (taxRegime === 'books_vat' ? 20 : 0));
  return `<div class="offer-item-row"><input class="offer-item-description" placeholder="Opis stavke" value="${escapeHtml(item.description || '')}" required><button class="remove-offer-item" type="button" aria-label="Obriši stavku">×</button><input class="offer-item-quantity" type="number" min="0.01" step="0.01" value="${item.quantity ?? 1}" aria-label="Količina" required><input class="offer-item-unit" value="${escapeHtml(item.unit || 'kom')}" aria-label="Jedinica" required><input class="offer-item-price" type="number" min="0" step="0.01" value="${item.unit_price ?? ''}" placeholder="0,00" aria-label="Cena" required><select class="offer-item-vat" aria-label="PDV tretman" ${taxRegime === 'books_vat' ? '' : 'hidden disabled'}><option value="20" ${rate === '20' ? 'selected' : ''}>20%</option><option value="10" ${rate === '10' ? 'selected' : ''}>10%</option><option value="exempt_right" ${rate === 'exempt_right' ? 'selected' : ''}>Oslobođeno + pravo</option><option value="exempt_no" ${rate === 'exempt_no' ? 'selected' : ''}>Oslobođeno bez prava</option></select></div>`;
}

function resetItems(items = [{}]) { itemList.innerHTML = items.map(itemTemplate).join(''); }
function readItems() {
  return [...itemList.querySelectorAll('.offer-item-row')].map(row => {
    const quantity = Number(row.querySelector('.offer-item-quantity').value || 0);
    const unitPrice = Number(row.querySelector('.offer-item-price').value || 0);
    const selectedVat = row.querySelector('.offer-item-vat').value;
    const taxable = selectedVat === '20' || selectedVat === '10';
    const vatRate = taxRegime === 'books_vat' && taxable ? Number(selectedVat) : 0;
    const vatTreatment = taxRegime === 'books_vat' ? (taxable ? 'taxable' : selectedVat) : 'taxable';
    const net = quantity * unitPrice;
    return { description: row.querySelector('.offer-item-description').value.trim(), quantity, unit: row.querySelector('.offer-item-unit').value.trim() || 'kom', unit_price: unitPrice, vat_rate: vatRate, vat_treatment: vatTreatment, vat_amount: net * vatRate / 100 };
  });
}

function setOfferDates(issue = today(), valid = plusDays(issue, 15)) {
  window.setDatePickerValue('offer_issue_date', issue);
  window.setDatePickerValue('offer_valid_until', valid);
}

function selectedTerm(selectId, customId) {
  const select = document.querySelector(`#${selectId}`);
  return select.value === 'custom' ? document.querySelector(`#${customId}`).value.trim() : select.value.trim();
}

function updateCustomTerm(selectId, customId) {
  const select = document.querySelector(`#${selectId}`);
  const custom = document.querySelector(`#${customId}`);
  custom.hidden = select.value !== 'custom';
  custom.required = select.value === 'custom';
  if (custom.hidden) custom.value = '';
}

function openModal() {
  form.reset();
  setOfferDates();
  resetItems();
  updateCustomTerm('offer-payment-terms', 'offer-payment-custom');
  updateCustomTerm('offer-delivery-terms', 'offer-delivery-custom');
  loadClients();
  modal.hidden = false;
  document.querySelector('#offer-client').focus();
}

function renderOffers() {
  const selected = statusFilter.value;
  const term = offerSearchInput.value.trim().toLocaleLowerCase('sr');
  const field = offerSearchField.value;
  const visible = sortOffers(offers.filter(offer => {
    const statusMatches = selected === 'all' || offer.status === selected;
    const value = field === 'client' ? offer.clients?.name : offer[field];
    return statusMatches && (!term || String(value ?? '').toLocaleLowerCase('sr').includes(term));
  }));
  list.innerHTML = visible.length ? visible.map(offer => `<tr data-offer-id="${offer.id}"><td><strong>${escapeHtml(offer.number)}</strong></td><td>${escapeHtml(offer.clients?.name || '—')}</td><td>${date(offer.issue_date)}</td><td>${date(offer.valid_until)}</td><td>${offer.offer_items?.length || 0}</td><td>${money(offer.total)}</td><td><span class="badge ${statusClass(offer.status)}">${statusLabel(offer.status)}</span></td><td><div class="row-actions"><button class="table-action print-offer" data-id="${offer.id}" type="button">PDF</button></div></td></tr>`).join('') : '<tr><td colspan="8" class="empty-state">Nema ponuda za izabrani status.</td></tr>';
  updateOfferSortIndicators();
  list.querySelectorAll('tr[data-offer-id]').forEach(row => row.addEventListener('click', event => {
    if (event.target.closest('.print-offer')) return;
    const offer = visible.find(item => item.id === row.dataset.offerId);
    if (offer) showDetail(offer);
  }));
}

function showDetail(offer) {
  detail.hidden = false;
  detailTitle.textContent = `${offer.number} · ${offer.clients?.name || '—'} · ${money(offer.total)}`;
  detailContent.innerHTML = `<div class="detail-meta"><span>Status <select id="offer-detail-status"><option value="draft" ${offer.status === 'draft' ? 'selected' : ''}>Nacrt</option><option value="sent" ${offer.status === 'sent' ? 'selected' : ''}>Poslata</option><option value="accepted" ${offer.status === 'accepted' ? 'selected' : ''}>Prihvaćena</option><option value="rejected" ${offer.status === 'rejected' ? 'selected' : ''}>Odbijena</option><option value="expired" ${offer.status === 'expired' ? 'selected' : ''}>Istekla</option></select></span><span>Datum: <strong>${date(offer.issue_date)}</strong></span><span>Važi do: <strong>${date(offer.valid_until)}</strong></span><span>PDV: <strong>${taxRegime === 'books_vat' ? money(offer.vat_amount) : 'Nije u sistemu PDV'}</strong></span></div><div class="invoice-actions"><button class="table-action" id="print-offer-detail" type="button">PDF / Štampaj</button>${offer.status !== 'accepted' ? '<button class="table-action" id="accept-offer" type="button">Prihvati i kreiraj račun</button>' : ''}</div><div class="table-wrap"><table><thead><tr><th>Opis stavke</th><th>Količina</th><th>Jedinica</th><th>Cena</th><th>PDV</th><th>Ukupno</th></tr></thead><tbody>${(offer.offer_items || []).map(item => `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${escapeHtml(item.unit)}</td><td>${money(item.unit_price)}</td><td>${taxRegime === 'books_vat' ? `${Number(item.vat_rate || 0)}%` : '—'}</td><td>${money(item.line_total ?? Number(item.quantity) * Number(item.unit_price) + Number(item.vat_amount || 0))}</td></tr>`).join('')}</tbody></table></div>${offer.payment_terms ? `<p class="notes"><strong>Uslovi plaćanja:</strong> ${escapeHtml(offer.payment_terms)}</p>` : ''}${offer.delivery_terms ? `<p class="notes"><strong>Uslovi isporuke:</strong> ${escapeHtml(offer.delivery_terms)}</p>` : ''}${offer.notes ? `<p class="notes"><strong>Napomena:</strong> ${escapeHtml(offer.notes)}</p>` : ''}`;
  document.querySelector('#offer-detail-status').addEventListener('change', event => updateStatus(offer, event.target.value));
  document.querySelector('#print-offer-detail').addEventListener('click', () => window.open(`ponuda-print.html?id=${offer.id}`, '_blank', 'noopener'));
  document.querySelector('#accept-offer')?.addEventListener('click', () => acceptOffer(offer));
}

async function acceptOffer(offer, askForConfirmation = true) {
  if (askForConfirmation && !confirm(`Prihvatiti ponudu ${offer.number} i kreirati račun?`)) return false;
  const { data: number, error: numberError } = await db.rpc('next_invoice_number');
  if (numberError) { alert(`Broj računa nije kreiran: ${numberError.message}`); return false; }
  const issueDate = today();
  const { data: invoice, error: invoiceError } = await db.from('invoices').insert({ company_id: companyId, client_id: offer.client_id, number, status: 'pending', issue_date: issueDate, due_date: plusDays(issueDate, 15), total: offer.total, subtotal: offer.subtotal, vat_rate: offer.vat_rate || 0, vat_amount: offer.vat_amount || 0, tax_regime: offer.tax_regime || taxRegime, notes: offer.notes || null }).select('id').single();
  if (invoiceError) { alert(`Račun nije kreiran: ${invoiceError.message}`); return false; }
  const { error: itemsError } = await db.from('invoice_items').insert((offer.offer_items || []).map(item => ({ invoice_id: invoice.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, vat_rate: item.vat_rate, vat_treatment: item.vat_treatment, vat_amount: item.vat_amount })));
  if (itemsError) { await db.from('invoices').delete().eq('id', invoice.id); alert(`Stavke računa nisu sačuvane: ${itemsError.message}`); return false; }
  const { error: offerError } = await db.from('offers').update({ status: 'accepted', invoice_id: invoice.id, updated_at: new Date().toISOString() }).eq('id', offer.id);
  if (offerError) { alert(`Ponuda nije označena kao prihvaćena: ${offerError.message}`); return false; }
  alert(`Kreiran je račun ${number}.`);
  await loadOffers();
  const refreshed = offers.find(item => item.id === offer.id);
  if (refreshed) showDetail(refreshed);
  return true;
}

async function updateStatus(offer, status) {
  if (status === 'accepted' && offer.status !== 'accepted') {
    const createInvoice = confirm(`Ponuda ${offer.number} je prihvaćena. Želite li da kreirate fakturu iz ponude?`);
    if (createInvoice) {
      const created = await acceptOffer(offer, false);
      if (!created) showDetail(offer);
      return;
    }
  }
  const { error } = await db.from('offers').update({ status, updated_at: new Date().toISOString() }).eq('id', offer.id);
  if (error) { alert(`Status ponude nije promenjen: ${error.message}`); return; }
  offer.status = status;
  renderOffers();
  showDetail(offer);
}

async function loadOffers() {
  const { data, error } = await db.from('offers').select('id,number,client_id,invoice_id,issue_date,valid_until,status,payment_terms,delivery_terms,notes,subtotal,vat_rate,vat_amount,total,tax_regime,clients(name,pib,mb,address,invoice_email),offer_items(description,quantity,unit,unit_price,vat_rate,vat_treatment,vat_amount,line_total)').order('issue_date', { ascending: false });
  if (error) { list.innerHTML = `<tr><td colspan="8" class="empty-state">Ponude nisu učitane: ${escapeHtml(error.message)}</td></tr>`; return; }
  offers = data || [];
  renderOffers();
}

document.querySelector('#new-offer').addEventListener('click', openModal);
document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
document.querySelector('#offer-payment-terms').addEventListener('change', () => updateCustomTerm('offer-payment-terms', 'offer-payment-custom'));
document.querySelector('#offer-delivery-terms').addEventListener('change', () => updateCustomTerm('offer-delivery-terms', 'offer-delivery-custom'));
document.querySelector('#add-offer-item').addEventListener('click', () => { itemList.insertAdjacentHTML('beforeend', itemTemplate()); itemList.lastElementChild.querySelector('.offer-item-description').focus(); });
itemList.addEventListener('click', event => { if (event.target.classList.contains('remove-offer-item') && itemList.children.length > 1) event.target.closest('.offer-item-row').remove(); });
statusFilter.addEventListener('change', renderOffers);
offerSearchInput.addEventListener('input', renderOffers);
offerSearchField.addEventListener('change', renderOffers);
document.querySelectorAll('.invoice-module th[data-sort]').forEach(header => header.addEventListener('click', () => {
  if (offerSort.key === header.dataset.sort) offerSort.direction = offerSort.direction === 'asc' ? 'desc' : 'asc';
  else { offerSort.key = header.dataset.sort; offerSort.direction = 'asc'; }
  renderOffers();
}));
list.addEventListener('click', event => {
  const printButton = event.target.closest('.print-offer');
  if (printButton) window.open(`ponuda-print.html?id=${printButton.dataset.id}`, '_blank', 'noopener');
});
document.querySelector('#close-offer-detail').addEventListener('click', () => { detail.hidden = true; });

form.addEventListener('submit', async event => {
  event.preventDefault();
  const items = readItems();
  if (!form.client_id.value || !items.length || items.some(item => !item.description || item.quantity <= 0 || item.unit_price < 0)) { alert('Komitent i najmanje jedna ispravna stavka su obavezni.'); return; }
  const issueDate = form.issue_date.value;
  const validUntil = form.valid_until.value;
  if (!issueDate || !validUntil || validUntil < issueDate) { alert('Rok važenja mora biti jednak ili kasniji od datuma izdavanja.'); return; }
  await window.itAntContextReady;
  const { data: membership, error: membershipError } = await db.from('company_users').select('company_id').eq('company_id', window.itAntActiveCompanyId).single();
  if (membershipError) { alert('Korisnik nije povezan sa preduzećem.'); return; }
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmount = items.reduce((sum, item) => sum + item.vat_amount, 0);
  const { data: number, error: numberError } = await db.rpc('next_offer_number');
  if (numberError) { alert(`Broj ponude nije kreiran: ${numberError.message}`); return; }
  const { data: offer, error: offerError } = await db.from('offers').insert({ company_id: membership.company_id, client_id: form.client_id.value, number, issue_date: issueDate, valid_until: validUntil, payment_terms: selectedTerm('offer-payment-terms', 'offer-payment-custom') || null, delivery_terms: selectedTerm('offer-delivery-terms', 'offer-delivery-custom') || null, notes: form.notes.value.trim() || null, subtotal, vat_rate: items.every(item => item.vat_rate === items[0]?.vat_rate) ? (items[0]?.vat_rate || 0) : 0, vat_amount: vatAmount, total: subtotal + vatAmount, tax_regime: taxRegime }).select('id').single();
  if (offerError) { alert(`Ponuda nije sačuvana: ${offerError.message}`); return; }
  const { error: itemsError } = await db.from('offer_items').insert(items.map(item => ({ offer_id: offer.id, description: item.description, quantity: item.quantity, unit: item.unit, unit_price: item.unit_price, vat_rate: item.vat_rate, vat_treatment: item.vat_treatment, vat_amount: item.vat_amount })));
  if (itemsError) { await db.from('offers').delete().eq('id', offer.id); alert(`Stavke ponude nisu sačuvane: ${itemsError.message}`); return; }
  modal.hidden = true;
  await loadOffers();
});

(async () => { try { await loadCompany(); await loadClients(); resetItems(); setOfferDates(); await loadOffers(); if (new URLSearchParams(window.location.search).get('new') === '1') openModal(); } catch (error) { list.innerHTML = `<tr><td colspan="8" class="empty-state">Podaci nisu dostupni: ${escapeHtml(error.message)}</td></tr>`; } })();
