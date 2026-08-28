const db = window.itAntSupabase;
const companyForm = document.querySelector('#company-form');
const userForm = document.querySelector('#user-form');
const companySelect = document.querySelector('#company-select');
const list = document.querySelector('#admin-list');
const count = document.querySelector('#admin-count');
const message = document.querySelector('#admin-message');

async function callAdmin(action, payload = {}) {
  const { data, error } = await db.functions.invoke('ADMIN-api', { body: { action, ...payload } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

function setMessage(text, error = false) { message.textContent = text; message.classList.toggle('warning-text', error); }

function render(data) {
  const companies = data.companies || [];
  count.textContent = `${companies.length} ${companies.length === 1 ? 'preduzeće' : 'preduzeća'}`;
  companySelect.innerHTML = '<option value="">Izaberite preduzeće</option>' + companies.map(company => `<option value="${company.id}">${company.name}</option>`).join('');
  list.innerHTML = companies.length ? companies.map(company => {
    const members = data.memberships.filter(member => member.company_id === company.id);
    return `<tr><td><strong>${company.name}</strong></td><td>${company.pib || '—'}</td><td>${members.length ? members.map(member => member.email).join('<br>') : 'Nema naloga'}</td><td>${members.length ? members.map(member => member.role).join('<br>') : '—'}</td></tr>`;
  }).join('') : '<tr><td colspan="4" class="empty-state">Još nema preduzeća.</td></tr>';
}

function renderUsers(data) {
  const userList = document.querySelector('#admin-user-list');
  const users = data.memberships || [];
  const companyOptions = (data.companies || []).map(company => `<option value="${company.id}">${company.name}</option>`).join('');
  userList.innerHTML = users.length ? users.map(member => `<tr><td>${member.email || member.user_id}</td><td><select class="user-company" data-user-id="${member.user_id}">${companyOptions}</select></td><td><input class="user-password" data-user-id="${member.user_id}" type="password" minlength="8" placeholder="Nova lozinka"></td><td><button class="table-action move-user" data-user-id="${member.user_id}" type="button">Promeni</button><button class="table-action reset-user" data-user-id="${member.user_id}" type="button">Resetuj</button><button class="table-action danger delete-user" data-user-id="${member.user_id}" type="button">Obriši</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">Još nema korisničkih naloga.</td></tr>';
  users.forEach(member => { const select = userList.querySelector(`select[data-user-id="${member.user_id}"]`); if (select) select.value = member.company_id; });
}

function renderLogs(logs = []) {
  const logList = document.querySelector('#admin-log-list');
  logList.innerHTML = logs.length ? logs.map(log => `<tr><td>${new Date(log.created_at).toLocaleString('sr-RS')}</td><td>${log.admin_email || 'Administrator'}</td><td>${log.action === 'create_company' ? 'Kreirano preduzeće' : 'Kreiran korisnički nalog'}</td><td>${log.details?.name || log.details?.email || '—'}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">Još nema administratorskih radnji.</td></tr>';
}

async function load() { try { const data = await callAdmin('list'); render(data); renderUsers(data); renderLogs(data.logs); } catch (error) { list.innerHTML = `<tr><td colspan="4" class="empty-state">${error.message}</td></tr>`; setMessage('Nemate administratorski pristup ili funkcija nije objavljena.', true); } }

document.querySelector('#admin-user-list').addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  const userId = button.dataset.userId;
  try {
    if (button.classList.contains('delete-user')) {
      if (!confirm('Obrisati ovaj korisnički nalog? Povezani podaci mogu biti obrisani zajedno sa nalogom.')) return;
      await callAdmin('delete-user', { user_id: userId }); setMessage('Korisnički nalog je obrisan.'); await load();
    } else if (button.classList.contains('move-user')) {
      const companyId = document.querySelector(`select[data-user-id="${userId}"]`).value;
      await callAdmin('move-user', { user_id: userId, company_id: companyId }); setMessage('Korisnik je prebačen u izabrano preduzeće.'); await load();
    } else {
      const passwordInput = document.querySelector(`input[data-user-id="${userId}"]`);
      if (!passwordInput.value) { setMessage('Unesi novu lozinku za resetovanje.', true); return; }
      await callAdmin('reset-password', { user_id: userId, password: passwordInput.value }); passwordInput.value = ''; setMessage('Lozinka je promenjena.'); await load();
    }
  } catch (error) { setMessage(error.message, true); }
});

companyForm.addEventListener('submit', async event => {
  event.preventDefault(); const values = Object.fromEntries(new FormData(companyForm));
  try { await callAdmin('create-company', { name: values.name, pib: values.pib }); companyForm.reset(); setMessage('Preduzeće je sačuvano.'); await load(); } catch (error) { setMessage(error.message, true); }
});

userForm.addEventListener('submit', async event => {
  event.preventDefault(); const values = Object.fromEntries(new FormData(userForm));
  try { await callAdmin('create-user', values); userForm.reset(); setMessage('Nalog je kreiran i povezan sa preduzećem.'); await load(); } catch (error) { setMessage(error.message, true); }
});

load();
