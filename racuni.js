const db = window.itAntSupabase;
const list = document.querySelector('#invoice-module-list');
const filter = document.querySelector('#status-filter');
const detail = document.querySelector('#invoice-detail');
const detailTitle = document.querySelector('#detail-title');
const detailContent = document.querySelector('#detail-content');
const formatRsd = value => `${Number(value || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const formatDate = value => { const date = new Date(value); return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`; };
let invoices = [];
let openInvoiceId = null;

async function getRemoteInvoices() {
  const { data, error } = await db.from('invoices').select('id,number,status,total,issue_date,notes,clients(name),invoice_items(description,quantity,unit_price,line_total)').order('issue_date', { ascending: false });
  if (error) throw error;
  return data.map(invoice => ({ ...invoice, name: invoice.clients?.name || 'Nepoznat komitent', amount: invoice.total, createdAt: invoice.issue_date, items: (invoice.invoice_items || []).map(item => ({ description: item.description, quantity: item.quantity, price: item.unit_price })) }));
}

async function migrateLocalInvoices() {
  if (localStorage.getItem('it-ant-invoices-migrated')) return;
  const local = JSON.parse(localStorage.getItem('it-ant-entries') || '[]').filter(entry => entry.type === 'invoice');
  if (!local.length) { localStorage.setItem('it-ant-invoices-migrated', '1'); return; }
  const { data: clients, error: clientsError } = await db.from('clients').select('id,name');
  if (clientsError) throw clientsError;
  const { data: membership, error: membershipError } = await db.from('company_users').select('company_id').limit(1).single();
  if (membershipError) throw membershipError;
  const clientByName = new Map(clients.map(client => [client.name, client.id]));
  for (const entry of [...local].reverse()) {
    const clientId = clientByName.get(entry.name || entry.client);
    if (!clientId) continue;
    const { data: number, error: numberError } = await db.rpc('next_invoice_number');
    if (numberError) throw numberError;
    const { data: invoice, error: invoiceError } = await db.from('invoices').insert({ company_id: membership.company_id, client_id: clientId, number, status: entry.status || 'pending', total: Number(entry.amount || 0), issue_date: new Date(entry.createdAt || Date.now()).toISOString().slice(0, 10), notes: null }).select('id').single();
    if (invoiceError) throw invoiceError;
    const items = (entry.items || []).map(item => ({ invoice_id: invoice.id, description: item.description, quantity: Number(item.quantity || 1), unit_price: Number(item.price || 0) }));
    if (items.length) { const { error: itemError } = await db.from('invoice_items').insert(items); if (itemError) throw itemError; }
  }
  localStorage.setItem('it-ant-invoices-migrated', '1');
}

function renderInvoices() {
  const visible = invoices.filter(invoice => filter.value === 'all' || invoice.status === filter.value);
  list.innerHTML = visible.length ? visible.map(invoice => `<tr><td><strong>${invoice.number}</strong></td><td>${invoice.name}</td><td>${formatDate(invoice.createdAt)}</td><td>${invoice.items?.length || 0}</td><td>${formatRsd(invoice.amount)}</td><td><span class="badge ${invoice.status === 'paid' ? 'paid' : 'pending'}">${invoice.status === 'paid' ? 'Plaćen' : 'Čeka uplatu'}</span></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">Nema računa za izabrani status.</td></tr>';
  list.querySelectorAll('tr').forEach((row, index) => row.addEventListener('click', () => { const invoice = visible[index]; if (invoice && openInvoiceId === invoice.id && !detail.hidden) { detail.hidden = true; openInvoiceId = null; } else if (invoice) showDetail(invoice); }));
}

function showDetail(invoice) {
  detail.hidden = false; openInvoiceId = invoice.id;
  detailTitle.textContent = `${invoice.number} · ${invoice.name} · ${formatRsd(invoice.amount)}`;
  detailContent.innerHTML = `<div class="detail-meta"><span>Status <select id="detail-status"><option value="paid" ${invoice.status === 'paid' ? 'selected' : ''}>Plaćen</option><option value="pending" ${invoice.status === 'pending' ? 'selected' : ''}>Čeka uplatu</option></select></span><span>Datum: <strong>${formatDate(invoice.createdAt)}</strong></span></div><div class="table-wrap"><table><thead><tr><th>Opis usluge</th><th>Količina</th><th>Cena</th><th>Ukupno</th></tr></thead><tbody>${(invoice.items || []).map(item => `<tr><td>${item.description}</td><td>${item.quantity}</td><td>${formatRsd(item.price)}</td><td>${formatRsd(item.quantity * item.price)}</td></tr>`).join('')}</tbody></table></div>`;
  document.querySelector('#detail-status').addEventListener('change', event => updateStatus(invoice, event.target.value));
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function updateStatus(invoice, status) {
  const { error } = await db.from('invoices').update({ status }).eq('id', invoice.id);
  if (error) { alert(`Status nije promenjen: ${error.message}`); return; }
  invoice.status = status; renderInvoices(); showDetail(invoice);
}

async function load() {
  try { await migrateLocalInvoices(); invoices = await getRemoteInvoices(); renderInvoices(); }
  catch (error) { list.innerHTML = `<tr><td colspan="6" class="empty-state">Računi nisu učitani: ${error.message}</td></tr>`; }
}

filter.addEventListener('change', renderInvoices);
document.querySelector('#close-detail').addEventListener('click', () => { detail.hidden = true; openInvoiceId = null; });
load();
