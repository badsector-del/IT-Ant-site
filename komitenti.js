const storageKey = 'it-ant-clients';
const db = window.itAntSupabase;
const modal = document.querySelector('#modal');
const form = document.querySelector('#komitent-form');
const list = document.querySelector('#komitent-list');
const count = document.querySelector('#record-count');
const formTitle = document.querySelector('#form-title');
let clients = [];
let editingId = null;
let companyId = null;
const clientSearch = document.createElement('div');
clientSearch.className = 'search-controls';
clientSearch.innerHTML = '<label>Pretraži<input type="search" id="client-search" placeholder="Unesite pojam"></label><label>Po čemu<select id="client-search-field"><option value="name">Naziv</option><option value="pib">PIB</option><option value="mb">MB</option><option value="address">Adresa</option><option value="invoice_email">Email</option></select></label>';
document.querySelector('.clients-module .panel-heading').append(clientSearch);
const clientSearchInput = document.querySelector('#client-search');
const clientSearchField = document.querySelector('#client-search-field');
const initials = name => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

async function loadClients() {
  await window.itAntContextReady;
  const { data: membership, error: membershipError } = await db.from('company_users').select('company_id').eq('company_id', window.itAntActiveCompanyId).single();
  if (membershipError) { list.innerHTML = `<tr><td colspan="6" class="empty-state">Korisnik nije povezan sa preduzećem.</td></tr>`; return; }
  companyId = membership.company_id;
  const { data, error } = await db.from('clients').select('*').order('created_at', { ascending: true });
  if (error) { list.innerHTML = `<tr><td colspan="6" class="empty-state">Greška pri učitavanju baze: ${error.message}</td></tr>`; return; }
  if (!data.length) await migrateLocalClients(); else clients = data;
  renderClients();
}

async function migrateLocalClients() {
  const local = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (!local.length) { clients = []; return; }
  const rows = local.map(client => ({ company_id: companyId, name: client.name, pib: client.pib || null, mb: client.mb || null, address: client.address || null, invoice_email: client.email || client.invoice_email || null }));
  const { data, error } = await db.from('clients').insert(rows).select('*');
  clients = error ? [] : data;
}

function renderClients() {
  count.textContent = `${clients.length} ${clients.length === 1 ? 'komitent' : 'komitenata'}`;
  const term = clientSearchInput.value.trim().toLocaleLowerCase('sr');
  const field = clientSearchField.value;
  const visible = clients.filter(client => !term || String(client[field] ?? '').toLocaleLowerCase('sr').includes(term));
  list.innerHTML = visible.length ? visible.map(client => `<tr><td><strong><span class="table-avatar">${initials(client.name)}</span>${client.name}</strong></td><td>${client.pib || '—'}</td><td>${client.mb || '—'}</td><td>${client.address || '—'}</td><td>${client.invoice_email || '—'}</td><td class="row-actions"><button class="table-action" data-edit="${client.id}">Izmeni</button><button class="table-action danger" data-delete="${client.id}">Obriši</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">Nema komitenata za izabranu pretragu.</td></tr>';
}

clientSearchInput.addEventListener('input', renderClients);
clientSearchField.addEventListener('change', renderClients);

function openNewClientModal() { editingId = null; formTitle.textContent = 'Novi komitent'; modal.hidden = false; form.reset(); form.name.focus(); }
document.querySelector('#new-client-button').addEventListener('click', openNewClientModal);
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
  const row = { company_id: companyId, name: values.name, pib: values.pib || null, mb: values.mb || null, address: values.address || null, invoice_email: values.email || null };
  const result = editingId ? await db.from('clients').update(row).eq('id', editingId).select('*').single() : await db.from('clients').insert(row).select('*').single();
  if (result.error) { alert(`Komitent nije sačuvan: ${result.error.message}`); return; }
  if (editingId) clients = clients.map(client => client.id === editingId ? result.data : client); else clients.push(result.data);
  renderClients(); modal.hidden = true;
});
loadClients().then(() => {
  if (companyId && new URLSearchParams(window.location.search).get('new') === '1') openNewClientModal();
});
