// APJ Padel - Tema claro / oscuro
//
// Este archivo se carga de forma BLOQUEANTE en el <head> a proposito: escribe
// data-theme en <html> antes del primer pintado para que no haya destello de
// tema equivocado al recargar.
//
// El tema por defecto es CLARO (papel), sin importar como tenga el sistema
// configurado el visitante: es la identidad de la APJ. El oscuro solo aparece
// si el jugador lo pide con el boton, y entonces se recuerda.

(function () {
  var STORAGE_KEY = 'apj_theme';
  var DEFAULT_THEME = 'light';
  var root = document.documentElement;

  function stored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (_) {
      return null; // modo privado / cookies bloqueadas
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#101215' : '#ffffff');
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      var toDark = theme !== 'dark';
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('title', toDark ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
      btn.setAttribute('aria-label', btn.getAttribute('title'));
    }
  }

  // 1. Resolver el tema cuanto antes (aun sin <body>).
  apply(stored() || DEFAULT_THEME);

  // 2. Inyectar el boton cuando exista el DOM.
  var ICONS =
    '<svg class="theme-icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/>' +
    '</svg>' +
    '<svg class="theme-icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a7 7 0 0 0 11.1 11.1z"/>' +
    '</svg>';

  function mount() {
    // El panel de administracion se queda siempre en claro: es herramienta.
    if (document.body.classList.contains('admin-page')) return;
    if (document.querySelector('.theme-toggle')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.innerHTML = ICONS;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (_) {
        /* sin persistencia: el cambio dura la sesion */
      }
      apply(next);
    });

    // Se cuelga de la barra de sesion cuando existe; si la pagina no tiene
    // barra (terminos, privacidad), queda flotante en la esquina.
    var nav = document.querySelector('.header-nav');
    var bar =
      document.querySelector('.reglamento-header-inner') ||
      document.querySelector('.tournaments-header-inner') ||
      document.querySelector('.site-header-inner');

    if (nav) nav.insertBefore(btn, nav.firstChild);
    else if (bar) bar.appendChild(btn);
    else {
      btn.classList.add('theme-toggle-floating');
      document.body.appendChild(btn);
    }

    apply(root.getAttribute('data-theme'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
