const entryKey = 'it-ant-entries';
const list = document.querySelector('#invoice-module-list');
const filter = document.querySelector('#status-filter');
const detail = document.querySelector('#invoice-detail');
const detailTitle = document.querySelector('#detail-title');
const detailContent = document.querySelector('#detail-content');
const formatRsd = value => `${Number(value || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const formatDate = value => { const date = new Date(value); return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`; };
const makeId = () => window.crypto?.randomUUID?.() || `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const invoiceYear = entry => new Date(entry.createdAt || Date.now()).getFullYear();
function getInvoices() {
  const entries = JSON.parse(localStorage.getItem(entryKey) || '[]');
  let changed = false;
  const counters = {};
  entries.filter(entry => entry.type === 'invoice').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(entry => { const year = invoiceYear(entry); const match = entry.number?.match(/^R-(\d+)-(\d{2})$/); if (match) counters[year] = Math.max(counters[year] || 0, Number(match[1])); });
  entries.forEach(entry => { if (!entry.id) { entry.id = makeId(); changed = true; } if (entry.type === 'invoice' && !entry.number) { const year = invoiceYear(entry); entry.number = `R-${String((counters[year] || 0) + 1).padStart(3, '0')}-${String(year).slice(-2)}`; counters[year] = (counters[year] || 0) + 1; changed = true; } });
  if (changed) localStorage.setItem(entryKey, JSON.stringify(entries));
  return entries.filter(entry => entry.type === 'invoice');
}
let openInvoiceId = null;

function renderInvoices() {
  const invoices = getInvoices().filter(invoice => filter.value === 'all' || invoice.status === filter.value);
  list.innerHTML = invoices.length ? invoices.map(invoice => `<tr><td><strong>${invoice.number}</strong></td><td>${invoice.name}</td><td>${formatDate(invoice.createdAt)}</td><td>${invoice.items?.length || 0}</td><td>${formatRsd(invoice.amount)}</td><td><span class="badge ${invoice.status === 'paid' ? 'paid' : 'pending'}">${invoice.status === 'paid' ? 'Plaćen' : 'Čeka uplatu'}</span></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">Nema računa za izabrani status.</td></tr>';
  list.querySelectorAll('tr').forEach((row, index) => row.addEventListener('click', () => { const invoice = invoices[index]; if (openInvoiceId === invoice.id && !detail.hidden) { detail.hidden = true; openInvoiceId = null; } else showDetail(invoice); }));
}

function showDetail(invoice) {
  detail.hidden = false;
  openInvoiceId = invoice.id;
  detailTitle.textContent = `${invoice.number} · ${invoice.name} · ${formatRsd(invoice.amount)}`;
  detailContent.innerHTML = `<div class="detail-meta"><span>Status <select id="detail-status"><option value="paid" ${invoice.status === 'paid' ? 'selected' : ''}>Plaćen</option><option value="pending" ${invoice.status === 'pending' ? 'selected' : ''}>Čeka uplatu</option></select></span><span>Datum: <strong>${formatDate(invoice.createdAt)}</strong></span></div><div class="table-wrap"><table><thead><tr><th>Opis usluge</th><th>Količina</th><th>Cena</th><th>Ukupno</th></tr></thead><tbody>${(invoice.items || []).map(item => `<tr><td>${item.description}</td><td>${item.quantity}</td><td>${formatRsd(item.price)}</td><td>${formatRsd(item.quantity * item.price)}</td></tr>`).join('')}</tbody></table></div>`;
  document.querySelector('#detail-status').addEventListener('change', event => updateStatus(invoice.id, event.target.value));
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

filter.addEventListener('change', renderInvoices);
document.querySelector('#close-detail').addEventListener('click', () => { detail.hidden = true; openInvoiceId = null; });
function updateStatus(id, status) { const entries = JSON.parse(localStorage.getItem(entryKey) || '[]'); const invoice = entries.find(entry => entry.id === id); if (!invoice) return; invoice.status = status; localStorage.setItem(entryKey, JSON.stringify(entries)); renderInvoices(); showDetail(invoice); }
renderInvoices();
