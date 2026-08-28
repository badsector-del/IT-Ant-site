(async () => {
  const db = window.itAntSupabase;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;
  const { data: membership } = await db.from('company_users').select('role,companies(name)').limit(1).single();
  const displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'Korisnik';
  const firstName = displayName.split(/[ ._-]/)[0];
  document.querySelectorAll('[data-user-name]').forEach(element => { element.textContent = displayName; });
  document.querySelectorAll('[data-user-email]').forEach(element => { element.textContent = user.email || ''; });
  document.querySelectorAll('[data-user-first-name]').forEach(element => { element.textContent = firstName; });
  document.querySelectorAll('[data-company-name]').forEach(element => { element.textContent = membership?.companies?.name || 'Preduzeće nije izabrano'; });
  document.querySelectorAll('[data-user-initials]').forEach(element => { element.textContent = displayName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(); });
})();
