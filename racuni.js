const entryKey = 'it-ant-entries';
const clientKey = 'it-ant-clients';
const list = document.querySelector('#invoice-module-list');
const filter = document.querySelector('#status-filter');
const detail = document.querySelector('#invoice-detail');
const detailTitle = document.querySelector('#detail-title');
const detailContent = document.querySelector('#detail-content');
const formatRsd = value => `${Number(value || 0).toLocaleString('sr-RS')} RSD`;
const getInvoices = () => JSON.parse(localStorage.getItem(entryKey) || '[]').filter(entry => entry.type === 'invoice');

function renderInvoices() {
  const invoices = getInvoices().filter(invoice => filter.value === 'all' || invoice.status === filter.value);
  list.innerHTML = invoices.length ? invoices.map((invoice, index) => `<tr><td><strong>#${String(getInvoices().indexOf(invoice) + 1).padStart(3, '0')}/26</strong></td><td>${invoice.name}</td><td>${new Intl.DateTimeFormat('sr-RS', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(invoice.createdAt))}</td><td>${invoice.items?.length || 0}</td><td>${formatRsd(invoice.amount)}</td><td><span class="badge ${invoice.status === 'paid' ? 'paid' : 'pending'}">${invoice.status === 'paid' ? 'Plaćen' : 'Čeka uplatu'}</span></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">Nema računa za izabrani status.</td></tr>';
  list.querySelectorAll('tr').forEach((row, index) => row.addEventListener('click', () => showDetail(invoices[index])));
}

function showDetail(invoice) {
  detail.hidden = false;
  detailTitle.textContent = `${invoice.name} · ${formatRsd(invoice.amount)}`;
  detailContent.innerHTML = `<div class="detail-meta"><span>Status: <strong>${invoice.status === 'paid' ? 'Plaćen' : 'Čeka uplatu'}</strong></span><span>Datum: <strong>${new Intl.DateTimeFormat('sr-RS').format(new Date(invoice.createdAt))}</strong></span></div><div class="table-wrap"><table><thead><tr><th>Opis usluge</th><th>Količina</th><th>Cena</th><th>Ukupno</th></tr></thead><tbody>${(invoice.items || []).map(item => `<tr><td>${item.description}</td><td>${item.quantity}</td><td>${formatRsd(item.price)}</td><td>${formatRsd(item.quantity * item.price)}</td></tr>`).join('')}</tbody></table></div>`;
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

filter.addEventListener('change', renderInvoices);
document.querySelector('#close-detail').addEventListener('click', () => { detail.hidden = true; });
renderInvoices();
