const modal = document.querySelector('#modal');
const form = document.querySelector('#entry-form');
const modalTitle = document.querySelector('#modal-title');
const descriptionField = document.querySelector('#description-field');
const statusField = document.querySelector('#status-field');
const clientPicker = document.querySelector('#client-picker');
const clientSelect = document.querySelector('#client-select');
let entryType = 'invoice';

if (!localStorage.getItem('it-ant-demo-reset-v2')) {
  localStorage.removeItem('it-ant-clients');
  localStorage.removeItem('it-ant-entries');
  localStorage.setItem('it-ant-demo-reset-v2', 'true');
}

const getClients = () => JSON.parse(localStorage.getItem('it-ant-clients') || '[]');
const getEntries = () => JSON.parse(localStorage.getItem('it-ant-entries') || '[]');
const populateClients = () => {
  clientSelect.innerHTML = '<option value="" disabled selected>Izaberite komitenta</option>' + getClients().map(client => `<option value="${client.name}">${client.name}</option>`).join('');
};

const formatRsd = value => `${Number(value).toLocaleString('sr-RS')} RSD`;
const openModal = type => {
  entryType = type;
  modal.hidden = false;
  modalTitle.textContent = type === 'invoice' ? 'Novi račun' : type === 'client' ? 'Novi klijent' : 'Novi trošak';
  descriptionField.hidden = type !== 'expense';
  statusField.hidden = type !== 'invoice';
  clientPicker.hidden = type !== 'invoice';
  clientSelect.required = type === 'invoice';
  form.amount.required = true;
  form.reset();
  if (type === 'invoice') populateClients();
  (type === 'invoice' ? clientSelect : form.amount).focus();
};

document.querySelectorAll('[data-modal]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.modal)));
document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (entryType === 'invoice') {
    data.name = data.client;
  }
  const entries = JSON.parse(localStorage.getItem('it-ant-entries') || '[]');
  entries.unshift({ ...data, type: entryType, createdAt: new Date().toISOString() });
  localStorage.setItem('it-ant-entries', JSON.stringify(entries));
  renderDashboard();
  modal.hidden = true;
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
  const date = new Intl.DateTimeFormat('sr-RS', { day: '2-digit', month: 'short' }).format(new Date());
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
  document.querySelector('#invoice-list').innerHTML = invoices.length ? invoices.slice(0, 5).map((invoice, index) => `<tr><td><strong>#NOVI-${invoices.length - index}</strong></td><td>${invoice.name}</td><td>${new Intl.DateTimeFormat('sr-RS', { day: '2-digit', month: 'short' }).format(new Date(invoice.createdAt))}</td><td>${formatRsd(invoice.amount)}</td><td><span class="badge ${invoice.status === 'paid' ? 'paid' : 'pending'}">${invoice.status === 'paid' ? 'Plaćen' : 'Čeka uplatu'}</span></td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">Još nema unetih računa.</td></tr>';
  const clients = getClients();
  document.querySelector('#client-list').innerHTML = clients.length ? clients.slice(0, 6).map(client => { const clientInvoices = invoices.filter(invoice => invoice.name === client.name); return `<div class="client"><span class="client-avatar orange">${client.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><strong>${client.name}</strong><small>${clientInvoices.length} ${clientInvoices.length === 1 ? 'račun' : 'računa'}</small></div><b>${formatRsd(total(clientInvoices.filter(invoice => invoice.status === 'pending')))}</b></div>`; }).join('') : '<p class="empty-state">Još nema unetih komitenata.</p>';
}

renderDashboard();
