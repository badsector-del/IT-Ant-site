window.itAntContextReady = (async () => {
  const db = window.itAntSupabase;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: memberships, error } = await db.from('company_users').select('company_id,role,companies(name,tax_regime)').order('created_at');
  if (error || !memberships?.length) return null;
  const savedId = sessionStorage.getItem('it-ant-active-company');
  const metadataId = user.app_metadata?.active_company_id;
  const active = memberships.find(item => item.company_id === metadataId) || memberships.find(item => item.company_id === savedId) || memberships[0];
  window.itAntActiveCompanyId = active.company_id;
  sessionStorage.setItem('it-ant-active-company', active.company_id);
  document.querySelectorAll('[data-kpo-nav]').forEach(element => { element.hidden = active.companies?.tax_regime !== 'pausal'; });
  const displayName = [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ') || user.user_metadata?.name || user.email?.split('@')[0] || 'Korisnik';
  const firstName = displayName.split(/[ ._-]/)[0];
  document.querySelectorAll('[data-user-name]').forEach(element => { element.textContent = displayName; });
  document.querySelectorAll('[data-user-email]').forEach(element => { element.textContent = user.email || ''; });
  document.querySelectorAll('[data-user-first-name]').forEach(element => { element.textContent = firstName; });
  document.querySelectorAll('[data-company-name]').forEach(element => { element.textContent = active.companies?.name || 'Preduzeće nije izabrano'; });
  document.querySelectorAll('[data-user-initials]').forEach(element => { element.textContent = displayName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(); });
  document.querySelectorAll('[data-company-switch]').forEach(select => {
    select.innerHTML = memberships.map(item => `<option value="${item.company_id}">${item.companies?.name || 'Preduzeće'}</option>`).join('');
    select.value = active.company_id;
    select.disabled = memberships.length < 2;
    select.addEventListener('change', async () => {
      const nextId = select.value;
      if (!nextId || nextId === window.itAntActiveCompanyId) return;
      select.disabled = true;
      try {
        const { error: switchError } = await db.functions.invoke('smart-service', { body: { company_id: nextId } });
        if (switchError) throw switchError;
        await db.auth.refreshSession();
        sessionStorage.setItem('it-ant-active-company', nextId);
        window.location.reload();
      } catch (switchError) {
        select.value = window.itAntActiveCompanyId;
        select.disabled = memberships.length < 2;
        alert(`Preduzeće nije promenjeno: ${switchError.message}`);
      }
    });
  });
  return { user, memberships, activeCompany: active };
})();
