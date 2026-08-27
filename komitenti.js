const storageKey = 'it-ant-clients';
const modal = document.querySelector('#modal');
const form = document.querySelector('#komitent-form');
const list = document.querySelector('#komitent-list');
const count = document.querySelector('#record-count');
const formTitle = document.querySelector('#form-title');
const getClients = () => JSON.parse(localStorage.getItem(storageKey) || '[]');
const initials = name => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
let editingIndex = null;

function renderClients() {
  const clients = getClients();
  count.textContent = `${clients.length} ${clients.length === 1 ? 'komitent' : 'komitenata'}`;
  list.innerHTML = clients.length ? clients.map((client, index) => `<tr><td><strong><span class="table-avatar">${initials(client.name)}</span>${client.name}</strong></td><td>${client.pib || '—'}</td><td>${client.mb || '—'}</td><td>${client.address || '—'}</td><td>${client.email || '—'}</td><td class="row-actions"><button class="table-action" data-edit="${index}">Izmeni</button><button class="table-action danger" data-delete="${index}">Obriši</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">Još nema unetih komitenata.</td></tr>';
}

document.querySelector('#new-client-button').addEventListener('click', () => { editingIndex = null; formTitle.textContent = 'Novi komitent'; modal.hidden = false; form.reset(); form.name.focus(); });
document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
list.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const index = Number(button.dataset.edit ?? button.dataset.delete);
  const clients = getClients();
  if (button.dataset.edit !== undefined) {
    editingIndex = index;
    formTitle.textContent = 'Izmeni komitenta';
    Object.entries(clients[index]).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    modal.hidden = false;
    form.name.focus();
  } else if (confirm(`Obrisati komitenta "${clients[index].name}"?`)) {
    clients.splice(index, 1);
    localStorage.setItem(storageKey, JSON.stringify(clients));
    renderClients();
  }
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const client = Object.fromEntries(new FormData(form));
  const clients = getClients();
  if (editingIndex === null) clients.push(client);
  else clients[editingIndex] = client;
  localStorage.setItem(storageKey, JSON.stringify(clients));
  renderClients();
  modal.hidden = true;
});
renderClients();
