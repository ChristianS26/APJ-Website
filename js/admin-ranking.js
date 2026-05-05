// APJ Padel - Admin / Ranking
// build-id: 2026-05-05T05:45Z — bump para invalidar cache de Vercel.
// Mismo whitelist curado de categorias que iOS y Android (los apps no
// muestran TODO lo que hay en la DB; muestran 11 categorias hardcoded en
// orden especifico). El admin selecciona una, fetch /api/ranking, render
// con filtro por nombre. Click en jugador abre el perfil detallado.

const APJAdminRanking = (function () {

  // Whitelist curado, en orden — espejo exacto de iOS (RankingListViewModel)
  // y Android (RankingViewModel). NO es derivable de la DB: los IDs saltan
  // (6 -> 20 -> 13 -> ...) y la app oculta cualquier otra categoria del
  // ranking. Si quieres agregar/cambiar una categoria visible, hay que
  // tocar las 3 plataformas a la vez para mantener paridad.
  const RANKING_CATEGORIES = [
    { id: 1,  name: 'Primera' },
    { id: 2,  name: 'Segunda' },
    { id: 3,  name: 'Tercera' },
    { id: 4,  name: 'Cuarta' },
    { id: 5,  name: 'Quinta' },
    { id: 6,  name: 'Sexta' },
    { id: 20, name: 'Septima' },
    { id: 13, name: 'Femenil 3ra' },
    { id: 14, name: 'Femenil 4ta' },
    { id: 15, name: 'Femenil 5ta' },
    { id: 19, name: 'Mixto +7' },
  ];

  // Season activa — debe coincidir con la que el backend usa por default
  // (RankingService.getPlayerProfile la trae hardcoded). La temporada arranca
  // en 2025 y corre hasta el corte. Cuando rolen al siguiente, hay que tocar
  // este valor + el del backend.
  const ACTIVE_SEASON = '2025';

  const state = {
    categories: RANKING_CATEGORIES.slice(),
    selectedCategoryId: RANKING_CATEGORIES[0].id,
    items: [],
    filter: '',
    // Profile actualmente abierto en el modal (necesario para que el form
    // de "mover categoria" sepa origen + total + uid sin re-fetch).
    currentProfile: null,
  };

  function start() {
    bind();
    renderCategoryChips();
    loadRanking();
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
      state.currentProfile = profile;
      body.innerHTML = renderProfile(profile);
      bindMoveActions();
    } catch (error) {
      body.innerHTML = `<div class="rk-error" style="margin:0;">${escapeHtml(humanizeError(error))}</div>`;
    }
  }

  function closeDetail() {
    document.getElementById('rk-detail-modal')?.classList.remove('active');
    state.currentProfile = null;
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
      <div class="rk-actions">
        <button type="button" class="btn btn-outline" id="rk-move-btn">
          Mover a otra categoría
        </button>
        ${shouldShowRevert(p, history) ? `
        <button type="button" class="btn btn-outline" id="rk-revert-btn">
          Revertir promoción
        </button>
        ` : ''}
      </div>
      <h4 class="rk-history-title">Historial</h4>
      ${historyHtml}
    `;
  }

  function bindMoveActions() {
    document.getElementById('rk-move-btn')?.addEventListener('click', openMoveForm);
    document.getElementById('rk-revert-btn')?.addEventListener('click', confirmRevert);
  }

  // Defensive gate: only show "Revertir promocion" cuando el backend
  // confirmo que hay una promocion activa (objeto con source_category_id
  // valido) Y el jugador no jugo torneos en la categoria destino.
  // Tolera respuestas viejas del backend (active_promotion ausente) sin
  // mostrar el boton.
  function shouldShowRevert(profile, history) {
    const ap = profile?.active_promotion;
    const hasPromotion = ap != null
      && typeof ap === 'object'
      && Number.isFinite(ap.source_category_id)
      && ap.source_category_id > 0;
    const noTournamentsHere = Array.isArray(history) && history.length === 0;
    return hasPromotion && noTournamentsHere;
  }

  // Replace the modal body with an in-place confirm view (same pattern as
  // openMoveForm). Avoids the native window.confirm() which doesn't match
  // the rest of the admin's look.
  function confirmRevert() {
    const p = state.currentProfile;
    if (!p) return;
    const body = document.getElementById('rk-detail-body');
    if (!body) return;

    const fullName = `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() || 'jugador';
    const catName = p.category?.name || 'esta categoría';
    const ap = p.active_promotion; // ya garantizada por la condicion del boton
    const sourceName = ap?.source_category_name || 'su categoría origen';
    const pointsCarried = ap?.points_carried ?? (p.points ?? 0);

    body.innerHTML = `
      <div class="rk-revert-form">
        <div class="rk-revert-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </div>
        <h3 class="rk-revert-title">¿Revertir la promoción?</h3>
        <p class="rk-revert-body">
          Vas a deshacer la promoción de
          <strong>${escapeHtml(fullName)}</strong>:
          <strong>${escapeHtml(sourceName)}</strong> → <strong>${escapeHtml(catName)}</strong>.
        </p>

        <div class="rk-revert-effects">
          <div class="rk-revert-effect">
            <span class="rk-revert-effect-icon minus">−</span>
            <span>Los <strong>${pointsCarried} pts</strong> que se le otorgaron en ${escapeHtml(catName)} se eliminan.</span>
          </div>
          <div class="rk-revert-effect">
            <span class="rk-revert-effect-icon plus">+</span>
            <span>Se le restauran los puntos originales en <strong>${escapeHtml(sourceName)}</strong>.</span>
          </div>
        </div>

        <div id="rk-revert-error" class="rk-error hidden" style="margin-top:12px;"></div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
          <button type="button" class="btn btn-outline" id="rk-revert-cancel">Cancelar</button>
          <button type="button" class="btn btn-primary rk-btn-danger" id="rk-revert-confirm">
            Sí, revertir
          </button>
        </div>
      </div>
    `;

    document.getElementById('rk-revert-cancel')?.addEventListener('click', () => {
      // Re-render the original profile (no refetch needed).
      const body = document.getElementById('rk-detail-body');
      if (body && state.currentProfile) {
        body.innerHTML = renderProfile(state.currentProfile);
        bindMoveActions();
      }
    });

    document.getElementById('rk-revert-confirm')?.addEventListener('click', () => doRevert(p));
  }

  async function doRevert(p) {
    const fullName = `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() || 'jugador';
    const btn = document.getElementById('rk-revert-confirm');
    const cancelBtn = document.getElementById('rk-revert-cancel');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Procesando...';
    }
    if (cancelBtn) cancelBtn.disabled = true;

    try {
      const result = await APJApi.revertPlayerPromotion({
        userId: p.user.uid,
        season: ACTIVE_SEASON,
        categoryId: p.category.id,
      });
      const sourceCat = RANKING_CATEGORIES.find(c => c.id === result.source_category_id);
      const sourceName = sourceCat?.name || `categoría ${result.source_category_id}`;
      APJToast?.success?.('Promoción revertida',
        `${fullName} vuelve a tener ${result.source_total_after} pts en ${sourceName}.`);
      closeDetail();
      loadRanking();
    } catch (error) {
      const msg = mapRevertError(error);
      const errEl = document.getElementById('rk-revert-error');
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sí, revertir';
      }
      if (cancelBtn) cancelBtn.disabled = false;
    }
  }

  function mapRevertError(error) {
    if (!error) return 'Error desconocido';
    const status = error.status;
    const errCode = error.data?.error;
    if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (status === 403) return 'No tienes permisos para esta accion.';
    if (status === 404 || errCode === 'no_active_promotion') {
      return 'Este jugador no tiene una promoción activa en esta categoría.';
    }
    return error.message || 'No se pudo revertir la promoción.';
  }

  // Replace the modal body with a "move category" form — same player profile
  // is the source. Admin picks destination and overrides the points if needed.
  function openMoveForm() {
    const p = state.currentProfile;
    if (!p) return;
    const body = document.getElementById('rk-detail-body');
    if (!body) return;

    const sourceCatId = p.category?.id;
    const sourceCatName = p.category?.name || '—';
    const sourceTotal = p.points ?? 0;
    const defaultPoints = Math.floor(sourceTotal / 2);
    const fullName = `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.trim() || 'jugador';

    // Destination chips — todas las categorias del whitelist menos la actual.
    const destChips = RANKING_CATEGORIES
      .filter(c => c.id !== sourceCatId)
      .map(c => `<button type="button" class="rk-cat-chip" data-dest-id="${c.id}">${escapeHtml(c.name)}</button>`)
      .join('');

    body.innerHTML = `
      <div class="rk-move-form">
        <div class="rk-move-summary">
          <p style="margin:0 0 4px 0; font-weight:600;">${escapeHtml(fullName)}</p>
          <p style="margin:0; color:var(--text-secondary); font-size:13px;">
            Origen: <strong>${escapeHtml(sourceCatName)}</strong> · ${sourceTotal} pts
          </p>
        </div>

        <div class="form-group" style="margin-top:16px;">
          <label class="form-label">Categoría destino</label>
          <div class="rk-cat-chips" id="rk-move-dest-chips">${destChips}</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="rk-move-points">Puntos a llevar</label>
          <input
            type="number" id="rk-move-points" class="form-input"
            min="0" step="1"
            value="${defaultPoints}"
            style="max-width: 200px;"
          >
          <p class="logo-uploader-hint" style="margin-top:6px;">
            Default: la mitad de los puntos actuales (${sourceTotal} ÷ 2 = ${defaultPoints}).
            Si ya tiene puntos en la categoría destino, se le sumarán.
          </p>
        </div>

        <div class="rk-move-warning" id="rk-move-warning">
          ${escapeHtml(fullName)} quedará en <strong>0 pts</strong> en ${escapeHtml(sourceCatName)} y desaparecerá del listing de esa categoría.
        </div>

        <div id="rk-move-error" class="rk-error hidden" style="margin-top:12px;"></div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
          <button type="button" class="btn btn-outline" id="rk-move-cancel">Cancelar</button>
          <button type="button" class="btn btn-primary" id="rk-move-confirm" disabled>
            Confirmar cambio
          </button>
        </div>
      </div>
    `;

    let selectedDestId = null;
    const confirmBtn = document.getElementById('rk-move-confirm');

    document.querySelectorAll('#rk-move-dest-chips .rk-cat-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#rk-move-dest-chips .rk-cat-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDestId = parseInt(btn.getAttribute('data-dest-id'), 10);
        if (confirmBtn) confirmBtn.disabled = false;
      });
    });

    document.getElementById('rk-move-cancel')?.addEventListener('click', () => {
      // Re-render the original profile view (no need to refetch).
      const body = document.getElementById('rk-detail-body');
      if (body && state.currentProfile) {
        body.innerHTML = renderProfile(state.currentProfile);
        bindMoveActions();
      }
    });

    confirmBtn?.addEventListener('click', async () => {
      if (selectedDestId == null) return;
      const pointsInput = document.getElementById('rk-move-points');
      const rawPoints = pointsInput?.value?.trim();
      const points = rawPoints === '' ? null : parseInt(rawPoints, 10);
      if (points != null && (!Number.isFinite(points) || points < 0)) {
        showMoveError('Los puntos deben ser un número mayor o igual a 0.');
        return;
      }

      confirmBtn.disabled = true;
      const orig = confirmBtn.textContent;
      confirmBtn.innerHTML = '<span class="spinner"></span> Procesando...';

      try {
        const result = await APJApi.promotePlayerCategory({
          userId: p.user.uid,
          season: ACTIVE_SEASON,
          fromCategoryId: sourceCatId,
          toCategoryId: selectedDestId,
          points,
        });
        // Success — toast + refresh.
        const destCat = RANKING_CATEGORIES.find(c => c.id === selectedDestId);
        const destName = destCat?.name || `categoría ${selectedDestId}`;
        APJToast?.success?.('Movimiento aplicado',
          `${fullName} ahora tiene ${result.dest_total_after} pts en ${destName}.`);
        closeDetail();
        // If the admin is currently viewing the source category, the player
        // will already be filtered out (total=0). Either way, refresh to
        // reflect the new state.
        loadRanking();
      } catch (error) {
        const msg = mapPromotionError(error);
        showMoveError(msg);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = orig;
      }
    });
  }

  function showMoveError(msg) {
    const el = document.getElementById('rk-move-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // Backend specific error → user-facing copy. The route returns
  // { error: "already_promoted" | "same_category" | "negative_points", ... }
  // and ApiError stores the parsed body under `data`.
  function mapPromotionError(error) {
    if (!error) return 'Error desconocido';
    const status = error.status;
    const errCode = error.data?.error;
    if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (status === 403) return 'No tienes permisos para esta accion.';
    if (status === 409 || errCode === 'already_promoted') {
      return 'Este jugador ya fue promovido a esa categoría en esta temporada. No se puede promover dos veces.';
    }
    if (errCode === 'same_category') return 'La categoría destino debe ser distinta a la origen.';
    if (errCode === 'negative_points') return 'Los puntos no pueden ser negativos.';
    return error.message || 'No se pudo aplicar el movimiento.';
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
