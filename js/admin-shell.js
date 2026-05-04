// APJ Padel - Admin Shell
// Shared layout & auth gate for every page under /admin/.
// Each admin page calls APJAdminShell.mount({ active: 'stripe-connect' }) and
// then renders its content into <div id="admin-content">.

const APJAdminShell = (function () {

  const NAV_ITEMS = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/admin/',
      icon:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>'
    },
    {
      id: 'stripe-connect',
      label: 'Stripe Connect',
      href: '/admin/stripe-connect/',
      icon:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>'
    }
  ];

  /**
   * Mount the shell. Returns a Promise that resolves with the user when the
   * page is allowed to render its content, or rejects (silently — having
   * already rendered an error/login state) when access is denied.
   *
   * @param {{ active: string }} opts
   * @returns {Promise<{user: object} | null>}
   */
  async function mount(opts = {}) {
    const activeId = opts.active || '';

    // Auth gate first
    if (!APJApi.isAuthenticated()) {
      renderNeedLogin();
      window.addEventListener('apj:auth:login', () => location.reload(), { once: true });
      return null;
    }

    const isValid = await APJApi.validateToken();
    if (!isValid) {
      renderNeedLogin();
      APJToast?.info?.('Sesion expirada', 'Por favor inicia sesion nuevamente.');
      window.addEventListener('apj:auth:login', () => location.reload(), { once: true });
      return null;
    }

    // Refresh user (role may have changed) — fall back to cache on error
    try { await APJApi.getProfile(); } catch (_) { /* ignore */ }

    const user = APJApi.getUserData();
    const isAdmin = (user?.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      renderForbidden();
      return null;
    }

    renderShell(activeId, user);
    return { user };
  }

  function renderShell(activeId, user) {
    const root = document.getElementById('admin-shell-root');
    if (!root) return;
    root.classList.remove('admin-shell-fallback');

    const navHtml = NAV_ITEMS.map(item => {
      const cls = item.id === activeId ? 'admin-nav-item active' : 'admin-nav-item';
      return `<a href="${item.href}" class="${cls}">${item.icon}<span>${item.label}</span></a>`;
    }).join('');

    const userName = user
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
      : 'Admin';

    root.innerHTML = `
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="admin-sidebar-header">
          <div class="admin-sidebar-brand">
            <div class="profile-logo-icon">APJ</div>
            <div>
              <div class="admin-sidebar-title">Panel Admin</div>
              <div class="admin-sidebar-subtitle">${escapeHtml(userName)}</div>
            </div>
          </div>
          <button type="button" class="admin-sidebar-close" id="admin-sidebar-close" aria-label="Cerrar menu">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <nav class="admin-nav">${navHtml}</nav>
        <div class="admin-sidebar-footer">
          <a href="/" class="admin-nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            <span>Volver al sitio</span>
          </a>
        </div>
      </aside>
      <div class="admin-main">
        <button type="button" class="admin-mobile-toggle" id="admin-mobile-toggle" aria-label="Abrir menu">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          <span>Menu</span>
        </button>
        <div class="admin-content" id="admin-content"></div>
      </div>
      <div class="admin-overlay" id="admin-overlay"></div>
    `;

    bindShellEvents();

    // Reveal the content the page already wrote into a hidden template
    const tpl = document.getElementById('admin-page-template');
    const target = document.getElementById('admin-content');
    if (tpl && target) {
      target.innerHTML = tpl.innerHTML;
    }
  }

  function renderNeedLogin() {
    const root = document.getElementById('admin-shell-root');
    if (!root) return;
    root.classList.add('admin-shell-fallback');
    root.innerHTML = `
      <div class="admin-fallback">
        <div class="profile-card">
          <div class="profile-card-body" style="text-align:center;">
            <h2 style="margin:0 0 8px 0;">Inicia sesion</h2>
            <p style="color:var(--text-secondary); margin:0 0 20px 0;">
              Necesitas una cuenta de administrador para entrar al panel.
            </p>
            <button class="btn btn-primary" data-show-login>Iniciar sesion</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderForbidden() {
    const root = document.getElementById('admin-shell-root');
    if (!root) return;
    root.classList.add('admin-shell-fallback');
    root.innerHTML = `
      <div class="admin-fallback">
        <div class="profile-card">
          <div class="profile-card-body" style="text-align:center;">
            <h2 style="margin:0 0 8px 0;">Acceso restringido</h2>
            <p style="color:var(--text-secondary); margin:0 0 20px 0;">
              Esta seccion solo esta disponible para administradores de la APJ.
            </p>
            <a href="/" class="btn btn-primary">Volver al inicio</a>
          </div>
        </div>
      </div>
    `;
  }

  function bindShellEvents() {
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('admin-overlay');
    const open = () => {
      sidebar?.classList.add('open');
      overlay?.classList.add('active');
    };
    const close = () => {
      sidebar?.classList.remove('open');
      overlay?.classList.remove('active');
    };
    document.getElementById('admin-mobile-toggle')?.addEventListener('click', open);
    document.getElementById('admin-sidebar-close')?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
  }

  function escapeHtml(value) {
    return String(value).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { mount };
})();
