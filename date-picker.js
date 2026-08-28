const monthNames = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
const pad = value => String(value).padStart(2, '0');
const toDisplayDate = value => { if (!value) return ''; const [year, month, day] = value.split('-'); return `${day}.${month}.${year}`; };
const toIsoDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

document.querySelectorAll('[data-date-picker]').forEach(picker => {
  const display = picker.querySelector('[data-date-display]');
  const hidden = picker.querySelector('[data-date-value]');
  const calendar = document.createElement('div'); calendar.className = 'date-calendar'; calendar.hidden = true;
  let viewDate = hidden.value ? new Date(`${hidden.value}T12:00:00`) : new Date();
  const render = () => {
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const start = (firstDay.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < start; i++) cells.push('<span></span>');
    for (let day = 1; day <= daysInMonth; day++) { const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day); const iso = toIsoDate(date); cells.push(`<button type="button" class="calendar-day ${iso === hidden.value ? 'selected' : ''}" data-date="${iso}">${day}</button>`); }
    calendar.innerHTML = `<div class="calendar-head"><button type="button" data-calendar-prev aria-label="Prethodni mesec">‹</button><strong>${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}</strong><button type="button" data-calendar-next aria-label="Sledeći mesec">›</button></div><div class="calendar-week"><span>Po</span><span>Ut</span><span>Sr</span><span>Če</span><span>Pe</span><span>Su</span><span>Ne</span></div><div class="calendar-grid">${cells.join('')}</div>`;
  };
  const setValue = iso => { hidden.value = iso; display.value = toDisplayDate(iso); calendar.hidden = true; render(); };
  display.addEventListener('click', () => { calendar.hidden = !calendar.hidden; render(); });
  display.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); calendar.hidden = !calendar.hidden; render(); } });
  calendar.addEventListener('click', event => { const day = event.target.closest('[data-date]'); if (day) setValue(day.dataset.date); if (event.target.closest('[data-calendar-prev]')) { viewDate.setMonth(viewDate.getMonth() - 1); render(); } if (event.target.closest('[data-calendar-next]')) { viewDate.setMonth(viewDate.getMonth() + 1); render(); } });
  picker.append(calendar);
  display.value = toDisplayDate(hidden.value);
});

window.setDatePickerValue = (name, value) => { const picker = document.querySelector(`[data-date-picker="${name}"]`); if (!picker) return; const display = picker.querySelector('[data-date-display]'); const hidden = picker.querySelector('[data-date-value]'); hidden.value = value || ''; display.value = toDisplayDate(value); };

document.addEventListener('click', event => { document.querySelectorAll('.date-calendar').forEach(calendar => { if (!calendar.parentElement.contains(event.target)) calendar.hidden = true; }); });
