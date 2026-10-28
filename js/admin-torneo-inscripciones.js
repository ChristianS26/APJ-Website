// APJ Padel - Admin Torneo / Inscripciones
// Reads the active tournament id from the shell selector and renders the
// teams grouped by category. Listens for selector changes and refreshes.
// Clicking a pair opens its detail modal, where the admin can add/remove
// restrictions manually using the same templates players get at signup
// (solo un día / no puede un día / a partir de cierta hora).

const APJAdminTorneoInscripciones = (function () {

  let lastGroups = [];
  let teamsById = new Map();
  let restrictionConfig = null;   // tournament restriction-config (template options)

  // Detail modal state
  const detail = {
    team: null,
    entries: [],          // [{ name, payload }] — what gets saved
    editing: null,        // 'A' | 'B' — player whose add-form is open
    type: 'play_only_day',
    saving: false,
  };

  function start() {
    bindDetail();
    refresh();
    window.addEventListener(APJAdminShell.TORNEO_CHANGED_EVENT, refresh);
  }

  async function refresh() {
    const id = APJAdminShell.getSelectedTournamentId();
    const list = document.getElementById('ins-list');
    const subtitle = document.getElementById('ins-tournament-subtitle');

    setTotalCount(null);
    closeDetail();
    restrictionConfig = null;

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
      loadRestrictionConfig(id);
    } catch (error) {
      if (list) list.innerHTML = `<div class="profile-card"><div class="profile-card-body" style="color:#ef4444; padding:24px;">${escapeHtml(humanizeError(error))}</div></div>`;
    }
  }

  function render(groups) {
    const list = document.getElementById('ins-list');
    if (!list) return;
    lastGroups = Array.isArray(groups) ? groups : [];
    teamsById = new Map();
    lastGroups.forEach(g => (g.teams || []).forEach(t => teamsById.set(t.id, { ...t, categoryName: g.categoryName || g.category?.name })));
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
      <tr class="ins-row" data-team-id="${escapeHtml(t.id)}" tabindex="0" title="Ver detalle de la pareja">
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

  // ----- Pair detail modal -----
  const TYPES = {
    PLAY_ONLY_DAY:  'play_only_day',
    EXCLUDE_DAY:    'exclude_day',
    PLAY_FROM_TIME: 'play_from_time',
  };
  const TYPE_OPTIONS = [
    { type: TYPES.PLAY_ONLY_DAY,  icon: '✅', label: 'Solo un día',  hint: 'Elige el único día en que puede jugar' },
    { type: TYPES.EXCLUDE_DAY,    icon: '🚫', label: 'No puede',     hint: 'Elige el día en que no puede jugar' },
    { type: TYPES.PLAY_FROM_TIME, icon: '🕐', label: 'Desde hora',   hint: 'Elige a partir de qué hora puede jugar' },
  ];
  // Fallback when the tournament has no time range configured: same slots the
  // Restricciones page offers (1 PM to midnight, every 30 min).
  const DEFAULT_TIME_FROM = '13:00';
  const DEFAULT_TIME_TO = '23:59';
  const DEFAULT_SLOT_MINUTES = 30;

  async function loadRestrictionConfig(tournamentId) {
    try {
      const cfg = await APJApi.getTournamentRestrictionConfig(tournamentId);
      if (APJAdminShell.getSelectedTournamentId() === tournamentId) restrictionConfig = cfg;
    } catch (_) {
      restrictionConfig = null;
    }
  }

  function bindDetail() {
    document.getElementById('ins-list')?.addEventListener('click', e => {
      const row = e.target.closest('.ins-row');
      if (row) openDetail(row.getAttribute('data-team-id'));
    });
    document.getElementById('ins-list')?.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('.ins-row');
      if (!row) return;
      e.preventDefault();
      openDetail(row.getAttribute('data-team-id'));
    });

    const overlay = document.getElementById('ins-detail-modal');
    overlay?.addEventListener('click', e => { if (e.target === overlay) closeDetail(); });
    document.querySelectorAll('[data-ins-close]').forEach(btn => btn.addEventListener('click', closeDetail));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

    // Everything inside the body is re-rendered, so delegate from the container
    const body = document.getElementById('ins-detail-body');
    body?.addEventListener('click', e => {
      const remove = e.target.closest('[data-remove-entry]');
      if (remove) {
        const idx = parseInt(remove.getAttribute('data-remove-entry'), 10);
        if (Number.isInteger(idx)) detail.entries.splice(idx, 1);
        return renderDetailBody();
      }
      const open = e.target.closest('[data-add-for]');
      if (open) {
        const key = open.getAttribute('data-add-for');
        detail.editing = detail.editing === key ? null : key;
        detail.type = templateDays().length > 0 ? TYPES.PLAY_ONLY_DAY : TYPES.PLAY_FROM_TIME;
        return renderDetailBody();
      }
      const typeBtn = e.target.closest('[data-type]');
      if (typeBtn) {
        detail.type = typeBtn.getAttribute('data-type');
        return renderDetailBody();
      }
      const day = e.target.closest('[data-iso]');
      if (day) {
        const iso = parseInt(day.getAttribute('data-iso'), 10);
        const mode = detail.type === TYPES.EXCLUDE_DAY ? 'not' : 'only';
        if (Number.isFinite(iso)) addEntry(JSON.stringify({ mode, days: [iso] }));
      }
    });
    body?.addEventListener('change', e => {
      if (e.target.id !== 'ins-detail-time' || !e.target.value) return;
      addEntry(JSON.stringify({ time_from: e.target.value }));
    });
    document.getElementById('ins-detail-save')?.addEventListener('click', saveDetail);
  }

  function openDetail(teamId) {
    const team = teamsById.get(teamId);
    if (!team) return;
    detail.team = team;
    detail.entries = parseEntries(team.restriction);
    detail.editing = null;
    detail.saving = false;

    document.getElementById('ins-detail-title').textContent = team.categoryName || 'Detalle de pareja';
    document.getElementById('ins-detail-subtitle').textContent =
      `${nameOf(team.playerA || {})} y ${nameOf(team.playerB || {})}`;
    renderDetailBody();
    setDetailSaving(false);
    document.getElementById('ins-detail-modal')?.classList.add('active');
  }

  function closeDetail() {
    if (detail.saving) return;
    detail.team = null;
    document.getElementById('ins-detail-modal')?.classList.remove('active');
  }

  function parseEntries(raw) {
    if (!raw || !String(raw).trim()) return [];
    return String(raw).split(' / ').map(s => s.trim()).filter(Boolean).map(splitNameAndPayload);
  }

  function serializeEntries(entries) {
    return entries.map(e => (e.name ? `${e.name}: ${e.payload}` : e.payload)).join(' / ');
  }

  // Same name the registration flows prefix entries with.
  function entryNameOf(p) {
    return [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || null;
  }

  function sameName(a, b) {
    return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  // One block per player with their restrictions; entries whose name matches
  // neither current player (legacy text, replaced player) go in "Otras".
  function renderDetailBody() {
    const team = detail.team;
    const body = document.getElementById('ins-detail-body');
    if (!team || !body) return;

    const players = [['A', team.playerA || {}], ['B', team.playerB || {}]];
    const indexed = detail.entries.map((entry, i) => ({ entry, i }));
    const owned = new Set();

    let html = players.map(([key, p]) => {
      const name = entryNameOf(p);
      const mine = indexed.filter(x => sameName(x.entry.name, name));
      mine.forEach(x => owned.add(x.i));
      const editing = detail.editing === key;
      return `
        <div class="ins-detail-player">
          <div class="ins-detail-player-head">
            <span class="ins-detail-player-name">${escapeHtml(nameOf(p))}</span>
            <button type="button" class="ins-detail-add-btn${editing ? ' active' : ''}" data-add-for="${key}">
              ${editing ? 'Cerrar' : '+ Agregar'}
            </button>
          </div>
          ${renderEntryList(mine)}
          ${editing ? renderAddForm() : ''}
        </div>`;
    }).join('');

    const others = indexed.filter(x => !owned.has(x.i));
    if (others.length > 0) {
      html += `
        <div class="ins-detail-player">
          <div class="ins-detail-player-head"><span class="ins-detail-player-name">Otras</span></div>
          ${renderEntryList(others, true)}
        </div>`;
    }
    body.innerHTML = html;
  }

  function renderEntryList(items, showName) {
    if (items.length === 0) return '<p class="ins-detail-empty">Sin restricciones</p>';
    return `<div class="ins-detail-entries">${items.map(({ entry, i }) => {
      const label = showName && entry.name ? `<span class="ins-detail-entry-name">${escapeHtml(entry.name)}</span>` : '';
      return `
        <span class="ins-detail-entry">
          ${label}${entryChips({ name: null, payload: entry.payload }).join('')}
          <button type="button" class="ins-detail-entry-remove" data-remove-entry="${i}" aria-label="Quitar restricción" title="Quitar">×</button>
        </span>`;
    }).join('')}</div>`;
  }

  function renderAddForm() {
    const days = templateDays();
    const times = templateTimes();
    const options = TYPE_OPTIONS.filter(t => (t.type === TYPES.PLAY_FROM_TIME ? times.length > 0 : days.length > 0));
    const current = options.find(t => t.type === detail.type) || options[0];
    if (!current) return '<p class="ins-detail-empty">El torneo no tiene días ni horarios disponibles.</p>';

    const segments = options.map(t => `
      <button type="button" class="ins-detail-seg${t.type === current.type ? ' active' : ''}" data-type="${t.type}">
        <span aria-hidden="true">${t.icon}</span> ${t.label}
      </button>`).join('');

    const picker = current.type === TYPES.PLAY_FROM_TIME
      ? `<select id="ins-detail-time" class="form-select">
           <option value="">Selecciona una hora</option>
           ${times.map(t => `<option value="${t}">${escapeHtml(formatTimeLabel(t))}</option>`).join('')}
         </select>`
      : `<div class="ins-detail-days">${days.map(d =>
          `<button type="button" class="ins-detail-day" data-iso="${d}">${ISO_DAY_NAMES[d] || d}</button>`).join('')}</div>`;

    return `
      <div class="ins-detail-form">
        <div class="ins-detail-segs">${segments}</div>
        <p class="ins-detail-hint">${escapeHtml(current.hint)}</p>
        ${picker}
      </div>`;
  }

  function addEntry(payload) {
    const team = detail.team;
    if (!team || !detail.editing) return;
    const p = detail.editing === 'B' ? team.playerB : team.playerA;
    detail.entries.push({ name: entryNameOf(p), payload });
    detail.editing = null;
    renderDetailBody();
  }

  // Days offered by the template: the tournament's configured days, or every
  // weekday in the tournament range when the admin hasn't configured any.
  function templateDays() {
    const cfgDays = Array.isArray(restrictionConfig?.available_days) ? restrictionConfig.available_days : [];
    if (cfgDays.length > 0) return cfgDays.slice().sort((a, b) => a - b);
    return tournamentDays();
  }

  function templateTimes() {
    const hasRange = !!restrictionConfig?.time_range_from && !!restrictionConfig?.time_range_to;
    const from = hasRange ? restrictionConfig.time_range_from : DEFAULT_TIME_FROM;
    const to = hasRange ? restrictionConfig.time_range_to : DEFAULT_TIME_TO;
    const step = hasRange ? restrictionConfig.time_slot_minutes : DEFAULT_SLOT_MINUTES;
    return buildTimeSlots(from, to, step);
  }

  function tournamentDays() {
    const t = APJAdminShell.getCachedTournament(APJAdminShell.getSelectedTournamentId());
    if (!t?.start_date || !t?.end_date) return [1, 2, 3, 4, 5, 6, 7];
    const start = new Date(String(t.start_date).slice(0, 10) + 'T00:00:00');
    const end = new Date(String(t.end_date).slice(0, 10) + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [1, 2, 3, 4, 5, 6, 7];
    const out = [];
    const cur = new Date(start);
    while (cur <= end && out.length < 7) {
      const iso = cur.getDay() === 0 ? 7 : cur.getDay();
      if (!out.includes(iso)) out.push(iso);
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  async function saveDetail() {
    const team = detail.team;
    if (!team || detail.saving) return;
    const restriction = serializeEntries(detail.entries);
    setDetailSaving(true);
    try {
      await APJApi.updateTeamRestriction(team.id, restriction);
      // Patch the cached groups so the table reflects the change without a refetch
      lastGroups.forEach(g => (g.teams || []).forEach(t => { if (t.id === team.id) t.restriction = restriction; }));
      detail.saving = false;
      closeDetail();
      render(lastGroups);
      APJToast?.success?.('Listo', 'Restricciones guardadas');
    } catch (error) {
      APJToast?.error?.('Error', humanizeError(error));
    } finally {
      setDetailSaving(false);
    }
  }

  function setDetailSaving(saving) {
    detail.saving = saving;
    const btn = document.getElementById('ins-detail-save');
    if (!btn) return;
    btn.disabled = saving;
    btn.innerHTML = saving ? '<span class="spinner"></span> Guardando...' : 'Guardar cambios';
  }

  function buildTimeSlots(fromStr, toStr, slotMinutes) {
    const from = parseHHmm(fromStr);
    const to = parseHHmm(toStr);
    const step = Number(slotMinutes) > 0 ? Number(slotMinutes) : 30;
    if (from == null || to == null || from >= to) return [];
    const out = [];
    for (let m = from; m <= to; m += step) out.push(toHHmm(m));
    return out;
  }
  function parseHHmm(s) {
    const m = typeof s === 'string' ? s.match(/^(\d{2}):(\d{2})/) : null;
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }
  function toHHmm(totalMin) {
    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }
  function formatTimeLabel(t) {
    if (t === '23:59') return 'Medianoche (12:00 AM)';
    return formatTime12(t);
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
