const logoutButtons = document.querySelectorAll('[data-logout]');
logoutButtons.forEach(button => button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Odjavljivanje...';
  await window.itAntSupabase.auth.signOut();
  window.location.href = 'login.html';
}));
