const db = window.itAntSupabase;
const modal = document.querySelector('#expense-modal');
const form = document.querySelector('#expense-form');
const list = document.querySelector('#expense-list');
const vatLabel = document.querySelector('#expense-vat-label');
const vatRate = document.querySelector('#expense-vat-rate');
const taxNote = document.querySelector('#expense-tax-note');
const totalInput = document.querySelector('#expense-total');
let companyId = null;
let taxRegime = 'pausal';
let editingId = null;
const money = value => `${Number(value || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const date = value => { const d = new Date(`${value}T00:00:00`); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const today = () => new Date().toISOString().slice(0, 10);
async function loadCompany() {
  const { data, error } = await db.from('company_users').select('company_id,companies(name,tax_regime)').limit(1).single();
  if (error) throw error;
  companyId = data.company_id;
  taxRegime = data.companies?.tax_regime || 'pausal';
  document.querySelectorAll('[data-company-name]').forEach(element => { element.textContent = data.companies?.name || 'Preduzeće nije izabrano'; });
  const vatEnabled = taxRegime === 'books_vat';
  vatLabel.hidden = !vatEnabled;
  taxNote.textContent = vatEnabled ? 'Unosi osnovicu bez PDV-a. Ukupan iznos se obračunava automatski.' : 'Ovo preduzeće nije u PDV sistemu. Trošak se vodi bez obračuna PDV-a.';
  if (!vatEnabled) { vatRate.value = '0'; totalInput.readOnly = false; }
}
function calculateTotal() {
  const subtotal = Number(form.subtotal.value || 0);
  const rate = taxRegime === 'books_vat' ? Number(vatRate.value || 0) : 0;
  totalInput.value = (subtotal + subtotal * rate / 100).toFixed(2);
}
async function loadExpenses() {
  const { data, error } = await db.from('expenses').select('id,supplier,invoice_number,expense_date,description,amount,subtotal,vat_rate,vat_amount,status').order('expense_date', { ascending: false });
  if (error) { list.innerHTML = `<tr><td colspan="8" class="empty-state">Troškovi nisu dostupni: ${escapeHtml(error.message)}</td></tr>`; return; }
  document.querySelector('#expense-count').textContent = `${data.length} ${data.length === 1 ? 'trošak' : 'troškova'}`;
  list.innerHTML = data.length ? data.map(item => `<tr><td>${escapeHtml(item.supplier)}</td><td>${escapeHtml(item.invoice_number || '—')}</td><td>${date(item.expense_date)}</td><td>${escapeHtml(item.description || '—')}</td><td>${money(item.amount)}</td><td>${Number(item.vat_rate || 0) ? `${Number(item.vat_rate)}%` : '—'}</td><td><span class="badge ${item.status === 'paid' ? 'paid' : 'pending'}">${item.status === 'paid' ? 'Plaćen' : 'Čeka plaćanje'}</span></td><td><div class="row-actions"><button class="table-action edit-expense" data-id="${item.id}" type="button">Izmeni</button><button class="table-action danger delete-expense" data-id="${item.id}" type="button">Obriši</button></div></td></tr>`).join('') : '<tr><td colspan="8" class="empty-state">Još nema unetih troškova.</td></tr>';
}
function openModal(expense = null) {
  editingId = expense?.id || null;
  form.reset();
  form.expense_date.value = expense?.expense_date || today();
  form.supplier.value = expense?.supplier || '';
  form.invoice_number.value = expense?.invoice_number || '';
  form.description.value = expense?.description || '';
  form.subtotal.value = expense?.subtotal ?? expense?.amount ?? '';
  form.status.value = expense?.status || 'paid';
  vatRate.value = String(expense?.vat_rate ?? (taxRegime === 'books_vat' ? 20 : 0));
  document.querySelector('#expense-title').textContent = editingId ? 'Izmeni trošak' : 'Novi trošak';
  document.querySelector('.modal-submit').textContent = editingId ? 'Sačuvaj izmene' : 'Sačuvaj trošak';
  calculateTotal();
  modal.hidden = false;
  form.supplier.focus();
}
document.querySelector('#new-expense').addEventListener('click', () => openModal());
document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
form.subtotal.addEventListener('input', calculateTotal);
vatRate.addEventListener('change', calculateTotal);
list.addEventListener('click', async event => {
  const id = event.target.dataset.id;
  if (!id) return;
  if (event.target.classList.contains('delete-expense')) { if (!confirm('Obrisati ovaj trošak?')) return; const { error } = await db.from('expenses').delete().eq('id', id); if (error) alert(error.message); else loadExpenses(); }
  if (event.target.classList.contains('edit-expense')) { const { data, error } = await db.from('expenses').select('*').eq('id', id).single(); if (error) alert(error.message); else openModal(data); }
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  calculateTotal();
  const subtotal = Number(form.subtotal.value || 0);
  const rate = taxRegime === 'books_vat' ? Number(vatRate.value || 0) : 0;
  const payload = { company_id: companyId, supplier: form.supplier.value.trim(), invoice_number: form.invoice_number.value.trim() || null, expense_date: form.expense_date.value, description: form.description.value.trim() || null, subtotal, vat_rate: rate, vat_amount: subtotal * rate / 100, amount: Number(totalInput.value || 0), status: form.status.value };
  const result = editingId ? await db.from('expenses').update(payload).eq('id', editingId) : await db.from('expenses').insert(payload);
  if (result.error) { alert(`Trošak nije sačuvan: ${result.error.message}`); return; }
  modal.hidden = true; await loadExpenses();
});
(async () => { try { await loadCompany(); await loadExpenses(); if (new URLSearchParams(window.location.search).get('new') === '1') openModal(); } catch (error) { list.innerHTML = `<tr><td colspan="8" class="empty-state">Podaci nisu dostupni.</td></tr>`; } })();
