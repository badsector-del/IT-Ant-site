const modal = document.querySelector('#modal');
const form = document.querySelector('#entry-form');
const modalTitle = document.querySelector('#modal-title');
const statusField = document.querySelector('#status-field');
const clientPicker = document.querySelector('#client-picker');
const clientSelect = document.querySelector('#client-select');
const expenseFields = document.querySelector('#expense-fields');
const invoiceItems = document.querySelector('#invoice-items');
const itemList = document.querySelector('#item-list');
const addItemButton = document.querySelector('#add-item');
const vatFields = document.querySelector('#vat-fields');
const taxNote = document.querySelector('#tax-note');
const db = window.itAntSupabase;
let entryType = 'invoice';
let companySettings = null;
let editingInvoiceId = null;

const getClients = () => JSON.parse(localStorage.getItem('it-ant-clients') || '[]');
const makeId = () => window.crypto?.randomUUID?.() || `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const invoiceYear = entry => new Date(entry.createdAt || Date.now()).getFullYear();
function getEntries() {
  const entries = JSON.parse(localStorage.getItem('it-ant-entries') || '[]');
  let changed = false;
  const counters = {};
  entries.filter(entry => entry.type === 'invoice').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(entry => {
    const year = invoiceYear(entry);
    const existingNumber = entry.number?.match(/^R-(\d+)-(\d{2})$/);
    if (existingNumber) counters[year] = Math.max(counters[year] || 0, Number(existingNumber[1]));
  });
  entries.forEach(entry => {
    if (!entry.id) { entry.id = makeId(); changed = true; }
    if (entry.type === 'invoice' && !entry.number) { const year = invoiceYear(entry); entry.number = `R-${String((counters[year] || 0) + 1).padStart(3, '0')}-${String(year).slice(-2)}`; counters[year] = (counters[year] || 0) + 1; changed = true; }
  });
  if (changed) localStorage.setItem('it-ant-entries', JSON.stringify(entries));
  return entries;
}
const nextInvoiceNumber = (entries, date) => { const year = date.getFullYear(); const max = entries.filter(entry => entry.type === 'invoice' && invoiceYear(entry) === year).reduce((highest, entry) => Math.max(highest, Number(entry.number?.match(/^R-(\d+)-/)?.[1] || 0)), 0); return `R-${String(max + 1).padStart(3, '0')}-${String(year).slice(-2)}`; };
async function populateClients() {
  clientSelect.innerHTML = '<option value="" disabled selected>Učitavanje komitenata...</option>';
  await db.auth.getSession();
  const { data, error } = await db.from('clients').select('id,name').order('name', { ascending: true });
  if (error) {
    clientSelect.innerHTML = '<option value="" disabled selected>Komitenti nisu dostupni</option>';
    return;
  }
  clientSelect.innerHTML = data.length ? '<option value="" disabled selected>Izaberite komitenta</option>' + data.map(client => `<option value="${client.id}">${client.name}</option>`).join('') : '<option value="" disabled selected>Prvo unesite komitenta</option>';
}

async function loadCompanySettings() {
  const { data } = await db.from('company_users').select('company_id,companies(tax_regime,vat_number)').limit(1).single();
  companySettings = data?.companies || { tax_regime: 'pausal' };
  const vatEnabled = companySettings.tax_regime === 'books_vat';
  vatFields.hidden = !vatEnabled;
  taxNote.textContent = vatEnabled ? 'Preduzeće je u PDV sistemu. Iznosi stavki su bez PDV-a.' : 'Za ovaj poreski režim račun se izdaje bez PDV-a.';
  itemList.querySelectorAll('.item-vat').forEach(select => {
    select.disabled = !vatEnabled;
    select.classList.toggle('vat-visible', vatEnabled);
    if (!vatEnabled) select.value = '20';
  });
}

const formatRsd = value => `${Number(value).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const formatDate = value => { const date = new Date(value); return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`; };
const returnTo = new URLSearchParams(window.location.search).get('return') || sessionStorage.getItem('it-ant-invoice-return') || (document.referrer.includes('racuni.html') ? 'racuni' : '');
const closeModal = () => {
  modal.hidden = true;
  if (returnTo === 'racuni') { sessionStorage.removeItem('it-ant-invoice-return'); window.location.href = 'racuni.html'; }
};
const openModal = type => {
  entryType = type;
  modal.hidden = false;
  modalTitle.textContent = type === 'invoice' ? 'Novi račun' : type === 'client' ? 'Novi klijent' : 'Novi trošak';
  statusField.hidden = type !== 'invoice';
  clientPicker.hidden = type !== 'invoice';
  expenseFields.hidden = type !== 'expense';
  invoiceItems.hidden = type !== 'invoice';
  vatFields.hidden = type !== 'invoice' || companySettings?.tax_regime !== 'books_vat';
  itemList.querySelectorAll('.item-vat').forEach(select => { select.classList.toggle('vat-visible', companySettings?.tax_regime === 'books_vat'); });
  clientSelect.required = type === 'invoice';
  form.amount.required = type !== 'invoice';
  form.reset();
  resetItems();
  itemList.querySelectorAll('input').forEach(input => { input.required = type === 'invoice'; });
  if (type === 'invoice') { populateClients(); loadCompanySettings(); }
  (type === 'invoice' ? clientSelect : form.amount).focus();
};

document.querySelectorAll('[data-modal]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.modal)));
document.querySelector('.modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
addItemButton.addEventListener('click', () => {
  itemList.insertAdjacentHTML('beforeend', '<div class="item-row new-entry"><input class="item-description" placeholder="" required><button class="remove-item" type="button" aria-label="Obriši stavku">×</button><input class="item-quantity" type="number" min="0.01" step="0.01" value="1" aria-label="Količina" required><input class="item-price" type="number" min="0" step="0.01" placeholder="0" aria-label="Cena" required><select class="item-vat" aria-label="PDV tretman"><option value="20">20% - Opšta</option><option value="10">10% - Posebna</option><option value="exempt_right">Oslobođeno sa pravom</option><option value="exempt_no">Oslobođeno bez prava</option></select></div>');
  const newVatSelect = itemList.lastElementChild.querySelector('.item-vat');
  newVatSelect.classList.toggle('vat-visible', companySettings?.tax_regime === 'books_vat');
  newVatSelect.disabled = newVatSelect.hidden;
  itemList.lastElementChild.querySelector('.item-description').focus();
});
itemList.addEventListener('click', event => { if (event.target.classList.contains('remove-item') && itemList.children.length > 1) event.target.closest('.item-row').remove(); });

function resetItems() {
  itemList.innerHTML = '<div class="item-row"><input class="item-description" placeholder="" required><button class="remove-item" type="button" aria-label="Obriši stavku">×</button><input class="item-quantity" type="number" min="0.01" step="0.01" value="1" aria-label="Količina" required><input class="item-price" type="number" min="0" step="0.01" placeholder="0" aria-label="Cena" required><select class="item-vat" aria-label="PDV tretman"><option value="20">20% - Opšta</option><option value="10">10% - Posebna</option><option value="exempt_right">Oslobođeno sa pravom</option><option value="exempt_no">Oslobođeno bez prava</option></select></div>';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (entryType === 'invoice') {
    data.items = [...itemList.querySelectorAll('.item-row')].map(row => {
      const vatValue = row.querySelector('.item-vat').value;
      const taxable = vatValue === '20' || vatValue === '10';
      const vatRate = companySettings?.tax_regime === 'books_vat' && taxable ? Number(vatValue) : 0;
      const vatTreatment = companySettings?.tax_regime === 'books_vat' ? (taxable ? 'taxable' : vatValue) : 'taxable';
      const netAmount = Number(row.querySelector('.item-quantity').value) * Number(row.querySelector('.item-price').value);
      return { description: row.querySelector('.item-description').value.trim(), quantity: Number(row.querySelector('.item-quantity').value), price: Number(row.querySelector('.item-price').value), vatRate, vatTreatment, vatAmount: netAmount * vatRate / 100 };
    });
    data.subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    data.vat_rate = data.items.every(item => item.vatRate === data.items[0]?.vatRate) ? (data.items[0]?.vatRate || 0) : 0;
    data.vat_amount = data.items.reduce((sum, item) => sum + item.vatAmount, 0);
    data.amount = data.subtotal + data.vat_amount;
  }
  if (entryType === 'invoice') {
    const { data: membership, error: membershipError } = await db.from('company_users').select('company_id').limit(1).single();
    if (membershipError) { alert('Korisnik nije povezan sa preduzećem.'); return; }
    const invoicePayload = { company_id: membership.company_id, client_id: data.client, status: data.status, total: data.amount, subtotal: data.subtotal, vat_rate: data.vat_rate, vat_amount: data.vat_amount, tax_regime: companySettings?.tax_regime || 'pausal', notes: null, updated_at: new Date().toISOString() };
    if (editingInvoiceId) {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: updated, error: updateError } = await db.from('invoices').update(invoicePayload).eq('id', editingInvoiceId).gt('created_at', cutoff).neq('status', 'cancelled').select('id').maybeSingle();
      if (updateError || !updated) { alert('Račun više nije moguće izmeniti. Rok za izmenu je 48 sati.'); return; }
      await db.from('invoice_items').delete().eq('invoice_id', editingInvoiceId);
      const { error: editItemsError } = await db.from('invoice_items').insert(data.items.map(item => ({ invoice_id: editingInvoiceId, description: item.description, quantity: item.quantity, unit_price: item.price, vat_rate: item.vatRate, vat_treatment: item.vatTreatment, vat_amount: item.vatAmount })));
      if (editItemsError) { alert(`Stavke nisu izmenjene: ${editItemsError.message}`); return; }
      modal.hidden = true; editingInvoiceId = null; window.location.href = 'racuni.html'; return;
    }
    const { data: number, error: numberError } = await db.rpc('next_invoice_number');
    if (numberError) { alert(`Broj računa nije kreiran: ${numberError.message}`); return; }
    const { data: invoice, error: invoiceError } = await db.from('invoices').insert({ ...invoicePayload, number }).select('id').single();
    if (invoiceError) { alert(`Račun nije sačuvan: ${invoiceError.message}`); return; }
    const items = data.items.map(item => ({ invoice_id: invoice.id, description: item.description, quantity: item.quantity, unit_price: item.price, vat_rate: item.vatRate, vat_treatment: item.vatTreatment, vat_amount: item.vatAmount }));
    const { error: itemsError } = await db.from('invoice_items').insert(items);
    if (itemsError) { await db.from('invoices').delete().eq('id', invoice.id); alert(`Stavke računa nisu sačuvane: ${itemsError.message}`); return; }
    modal.hidden = true;
    window.location.href = 'racuni.html';
    return;
  }
  const entries = JSON.parse(localStorage.getItem('it-ant-entries') || '[]');
  const createdAt = new Date().toISOString();
  entries.unshift({ ...data, type: entryType, createdAt, id: makeId(), ...(entryType === 'invoice' ? { number: nextInvoiceNumber(entries, new Date(createdAt)) } : {}) });
  localStorage.setItem('it-ant-entries', JSON.stringify(entries));
  renderDashboard();
  modal.hidden = true;
  if (entryType === 'invoice') window.location.href = 'racuni.html';
});

function renderEntry(data) {
  if (entryType === 'client') {
    const initials = data.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
    document.querySelector('#client-list').insertAdjacentHTML('afterbegin', `<div class="client new-entry"><span class="client-avatar orange">${initials}</span><div><strong>${data.name}</strong><small>Novi klijent</small></div><b>0 RSD</b></div>`);
    return;
  }
  if (entryType === 'expense') {
    const current = document.querySelector('#expenses-total');
    const amount = Number(current.textContent.replace(/[^0-9]/g, '')) + Number(data.amount || 0);
    current.textContent = formatRsd(amount);
    return;
  }
  const date = formatDate(new Date());
  const status = data.status === 'paid' ? '<span class="badge paid">Plaćen</span>' : '<span class="badge pending">Čeka uplatu</span>';
  document.querySelector('#invoice-list').insertAdjacentHTML('afterbegin', `<tr class="new-entry"><td><strong>#NOVI</strong></td><td>${data.name}</td><td>${date}</td><td>${formatRsd(data.amount)}</td><td>${status}</td></tr>`);
}

async function renderDashboard() {
  const entries = getEntries();
  const { data: remoteInvoices } = await db.from('invoices').select('id,number,status,total,issue_date,clients(name)').order('issue_date', { ascending: false });
  const invoices = remoteInvoices ? remoteInvoices.map(invoice => ({ ...invoice, type: 'invoice', name: invoice.clients?.name || 'Nepoznat komitent', amount: invoice.total, createdAt: invoice.issue_date })) : entries.filter(entry => entry.type === 'invoice');
  const expenses = entries.filter(entry => entry.type === 'expense');
  const paid = invoices.filter(entry => entry.status === 'paid');
  const pending = invoices.filter(entry => entry.status === 'pending');
  const total = rows => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  document.querySelector('#income-total').textContent = formatRsd(total(paid));
  document.querySelector('#receivables-total').textContent = formatRsd(total(pending));
  document.querySelector('#expenses-total').textContent = formatRsd(total(expenses));
  document.querySelector('#income-note').textContent = paid.length ? `${paid.length} plaćenih računa` : 'Nema unetih računa';
  document.querySelector('#pending-count').textContent = pending.length ? `${pending.length} računa na čekanju` : 'Nema računa na čekanju';
  document.querySelector('#expenses-note').textContent = expenses.length ? `${expenses.length} evidentiranih troškova` : 'Nema unetih troškova';
  document.querySelector('#invoice-list').innerHTML = invoices.length ? invoices.slice(0, 5).map(invoice => `<tr><td><strong>${invoice.number}</strong></td><td>${invoice.name}</td><td>${formatDate(invoice.createdAt)}</td><td>${formatRsd(invoice.amount)}</td><td><span class="badge ${invoice.status === 'paid' ? 'paid' : 'pending'}">${invoice.status === 'paid' ? 'Plaćen' : 'Čeka uplatu'}</span></td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">Još nema unetih računa.</td></tr>';
  const { data: remoteClients } = await db.from('clients').select('id,name').order('name', { ascending: true });
  const clients = remoteClients || getClients();
  document.querySelector('#client-list').innerHTML = clients.length ? clients.slice(0, 6).map(client => { const clientInvoices = invoices.filter(invoice => invoice.name === client.name); return `<div class="client"><span class="client-avatar orange">${client.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><strong>${client.name}</strong><small>${clientInvoices.length} ${clientInvoices.length === 1 ? 'račun' : 'računa'}</small></div><b>${formatRsd(total(clientInvoices.filter(invoice => invoice.status === 'pending')))}</b></div>`; }).join('') : '<p class="empty-state">Još nema unetih komitenata.</p>';
}

renderDashboard();
if (window.location.hash === '#novi-racun') openModal('invoice');
async function loadEditInvoice(id) {
  const { data: invoice, error } = await db.from('invoices').select('id,client_id,status,invoice_items(description,quantity,unit_price,vat_rate,vat_treatment)').eq('id', id).single();
  if (error || !invoice) return;
  editingInvoiceId = id; openModal('invoice');
  await populateClients(); await loadCompanySettings();
  clientSelect.value = invoice.client_id; form.status.value = invoice.status; resetItems();
  itemList.innerHTML = invoice.invoice_items.map(item => { const vatValue = item.vat_treatment === 'exempt_right' || item.vat_treatment === 'exempt_no' ? item.vat_treatment : String(item.vat_rate ?? 20); return `<div class="item-row"><input class="item-description" value="${item.description}" required><button class="remove-item" type="button" aria-label="Obriši stavku">×</button><input class="item-quantity" type="number" min="0.01" step="0.01" value="${item.quantity}" aria-label="Količina" required><input class="item-price" type="number" min="0" step="0.01" value="${item.unit_price}" aria-label="Cena" required><select class="item-vat" aria-label="PDV tretman"><option value="20" ${vatValue === '20' ? 'selected' : ''}>20% - Opšta</option><option value="10" ${vatValue === '10' ? 'selected' : ''}>10% - Posebna</option><option value="exempt_right" ${vatValue === 'exempt_right' ? 'selected' : ''}>Oslobođeno sa pravom</option><option value="exempt_no" ${vatValue === 'exempt_no' ? 'selected' : ''}>Oslobođeno bez prava</option></select></div>`; }).join('');
  itemList.querySelectorAll('.item-vat').forEach(select => { select.disabled = companySettings?.tax_regime !== 'books_vat'; select.classList.toggle('vat-visible', companySettings?.tax_regime === 'books_vat'); });
  modalTitle.textContent = 'Izmeni račun';
};
const editId = new URLSearchParams(window.location.search).get('edit');
if (editId) loadEditInvoice(editId);
