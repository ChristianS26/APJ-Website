// APJ Padel - Admin Shell
// Owns the entire admin chrome: header (brand + user + logout) and layout
// (sidebar + scrollable content area). Each admin page provides its body
// content inside <template id="admin-page-template"> and calls
// APJAdminShell.mount({ active: 'foo' }).
//
// build-id: 2026-05-04T23:00Z — bump to force Vercel cache invalidation.

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
          href: '/admin/inscripciones/',
          icon:
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M22 11h-6M19 8v6"/></svg>'
        },
        {
          id: 'restricciones',
          label: 'Restricciones',
          href: '/admin/restricciones/',
          icon:
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
        },
        {
          id: 'ajustes',
          label: 'Ajustes',
          href: '/admin/ajustes/',
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

    // Show a loader immediately so the user never sees an empty admin area
    // while auth + profile + tournaments resolve. renderShell / renderNeedLogin
    // / renderForbidden each overwrite #admin-shell-root, replacing the loader.
    renderBootLoading(labelForActive(activeId));

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
            <div class="admin-sidebar-tournament-label">Torneo seleccionado</div>
            <div class="t-picker" id="t-picker">
              <button type="button" class="t-picker-trigger" id="t-picker-trigger" aria-haspopup="listbox" aria-expanded="false">
                <div class="t-picker-trigger-content">
                  <div class="t-picker-name" id="t-picker-name">Cargando...</div>
                  <div class="t-picker-meta" id="t-picker-meta"></div>
                </div>
                <svg class="t-picker-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="t-picker-popover" id="t-picker-popover" role="listbox" hidden></div>
            </div>
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

  // Friendly label per section so the loading copy reflects what the user
  // just clicked instead of a generic "Cargando..." (small UX touch).
  const SECTION_LABELS = {
    inscripciones: 'Cargando inscripciones...',
    restricciones: 'Cargando restricciones...',
    ajustes: 'Cargando ajustes del torneo...',
    categories: 'Cargando categorias...',
    'stripe-connect': 'Cargando Stripe Connect...',
  };

  function labelForActive(activeId) {
    return SECTION_LABELS[activeId] || 'Cargando panel...';
  }

  function renderBootLoading(label) {
    const root = document.getElementById('admin-shell-root');
    if (!root) return;
    root.classList.remove('admin-shell-fallback');
    root.innerHTML = `
      <div class="admin-shell-loading">
        <div class="spinner"></div>
        <p>${escapeHtml(label)}</p>
      </div>
    `;
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

    // Custom tournament picker
    const trigger = document.getElementById('t-picker-trigger');
    const popover = document.getElementById('t-picker-popover');
    if (trigger && popover) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = popover.hasAttribute('hidden');
        if (open) openPopover();
        else closePopover();
      });
      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!popover.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
          closePopover();
        }
      });
      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePopover();
      });
    }
  }

  function openPopover() {
    const trigger = document.getElementById('t-picker-trigger');
    const popover = document.getElementById('t-picker-popover');
    if (!trigger || !popover) return;
    popover.removeAttribute('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    document.getElementById('t-picker')?.classList.add('open');
  }
  function closePopover() {
    const trigger = document.getElementById('t-picker-trigger');
    const popover = document.getElementById('t-picker-popover');
    if (!trigger || !popover) return;
    popover.setAttribute('hidden', '');
    trigger.setAttribute('aria-expanded', 'false');
    document.getElementById('t-picker')?.classList.remove('open');
  }

  async function loadTournamentsIntoSelector() {
    try {
      const list = await APJApi.getTournaments();
      tournamentsCache = (Array.isArray(list) ? list : [])
        .slice()
        .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

      let savedId = '';
      try { savedId = localStorage.getItem(TORNEO_KEY) || ''; } catch (_) {}
      // Drop stale selection (deleted/renamed tournament).
      if (savedId && !tournamentsCache.find(t => t.id === savedId)) {
        savedId = '';
        try { localStorage.removeItem(TORNEO_KEY); } catch (_) {}
      }
      // First time on the panel? Pick the most recent ACTIVE tournament.
      if (!savedId) {
        const firstActive = tournamentsCache.find(t => t.is_enabled !== false);
        if (firstActive) {
          savedId = firstActive.id;
          try { localStorage.setItem(TORNEO_KEY, savedId); } catch (_) {}
        }
      }

      renderPickerTrigger(savedId);
      renderPickerPopover(savedId);

      // Notify the page that tournaments are ready
      window.dispatchEvent(new CustomEvent(TORNEO_CHANGED_EVENT, { detail: { id: savedId } }));
    } catch (e) {
      renderPickerTrigger('', { error: true });
    }
  }

  function renderPickerTrigger(selectedId, opts = {}) {
    const nameEl = document.getElementById('t-picker-name');
    const metaEl = document.getElementById('t-picker-meta');
    if (!nameEl || !metaEl) return;
    if (opts.error) {
      nameEl.textContent = 'Error cargando torneos';
      metaEl.innerHTML = '';
      return;
    }
    if (!tournamentsCache || tournamentsCache.length === 0) {
      nameEl.textContent = 'Sin torneos';
      metaEl.innerHTML = '';
      return;
    }
    const t = tournamentsCache.find(x => x.id === selectedId);
    if (!t) {
      nameEl.textContent = 'Selecciona un torneo';
      metaEl.innerHTML = '';
      return;
    }
    nameEl.textContent = t.name;
    const date = formatDateShort(t.start_date);
    const dot = t.is_enabled === false
      ? '<span class="t-picker-status t-picker-status-off">Inactivo</span>'
      : '<span class="t-picker-status t-picker-status-on">Activo</span>';
    metaEl.innerHTML = `<span>${escapeHtml(date)}</span>${dot}`;
  }

  function renderPickerPopover(selectedId) {
    const popover = document.getElementById('t-picker-popover');
    if (!popover) return;
    if (!tournamentsCache || tournamentsCache.length === 0) {
      popover.innerHTML = '<div class="t-picker-empty">No hay torneos</div>';
      return;
    }
    popover.innerHTML = tournamentsCache.map(t => {
      const isActive = t.id === selectedId;
      const date = formatDateShort(t.start_date);
      const off = t.is_enabled === false;
      return `
        <button type="button" class="t-picker-item${isActive ? ' active' : ''}" data-id="${escapeAttr(t.id)}" role="option" aria-selected="${isActive}">
          <div class="t-picker-item-main">
            <div class="t-picker-item-name">${escapeHtml(t.name)}</div>
            <div class="t-picker-item-meta">
              <span>${escapeHtml(date)}</span>
              <span class="t-picker-status ${off ? 't-picker-status-off' : 't-picker-status-on'}">${off ? 'Inactivo' : 'Activo'}</span>
            </div>
          </div>
          ${isActive ? '<svg class="t-picker-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>`;
    }).join('');

    // Bind item clicks
    popover.querySelectorAll('.t-picker-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id') || '';
        try { localStorage.setItem(TORNEO_KEY, id); } catch (_) {}
        renderPickerTrigger(id);
        renderPickerPopover(id);
        closePopover();
        window.dispatchEvent(new CustomEvent(TORNEO_CHANGED_EVENT, { detail: { id } }));
      });
    });
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
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
