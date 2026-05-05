// APJ Padel - Admin Torneo
// Tournament selector + tabs (Inscripciones / Ajustes).
// Auth/admin gate handled by APJAdminShell.

const APJAdminTorneo = (function () {
  const SESSION_KEY = 'apj_admin_torneo_id';

  let tournaments = [];
  let currentTournament = null;
  let currentTeams = [];        // grouped by category
  let activeTab = 'inscripciones';

  function start() {
    bind();
    loadTournaments();
  }

  function bind() {
    document.getElementById('torneo-select')?.addEventListener('change', onSelectChange);
    document.querySelectorAll('.torneo-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.getElementById('torneo-edit-form')?.addEventListener('submit', onSave);
    document.getElementById('torneo-edit-reset')?.addEventListener('click', () => {
      if (currentTournament) populateAjustesForm(currentTournament);
    });
    document.getElementById('torneo-edit-enabled')?.addEventListener('change', onToggleEnabled);
    document.getElementById('torneo-edit-registration-open')?.addEventListener('change', onToggleRegistration);
  }

  // ---------- Tournaments list ----------
  async function loadTournaments() {
    clearError();
    try {
      const list = await APJApi.getTournaments();
      tournaments = (Array.isArray(list) ? list : [])
        .slice()
        .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
      renderTournamentSelect();

      // Restore previous selection if still valid
      const remembered = sessionStorage.getItem(SESSION_KEY);
      if (remembered && tournaments.find(t => t.id === remembered)) {
        document.getElementById('torneo-select').value = remembered;
        await selectTournament(remembered);
      }
    } catch (error) {
      showError(humanizeError(error));
    }
  }

  function renderTournamentSelect() {
    const select = document.getElementById('torneo-select');
    if (!select) return;
    if (tournaments.length === 0) {
      select.innerHTML = '<option value="">No hay torneos</option>';
      return;
    }
    select.innerHTML = '<option value="">— Selecciona un torneo —</option>' +
      tournaments.map(t => {
        const date = t.start_date || '';
        const status = t.is_enabled === false ? ' (inactivo)' : '';
        return `<option value="${escapeAttr(t.id)}">${escapeHtml(t.name)} — ${escapeHtml(date)}${status}</option>`;
      }).join('');
  }

  async function onSelectChange(e) {
    const id = e.target.value;
    if (!id) {
      hideTabs();
      currentTournament = null;
      currentTeams = [];
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, id);
    await selectTournament(id);
  }

  async function selectTournament(id) {
    showTabs();
    showInscripcionesLoading();

    // Use the cached row for instant render of Ajustes; fetch fresh in parallel.
    const cached = tournaments.find(t => t.id === id);
    if (cached) {
      currentTournament = cached;
      populateAjustesForm(cached);
    }

    clearError();
    try {
      const [fresh, teams] = await Promise.all([
        APJApi.getTournamentById(id),
        APJApi.getTeamsByTournamentGrouped(id),
      ]);
      currentTournament = fresh || cached;
      currentTeams = Array.isArray(teams) ? teams : [];
      if (fresh) populateAjustesForm(fresh);
      renderInscripciones();
    } catch (error) {
      showError(humanizeError(error));
      const list = document.getElementById('torneo-ins-list');
      if (list) list.innerHTML = `<div class="profile-card"><div class="profile-card-body" style="color:#ef4444;">${escapeHtml(humanizeError(error))}</div></div>`;
    }
  }

  // ---------- Tabs ----------
  function showTabs() {
    document.getElementById('torneo-tabs-bar')?.classList.remove('hidden');
    switchTab(activeTab);
  }
  function hideTabs() {
    document.getElementById('torneo-tabs-bar')?.classList.add('hidden');
    document.getElementById('torneo-tab-inscripciones')?.classList.add('hidden');
    document.getElementById('torneo-tab-ajustes')?.classList.add('hidden');
  }
  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll('.torneo-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === name);
    });
    document.getElementById('torneo-tab-inscripciones')?.classList.toggle('hidden', name !== 'inscripciones');
    document.getElementById('torneo-tab-ajustes')?.classList.toggle('hidden', name !== 'ajustes');
  }

  // ---------- Inscripciones ----------
  function showInscripcionesLoading() {
    const list = document.getElementById('torneo-ins-list');
    if (!list) return;
    list.innerHTML = '<div class="profile-loading-page" style="padding:32px 0;"><div class="spinner" style="width:24px; height:24px;"></div><p style="font-size:13px;">Cargando inscripciones...</p></div>';
  }

  function renderInscripciones() {
    const list = document.getElementById('torneo-ins-list');
    if (!list) return;
    if (!currentTeams || currentTeams.length === 0) {
      list.innerHTML = '<div class="profile-card"><div class="profile-card-body" style="text-align:center; color:var(--text-secondary); padding:32px 24px;">Aun no hay equipos inscritos en este torneo.</div></div>';
      return;
    }

    const blocks = currentTeams.map(group => {
      // Backend uses categoryName (camelCase) — not category.name.
      const catName = group.categoryName || group.category?.name || 'Sin categoria';
      const teams = Array.isArray(group.teams) ? group.teams : [];
      const rows = teams.map(t => renderTeamRow(t)).join('');
      return `
        <div class="ins-category-block">
          <div class="ins-category-header">
            <h3>${escapeHtml(catName)}</h3>
            <span class="ins-category-count">${teams.length} ${teams.length === 1 ? 'equipo' : 'equipos'}</span>
          </div>
          <div class="ins-table-wrap">
            <table class="ins-table">
              <thead>
                <tr>
                  <th>Jugador A</th>
                  <th>Jugador B</th>
                  <th>Pago A</th>
                  <th>Pago B</th>
                  <th>Restriccion</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }).join('');

    list.innerHTML = blocks;
  }

  function renderTeamRow(t) {
    const a = t.playerA || {};
    const b = t.playerB || {};
    // Paid flags use camelCase from the DTO: playerAPaid / playerBPaid
    const aPaid = !!t.playerAPaid;
    const bPaid = !!t.playerBPaid;
    return `
      <tr>
        <td>
          <div><strong>${escapeHtml(nameOf(a))}</strong></div>
          ${a.phone ? `<div style="color:var(--text-secondary); font-size:12px;">${escapeHtml(a.phone)}</div>` : ''}
        </td>
        <td>
          <div><strong>${escapeHtml(nameOf(b))}</strong></div>
          ${b.phone ? `<div style="color:var(--text-secondary); font-size:12px;">${escapeHtml(b.phone)}</div>` : ''}
        </td>
        <td>${pill(aPaid ? 'Pagado' : 'Pendiente', aPaid ? 'green' : 'gray')}</td>
        <td>${pill(bPaid ? 'Pagado' : 'Pendiente', bPaid ? 'green' : 'gray')}</td>
        <td style="color:var(--text-secondary);">${escapeHtml(t.restriction || '—')}</td>
      </tr>`;
  }

  function nameOf(player) {
    // Backend uses snake_case for player names (TeamPlayerDto: @SerialName first_name/last_name).
    return [player.first_name, player.last_name].filter(Boolean).join(' ').trim() || '—';
  }

  function pill(label, color) {
    return `<span class="ins-paid-pill ${color}">${escapeHtml(label)}</span>`;
  }

  // ---------- Ajustes form ----------
  function populateAjustesForm(t) {
    document.getElementById('torneo-edit-name').value = t.name || '';
    document.getElementById('torneo-edit-start').value = (t.start_date || '').slice(0, 10);
    document.getElementById('torneo-edit-end').value = (t.end_date || '').slice(0, 10);
    document.getElementById('torneo-edit-location').value = t.location || '';
    document.getElementById('torneo-edit-type').value = t.type || 'Regular';
    document.getElementById('torneo-edit-lat').value = t.latitude ?? '';
    document.getElementById('torneo-edit-lng').value = t.longitude ?? '';
    document.getElementById('torneo-edit-max-points').value = t.max_points || '';
    document.getElementById('torneo-edit-club-logo').value = t.club_logo_url || '';
    document.getElementById('torneo-edit-enabled').checked = !!t.is_enabled;
    document.getElementById('torneo-edit-registration-open').checked = !!t.registration_open;
  }

  function readAjustesForm() {
    const lat = document.getElementById('torneo-edit-lat').value.trim();
    const lng = document.getElementById('torneo-edit-lng').value.trim();
    const clubLogo = document.getElementById('torneo-edit-club-logo').value.trim();
    return {
      name: document.getElementById('torneo-edit-name').value.trim(),
      start_date: document.getElementById('torneo-edit-start').value,
      end_date: document.getElementById('torneo-edit-end').value,
      location: document.getElementById('torneo-edit-location').value.trim() || null,
      latitude: lat === '' ? null : Number(lat),
      longitude: lng === '' ? null : Number(lng),
      type: document.getElementById('torneo-edit-type').value,
      max_points: document.getElementById('torneo-edit-max-points').value.trim() || null,
      club_logo_url: clubLogo === '' ? null : clubLogo,
    };
  }

  async function onSave(e) {
    e.preventDefault();
    if (!currentTournament) return;
    const payload = readAjustesForm();

    if (!payload.name) return APJToast?.error?.('Falta nombre', 'El torneo necesita un nombre.');
    if (!payload.start_date || !payload.end_date) return APJToast?.error?.('Faltan fechas', 'Inicio y fin son requeridos.');
    if (payload.start_date > payload.end_date) return APJToast?.error?.('Fechas invalidas', 'La fecha de inicio no puede ser despues del fin.');

    const btn = document.getElementById('torneo-edit-save');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Guardando...';

    try {
      await APJApi.updateTournament(currentTournament.id, payload);
      Object.assign(currentTournament, payload);
      // Update the cached entry in the list too (so the dropdown text refreshes)
      const idx = tournaments.findIndex(t => t.id === currentTournament.id);
      if (idx >= 0) Object.assign(tournaments[idx], payload);
      renderTournamentSelect();
      document.getElementById('torneo-select').value = currentTournament.id;
      APJToast?.success?.('Listo', 'Cambios guardados');
    } catch (error) {
      APJToast?.error?.('Error', humanizeError(error));
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  async function onToggleEnabled(e) {
    if (!currentTournament) return;
    const enabled = e.target.checked;
    try {
      await APJApi.setTournamentEnabled(currentTournament.id, enabled);
      currentTournament.is_enabled = enabled;
      const idx = tournaments.findIndex(t => t.id === currentTournament.id);
      if (idx >= 0) tournaments[idx].is_enabled = enabled;
      renderTournamentSelect();
      document.getElementById('torneo-select').value = currentTournament.id;
      APJToast?.success?.('Listo', enabled ? 'Torneo activado' : 'Torneo desactivado');
    } catch (error) {
      e.target.checked = !enabled; // revert
      APJToast?.error?.('Error', humanizeError(error));
    }
  }

  async function onToggleRegistration(e) {
    if (!currentTournament) return;
    const open = e.target.checked;
    try {
      await APJApi.setTournamentRegistrationOpen(currentTournament.id, open);
      currentTournament.registration_open = open;
      APJToast?.success?.('Listo', open ? 'Inscripciones abiertas' : 'Inscripciones cerradas');
    } catch (error) {
      e.target.checked = !open;
      APJToast?.error?.('Error', humanizeError(error));
    }
  }

  // ---------- Helpers ----------
  function showError(msg) {
    const el = document.getElementById('torneo-error');
    if (!el) return;
    el.textContent = msg; el.classList.remove('hidden');
  }
  function clearError() {
    const el = document.getElementById('torneo-error');
    if (!el) return;
    el.textContent = ''; el.classList.add('hidden');
  }

  function humanizeError(error) {
    if (!error) return 'Error desconocido';
    const status = error.status;
    if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (status === 403) return 'No tienes permisos para esta accion.';
    if (status === 404) return 'No encontrado.';
    return error.message || 'Ocurrio un error inesperado.';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(v) { return escapeHtml(v); }

  return { start };
})();
