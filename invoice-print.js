const db = window.itAntSupabase;
const page = document.querySelector('#invoice-page');
const money = value => `${Number(value || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
const date = value => { const d = new Date(value); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
const esc = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const vatLabel = item => item.vat_treatment === 'exempt_right' ? 'Oslobođeno + pravo' : item.vat_treatment === 'exempt_no' ? 'Oslobođeno bez prava' : `${Number(item.vat_rate || 0)}%`;

async function load() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { page.innerHTML = '<p class="error">Račun nije izabran.</p>'; return; }
  const { data: invoice, error } = await db.from('invoices').select('id,number,status,issue_date,due_date,subtotal,total,vat_amount,tax_regime,notes,clients(name,pib,mb,address,invoice_email),invoice_items(description,quantity,unit_price,vat_rate,vat_treatment,vat_amount)').eq('id', id).single();
  if (error || !invoice) { page.innerHTML = `<p class="error">Račun nije moguće učitati: ${esc(error?.message)}</p>`; return; }
  const { data: membership } = await db.from('company_users').select('companies(name,pib,address,bank_name,bank_account,tax_regime,vat_number)').limit(1).single();
  const company = membership?.companies || {};
  const items = invoice.invoice_items || [];
  page.innerHTML = `<div class="toolbar"><button type="button" onclick="this.closest('.toolbar').setAttribute('data-print-hidden','true'); window.print()">Štampaj / Sačuvaj kao PDF</button></div><section class="sheet"><header class="invoice-head"><div class="issuer"><img class="logo" src="Logo-Transparent.png" alt="IT ANT"><h1>${esc(company.name || 'Preduzeće')}</h1></div><div class="company-details"><p>Adresa: ${esc(company.address || '—')}</p><p>Novi Beograd</p><p>PIB: ${esc(company.pib || '—')} | MB: ${esc(company.mb || '—')}</p><p>Email: ${esc(company.email || '—')}</p><p>Telefon: ${esc(company.phone || '—')}</p></div></header><div class="invoice-title"><h2>Račun</h2></div><section class="parties"><div class="invoice-data"><p class="party-label">Podaci o računu</p><p><strong>RAČUN br:</strong> ${esc(invoice.number)}</p><p>Mesto izdavanja: Beograd</p><p>Datum izdavanja: ${date(invoice.issue_date)}</p><p>Datum prometa: ${date(invoice.issue_date)}</p><p>Datum valute: ${invoice.due_date ? date(invoice.due_date) : date(invoice.issue_date)}</p></div><div class="recipient"><p class="party-label">Kupac</p><h3>${esc(invoice.clients?.name || '—')}</h3><p>PIB: ${esc(invoice.clients?.pib || '—')}</p><p>MB: ${esc(invoice.clients?.mb || '—')}</p><p>Adresa: ${esc(invoice.clients?.address || '—')}</p></div></section><table class="items"><thead><tr><th>RB</th><th>Opis usluge</th><th class="num">Količina</th><th class="num">Cena</th><th>PDV</th><th class="num">Ukupno</th></tr></thead><tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.description)}</td><td class="num">${item.quantity}</td><td class="num">${money(item.unit_price)}</td><td>${company.tax_regime === 'books_vat' ? vatLabel(item) : '—'}</td><td class="num">${money(Number(item.quantity) * Number(item.unit_price) + Number(item.vat_amount || 0))}</td></tr>`).join('')}</tbody></table><table class="totals"><tr><td>Osnovica:</td><td>${money(invoice.subtotal ?? invoice.total)}</td></tr>${company.tax_regime === 'books_vat' ? `<tr><td>PDV:</td><td>${money(invoice.vat_amount)}</td></tr>` : ''}<tr><td>Za uplatu:</td><td>${money(invoice.total)}</td></tr></table>${invoice.notes ? `<p class="notes"><strong>Napomena:</strong> ${esc(invoice.notes)}</p>` : ''}<footer class="footer">Dokument je generisan iz aplikacije IT ANT Poslovanje. Status računa: ${invoice.status === 'paid' ? 'Plaćen' : invoice.status === 'cancelled' ? 'Storniran' : 'Čeka uplatu'}</footer></section>`;
  const payment = `Uplatu izvršiti na račun ${esc(company.bank_name || '—')}, broj računa ${esc(company.bank_account || '—')} sa pozivom na broj fakture ${esc(invoice.number)}`;
  document.querySelector('.footer').innerHTML = `<div>Račun broj ${esc(invoice.number)} · ${esc(company.name || 'Preduzeće')} · strana <span class="page-counter">1/1</span></div>${company.tax_regime === 'books_vat' ? '' : '<div>Ne podleže obračunu i plaćanju poreza po Zakonu o PDV-u</div>'}<div>${payment}</div><div>Dokument je važeći bez potpisa</div>`;
  const companyDetails = document.querySelector('.company-details');
  companyDetails?.querySelector('p:nth-child(2)')?.remove();
  companyDetails?.insertAdjacentHTML('beforeend', `<p>Tekući račun: ${esc(company.bank_account || '—')}</p>`);
  const invoiceData = document.querySelector('.invoice-data');
  invoiceData?.querySelector('.party-label')?.remove();
  invoiceData?.querySelector('p')?.classList.add('invoice-number');
  const originalSheet = document.querySelector('.sheet');
  const originalHeader = originalSheet.querySelector('.invoice-head');
  const originalParties = originalSheet.querySelector('.parties');
  const originalTable = originalSheet.querySelector('.items');
  const originalTotals = originalSheet.querySelector('.totals');
  const originalNotes = originalSheet.querySelector('.notes');
  const originalFooter = originalSheet.querySelector('.footer');
  const rows = [...originalTable.querySelectorAll('tbody tr')];
  const rowsPerPage = 14;
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const footerHtml = pageNumber => `<div>Račun broj ${esc(invoice.number)} · ${esc(company.name || 'Preduzeće')} · strana ${pageNumber}/${pageCount}</div>${company.tax_regime === 'books_vat' ? '' : '<div>Ne podleže obračunu i plaćanju poreza po Zakonu o PDV-u</div>'}<div>${payment}</div><div>Dokument je važeći bez potpisa</div>`;
  originalSheet.remove();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const sheet = document.createElement('section');
    sheet.className = 'sheet page-sheet';
    sheet.style.width = '210mm';
    sheet.style.height = '297mm';
    sheet.style.minHeight = '297mm';
    sheet.style.breakAfter = pageNumber === pageCount ? 'auto' : 'page';
    sheet.style.pageBreakAfter = pageNumber === pageCount ? 'auto' : 'always';
    if (pageNumber > 1) { sheet.style.breakBefore = 'page'; sheet.style.pageBreakBefore = 'always'; }
    if (pageNumber === 1) sheet.append(originalHeader.cloneNode(true), originalParties.cloneNode(true));
    else { const continuation = document.createElement('p'); continuation.className = 'continuation-title'; continuation.textContent = `Račun broj ${invoice.number} · nastavak`; sheet.append(continuation); }
    const table = originalTable.cloneNode(true);
    table.querySelector('tbody').replaceChildren(...rows.slice((pageNumber - 1) * rowsPerPage, pageNumber * rowsPerPage).map(row => row.cloneNode(true)));
    sheet.append(table);
    if (pageNumber === pageCount) { sheet.append(originalTotals.cloneNode(true)); if (originalNotes) sheet.append(originalNotes.cloneNode(true)); }
    const footer = originalFooter.cloneNode(false);
    footer.innerHTML = footerHtml(pageNumber);
    sheet.append(footer);
    page.append(sheet);
  }
}
const preparePrint = () => {
  document.querySelector('.toolbar')?.setAttribute('data-print-hidden', 'true');
  document.querySelectorAll('.page-sheet').forEach((sheet, index) => {
    sheet.style.breakAfter = index === document.querySelectorAll('.page-sheet').length - 1 ? 'auto' : 'page';
    sheet.style.pageBreakAfter = index === document.querySelectorAll('.page-sheet').length - 1 ? 'auto' : 'always';
    if (index > 0) {
      sheet.style.breakBefore = 'page';
      sheet.style.pageBreakBefore = 'always';
    }
  });
};
const restorePrint = () => document.querySelector('.toolbar')?.removeAttribute('data-print-hidden');
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('afterprint', restorePrint);
load();
