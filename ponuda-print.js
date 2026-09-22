const db = window.itAntSupabase;
const page = document.querySelector('#invoice-page');
const money = value => `${Number(value || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const date = value => { if (!value) return '—'; const d = new Date(`${value}T00:00:00`); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const vatLabel = item => item.vat_treatment === 'exempt_right' ? 'Oslobođeno + pravo' : item.vat_treatment === 'exempt_no' ? 'Oslobođeno bez prava' : `${Number(item.vat_rate || 0)}%`;

async function load() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { page.innerHTML = '<p class="error">Ponuda nije izabrana.</p>'; return; }
  const { data: offer, error } = await db.from('offers').select('id,number,status,issue_date,valid_until,payment_terms,delivery_terms,notes,subtotal,total,vat_amount,tax_regime,clients(name,pib,mb,address,invoice_email),offer_items(description,quantity,unit,unit_price,line_total,vat_rate,vat_treatment,vat_amount)').eq('id', id).single();
  if (error || !offer) { page.innerHTML = `<p class="error">Ponuda nije moguće učitati: ${esc(error?.message)}</p>`; return; }
  await window.itAntContextReady;
  const { data: membership } = await db.from('company_users').select('companies(name,pib,address,bank_name,bank_account,tax_regime)').eq('company_id', window.itAntActiveCompanyId).single();
  const company = membership?.companies || {};
  const vatEnabled = offer.tax_regime === 'books_vat';
  const items = offer.offer_items || [];
  const header = `<header class="invoice-head"><div class="issuer"><img class="logo" src="Logo-Transparent.png" alt="IT ANT"><h1>${esc(company.name || 'Preduzeće')}</h1></div><div class="company-details"><p>Adresa: ${esc(company.address || '—')}</p><p>PIB: ${esc(company.pib || '—')} | MB: ${esc(company.mb || '—')}</p><p>Tekući račun: ${esc(company.bank_account || '—')}</p></div></header>`;
  const parties = `<section class="parties"><div class="invoice-data"><p class="invoice-number">PONUDA br: ${esc(offer.number)}</p><p>Mesto izdavanja: Beograd</p><p>Datum izdavanja: ${date(offer.issue_date)}</p><p>Važi do: ${date(offer.valid_until)}</p></div><div class="recipient"><h3>${esc(offer.clients?.name || '—')}</h3><p>PIB: ${esc(offer.clients?.pib || '—')}</p><p>MB: ${esc(offer.clients?.mb || '—')}</p><p>Adresa: ${esc(offer.clients?.address || '—')}</p></div></section>`;
  const table = `<table class="items"><thead><tr><th>RB</th><th>Opis stavke</th><th class="num">Količina</th><th>Jedinica</th><th class="num">Cena</th>${vatEnabled ? '<th>PDV</th>' : ''}<th class="num">Ukupno</th></tr></thead><tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.description)}</td><td class="num">${item.quantity}</td><td>${esc(item.unit || 'kom')}</td><td class="num">${money(item.unit_price)}</td>${vatEnabled ? `<td>${vatLabel(item)}</td>` : ''}<td class="num">${money(item.line_total ?? Number(item.quantity) * Number(item.unit_price) + Number(item.vat_amount || 0))}</td></tr>`).join('')}</tbody></table>`;
  const totals = `<table class="totals"><tr><td>Osnovica:</td><td>${money(offer.subtotal)}</td></tr>${vatEnabled ? `<tr><td>PDV:</td><td>${money(offer.vat_amount)}</td></tr>` : ''}<tr><td>Ukupno:</td><td>${money(offer.total)}</td></tr></table>`;
  const notes = `${offer.payment_terms ? `<p class="notes"><strong>Uslovi plaćanja:</strong> ${esc(offer.payment_terms)}</p>` : ''}${offer.delivery_terms ? `<p class="notes"><strong>Uslovi isporuke:</strong> ${esc(offer.delivery_terms)}</p>` : ''}${offer.notes ? `<p class="notes"><strong>Napomena:</strong> ${esc(offer.notes)}</p>` : ''}`;
  const footer = pageNumber => `<div>Ponuda broj ${esc(offer.number)} · ${esc(company.name || 'Preduzeće')} · strana ${pageNumber}/__PAGES__</div><div>Ova ponuda je informativnog karaktera i ne predstavlja obavezu do njenog prihvatanja.</div><div>Dokument je generisan iz aplikacije IT ANT Poslovanje.</div>`;
  page.innerHTML = `<div class="toolbar"><button type="button" onclick="window.print()">Štampaj / Sačuvaj kao PDF</button></div><section class="sheet page-sheet">${header}<div class="invoice-title"><h2>Ponuda</h2></div>${parties}${table}${totals}${notes}<footer class="footer"></footer></section>`;
  const originalSheet = page.querySelector('.sheet');
  const originalTable = originalSheet.querySelector('.items');
  const originalRows = [...originalTable.querySelectorAll('tbody tr')];
  const originalFooter = originalSheet.querySelector('.footer');
  const rowsPerPage = 12;
  const pageCount = Math.max(1, Math.ceil(originalRows.length / rowsPerPage));
  originalSheet.remove();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const sheet = document.createElement('section'); sheet.className = 'sheet page-sheet';
    if (pageNumber === 1) { sheet.insertAdjacentHTML('beforeend', header + '<div class="invoice-title"><h2>Ponuda</h2></div>' + parties); }
    else { sheet.innerHTML = `<p class="continuation-title">Ponuda broj ${esc(offer.number)} · nastavak</p>`; }
    const currentTable = originalTable.cloneNode(true); currentTable.querySelector('tbody').replaceChildren(...originalRows.slice((pageNumber - 1) * rowsPerPage, pageNumber * rowsPerPage).map(row => row.cloneNode(true))); sheet.append(currentTable);
    if (pageNumber === pageCount) { sheet.insertAdjacentHTML('beforeend', totals + notes); }
    const currentFooter = originalFooter.cloneNode(false); currentFooter.innerHTML = footer(pageNumber).replace('__PAGES__', pageCount); sheet.append(currentFooter); page.append(sheet);
  }
}
window.addEventListener('beforeprint', () => document.querySelector('.toolbar')?.setAttribute('data-print-hidden', 'true'));
window.addEventListener('afterprint', () => document.querySelector('.toolbar')?.removeAttribute('data-print-hidden'));
load();
