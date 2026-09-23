const db = window.itAntSupabase;
const list = document.querySelector('#kpo-list');
const yearSelect = document.querySelector('#kpo-year');
const searchInput = document.querySelector('#kpo-search');
const modulePanel = document.querySelector('#kpo-module');
const unavailablePanel = document.querySelector('#kpo-unavailable');
const regimeNote = document.querySelector('#kpo-regime-note');
const formatRsd = value => `${Number(value || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const formatDate = value => { if (!value) return '—'; const date = new Date(`${value}T00:00:00`); return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const signedClass = value => Number(value) < 0 ? 'cancelled' : 'paid';
let entries = [];

function makeEntries(invoices) {
  return invoices.flatMap(invoice => {
    const original = { id: `${invoice.id}-original`, issue_date: invoice.issue_date, number: invoice.number, client: invoice.clients?.name || '—', description: 'Račun', amount: Number(invoice.total || 0), status: invoice.status === 'cancelled' ? 'Storniran račun' : 'Račun', sortOrder: 0 };
    if (invoice.status !== 'cancelled') return [original];
    return [original, { ...original, id: `${invoice.id}-cancel`, number: `Storno ${invoice.number}`, description: `Storno računa ${invoice.number}`, amount: -Math.abs(Number(invoice.total || 0)), status: 'Korekcija storna', sortOrder: 1 }];
  }).sort((a, b) => `${a.issue_date}-${a.sortOrder}`.localeCompare(`${b.issue_date}-${b.sortOrder}`));
}

function renderYears() {
  const years = [...new Set(entries.map(entry => Number(String(entry.issue_date).slice(0, 4)).toString()))].filter(Boolean).sort((a, b) => Number(b) - Number(a));
  const current = String(new Date().getFullYear());
  yearSelect.innerHTML = years.length ? years.map(year => `<option value="${year}">${year}</option>`).join('') : `<option value="${current}">${current}</option>`;
  yearSelect.value = years.includes(current) ? current : years[0] || current;
}

function render() {
  const year = yearSelect.value;
  const term = searchInput.value.trim().toLocaleLowerCase('sr');
  const visible = entries.filter(entry => String(entry.issue_date || '').startsWith(year) && (!term || `${entry.number} ${entry.client} ${entry.description}`.toLocaleLowerCase('sr').includes(term)));
  const total = visible.reduce((sum, entry) => sum + entry.amount, 0);
  document.querySelector('#kpo-total').textContent = formatRsd(total);
  document.querySelector('#kpo-count').textContent = `${visible.length} ${visible.length === 1 ? 'stavka' : 'stavki'}`;
  document.querySelector('#kpo-invoice-count').textContent = visible.filter(entry => entry.sortOrder === 0).length;
  document.querySelector('#kpo-cancel-count').textContent = visible.filter(entry => entry.sortOrder === 1).length;
  list.innerHTML = visible.length ? visible.map((entry, index) => `<tr><td>${index + 1}</td><td>${formatDate(entry.issue_date)}</td><td><strong>${escapeHtml(entry.number)}</strong></td><td>${escapeHtml(entry.client)}</td><td>${escapeHtml(entry.description)}</td><td class="${signedClass(entry.amount)}">${formatRsd(entry.amount)}</td><td><span class="badge ${signedClass(entry.amount)}">${escapeHtml(entry.status)}</span></td></tr>`).join('') : '<tr><td colspan="7" class="empty-state">Nema računa za izabranu godinu.</td></tr>';
}

async function load() {
  try {
    await window.itAntContextReady;
    const { data: company, error: companyError } = await db.from('company_users').select('company_id,companies(name,tax_regime)').eq('company_id', window.itAntActiveCompanyId).single();
    if (companyError) throw companyError;
    if (company.companies?.tax_regime !== 'pausal') { modulePanel.hidden = true; unavailablePanel.hidden = false; regimeNote.textContent = 'KPO važi samo za paušalce.'; return; }
    regimeNote.textContent = 'Računi se automatski evidentiraju po datumu prometa.';
    const { data, error } = await db.from('invoices').select('id,number,status,total,issue_date,clients(name)').order('issue_date', { ascending: true });
    if (error) throw error;
    entries = makeEntries(data || []);
    renderYears();
    render();
  } catch (error) {
    list.innerHTML = `<tr><td colspan="7" class="empty-state">KPO nije učitan: ${escapeHtml(error.message)}</td></tr>`;
  }
}

yearSelect.addEventListener('change', render);
searchInput.addEventListener('input', render);
document.querySelector('#print-kpo').addEventListener('click', () => window.print());
document.querySelector('#export-kpo').addEventListener('click', () => {
  const year = yearSelect.value;
  const rows = entries.filter(entry => String(entry.issue_date || '').startsWith(year));
  const csv = [['Rb.', 'Datum prometa', 'Broj dokumenta', 'Komitent', 'Opis', 'Iznos RSD', 'Status'], ...rows.map((entry, index) => [index + 1, formatDate(entry.issue_date), entry.number, entry.client, entry.description, entry.amount.toFixed(2), entry.status])].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = `KPO-${year}.csv`; link.click(); URL.revokeObjectURL(link.href);
});
load();
