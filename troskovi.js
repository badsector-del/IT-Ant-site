const db = window.itAntSupabase;
const modal = document.querySelector('#expense-modal');
const form = document.querySelector('#expense-form');
const list = document.querySelector('#expense-list');
const vatLabel = document.querySelector('#expense-vat-label');
const vatRate = document.querySelector('#expense-vat-rate');
const taxNote = document.querySelector('#expense-tax-note');
const totalInput = document.querySelector('#expense-total');
const supplierSelect = document.querySelector('#supplier-select');
const expenseDateInput = form.expense_date;
expenseDateInput.type = 'text';
const expenseDateLabel = expenseDateInput.closest('label');
const expenseDatePicker = document.createElement('div');
expenseDatePicker.className = 'date-picker';
expenseDatePicker.innerHTML = '<input type="text" data-date-display placeholder="dd.MM.yyyy" readonly><div class="date-calendar" hidden></div>';
expenseDateInput.type = 'hidden';
expenseDatePicker.append(expenseDateInput);
expenseDateLabel.append(expenseDatePicker);
const expenseDateDisplay = expenseDatePicker.querySelector('[data-date-display]');
const expenseCalendar = expenseDatePicker.querySelector('.date-calendar');
const descriptionLabel = form.description.closest('label');
const subtotalLabel = form.subtotal.closest('label');
const expenseItems = document.createElement('div');
expenseItems.className = 'expense-items';
expenseItems.innerHTML = '<div class="expense-items-heading"><span>Opis</span><span>Količina</span><span>Cena</span><span>PDV</span><span></span></div><div id="expense-item-list"></div><button type="button" class="add-item" id="add-expense-item">+ Dodaj stavku</button>';
document.querySelector('.expense-amount-grid').before(expenseItems);
descriptionLabel.hidden = true;
subtotalLabel.hidden = true;
document.querySelector('#expense-vat-label').hidden = true;
const expenseItemList = document.querySelector('#expense-item-list');
const addExpenseItem = () => { expenseItemList.insertAdjacentHTML('beforeend', '<div class="expense-item-row"><input class="expense-item-description" placeholder="Opis stavke" required><input class="expense-item-quantity" type="number" min="0.01" step="0.01" value="1" required><input class="expense-item-price" type="number" min="0" step="0.01" placeholder="0,00" required><select class="expense-item-vat"><option value="20">20%</option><option value="10">10%</option><option value="0">Bez PDV-a</option></select><button type="button" class="remove-expense-item" aria-label="Obriši stavku">×</button></div>'); updateExpenseVatVisibility(); };
const resetExpenseItems = () => { expenseItemList.innerHTML = ''; addExpenseItem(); };
const updateExpenseVatVisibility = () => expenseItemList.querySelectorAll('.expense-item-vat').forEach(select => { select.hidden = taxRegime !== 'books_vat'; select.disabled = taxRegime !== 'books_vat'; });
const readExpenseItems = () => [...expenseItemList.querySelectorAll('.expense-item-row')].map(row => { const quantity = Number(row.querySelector('.expense-item-quantity').value || 0); const price = Number(row.querySelector('.expense-item-price').value || 0); const rate = taxRegime === 'books_vat' ? Number(row.querySelector('.expense-item-vat').value || 0) : 0; const subtotal = quantity * price; return { description: row.querySelector('.expense-item-description').value.trim(), quantity, unit_price: price, vat_rate: rate, vat_amount: subtotal * rate / 100 }; });
const fillExpenseItems = items => { expenseItemList.innerHTML = ''; (items?.length ? items : [{}]).forEach(item => { addExpenseItem(); const row = expenseItemList.lastElementChild; row.querySelector('.expense-item-description').value = item.description || ''; row.querySelector('.expense-item-quantity').value = item.quantity || 1; row.querySelector('.expense-item-price').value = item.unit_price ?? ''; row.querySelector('.expense-item-vat').value = String(item.vat_rate ?? 0); }); updateExpenseVatVisibility(); };
const monthNames = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
const pad = value => String(value).padStart(2, '0');
const displayDate = value => value ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : '';
let calendarDate = new Date();
function renderCalendar() {
  const first = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const days = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const start = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: start }, () => '<span></span>');
  for (let day = 1; day <= days; day += 1) { const iso = `${calendarDate.getFullYear()}-${pad(calendarDate.getMonth() + 1)}-${pad(day)}`; cells.push(`<button type="button" class="calendar-day ${iso === expenseDateInput.value ? 'selected' : ''}" data-expense-date="${iso}">${day}</button>`); }
  expenseCalendar.innerHTML = `<div class="calendar-head"><button type="button" data-calendar-prev>‹</button><strong>${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}</strong><button type="button" data-calendar-next>›</button></div><div class="calendar-week"><span>Po</span><span>Ut</span><span>Sr</span><span>Če</span><span>Pe</span><span>Su</span><span>Ne</span></div><div class="calendar-grid">${cells.join('')}</div>`;
}
function setExpenseDate(value) { expenseDateInput.value = value || ''; expenseDateDisplay.value = displayDate(value); if (value) calendarDate = new Date(`${value}T12:00:00`); renderCalendar(); }
expenseDateDisplay.addEventListener('click', () => { expenseCalendar.hidden = !expenseCalendar.hidden; renderCalendar(); });
expenseCalendar.addEventListener('click', event => { const day = event.target.closest('[data-expense-date]'); if (day) { setExpenseDate(day.dataset.expenseDate); expenseCalendar.hidden = true; } if (event.target.closest('[data-calendar-prev]')) { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); } if (event.target.closest('[data-calendar-next]')) { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); } });
document.addEventListener('click', event => { if (!expenseDatePicker.contains(event.target)) expenseCalendar.hidden = true; });
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
  updateExpenseVatVisibility();
}
async function loadSuppliers(selectedId = '') {
  const { data, error } = await db.from('clients').select('id,name').order('name', { ascending: true });
  if (error) { supplierSelect.innerHTML = '<option value="">Komitenti nisu dostupni</option>'; return; }
  supplierSelect.innerHTML = data.length ? '<option value="">Izaberite dobavljača</option>' + data.map(client => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join('') : '<option value="">Prvo unesite komitenta</option>';
  supplierSelect.value = selectedId;
}
function calculateTotal() {
  const items = readExpenseItems();
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vat = items.reduce((sum, item) => sum + item.vat_amount, 0);
  totalInput.value = (subtotal + vat).toFixed(2);
}
async function loadExpenses() {
  const { data, error } = await db.from('expenses').select('id,supplier,supplier_id,invoice_number,expense_date,description,amount,subtotal,vat_rate,vat_amount,status').order('expense_date', { ascending: false });
  if (error) { list.innerHTML = `<tr><td colspan="8" class="empty-state">Troškovi nisu dostupni: ${escapeHtml(error.message)}</td></tr>`; return; }
  document.querySelector('#expense-count').textContent = `${data.length} ${data.length === 1 ? 'trošak' : 'troškova'}`;
  list.innerHTML = data.length ? data.map(item => `<tr><td>${escapeHtml(item.supplier)}</td><td>${escapeHtml(item.invoice_number || '—')}</td><td>${date(item.expense_date)}</td><td>${escapeHtml(item.description || '—')}</td><td>${money(item.amount)}</td><td>${Number(item.vat_rate || 0) ? `${Number(item.vat_rate)}%` : '—'}</td><td><span class="badge ${item.status === 'paid' ? 'paid' : 'pending'}">${item.status === 'paid' ? 'Plaćen' : 'Čeka plaćanje'}</span></td><td><div class="row-actions"><button class="table-action edit-expense" data-id="${item.id}" type="button">Izmeni</button><button class="table-action danger delete-expense" data-id="${item.id}" type="button">Obriši</button></div></td></tr>`).join('') : '<tr><td colspan="8" class="empty-state">Još nema unetih troškova.</td></tr>';
}
function openModal(expense = null) {
  editingId = expense?.id || null;
  form.reset();
  setExpenseDate(expense?.expense_date || today());
  loadSuppliers(expense?.supplier_id || '');
  form.invoice_number.value = expense?.invoice_number || '';
  form.description.value = expense?.description || '';
  form.subtotal.value = expense?.subtotal ?? expense?.amount ?? '';
  form.status.value = expense?.status || 'paid';
  fillExpenseItems(expense?.items);
  vatRate.value = String(expense?.vat_rate ?? (taxRegime === 'books_vat' ? 20 : 0));
  document.querySelector('#expense-title').textContent = editingId ? 'Izmeni trošak' : 'Novi trošak';
  document.querySelector('.modal-submit').textContent = editingId ? 'Sačuvaj izmene' : 'Sačuvaj trošak';
  calculateTotal();
  modal.hidden = false;
  form.supplier.focus();
}
document.querySelector('#add-expense-item').addEventListener('click', addExpenseItem);
expenseItemList.addEventListener('click', event => { if (event.target.classList.contains('remove-expense-item') && expenseItemList.children.length > 1) event.target.closest('.expense-item-row').remove(); calculateTotal(); });
expenseItemList.addEventListener('input', calculateTotal);
document.querySelector('#new-expense').addEventListener('click', () => openModal());
document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
form.subtotal.addEventListener('input', calculateTotal);
vatRate.addEventListener('change', calculateTotal);
list.addEventListener('click', async event => {
  const id = event.target.dataset.id;
  if (!id) return;
  if (event.target.classList.contains('delete-expense')) { if (!confirm('Obrisati ovaj trošak?')) return; const { error } = await db.from('expenses').delete().eq('id', id); if (error) alert(error.message); else loadExpenses(); }
  if (event.target.classList.contains('edit-expense')) { const { data, error } = await db.from('expenses').select('*').eq('id', id).single(); const { data: items } = await db.from('expense_items').select('description,quantity,unit_price,vat_rate,vat_amount').eq('expense_id', id).order('created_at'); if (error) alert(error.message); else openModal({ ...data, items }); }
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  calculateTotal();
  const items = readExpenseItems();
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vat = items.reduce((sum, item) => sum + item.vat_amount, 0);
  const supplierName = supplierSelect.options[supplierSelect.selectedIndex]?.textContent || '';
  const payload = { company_id: companyId, supplier_id: supplierSelect.value, supplier: supplierName, invoice_number: form.invoice_number.value.trim() || null, expense_date: form.expense_date.value, description: items.map(item => item.description).filter(Boolean).join(', ') || null, subtotal, vat_rate: items.every(item => item.vat_rate === items[0]?.vat_rate) ? (items[0]?.vat_rate || 0) : 0, vat_amount: vat, amount: subtotal + vat, status: form.status.value };
  const result = editingId ? await db.from('expenses').update(payload).eq('id', editingId) : await db.from('expenses').insert(payload).select('id').single();
  if (result.error) { alert(`Trošak nije sačuvan: ${result.error.message}`); return; }
  const expenseId = editingId || result.data.id;
  if (editingId) await db.from('expense_items').delete().eq('expense_id', expenseId);
  const { error: itemsError } = await db.from('expense_items').insert(items.map(item => ({ expense_id: expenseId, description: item.description, quantity: item.quantity, unit_price: item.unit_price, vat_rate: item.vat_rate, vat_amount: item.vat_amount })));
  if (itemsError) { alert(`Stavke troška nisu sačuvane: ${itemsError.message}`); return; }
  modal.hidden = true; await loadExpenses();
});
(async () => { try { await loadCompany(); await loadSuppliers(); await loadExpenses(); if (new URLSearchParams(window.location.search).get('new') === '1') openModal(); } catch (error) { list.innerHTML = `<tr><td colspan="8" class="empty-state">Podaci nisu dostupni.</td></tr>`; } })();
