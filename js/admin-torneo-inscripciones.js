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

    setTotalCount(null);

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
      setTotalCount(0);
      list.innerHTML = '<div class="profile-card"><div class="profile-card-body" style="text-align:center; color:var(--text-secondary); padding:32px 24px;">Aun no hay equipos inscritos en este torneo.</div></div>';
      return;
    }

    const total = groups.reduce((sum, g) => sum + (Array.isArray(g.teams) ? g.teams.length : 0), 0);
    setTotalCount(total);

    list.innerHTML = groups.map(group => {
      const catName = group.categoryName || group.category?.name || 'Sin categoria';
      const teams = Array.isArray(group.teams) ? group.teams : [];
      const rows = teams.map(t => renderRow(t)).join('');
      const color = colorForCategory(catName);
      const headerStyle = `background: ${color.bg}; border-left: 4px solid ${color.accent};`;
      const countStyle = `color: ${color.accent}; border-color: ${color.accent}; background: ${color.bg};`;
      return `
        <div class="ins-category-block">
          <div class="ins-category-header" style="${headerStyle}">
            <h3>${escapeHtml(catName)}</h3>
            <span class="ins-category-count" style="${countStyle}">${teams.length} ${teams.length === 1 ? 'equipo' : 'equipos'}</span>
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

  // Shows the tournament-wide pair count in the page header; pass null to
  // hide it (no tournament selected, loading, or error states).
  function setTotalCount(total) {
    const badge = document.getElementById('ins-total-count');
    if (!badge) return;
    if (total === null || total === undefined) {
      badge.style.display = 'none';
      badge.textContent = '';
      return;
    }
    badge.textContent = `${total} ${total === 1 ? 'pareja inscrita' : 'parejas inscritas'}`;
    badge.style.display = 'inline-flex';
  }

  // ----- Category color palette -----
  // Stable, distinct per category name so the same category keeps its color
  // across reloads and tournaments. Light tinted bg + accent border.
  const CATEGORY_PALETTE = [
    { bg: 'rgba(99,102,241,0.12)', accent: '#6366f1' },  // indigo
    { bg: 'rgba(236,72,153,0.12)', accent: '#ec4899' },  // pink
    { bg: 'rgba(16,185,129,0.12)', accent: '#10b981' },  // emerald
    { bg: 'rgba(245,158,11,0.14)', accent: '#d97706' },  // amber
    { bg: 'rgba(14,165,233,0.12)', accent: '#0ea5e9' },  // sky
    { bg: 'rgba(168,85,247,0.12)', accent: '#a855f7' },  // purple
    { bg: 'rgba(244,63,94,0.12)',  accent: '#f43f5e' },  // rose
    { bg: 'rgba(20,184,166,0.12)', accent: '#14b8a6' },  // teal
  ];

  function colorForCategory(name) {
    const s = String(name || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return CATEGORY_PALETTE[Math.abs(h) % CATEGORY_PALETTE.length];
  }

  function renderRow(t) {
    const a = t.playerA || {};
    const b = t.playerB || {};
    const aPaid = !!t.playerAPaid;
    const bPaid = !!t.playerBPaid;
    return `
      <tr>
        <td>${playerCell(a)}</td>
        <td>${playerCell(b)}</td>
        <td>${pill(aPaid ? 'Pagado' : 'Pendiente', aPaid ? 'green' : 'gray')}</td>
        <td>${pill(bPaid ? 'Pagado' : 'Pendiente', bPaid ? 'green' : 'gray')}</td>
        <td>${formatRestriction(t.restriction)}</td>
      </tr>`;
  }

  function playerCell(p) {
    return `
      <div class="ins-player-cell">
        <span class="name">${escapeHtml(nameOf(p))}</span>
        <span class="phone">${p && p.phone ? escapeHtml(p.phone) : '&nbsp;'}</span>
      </div>`;
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
    // The backend stores restrictions per-player as "NAME: payload" joined by
    // " / ". Split, peel the name prefix, parse the JSON payload, render chips.
    const entries = String(raw)
      .split(' / ')
      .map(s => s.trim())
      .filter(Boolean)
      .map(splitNameAndPayload);

    const chips = entries.flatMap(e => entryChips(e));
    if (chips.length === 0) {
      return restrictionChip('💬', escapeHtml(raw), 'gray');
    }
    return `<div class="ins-restriction-chips">${chips.join('')}</div>`;
  }

  // "Christian Urias: {json}" -> { name: "Christian Urias", payload: "{json}" }
  // "{json}"               -> { name: null, payload: "{json}" }
  function splitNameAndPayload(s) {
    const idx = s.indexOf(':');
    if (idx <= 0) return { name: null, payload: s };
    const maybeName = s.slice(0, idx).trim();
    const rest = s.slice(idx + 1).trim();
    // Heuristic: a name shouldn't contain { or " (those are JSON markers) and
    // shouldn't be ridiculously long.
    if (maybeName.length === 0 || maybeName.length > 80) return { name: null, payload: s };
    if (/[{}"]/.test(maybeName)) return { name: null, payload: s };
    return { name: maybeName, payload: rest };
  }

  function entryChips(entry) {
    const parsed = tryParseJson(entry.payload);
    const initials = entry.name ? initialsOf(entry.name) : null;
    if (!parsed || typeof parsed !== 'object') {
      // Couldn't parse — show the raw payload as a neutral chip.
      return [restrictionChip('💬', escapeHtml(entry.payload), 'gray', initials)];
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
        chips.push(restrictionChip('🚫', `No puede jugar ${escapeHtml(names)}`, 'red', initials));
      } else {
        chips.push(restrictionChip('✅', `Solo juega ${escapeHtml(names)}`, 'green', initials));
      }
    }
    if (typeof parsed.time_from === 'string' && /^\d{2}:\d{2}/.test(parsed.time_from)) {
      chips.push(restrictionChip('🕐', `Desde ${escapeHtml(formatTime12(parsed.time_from))}`, 'blue', initials));
    }
    if (chips.length === 0) {
      return [restrictionChip('💬', escapeHtml(entry.payload), 'gray', initials)];
    }
    return chips;
  }

  function initialsOf(full) {
    const parts = String(full).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    return parts.slice(0, 3).map(p => p[0]?.toUpperCase() || '').join('');
  }

  function restrictionChip(icon, label, color, initials) {
    const badge = initials
      ? `<span class="ins-restriction-chip-initials" title="${escapeHtml(initials)}">${escapeHtml(initials)}</span>`
      : '';
    return `<span class="ins-restriction-chip ${color}">${badge}<span class="ins-restriction-chip-icon">${icon}</span><span>${label}</span></span>`;
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
