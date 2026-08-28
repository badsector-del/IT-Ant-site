const logoutButtons = document.querySelectorAll('[data-logout]');
logoutButtons.forEach(button => button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Odjavljivanje...';
  try { await window.itAntSupabase.auth.signOut({ scope: 'local' }); } catch (error) { /* Local logout continues even if the server is slow. */ }
  window.location.href = 'login.html';
}));
