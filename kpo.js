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
let taxRegime = 'pausal';

function invoiceEntries(invoices) {
  return invoices.flatMap(invoice => {
    const original = { id: `${invoice.id}-original`, issue_date: invoice.issue_date, number: invoice.number, partner: invoice.clients?.name || '—', description: 'Izlazni račun', base: Number(invoice.subtotal || invoice.total || 0), vat: Number(invoice.vat_amount || 0), total: Number(invoice.total || 0), kind: 'Izlazni račun', sortOrder: 0 };
    if (invoice.status !== 'cancelled') return [original];
    return [original, { ...original, id: `${invoice.id}-cancel`, number: `Storno ${invoice.number}`, description: `Storno računa ${invoice.number}`, base: -Math.abs(original.base), vat: -Math.abs(original.vat), total: -Math.abs(original.total), kind: 'Korekcija storna', sortOrder: 1 }];
  });
}

function expenseEntries(expenses) {
  return expenses.map(expense => ({ id: expense.id, issue_date: expense.expense_date, number: expense.invoice_number || '—', partner: expense.supplier || '—', description: expense.description || 'Ulazni račun', base: Number(expense.subtotal || expense.amount || 0), vat: Number(expense.vat_amount || 0), total: Number(expense.amount || 0), kind: 'Ulazni račun', sortOrder: 0 }));
}

function setView() {
  const vat = taxRegime === 'books_vat';
  document.querySelector('#evidence-title').textContent = vat ? 'PDV evidencija' : 'KPO';
  document.querySelector('#evidence-copy').textContent = vat ? 'Evidencija izlaznih i ulaznih računa za obračun PDV-a.' : 'Knjiga o ostvarenom prometu paušalno oporezovanih obveznika.';
  regimeNote.textContent = vat ? 'Prikazani su izlazni računi i troškovi sa evidentiranim PDV-om.' : 'Računi se automatski evidentiraju po datumu prometa.';
  document.querySelector('#kpo-total').previousElementSibling.querySelector('span').textContent = vat ? 'PDV za uplatu' : 'Ukupan promet';
  document.querySelector('#kpo-invoice-count').previousElementSibling.querySelector('span').textContent = vat ? 'Izlazni PDV' : 'Računi';
  document.querySelector('#kpo-cancel-count').previousElementSibling.querySelector('span').textContent = vat ? 'Ulazni PDV' : 'Storna';
  document.querySelector('#kpo-invoice-count').nextElementSibling.textContent = vat ? 'obračunati PDV' : 'izdatih dokumenata';
  document.querySelector('#kpo-cancel-count').nextElementSibling.textContent = vat ? 'prethodni PDV' : 'korektivnih stavki';
  document.querySelector('#kpo-list').previousElementSibling.innerHTML = vat ? '<tr><th>Rb.</th><th>Datum</th><th>Broj dokumenta</th><th>Partner</th><th>Opis</th><th>Osnovica</th><th>PDV</th><th>Ukupno</th><th>Vrsta</th></tr>' : '<tr><th>Rb.</th><th>Datum prometa</th><th>Broj dokumenta</th><th>Komitent</th><th>Opis</th><th>Iznos</th><th>Status</th></tr>';
}

function renderYears() {
  const years = [...new Set(entries.map(entry => String(entry.issue_date || '').slice(0, 4)))].filter(Boolean).sort((a, b) => Number(b) - Number(a));
  const current = String(new Date().getFullYear());
  yearSelect.innerHTML = years.length ? years.map(year => `<option value="${year}">${year}</option>`).join('') : `<option value="${current}">${current}</option>`;
  yearSelect.value = years.includes(current) ? current : years[0] || current;
}

