// APJ Padel - Admin Torneo / Inscripciones
// Reads the active tournament id from the shell selector and renders the
// teams grouped by category. Listens for selector changes and refreshes.

const APJAdminTorneoInscripciones = (function () {

  function start() {
    refresh();
    window.addEventListener(APJAdminShell.TORNEO_CHANGED_EVENT, refresh);
  }

  async function refresh() {
    const id = APJAdminShell.getSelectedTournamentId();
    const list = document.getElementById('ins-list');
    const subtitle = document.getElementById('ins-tournament-subtitle');

    if (!id) {
      if (subtitle) subtitle.textContent = 'Selecciona un torneo en el menu lateral.';
      if (list) list.innerHTML = `
        <div class="profile-card">
          <div class="profile-card-body" style="text-align:center; color:var(--text-secondary); padding:48px 24px;">
            Selecciona un torneo arriba para ver sus inscripciones.
          </div>
        </div>`;
      return;
    }

    const cached = APJAdminShell.getCachedTournament(id);
    if (subtitle && cached) subtitle.textContent = `${cached.name} — ${(cached.start_date || '').slice(0, 10)}`;

    if (list) list.innerHTML = `
      <div class="profile-loading-page" style="padding:32px 0;">
        <div class="spinner" style="width:24px; height:24px;"></div>
        <p style="font-size:13px;">Cargando inscripciones...</p>
      </div>`;

    try {
      const groups = await APJApi.getTeamsByTournamentGrouped(id);
      render(groups);
    } catch (error) {
      if (list) list.innerHTML = `<div class="profile-card"><div class="profile-card-body" style="color:#ef4444; padding:24px;">${escapeHtml(humanizeError(error))}</div></div>`;
    }
  }

  function render(groups) {
    const list = document.getElementById('ins-list');
    if (!list) return;
    if (!Array.isArray(groups) || groups.length === 0) {
      list.innerHTML = '<div class="profile-card"><div class="profile-card-body" style="text-align:center; color:var(--text-secondary); padding:32px 24px;">Aun no hay equipos inscritos en este torneo.</div></div>';
      return;
    }

    list.innerHTML = groups.map(group => {
      const catName = group.categoryName || group.category?.name || 'Sin categoria';
      const teams = Array.isArray(group.teams) ? group.teams : [];
      const rows = teams.map(t => renderRow(t)).join('');
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
  }

  function renderRow(t) {
    const a = t.playerA || {};
    const b = t.playerB || {};
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

  function nameOf(p) {
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';
  }
  function pill(label, color) {
    return `<span class="ins-paid-pill ${color}">${escapeHtml(label)}</span>`;
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

  return { start };
})();
