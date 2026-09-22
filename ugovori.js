const db = window.itAntSupabase;
const modal = document.querySelector('#contract-modal');
const form = document.querySelector('#contract-form');
const list = document.querySelector('#contract-list');
const detail = document.querySelector('#contract-detail');
const detailTitle = document.querySelector('#contract-detail-title');
const detailContent = document.querySelector('#contract-detail-content');
const clientSelect = document.querySelector('#contract-client');
const statusFilter = document.querySelector('#contract-status-filter');
const durationSelect = document.querySelector('#contract-duration');
const endDateLabel = document.querySelector('#contract-end-date-label');
const subtotalInput = document.querySelector('#contract-subtotal');
const vatRateSelect = document.querySelector('#contract-vat-rate');
const totalInput = document.querySelector('#contract-total');
const vatLabel = document.querySelector('#contract-vat-label');
const taxNote = document.querySelector('#contract-tax-note');
const money = value => `${Number(value || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const date = value => { if (!value) return '—'; const d = new Date(`${value}T00:00:00`); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const today = () => new Date().toISOString().slice(0, 10);
let companyId = null;
let taxRegime = 'pausal';
let editingId = null;
let contracts = [];
const search = document.createElement('div');
search.className = 'search-controls';
search.innerHTML = '<label>Pretraži<input type="search" id="contract-search" placeholder="Unesite pojam"></label><label>Po čemu<select id="contract-search-field"><option value="number">Broj ugovora</option><option value="client">Komitent</option><option value="signature_date">Datum potpisa</option><option value="monthly_total">Mesečni iznos</option></select></label>';
document.querySelector('.invoice-toolbar').append(search);
const searchInput = document.querySelector('#contract-search');
const searchField = document.querySelector('#contract-search-field');
const sortState = { key: 'signature_date', direction: 'desc' };
const statusLabels = { active: 'Aktivan', potential: 'Potencijalan', closed: 'Zatvoren' };

async function loadCompany() {
  await window.itAntContextReady;
  const { data, error } = await db.from('company_users').select('company_id,companies(name,tax_regime)').eq('company_id', window.itAntActiveCompanyId).single();
  if (error) throw error;
  companyId = data.company_id;
  taxRegime = data.companies?.tax_regime || 'pausal';
  document.querySelectorAll('[data-company-name]').forEach(element => { element.textContent = data.companies?.name || 'Preduzeće nije izabrano'; });
  const vatEnabled = taxRegime === 'books_vat';
  vatLabel.hidden = !vatEnabled;
  taxNote.textContent = vatEnabled ? 'Unosi se mesečna osnovica bez PDV-a. Ukupan iznos se obračunava automatski.' : 'Ovo preduzeće nije u PDV sistemu. Ugovor se vodi bez obračuna PDV-a.';
  if (!vatEnabled) vatRateSelect.value = '0';
  calculateTotal();
}
async function loadClients(selected = '') {
  const { data, error } = await db.from('clients').select('id,name').order('name', { ascending: true });
  if (error) { clientSelect.innerHTML = '<option value="">Komitenti nisu dostupni</option>'; return; }
  clientSelect.innerHTML = data.length ? '<option value="">Izaberite komitenta</option>' + data.map(client => `<option value="${client.id}">${esc(client.name)}</option>`).join('') : '<option value="">Prvo unesite komitenta</option>';
  clientSelect.value = selected;
}
function calculateTotal() { const subtotal = Number(subtotalInput.value || 0); const rate = taxRegime === 'books_vat' ? Number(vatRateSelect.value || 0) : 0; totalInput.value = (subtotal + subtotal * rate / 100).toFixed(2); }
function durationLabel(contract) { return contract.duration_type === 'definite' ? `Do ${date(contract.end_date)}` : 'Neodređeno'; }
function sortContracts(rows) { return [...rows].sort((a, b) => { const left = sortState.key === 'client' ? a.clients?.name : sortState.key === 'duration' ? durationLabel(a) : a[sortState.key]; const right = sortState.key === 'client' ? b.clients?.name : sortState.key === 'duration' ? durationLabel(b) : b[sortState.key]; const comparison = ['monthly_total'].includes(sortState.key) ? Number(left || 0) - Number(right || 0) : String(left ?? '').localeCompare(String(right ?? ''), 'sr'); return sortState.direction === 'asc' ? comparison : -comparison; }); }
function renderContracts() {
  const term = searchInput.value.trim().toLocaleLowerCase('sr');
  const field = searchField.value;
  const selected = statusFilter.value;
  const visible = sortContracts(contracts.filter(contract => { const statusMatches = selected === 'all' || contract.status === selected; const value = field === 'client' ? contract.clients?.name : field === 'monthly_total' ? money(contract.monthly_total) : contract[field]; return statusMatches && (!term || String(value ?? '').toLocaleLowerCase('sr').includes(term)); }));
  list.innerHTML = visible.length ? visible.map(contract => `<tr data-contract-id="${contract.id}"><td><strong>${esc(contract.number)}</strong></td><td>${esc(contract.clients?.name || '—')}</td><td>${date(contract.signature_date)}</td><td>${durationLabel(contract)}</td><td>${money(contract.monthly_total)}</td><td><span class="badge ${contract.status === 'active' ? 'paid' : contract.status === 'closed' ? 'cancelled' : 'pending'}">${statusLabels[contract.status] || contract.status}</span></td><td><div class="row-actions"><button class="table-action" data-edit-contract="${contract.id}" type="button">Izmeni</button><button class="table-action" data-print-contract="${contract.id}" type="button">PDF</button></div></td></tr>`).join('') : '<tr><td colspan="7" class="empty-state">Nema ugovora za izabrane kriterijume.</td></tr>';
  document.querySelectorAll('.invoice-module th[data-sort]').forEach(header => { header.dataset.direction = header.dataset.sort === sortState.key ? sortState.direction : ''; });
  list.querySelectorAll('tr[data-contract-id]').forEach(row => row.addEventListener('click', event => { const id = row.dataset.contractId; const contract = contracts.find(item => item.id === id); if (event.target.closest('[data-edit-contract]')) return openModal(contract); if (event.target.closest('[data-print-contract]')) return window.open(`ugovor-print.html?id=${id}`, '_blank', 'noopener'); if (contract) showDetail(contract); }));
}
async function loadContracts() { const { data, error } = await db.from('contracts').select('id,number,client_id,signature_date,duration_type,end_date,status,billing_type,monthly_subtotal,vat_rate,vat_amount,monthly_total,tax_regime,item_prefix,notes,clients(name,pib,mb,address,invoice_email)').order('signature_date', { ascending: false }); if (error) { list.innerHTML = `<tr><td colspan="7" class="empty-state">Ugovori nisu učitani: ${esc(error.message)}</td></tr>`; return; } contracts = data || []; renderContracts(); }
function showDetail(contract) { detail.hidden = false; detailTitle.textContent = `${contract.number} · ${contract.clients?.name || '—'} · ${money(contract.monthly_total)} mesečno`; detailContent.innerHTML = `<div class="detail-meta"><span>Status <select id="contract-detail-status"><option value="active" ${contract.status === 'active' ? 'selected' : ''}>Aktivan</option><option value="potential" ${contract.status === 'potential' ? 'selected' : ''}>Potencijalan</option><option value="closed" ${contract.status === 'closed' ? 'selected' : ''}>Zatvoren</option></select></span><span>Potpisan: <strong>${date(contract.signature_date)}</strong></span><span>Trajanje: <strong>${durationLabel(contract)}</strong></span><span>PDV: <strong>${contract.tax_regime === 'books_vat' ? `${Number(contract.vat_rate || 0)}% / ${money(contract.vat_amount)}` : 'Nije u sistemu PDV'}</strong></span></div><div class="invoice-actions"><button class="table-action" id="print-contract-detail" type="button">PDF / Štampaj</button><button class="table-action" id="edit-contract-detail" type="button">Izmeni ugovor</button></div><div class="contract-summary"><p><strong>Mesečna osnovica:</strong> ${money(contract.monthly_subtotal)}</p><p><strong>Ukupno mesečno:</strong> ${money(contract.monthly_total)}</p><p><strong>Obračun:</strong> ${contract.billing_type === 'fixed' ? 'Isti iznos svakog meseca' : 'Promenljiv iznos'}</p>${contract.item_prefix ? `<p><strong>Tekst stavke:</strong> ${esc(contract.item_prefix)}</p>` : ''}${contract.notes ? `<p class="notes"><strong>Napomena:</strong> ${esc(contract.notes)}</p>` : ''}</div>`; detail.querySelector('#contract-detail-status').addEventListener('change', event => updateStatus(contract, event.target.value)); detail.querySelector('#print-contract-detail').addEventListener('click', () => window.open(`ugovor-print.html?id=${contract.id}`, '_blank', 'noopener')); detail.querySelector('#edit-contract-detail').addEventListener('click', () => openModal(contract)); detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function updateStatus(contract, status) { const { error } = await db.from('contracts').update({ status, updated_at: new Date().toISOString() }).eq('id', contract.id); if (error) { alert(`Status nije promenjen: ${error.message}`); return; } contract.status = status; renderContracts(); showDetail(contract); }
function openModal(contract = null) { editingId = contract?.id || null; form.reset(); durationSelect.value = contract?.duration_type || 'indefinite'; endDateLabel.hidden = durationSelect.value !== 'definite'; window.setDatePickerValue('contract_signature_date', contract?.signature_date || today()); window.setDatePickerValue('contract_end_date', contract?.end_date || ''); form.number.value = contract?.number || ''; form.status.value = contract?.status || 'active'; form.billing_type.value = contract?.billing_type || 'fixed'; subtotalInput.value = contract?.monthly_subtotal ?? ''; vatRateSelect.value = String(contract?.vat_rate ?? (taxRegime === 'books_vat' ? 20 : 0)); form.item_prefix.value = contract?.item_prefix || ''; form.notes.value = contract?.notes || ''; document.querySelector('#contract-title').textContent = editingId ? 'Izmeni ugovor' : 'Novi ugovor'; document.querySelector('.modal-submit').textContent = editingId ? 'Sačuvaj izmene' : 'Sačuvaj ugovor'; loadClients(contract?.client_id || ''); calculateTotal(); modal.hidden = false; clientSelect.focus(); }
form.addEventListener('submit', async event => { event.preventDefault(); try { if (!companyId) return alert('Aktivno preduzeće nije učitano.'); if (!clientSelect.value) return alert('Izaberite komitenta.'); const signatureDate = form.signature_date.value; if (!signatureDate) return alert('Izaberite datum potpisa.'); if (durationSelect.value === 'definite' && !form.end_date.value) return alert('Izaberite datum završetka.'); const subtotal = Number(subtotalInput.value || 0); const rate = taxRegime === 'books_vat' ? Number(vatRateSelect.value || 0) : 0; if (subtotal < 0) return alert('Mesečna osnovica ne može biti negativna.'); const vatAmount = subtotal * rate / 100; const payload = { company_id: companyId, client_id: clientSelect.value, number: form.number.value.trim() || null, signature_date: signatureDate, duration_type: durationSelect.value, end_date: durationSelect.value === 'definite' ? form.end_date.value : null, status: form.status.value, billing_type: form.billing_type.value, monthly_subtotal: subtotal, vat_rate: rate, vat_amount: vatAmount, monthly_total: subtotal + vatAmount, tax_regime: taxRegime, item_prefix: form.item_prefix.value.trim() || null, notes: form.notes.value.trim() || null, updated_at: new Date().toISOString() }; if (!editingId && !payload.number) { const { data: number, error: numberError } = await db.rpc('next_contract_number'); if (numberError) throw numberError; payload.number = number; } const result = editingId ? await db.from('contracts').update(payload).eq('id', editingId) : await db.from('contracts').insert(payload).select('id').single(); if (result.error) throw result.error; modal.hidden = true; await loadContracts(); } catch (error) { alert(`Ugovor nije sačuvan: ${error?.message || error}`); } });
durationSelect.addEventListener('change', () => { endDateLabel.hidden = durationSelect.value !== 'definite'; });
subtotalInput.addEventListener('input', calculateTotal); vatRateSelect.addEventListener('change', calculateTotal); statusFilter.addEventListener('change', renderContracts); searchInput.addEventListener('input', renderContracts); searchField.addEventListener('change', renderContracts);
document.querySelectorAll('.invoice-module th[data-sort]').forEach(header => header.addEventListener('click', () => { if (sortState.key === header.dataset.sort) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc'; else { sortState.key = header.dataset.sort; sortState.direction = 'asc'; } renderContracts(); }));
document.querySelector('#new-contract').addEventListener('click', () => openModal()); document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; }); modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; }); document.querySelector('#close-contract-detail').addEventListener('click', () => { detail.hidden = true; });
(async () => { try { await loadCompany(); await loadClients(); await loadContracts(); if (new URLSearchParams(location.search).get('new') === '1') openModal(); } catch (error) { list.innerHTML = `<tr><td colspan="7" class="empty-state">Podaci nisu dostupni: ${esc(error.message)}</td></tr>`; } })();
