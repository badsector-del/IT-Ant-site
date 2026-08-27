const storageKey = 'it-ant-clients';
const db = window.itAntSupabase;
const modal = document.querySelector('#modal');
const form = document.querySelector('#komitent-form');
const list = document.querySelector('#komitent-list');
const count = document.querySelector('#record-count');
const formTitle = document.querySelector('#form-title');
let clients = [];
let editingId = null;
const initials = name => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

async function loadClients() {
  const { data, error } = await db.from('clients').select('*').order('created_at', { ascending: true });
  if (error) { list.innerHTML = `<tr><td colspan="6" class="empty-state">Greška pri učitavanju baze: ${error.message}</td></tr>`; return; }
  if (!data.length) await migrateLocalClients(); else clients = data;
  renderClients();
}

async function migrateLocalClients() {
  const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (!local.length) { clients = []; return; }
  const rows = local.map(client => ({ name: client.name, pib: client.pib || null, mb: client.mb || null, address: client.address || null, invoice_email: client.email || client.invoice_email || null }));
  const { data, error } = await db.from('clients').insert(rows).select('*');
  clients = error ? [] : data;
}

function renderClients() {
  count.textContent = `${clients.length} ${clients.length === 1 ? 'komitent' : 'komitenata'}`;
  list.innerHTML = clients.length ? clients.map(client => `<tr><td><strong><span class="table-avatar">${initials(client.name)}</span>${client.name}</strong></td><td>${client.pib || '—'}</td><td>${client.mb || '—'}</td><td>${client.address || '—'}</td><td>${client.invoice_email || '—'}</td><td class="row-actions"><button class="table-action" data-edit="${client.id}">Izmeni</button><button class="table-action danger" data-delete="${client.id}">Obriši</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">Još nema unetih komitenata.</td></tr>';
}

document.querySelector('#new-client-button').addEventListener('click', () => { editingId = null; formTitle.textContent = 'Novi komitent'; modal.hidden = false; form.reset(); form.name.focus(); });
document.querySelector('.modal-close').addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
list.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  const client = clients.find(item => item.id === (button.dataset.edit || button.dataset.delete));
  if (!client) return;
  if (button.dataset.edit) {
    editingId = client.id; formTitle.textContent = 'Izmeni komitenta';
    form.name.value = client.name; form.pib.value = client.pib || ''; form.mb.value = client.mb || ''; form.address.value = client.address || ''; form.email.value = client.invoice_email || '';
    modal.hidden = false; form.name.focus();
  } else if (confirm(`Obrisati komitenta "${client.name}"?`)) {
    const { error } = await db.from('clients').delete().eq('id', client.id);
    if (!error) { clients = clients.filter(item => item.id !== client.id); renderClients(); }
  }
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const row = { name: values.name, pib: values.pib || null, mb: values.mb || null, address: values.address || null, invoice_email: values.email || null };
  const result = editingId ? await db.from('clients').update(row).eq('id', editingId).select('*').single() : await db.from('clients').insert(row).select('*').single();
  if (result.error) { alert(`Komitent nije sačuvan: ${result.error.message}`); return; }
  if (editingId) clients = clients.map(client => client.id === editingId ? result.data : client); else clients.push(result.data);
  renderClients(); modal.hidden = true;
});
loadClients();
