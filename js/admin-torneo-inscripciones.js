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
        <td>${formatRestriction(t.restriction)}</td>
      </tr>`;
  }

  // ----- Restriction formatting -----
  // Accepts both the structured JSON contract emitted by the new restriction
  // picker (apps + web /inscripcion/) and the legacy free-text strings:
  //   { mode?: 'only'|'not', days?: number[1..7], time_from?: 'HH:mm' }
  // Returns escaped HTML safe to drop into a <td>. Multiple lines separated
  // by \n (CSS white-space: pre-line renders them).
  const ISO_DAY_NAMES = {
    1: 'Lunes', 2: 'Martes', 3: 'Miercoles', 4: 'Jueves',
    5: 'Viernes', 6: 'Sabado', 7: 'Domingo',
  };

  function formatRestriction(raw) {
    if (!raw || !String(raw).trim()) {
      return '<span style="color:var(--text-muted);">—</span>';
    }
    const parsed = tryParseJson(raw);
    if (!parsed || typeof parsed !== 'object') {
      // Legacy free text — render as a neutral chip.
      return restrictionChip('💬', escapeHtml(raw), 'gray');
    }
    const chips = [];
    const days = Array.isArray(parsed.days)
      ? parsed.days.filter(d => Number.isInteger(d) && d >= 1 && d <= 7)
      : [];
    if (days.length > 0) {
      const names = days
        .slice()
        .sort((a, b) => a - b)
        .map(d => ISO_DAY_NAMES[d])
        .filter(Boolean)
        .join(', ');
      if (parsed.mode === 'not') {
        chips.push(restrictionChip('🚫', `No puede jugar ${escapeHtml(names)}`, 'red'));
      } else {
        chips.push(restrictionChip('✅', `Solo juega ${escapeHtml(names)}`, 'green'));
      }
    }
    if (typeof parsed.time_from === 'string' && /^\d{2}:\d{2}/.test(parsed.time_from)) {
      chips.push(restrictionChip('🕐', `Desde ${escapeHtml(formatTime12(parsed.time_from))}`, 'blue'));
    }
    if (chips.length === 0) {
      return restrictionChip('💬', escapeHtml(raw), 'gray');
    }
    return `<div class="ins-restriction-chips">${chips.join('')}</div>`;
  }

  function restrictionChip(icon, label, color) {
    return `<span class="ins-restriction-chip ${color}"><span class="ins-restriction-chip-icon">${icon}</span><span>${label}</span></span>`;
  }

  function tryParseJson(s) {
    const text = String(s).trim();
    if (!text.startsWith('{') && !text.startsWith('[')) return null;
    try { return JSON.parse(text); } catch (_) { return null; }
  }

  function formatTime12(hhmm) {
    const [hStr, mStr] = hhmm.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
    const hour12 = ((h + 11) % 12) + 1;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
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
