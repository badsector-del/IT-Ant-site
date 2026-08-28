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
const db = window.itAntSupabase;
let entryType = 'invoice';

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

const formatRsd = value => `${Number(value).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const formatDate = value => { const date = new Date(value); return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`; };
const openModal = type => {
  entryType = type;
  modal.hidden = false;
  modalTitle.textContent = type === 'invoice' ? 'Novi račun' : type === 'client' ? 'Novi klijent' : 'Novi trošak';
  statusField.hidden = type !== 'invoice';
  clientPicker.hidden = type !== 'invoice';
  expenseFields.hidden = type !== 'expense';
  invoiceItems.hidden = type !== 'invoice';
  clientSelect.required = type === 'invoice';
  form.amount.required = type !== 'invoice';
  form.reset();
  resetItems();
  itemList.querySelectorAll('input').forEach(input => { input.required = type === 'invoice'; });
  if (type === 'invoice') populateClients();
  (type === 'invoice' ? clientSelect : form.amount).focus();
};

document.querySelectorAll('[data-modal]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.modal)));
document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
addItemButton.addEventListener('click', () => {
  itemList.insertAdjacentHTML('beforeend', '<div class="item-row new-entry"><input class="item-description" placeholder="" required><button class="remove-item" type="button" aria-label="Obriši stavku">×</button><input class="item-quantity" type="number" min="0.01" step="0.01" value="1" aria-label="Količina" required><input class="item-price" type="number" min="0" step="0.01" placeholder="0" aria-label="Cena" required></div>');
  itemList.lastElementChild.querySelector('.item-description').focus();
});
itemList.addEventListener('click', event => { if (event.target.classList.contains('remove-item') && itemList.children.length > 1) event.target.closest('.item-row').remove(); });

function resetItems() {
  itemList.innerHTML = '<div class="item-row"><input class="item-description" placeholder="" required><button class="remove-item" type="button" aria-label="Obriši stavku">×</button><input class="item-quantity" type="number" min="0.01" step="0.01" value="1" aria-label="Količina" required><input class="item-price" type="number" min="0" step="0.01" placeholder="0" aria-label="Cena" required></div>';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (entryType === 'invoice') {
    data.items = [...itemList.querySelectorAll('.item-row')].map(row => ({ description: row.querySelector('.item-description').value.trim(), quantity: Number(row.querySelector('.item-quantity').value), price: Number(row.querySelector('.item-price').value) }));
    data.amount = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  }
  if (entryType === 'invoice') {
    const { data: membership, error: membershipError } = await db.from('company_users').select('company_id').limit(1).single();
    if (membershipError) { alert('Korisnik nije povezan sa preduzećem.'); return; }
    const { data: number, error: numberError } = await db.rpc('next_invoice_number');
    if (numberError) { alert(`Broj računa nije kreiran: ${numberError.message}`); return; }
    const { data: invoice, error: invoiceError } = await db.from('invoices').insert({ company_id: membership.company_id, client_id: data.client, number, status: data.status, total: data.amount, notes: null }).select('id').single();
    if (invoiceError) { alert(`Račun nije sačuvan: ${invoiceError.message}`); return; }
    const items = data.items.map(item => ({ invoice_id: invoice.id, description: item.description, quantity: item.quantity, unit_price: item.price }));
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

function renderDashboard() {
  const entries = getEntries();
  const invoices = entries.filter(entry => entry.type === 'invoice');
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
  const clients = getClients();
  document.querySelector('#client-list').innerHTML = clients.length ? clients.slice(0, 6).map(client => { const clientInvoices = invoices.filter(invoice => invoice.name === client.name); return `<div class="client"><span class="client-avatar orange">${client.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><strong>${client.name}</strong><small>${clientInvoices.length} ${clientInvoices.length === 1 ? 'račun' : 'računa'}</small></div><b>${formatRsd(total(clientInvoices.filter(invoice => invoice.status === 'pending')))}</b></div>`; }).join('') : '<p class="empty-state">Još nema unetih komitenata.</p>';
}

renderDashboard();
if (window.location.hash === '#novi-racun') openModal('invoice');