function render() {
  const year = yearSelect.value;
  const term = searchInput.value.trim().toLocaleLowerCase('sr');
  const visible = entries.filter(entry => String(entry.issue_date || '').startsWith(year) && (!term || `${entry.number} ${entry.partner} ${entry.description}`.toLocaleLowerCase('sr').includes(term)));
  const total = visible.reduce((sum, entry) => sum + entry.total, 0);
  const outputVat = visible.filter(entry => entry.kind !== 'Ulazni račun').reduce((sum, entry) => sum + entry.vat, 0);
  const inputVat = visible.filter(entry => entry.kind === 'Ulazni račun').reduce((sum, entry) => sum + entry.vat, 0);
  document.querySelector('#kpo-total').textContent = formatRsd(taxRegime === 'books_vat' ? outputVat - inputVat : total);
  document.querySelector('#kpo-count').textContent = `${visible.length} ${visible.length === 1 ? 'stavka' : 'stavki'}`;
  document.querySelector('#kpo-invoice-count').textContent = taxRegime === 'books_vat' ? formatRsd(outputVat) : visible.filter(entry => entry.kind !== 'Korekcija storna').length;
  document.querySelector('#kpo-cancel-count').textContent = taxRegime === 'books_vat' ? formatRsd(inputVat) : visible.filter(entry => entry.kind === 'Korekcija storna').length;
  list.innerHTML = visible.length ? visible.map((entry, index) => taxRegime === 'books_vat' ? `<tr><td>${index + 1}</td><td>${formatDate(entry.issue_date)}</td><td><strong>${escapeHtml(entry.number)}</strong></td><td>${escapeHtml(entry.partner)}</td><td>${escapeHtml(entry.description)}</td><td>${formatRsd(entry.base)}</td><td class="${signedClass(entry.vat)}">${formatRsd(entry.vat)}</td><td>${formatRsd(entry.total)}</td><td><span class="badge ${signedClass(entry.total)}">${escapeHtml(entry.kind)}</span></td></tr>` : `<tr><td>${index + 1}</td><td>${formatDate(entry.issue_date)}</td><td><strong>${escapeHtml(entry.number)}</strong></td><td>${escapeHtml(entry.partner)}</td><td>${escapeHtml(entry.description)}</td><td class="${signedClass(entry.total)}">${formatRsd(entry.total)}</td><td><span class="badge ${signedClass(entry.total)}">${escapeHtml(entry.kind)}</span></td></tr>`).join('') : `<tr><td colspan="${taxRegime === 'books_vat' ? 9 : 7}" class="empty-state">Nema podataka za izabranu godinu.</td></tr>`;
}

async function load() {
  try {
    await window.itAntContextReady;
    const { data: company, error: companyError } = await db.from('company_users').select('company_id,companies(name,tax_regime)').eq('company_id', window.itAntActiveCompanyId).single();
    if (companyError) throw companyError;
    taxRegime = company.companies?.tax_regime || 'pausal';
    if (!['pausal', 'books_vat'].includes(taxRegime)) { modulePanel.hidden = true; unavailablePanel.hidden = false; regimeNote.textContent = 'Za izabrani poreski režim evidencija još nije dostupna.'; return; }
    const invoiceQuery = db.from('invoices').select('id,number,status,total,subtotal,vat_amount,issue_date,clients(name)').order('issue_date', { ascending: true });
    const expenseQuery = taxRegime === 'books_vat' ? db.from('expenses').select('id,supplier,invoice_number,expense_date,description,amount,subtotal,vat_amount').order('expense_date', { ascending: true }) : Promise.resolve({ data: [], error: null });
    const [{ data: invoices, error: invoiceError }, { data: expenses, error: expenseError }] = await Promise.all([invoiceQuery, expenseQuery]);
    if (invoiceError) throw invoiceError;
    if (expenseError) throw expenseError;
    entries = [...invoiceEntries(invoices || []), ...expenseEntries(expenses || [])].sort((a, b) => `${a.issue_date}-${a.sortOrder}`.localeCompare(`${b.issue_date}-${b.sortOrder}`));
    setView();
    renderYears();
    render();
  } catch (error) { list.innerHTML = `<tr><td colspan="9" class="empty-state">Evidencija nije učitana: ${escapeHtml(error.message)}</td></tr>`; }
}

yearSelect.addEventListener('change', render);
searchInput.addEventListener('input', render);
document.querySelector('#print-kpo').addEventListener('click', () => window.print());
document.querySelector('#export-kpo').addEventListener('click', () => {
  const year = yearSelect.value;
  const rows = entries.filter(entry => String(entry.issue_date || '').startsWith(year));
  const csv = [['Rb.', 'Datum', 'Broj dokumenta', 'Partner', 'Opis', 'Osnovica', 'PDV', 'Ukupno', 'Vrsta'], ...rows.map((entry, index) => [index + 1, formatDate(entry.issue_date), entry.number, entry.partner, entry.description, entry.base.toFixed(2), entry.vat.toFixed(2), entry.total.toFixed(2), entry.kind])].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = `Poreske-evidencije-${year}.csv`; link.click(); URL.revokeObjectURL(link.href);
});
load();
