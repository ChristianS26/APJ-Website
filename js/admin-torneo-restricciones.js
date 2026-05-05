// APJ Padel - Admin Torneo / Restricciones
// Mirrors the Courtbit Dashboard restriction-config panel: publish toggle,
// day chips (only ISO weekdays inside the tournament date range), optional
// time range with slot granularity. Reads/writes /api/tournaments/{id}/
// restriction-config.

const APJAdminTorneoRestricciones = (function () {
  const ISO_DAY_NAMES = {
    1: 'Lunes', 2: 'Martes', 3: 'Miercoles', 4: 'Jueves',
    5: 'Viernes', 6: 'Sabado', 7: 'Domingo',
  };

  let currentTournament = null;
  let serverConfig = null;
  // Local form state — reflects what the user is editing
  let state = defaultState();
  let dirty = false;

  function defaultState() {
    return {
      enabled: false,
      availableDays: [],
      hasTimeRange: false,
      timeFrom: '',
      timeTo: '',
      slotMinutes: 60,
    };
  }

  function start() {
    bind();
    refresh();
    window.addEventListener(APJAdminShell.TORNEO_CHANGED_EVENT, refresh);
  }

  function bind() {
    document.getElementById('restr-enabled')?.addEventListener('change', e => {
      state.enabled = !!e.target.checked;
      markDirty();
    });
    document.getElementById('restr-has-time-range')?.addEventListener('change', e => {
      state.hasTimeRange = !!e.target.checked;
      document.getElementById('restr-time-fields')?.classList.toggle('hidden', !state.hasTimeRange);
      markDirty();
    });
    document.getElementById('restr-time-from')?.addEventListener('input', e => {
      state.timeFrom = e.target.value;
      markDirty();
    });
    document.getElementById('restr-time-to')?.addEventListener('input', e => {
      state.timeTo = e.target.value;
      markDirty();
    });
    document.getElementById('restr-slot-min')?.addEventListener('change', e => {
      const v = clamp(parseInt(e.target.value, 10) || 60, 5, 180);
      e.target.value = v;
      state.slotMinutes = v;
      markDirty();
    });
    document.getElementById('restr-select-all')?.addEventListener('click', () => {
      const days = tournamentDays();
      state.availableDays = days.slice();
      renderDayChips();
      markDirty();
    });
    document.getElementById('restr-clear-all')?.addEventListener('click', () => {
      state.availableDays = [];
      renderDayChips();
      markDirty();
    });
    document.getElementById('restr-discard')?.addEventListener('click', () => {
      if (serverConfig) populateFromConfig(serverConfig);
    });
    document.getElementById('restr-save')?.addEventListener('click', onSave);
  }

  async function refresh() {
    const id = APJAdminShell.getSelectedTournamentId();
    const empty = document.getElementById('restr-empty');
    const content = document.getElementById('restr-content');
    const subtitle = document.getElementById('restr-tournament-subtitle');

    if (!id) {
      if (subtitle) subtitle.textContent = 'Selecciona un torneo en el menu lateral.';
      empty?.classList.remove('hidden');
      content?.classList.add('hidden');
      currentTournament = null;
      serverConfig = null;
      return;
    }

    const cached = APJAdminShell.getCachedTournament(id);
    if (subtitle && cached) {
      subtitle.textContent = `${cached.name} — ${formatDateShort(cached.start_date)} a ${formatDateShort(cached.end_date)}`;
    }
    if (cached) currentTournament = cached;

    empty?.classList.add('hidden');
    content?.classList.remove('hidden');

    // Render the day chips immediately based on cached dates
    renderDayChips();

    try {
      const fresh = await APJApi.getTournamentById(id);
      if (fresh) {
        currentTournament = fresh;
        if (subtitle) subtitle.textContent = `${fresh.name} — ${formatDateShort(fresh.start_date)} a ${formatDateShort(fresh.end_date)}`;
      }
      const cfg = await APJApi.getTournamentRestrictionConfig(id);
      serverConfig = cfg;
      populateFromConfig(cfg);
    } catch (error) {
      APJToast?.error?.('Error', humanizeError(error));
    }
  }

  function populateFromConfig(cfg) {
    state.enabled = !!cfg.enabled;
    state.availableDays = Array.isArray(cfg.available_days) ? cfg.available_days.slice() : [];
    state.hasTimeRange = !!(cfg.time_range_from && cfg.time_range_to);
    state.timeFrom = (cfg.time_range_from || '').slice(0, 5);
    state.timeTo = (cfg.time_range_to || '').slice(0, 5);
    state.slotMinutes = cfg.time_slot_minutes || 60;

    document.getElementById('restr-enabled').checked = state.enabled;
    document.getElementById('restr-has-time-range').checked = state.hasTimeRange;
    document.getElementById('restr-time-fields')?.classList.toggle('hidden', !state.hasTimeRange);
    document.getElementById('restr-time-from').value = state.timeFrom;
    document.getElementById('restr-time-to').value = state.timeTo;
    document.getElementById('restr-slot-min').value = state.slotMinutes;
    renderDayChips();
    setDirty(false);
  }

  // ---------- Days ----------
  // ISO weekdays within the tournament date range, in chronological order
  function tournamentDays() {
    if (!currentTournament?.start_date || !currentTournament?.end_date) return [];
    const start = new Date(currentTournament.start_date + 'T00:00:00');
    const end = new Date(currentTournament.end_date + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    const seen = new Set();
    const out = [];
    const cur = new Date(start);
    while (cur <= end) {
      const js = cur.getDay();           // 0=Sun..6=Sat
      const iso = js === 0 ? 7 : js;     // 1=Mon..7=Sun
      if (!seen.has(iso)) { seen.add(iso); out.push(iso); }
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  function renderDayChips() {
    const wrap = document.getElementById('restr-day-chips');
    const hint = document.getElementById('restr-days-range-hint');
    if (!wrap) return;

    const days = tournamentDays();
    if (hint && currentTournament) {
      const a = formatDateShort(currentTournament.start_date);
      const b = formatDateShort(currentTournament.end_date);
      hint.textContent = `Solo se muestran los días dentro del rango del torneo (${a} a ${b}).`;
    }

    if (days.length === 0) {
      wrap.innerHTML = '<span style="color:var(--text-secondary); font-size:13px;">El torneo no tiene fechas válidas.</span>';
      return;
    }

    // Sanitize selected days to those actually in range
    state.availableDays = state.availableDays.filter(d => days.includes(d));

    wrap.innerHTML = days.map(d => {
      const active = state.availableDays.includes(d) ? ' active' : '';
      return `<button type="button" class="day-chip${active}" data-iso="${d}">${ISO_DAY_NAMES[d]}</button>`;
    }).join('');

    wrap.querySelectorAll('.day-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const iso = parseInt(btn.getAttribute('data-iso'), 10);
        if (!Number.isFinite(iso)) return;
        if (state.availableDays.includes(iso)) {
          state.availableDays = state.availableDays.filter(d => d !== iso);
        } else {
          // Keep chronological order based on tournament range
          const all = tournamentDays();
          const next = state.availableDays.concat(iso);
          state.availableDays = all.filter(d => next.includes(d));
        }
        renderDayChips();
        markDirty();
      });
    });
  }

  // ---------- Save ----------
  async function onSave() {
    if (!currentTournament) return;

    if (state.hasTimeRange) {
      if (!state.timeFrom || !state.timeTo) {
        return APJToast?.error?.('Faltan horarios', 'Define un "Desde" y un "Hasta" o desactiva el rango horario.');
      }
      if (state.timeFrom >= state.timeTo) {
        return APJToast?.error?.('Horario invalido', '"Desde" debe ser anterior a "Hasta".');
      }
    }

    const btn = document.getElementById('restr-save');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Guardando...';

    const payload = {
      enabled: state.enabled,
      available_days: state.availableDays.slice().sort((a, b) => a - b),
      time_range_from: state.hasTimeRange ? state.timeFrom : null,
      time_range_to: state.hasTimeRange ? state.timeTo : null,
      time_slot_minutes: state.slotMinutes,
    };

    try {
      const saved = await APJApi.saveTournamentRestrictionConfig(currentTournament.id, payload);
      serverConfig = saved;
      populateFromConfig(saved);
      APJToast?.success?.('Listo', 'Restricciones guardadas');
    } catch (error) {
      APJToast?.error?.('Error', humanizeError(error));
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  // ---------- Helpers ----------
  function setDirty(value) {
    dirty = value;
    document.getElementById('restr-dirty')?.classList.toggle('hidden', !value);
  }
  function markDirty() { setDirty(true); }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function formatDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function humanizeError(error) {
    if (!error) return 'Error desconocido';
    const status = error.status;
    if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (status === 403) return 'No tienes permisos para esta accion.';
    if (status === 404) return 'No encontrado.';
    if (status === 400 && error.data?.errors) return error.data.errors.join(', ');
    return error.message || 'Ocurrio un error inesperado.';
  }

  return { start };
})();
