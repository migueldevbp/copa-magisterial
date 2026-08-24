/**
 * Campos de clave: anti-autofill + ojito mostrar/ocultar.
 */
(() => {
  const EYE = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.8 21.8 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.9 21.9 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  function clearInput(input) {
    if (!input) return;
    input.value = '';
    input.setAttribute('readonly', 'readonly');
  }

  function unlockOnFocus(input) {
    const unlock = () => input.removeAttribute('readonly');
    input.addEventListener('focus', unlock);
    input.addEventListener('mousedown', unlock);
    input.addEventListener('touchstart', unlock, { passive: true });
  }

  function bindToggle(btn) {
    const wrap = btn.closest('.password-field');
    const input = wrap?.querySelector('[data-password-input]');
    if (!input) return;
    if (!btn.innerHTML.trim()) btn.innerHTML = EYE;

    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.classList.toggle('is-visible', show);
      input.focus();
    });
  }

  function init() {
    document.querySelectorAll('[data-password-input]').forEach((input) => {
      clearInput(input);
      unlockOnFocus(input);
    });
    document.querySelectorAll('[data-toggle-password]').forEach(bindToggle);
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('pageshow', () => {
    document.querySelectorAll('[data-password-input]').forEach(clearInput);
  });
})();
