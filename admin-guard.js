(async () => {
  const { data: { session } } = await window.itAntSupabase.auth.getSession();
  if (!session) { window.location.href = 'login.html?next=admin.html'; return; }
  const { data: admin } = await window.itAntSupabase.from('platform_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (!admin) window.location.replace('poslovanje.html');
})();
