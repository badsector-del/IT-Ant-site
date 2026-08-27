const modal = document.querySelector('#modal');
const form = document.querySelector('#entry-form');
const modalTitle = document.querySelector('#modal-title');
const descriptionField = document.querySelector('#description-field');
const statusField = document.querySelector('#status-field');
const clientPicker = document.querySelector('#client-picker');
const clientSelect = document.querySelector('#client-select');
const newClientField = document.querySelector('#new-client-field');
let entryType = 'invoice';

const defaultClients = ['BCE Group', 'RNC Services', 'Crafter d.o.o.', 'Digital Finance'];
const getClients = () => JSON.parse(localStorage.getItem('it-ant-clients') || JSON.stringify(defaultClients));
const populateClients = () => {
  clientSelect.innerHTML = '<option value="" disabled selected>Izaberite komitenta</option>' + getClients().map(client => `<option value="${client}">${client}</option>`).join('');
};

const formatRsd = value => `${Number(value).toLocaleString('sr-RS')} RSD`;
const openModal = type => {
  entryType = type;
  modal.hidden = false;
  modalTitle.textContent = type === 'invoice' ? 'Novi račun' : type === 'client' ? 'Novi klijent' : 'Novi trošak';
  descriptionField.hidden = type !== 'expense';
  statusField.hidden = type !== 'invoice';
  clientPicker.hidden = type !== 'invoice';
  newClientField.hidden = type !== 'client';
  clientSelect.required = type === 'invoice';
  newClientField.querySelector('input').required = type === 'client';
  form.amount.required = type !== 'client';
  form.reset();
  if (type === 'invoice') populateClients();
  (type === 'client' ? newClientField.querySelector('input') : clientSelect).focus();
};

document.querySelectorAll('[data-modal]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.modal)));
document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (entryType === 'client') {
    const clients = getClients();
    clients.unshift(data.newClientName);
    localStorage.setItem('it-ant-clients', JSON.stringify([...new Set(clients)]));
    data.name = data.newClientName;
  } else {
    data.name = data.client;
  }
  const entries = JSON.parse(localStorage.getItem('it-ant-entries') || '[]');
  entries.unshift({ ...data, type: entryType, createdAt: new Date().toISOString() });
  localStorage.setItem('it-ant-entries', JSON.stringify(entries));
  renderEntry(data);
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
