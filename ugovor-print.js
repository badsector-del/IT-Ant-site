const db = window.itAntSupabase;
const page = document.querySelector('#invoice-page');
const money = value => `${Number(value || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const date = value => { if (!value) return '—'; const d = new Date(`${value}T00:00:00`); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const status = value => ({ active: 'Aktivan', potential: 'Potencijalan', closed: 'Zatvoren' }[value] || value);
async function load() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return page.innerHTML = '<p class="error">Ugovor nije izabran.</p>';
  const { data: contract, error } = await db.from('contracts').select('id,number,signature_date,duration_type,end_date,status,billing_type,monthly_subtotal,vat_rate,vat_amount,monthly_total,tax_regime,item_prefix,notes,clients(name,pib,mb,address,invoice_email)').eq('id', id).single();
  if (error || !contract) return page.innerHTML = `<p class="error">Ugovor nije moguće učitati: ${esc(error?.message)}</p>`;
  await window.itAntContextReady;
  const { data: membership } = await db.from('company_users').select('companies(name,pib,mb,address,bank_account,tax_regime)').eq('company_id', window.itAntActiveCompanyId).single();
  const company = membership?.companies || {};
  const vatEnabled = contract.tax_regime === 'books_vat';
  const header = `<header class="invoice-head"><div class="issuer"><img class="logo" src="Logo-Transparent.png" alt="IT ANT"><h1>${esc(company.name || 'Preduzeće')}</h1></div><div class="company-details"><p>Adresa: ${esc(company.address || '—')}</p><p>PIB: ${esc(company.pib || '—')} | MB: ${esc(company.mb || '—')}</p><p>Tekući račun: ${esc(company.bank_account || '—')}</p></div></header>`;
  const parties = `<section class="parties"><div class="invoice-data"><p class="invoice-number">UGOVOR br: ${esc(contract.number)}</p><p>Datum potpisa: ${date(contract.signature_date)}</p><p>Trajanje: ${contract.duration_type === 'definite' ? `do ${date(contract.end_date)}` : 'neodređeno'}</p><p>Status: ${status(contract.status)}</p></div><div class="recipient"><h3>${esc(contract.clients?.name || '—')}</h3><p>PIB: ${esc(contract.clients?.pib || '—')}</p><p>MB: ${esc(contract.clients?.mb || '—')}</p><p>Adresa: ${esc(contract.clients?.address || '—')}</p></div></section>`;
  const table = `<table class="items"><thead><tr><th>Opis</th><th class="num">Osnovica</th>${vatEnabled ? '<th>PDV</th><th class="num">PDV iznos</th>' : ''}<th class="num">Mesečno ukupno</th></tr></thead><tbody><tr><td>${esc(contract.item_prefix || 'Ugovorene usluge')}</td><td class="num">${money(contract.monthly_subtotal)}</td>${vatEnabled ? `<td>${Number(contract.vat_rate || 0)}%</td><td class="num">${money(contract.vat_amount)}</td>` : ''}<td class="num">${money(contract.monthly_total)}</td></tr></tbody></table>`;
  const notes = `${contract.billing_type === 'fixed' ? '<p class="notes"><strong>Obračun:</strong> Isti iznos svakog meseca.</p>' : '<p class="notes"><strong>Obračun:</strong> Promenljiv iznos po dogovorenom planu.</p>'}${contract.notes ? `<p class="notes"><strong>Napomena:</strong> ${esc(contract.notes)}</p>` : ''}`;
  page.innerHTML = `<div class="toolbar"><button type="button" onclick="window.print()">Štampaj / Sačuvaj kao PDF</button></div><section class="sheet page-sheet">${header}<div class="invoice-title"><h2>Ugovor</h2></div>${parties}${table}${notes}<footer class="footer"><div>Ugovor broj ${esc(contract.number)} · ${esc(company.name || 'Preduzeće')}</div><div>Dokument je generisan iz aplikacije IT ANT Poslovanje.</div></footer></section>`;
}
window.addEventListener('beforeprint', () => document.querySelector('.toolbar')?.setAttribute('data-print-hidden', 'true'));
load();
