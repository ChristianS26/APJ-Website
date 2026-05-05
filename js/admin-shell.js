// APJ Padel - Admin Shell
// Owns the entire admin chrome: header (brand + user + logout) and layout
// (sidebar + scrollable content area). Each admin page provides its body
// content inside <template id="admin-page-template"> and calls
// APJAdminShell.mount({ active: 'foo' }).
//
// build-id: 2026-05-04T22:30Z — bump to force Vercel cache invalidation.

const APJAdminShell = (function () {

  const TORNEO_KEY = 'apj_admin_torneo_id';
  const TORNEO_CHANGED_EVENT = 'apj:torneo:changed';

  let tournamentsCache = null;

  const NAV_SECTIONS = [
    {
      id: 'tournament',
      label: 'Torneo',
      items: [
        {
          id: 'inscripciones',
          label: 'Inscripciones',
          href: '/admin/torneo/inscripciones/',
          icon:
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M22 11h-6M19 8v6"/></svg>'
        },
        {
          id: 'ajustes',
          label: 'Ajustes',
          href: '/admin/torneo/ajustes/',
          icon:
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
        }
      ]
    },
    {
      id: 'organization',
      label: 'Organizacion',
      items: [
        {
          id: 'categories',
          label: 'Categorias',
          href: '/admin/categories/',
          icon:
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/><circle cx="6" cy="6" r="0.5" fill="currentColor"/><circle cx="6" cy="12" r="0.5" fill="currentColor"/><circle cx="6" cy="18" r="0.5" fill="currentColor"/></svg>'
        },
        {
          id: 'stripe-connect',
          label: 'Stripe Connect',
          href: '/admin/stripe-connect/',
          icon:
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>'
        }
      ]
    }
  ];

  /**
   * Mount the shell. Returns { user } on success, or null when access was
   * denied (login or forbidden screens have already been rendered).
   *
   * @param {{ active: string }} opts
   */
  async function mount(opts = {}) {
    const activeId = opts.active || '';

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

    try { await APJApi.getProfile(); } catch (_) { /* keep cached user */ }

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

    const navHtml = NAV_SECTIONS.map(section => {
      const itemsHtml = section.items.map(item => {
        const cls = item.id === activeId ? 'admin-nav-item active' : 'admin-nav-item';
        return `<a href="${item.href}" class="${cls}">${item.icon}<span>${item.label}</span></a>`;
      }).join('');
      return `
        <div class="admin-nav-section">
          <div class="admin-nav-section-label">${escapeHtml(section.label)}</div>
          ${itemsHtml}
        </div>`;
    }).join('');

    const userName = user
      ? (`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Admin')
      : 'Admin';
    const userInitials = userName.split(' ').filter(Boolean).map(s => s[0]).join('').slice(0, 2).toUpperCase();
    const avatarInner = user?.photo_url
      ? `<img src="${escapeAttr(user.photo_url)}" alt="${escapeAttr(userName)}">`
      : escapeHtml(userInitials || 'A');

    root.innerHTML = `
      <header class="admin-header">
        <div class="admin-header-left">
          <button type="button" class="admin-burger" id="admin-burger" aria-label="Abrir menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <a href="/admin/" class="admin-header-brand">
            <div class="admin-header-brand-icon">APJ</div>
            <span class="admin-header-brand-text">Admin</span>
          </a>
        </div>
        <div class="admin-header-right">
          <div class="admin-header-user">
            <div class="admin-avatar">${avatarInner}</div>
            <span class="admin-header-username">${escapeHtml(userName)}</span>
          </div>
          <button type="button" class="btn btn-outline btn-sm" data-logout>Salir</button>
        </div>
      </header>

      <div class="admin-layout">
        <aside class="admin-sidebar" id="admin-sidebar">
          <div class="admin-sidebar-tournament">
            <label class="admin-sidebar-tournament-label" for="admin-tournament-selector">Torneo</label>
            <select id="admin-tournament-selector" class="admin-sidebar-tournament-select">
              <option value="">Cargando...</option>
            </select>
          </div>
          <nav class="admin-nav">${navHtml}</nav>
          <div class="admin-sidebar-footer">
            <a href="https://padeljalisco.com" class="admin-nav-item" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
              <span>Ver sitio publico</span>
            </a>
          </div>
        </aside>
        <main class="admin-main">
          <div id="admin-content"></div>
        </main>
      </div>
      <div class="admin-overlay" id="admin-overlay"></div>
    `;

    bindShellEvents();
    loadTournamentsIntoSelector();

    // Pull the page-specific content from the <template> into #admin-content
    const tpl = document.getElementById('admin-page-template');
    const target = document.getElementById('admin-content');
    if (tpl && target) target.innerHTML = tpl.innerHTML;
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
            <a href="https://padeljalisco.com" class="btn btn-primary">Volver al sitio</a>
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
    document.getElementById('admin-burger')?.addEventListener('click', open);
    overlay?.addEventListener('click', close);
    // Auto-close when navigating via a sidebar link on mobile
    sidebar?.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

    // Tournament selector — persist + broadcast
    document.getElementById('admin-tournament-selector')?.addEventListener('change', (e) => {
      const id = e.target.value || '';
      try {
        if (id) localStorage.setItem(TORNEO_KEY, id);
        else localStorage.removeItem(TORNEO_KEY);
      } catch (_) { /* ignore */ }
      window.dispatchEvent(new CustomEvent(TORNEO_CHANGED_EVENT, { detail: { id } }));
    });
  }

  async function loadTournamentsIntoSelector() {
    const select = document.getElementById('admin-tournament-selector');
    if (!select) return;
    try {
      const list = await APJApi.getTournaments();
      tournamentsCache = (Array.isArray(list) ? list : [])
        .slice()
        .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

      let savedId = '';
      try { savedId = localStorage.getItem(TORNEO_KEY) || ''; } catch (_) {}
      if (savedId && !tournamentsCache.find(t => t.id === savedId)) {
        savedId = '';
        try { localStorage.removeItem(TORNEO_KEY); } catch (_) {}
      }

      if (tournamentsCache.length === 0) {
        select.innerHTML = '<option value="">No hay torneos</option>';
        return;
      }

      const opts = ['<option value="">— Selecciona un torneo —</option>']
        .concat(tournamentsCache.map(t => {
          const date = (t.start_date || '').slice(0, 10);
          const inactive = t.is_enabled === false ? ' (inactivo)' : '';
          return `<option value="${escapeAttr(t.id)}">${escapeHtml(t.name)} — ${escapeHtml(date)}${inactive}</option>`;
        }));
      select.innerHTML = opts.join('');
      select.value = savedId || '';

      // Notify the page that tournaments are ready (covers case where
      // the page mounted before the selector finished loading).
      window.dispatchEvent(new CustomEvent(TORNEO_CHANGED_EVENT, { detail: { id: savedId } }));
    } catch (e) {
      select.innerHTML = '<option value="">Error cargando torneos</option>';
    }
  }

  function getSelectedTournamentId() {
    try { return localStorage.getItem(TORNEO_KEY) || ''; } catch (_) { return ''; }
  }

  function getCachedTournaments() {
    return tournamentsCache || [];
  }

  function getCachedTournament(id) {
    return (tournamentsCache || []).find(t => t.id === id) || null;
  }

  function escapeHtml(value) {
    return String(value).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(value) { return escapeHtml(value); }

  return {
    mount,
    getSelectedTournamentId,
    getCachedTournaments,
    getCachedTournament,
    TORNEO_CHANGED_EVENT,
  };
})();
