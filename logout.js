const logoutButtons = document.querySelectorAll('[data-logout]');
logoutButtons.forEach(button => button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Odjavljivanje...';
  await Promise.race([
    window.itAntSupabase.auth.signOut(),
    new Promise(resolve => setTimeout(resolve, 10000))
  ]);
  window.location.href = 'login.html';
}));
