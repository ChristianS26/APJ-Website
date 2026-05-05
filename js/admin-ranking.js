// APJ Padel - Admin / Ranking
// Lists categorias (admin/regular), lets the admin pick one, fetches the
// per-category ranking and renders it as a table. Supports a live name
// filter and a player detail modal.

const APJAdminRanking = (function () {

  const state = {
    categories: [],
    selectedCategoryId: null,
    items: [],
    filter: '',
  };

  function start() {
    bind();
    loadCategories();
  }

  function bind() {
    const search = document.getElementById('rk-search');
    if (search) {
      search.addEventListener('input', () => {
        state.filter = (search.value || '').trim();
        renderTable();
      });
    }
    // Modal close
    document.querySelectorAll('[data-rk-close]').forEach(el => {
      el.addEventListener('click', closeDetail);
    });
    document.getElementById('rk-detail-modal')?.addEventListener('click', e => {
      if (e.target.id === 'rk-detail-modal') closeDetail();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDetail();
    });
  }

  // ---------- Categories ----------
  async function loadCategories() {
    const chipsHost = document.getElementById('rk-cat-chips');
    try {
      const list = await APJApi.adminListRegularCategories();
      const sorted = (Array.isArray(list) ? list : [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      state.categories = sorted;

      if (sorted.length === 0) {
        if (chipsHost) chipsHost.innerHTML = '<span style="color:var(--text-secondary); font-size:13px;">No hay categorias.</span>';
        renderEmpty('No hay categorias creadas. Ve a "Categorias" para crear la primera.');
        return;
      }

      // Default to first category (lowest position)
      state.selectedCategoryId = sorted[0].id;
      renderCategoryChips();
      loadRanking();
    } catch (error) {
      showError(humanizeError(error));
      if (chipsHost) chipsHost.innerHTML = '';
    }
  }

  function renderCategoryChips() {
    const host = document.getElementById('rk-cat-chips');
    if (!host) return;
    host.innerHTML = state.categories.map(cat => {
      const cls = cat.id === state.selectedCategoryId ? 'rk-cat-chip active' : 'rk-cat-chip';
      return `<button type="button" class="${cls}" data-cat-id="${cat.id}">${escapeHtml(cat.name)}</button>`;
    }).join('');
    host.querySelectorAll('.rk-cat-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-cat-id'), 10);
        if (!Number.isFinite(id) || id === state.selectedCategoryId) return;
        state.selectedCategoryId = id;
        renderCategoryChips();
        loadRanking();
      });
    });
  }

  // ---------- Ranking ----------
  async function loadRanking() {
    const host = document.getElementById('rk-table-host');
    if (host) host.innerHTML = `
      <div class="profile-loading-page" style="padding:40px 0;">
        <div class="spinner" style="width:28px; height:28px;"></div>
        <p style="font-size:13px;">Cargando ranking...</p>
      </div>`;

    clearError();
    state.items = [];

    try {
      const items = await APJApi.getRanking(state.selectedCategoryId);
      state.items = Array.isArray(items) ? items : [];
      const meta = document.getElementById('rk-cat-meta');
      if (meta) {
        const cat = state.categories.find(c => c.id === state.selectedCategoryId);
        const catName = cat ? cat.name : '';
        meta.textContent = state.items.length
          ? `${state.items.length} ${state.items.length === 1 ? 'jugador' : 'jugadores'} en ${catName}.`
          : `Sin jugadores con puntos en ${catName}.`;
      }
      renderTable();
    } catch (error) {
      showError(humanizeError(error));
      renderEmpty('No se pudo cargar el ranking.');
    }
  }

  function renderTable() {
    const host = document.getElementById('rk-table-host');
    if (!host) return;

    const filtered = applyFilter(state.items, state.filter);
    if (filtered.length === 0) {
      const reason = state.items.length === 0
        ? 'Aun no hay jugadores con puntos en esta categoria.'
        : 'Ningun jugador coincide con la busqueda.';
      host.innerHTML = `<div class="rk-empty">${escapeHtml(reason)}</div>`;
      return;
    }

    const rowsHtml = filtered.map(item => {
      const pos = item.position ?? '—';
      const points = item.total_points ?? 0;
      const tournaments = item.tournaments_played ?? 0;
      const u = item.user || {};
      return `
        <tr data-uid="${escapeAttr(u.uid || '')}">
          <td>${positionCell(pos)}</td>
          <td>${playerCell(u)}</td>
          <td style="text-align:right;">${tournaments}</td>
          <td style="text-align:right;"><span class="rk-points">${points}</span></td>
          <td style="text-align:right; color:var(--text-secondary);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </td>
        </tr>`;
    }).join('');

    host.innerHTML = `
      <div class="rk-table-wrap">
        <table class="rk-table">
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Jugador</th>
              <th style="text-align:right;">Torneos</th>
              <th style="text-align:right;">Puntos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;

    host.querySelectorAll('tbody tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const uid = tr.getAttribute('data-uid');
        if (uid) openDetail(uid);
      });
    });
  }

  // Case + accent insensitive — admin types "urias" and matches "Urías".
  function applyFilter(items, query) {
    if (!query) return items;
    const norm = normalize(query);
    return items.filter(item => {
      const u = item.user || {};
      const name = `${u.first_name || ''} ${u.last_name || ''}`;
      return normalize(name).includes(norm);
    });
  }

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  function positionCell(pos) {
    const n = Number(pos);
    if (n === 1) return `<span class="rk-pos-medal gold">1</span>`;
    if (n === 2) return `<span class="rk-pos-medal silver">2</span>`;
    if (n === 3) return `<span class="rk-pos-medal bronze">3</span>`;
    return `<span class="rk-pos">#${escapeHtml(String(pos))}</span>`;
  }

  function playerCell(u) {
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—';
    const phone = u.phone ? escapeHtml(u.phone) : '';
    const initials = (u.first_name?.[0] || '') + (u.last_name?.[0] || '');
    const avatar = u.photo_url
      ? `<span class="rk-avatar"><img src="${escapeAttr(u.photo_url)}" alt=""></span>`
      : `<span class="rk-avatar">${escapeHtml(initials.toUpperCase() || '?')}</span>`;
    return `
      <div class="rk-player">
        ${avatar}
        <div class="rk-player-info">
          <span class="name">${escapeHtml(name)}</span>
          ${phone ? `<span class="phone">${phone}</span>` : ''}
        </div>
      </div>`;
  }

  function renderEmpty(message) {
    const host = document.getElementById('rk-table-host');
    if (host) host.innerHTML = `<div class="rk-empty">${escapeHtml(message)}</div>`;
  }

  // ---------- Player detail modal ----------
  async function openDetail(userId) {
    const modal = document.getElementById('rk-detail-modal');
    const body = document.getElementById('rk-detail-body');
    if (!modal || !body) return;
    modal.classList.add('active');
    body.innerHTML = `
      <div class="profile-loading-page" style="padding:40px 0;">
        <div class="spinner" style="width:28px; height:28px;"></div>
        <p style="font-size:13px;">Cargando perfil...</p>
      </div>`;

    try {
      const profile = await APJApi.getRankingPlayerProfile(userId, state.selectedCategoryId);
      body.innerHTML = renderProfile(profile);
    } catch (error) {
      body.innerHTML = `<div class="rk-error" style="margin:0;">${escapeHtml(humanizeError(error))}</div>`;
    }
  }

  function closeDetail() {
    document.getElementById('rk-detail-modal')?.classList.remove('active');
  }

  function renderProfile(p) {
    const u = p.user || {};
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—';
    const initials = (u.first_name?.[0] || '') + (u.last_name?.[0] || '');
    const avatar = u.photo_url
      ? `<span class="avatar"><img src="${escapeAttr(u.photo_url)}" alt=""></span>`
      : `<span class="avatar">${escapeHtml(initials.toUpperCase() || '?')}</span>`;
    const catName = p.category?.name || '—';
    const phone = u.phone ? escapeHtml(u.phone) : '';

    const history = Array.isArray(p.history) ? p.history : [];
    const historyHtml = history.length === 0
      ? `<div class="rk-history-empty">Sin historial de torneos en ${escapeHtml(catName)}.</div>`
      : history.map(h => `
          <div class="rk-history-row">
            <div style="min-width:0; flex:1;">
              <div class="name">${escapeHtml(h.tournamentName || '—')}</div>
              ${h.date ? `<div class="date">${escapeHtml(formatDateShort(h.date))}</div>` : ''}
            </div>
            ${resultChip(h.result)}
          </div>`).join('');

    return `
      <div class="rk-detail-hero">
        ${avatar}
        <div class="info">
          <p class="name">${escapeHtml(name)}</p>
          <p class="meta">
            Posicion #${p.position} · ${escapeHtml(catName)}
            ${phone ? ` · ${phone}` : ''}
          </p>
        </div>
      </div>
      <div class="rk-stats">
        <div class="rk-stat"><div class="value">${p.points ?? 0}</div><div class="label">Puntos</div></div>
        <div class="rk-stat"><div class="value">${history.length}</div><div class="label">Torneos</div></div>
        <div class="rk-stat"><div class="value">${p.tournamentsWon ?? 0}</div><div class="label">Campeon</div></div>
        <div class="rk-stat"><div class="value">${p.finalsReached ?? 0}</div><div class="label">Finales</div></div>
      </div>
      <h4 class="rk-history-title">Historial</h4>
      ${historyHtml}
    `;
  }

  function resultChip(result) {
    const r = String(result || '').toLowerCase();
    if (r.startsWith('campeon') || r === 'ganado') return `<span class="rk-result-chip gold">${escapeHtml(result)}</span>`;
    if (r.startsWith('finalista')) return `<span class="rk-result-chip silver">${escapeHtml(result)}</span>`;
    if (r.startsWith('semi')) return `<span class="rk-result-chip bronze">${escapeHtml(result)}</span>`;
    return `<span class="rk-result-chip gray">${escapeHtml(result || 'Participante')}</span>`;
  }

  // ---------- helpers ----------
  function showError(msg) {
    const el = document.getElementById('rk-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function clearError() {
    document.getElementById('rk-error')?.classList.add('hidden');
  }

  function humanizeError(error) {
    if (!error) return 'Error desconocido';
    const status = error.status;
    if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (status === 403) return 'No tienes permisos para esta accion.';
    if (status === 404) return 'No encontrado.';
    return error.message || 'Ocurrio un error inesperado.';
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(value) { return escapeHtml(value); }

  return { start };
})();
