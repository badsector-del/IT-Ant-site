const storageKey = 'it-ant-clients';
const resetKey = 'it-ant-demo-reset-v2';
if (!localStorage.getItem(resetKey)) {
  localStorage.removeItem(storageKey);
  localStorage.removeItem('it-ant-entries');
  localStorage.setItem(resetKey, 'true');
}

const modal = document.querySelector('#modal');
const form = document.querySelector('#komitent-form');
const list = document.querySelector('#komitent-list');
const count = document.querySelector('#record-count');
const getClients = () => JSON.parse(localStorage.getItem(storageKey) || '[]');
const initials = name => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

function renderClients() {
  const clients = getClients();
  count.textContent = `${clients.length} ${clients.length === 1 ? 'komitent' : 'komitenata'}`;
  list.innerHTML = clients.length ? clients.map(client => `<tr><td><strong><span class="table-avatar">${initials(client.name)}</span>${client.name}</strong></td><td>${client.pib || '—'}</td><td>${client.mb || '—'}</td><td>${client.address || '—'}</td><td>${client.email || '—'}</td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">Još nema unetih komitenata.</td></tr>';
}

document.querySelector('#new-client-button').addEventListener('click', () => { modal.hidden = false; form.reset(); form.name.focus(); });
document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
form.addEventListener('submit', event => {
  event.preventDefault();
  const client = Object.fromEntries(new FormData(form));
  const clients = getClients();
  clients.push(client);
  localStorage.setItem(storageKey, JSON.stringify(clients));
  renderClients();
  modal.hidden = true;
});
renderClients();
