(async () => {
  const { data: { session } } = await window.itAntSupabase.auth.getSession();
  if (!session) window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname.split('/').pop() || 'poslovanje.html')}`;
})();
