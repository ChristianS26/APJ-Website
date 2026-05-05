// APJ Padel - Player restriction picker (web /inscripcion/)
// Mirrors the Courtbit pattern: outer toggle + 3 mutually-exclusive types.
// User picks ONE type and configures it (a single day or a time).
//
// Wire format (backwards compatible with the admin Inscripciones display):
//   play_only_day day 3  → { "mode": "only", "days": [3] }
//   exclude_day   day 3  → { "mode": "not",  "days": [3] }
//   play_from_time 20:00 → { "time_from": "20:00" }

const RestrictionPicker = (function () {
  const ISO_DAY_NAMES = {
    1: 'Lunes', 2: 'Martes', 3: 'Miercoles', 4: 'Jueves',
    5: 'Viernes', 6: 'Sabado', 7: 'Domingo',
  };

  // Discrete types — user picks ONE.
  const TYPES = {
    PLAY_ONLY_DAY:  'play_only_day',
    EXCLUDE_DAY:    'exclude_day',
    PLAY_FROM_TIME: 'play_from_time',
  };

  const TYPE_OPTIONS = [
    { type: TYPES.PLAY_ONLY_DAY,  icon: '✅', label: 'Solo puedo jugar un día específico' },
    { type: TYPES.EXCLUDE_DAY,    icon: '🚫', label: 'No puedo jugar un día específico' },
    { type: TYPES.PLAY_FROM_TIME, icon: '🕐', label: 'Solo puedo jugar a partir de cierta hora' },
  ];

  const state = {
    enabled: false,
    type: TYPES.PLAY_ONLY_DAY,
    selectedDay: null,   // single ISO 1..7
    selectedTime: '',    // 'HH:mm'
  };

  let config = null;

  async function init(tournamentId) {
    const section = document.getElementById('restriction-section');
    if (!section || !tournamentId) { hide(); return; }
    try {
      config = await APJApi.getTournamentRestrictionConfig(tournamentId);
    } catch (_) {
      hide();
      return;
    }
    if (!config?.enabled) { hide(); return; }
    const hasDays = Array.isArray(config.available_days) && config.available_days.length > 0;
    const hasTime = !!config.time_range_from && !!config.time_range_to;
    if (!hasDays && !hasTime) { hide(); return; }

    show();
    resetState();
    // Auto-pick the first enabled type so the picker is usable immediately
    state.type = hasDays ? TYPES.PLAY_ONLY_DAY : TYPES.PLAY_FROM_TIME;
    render();
    bind();
  }

  function show() { document.getElementById('restriction-section')?.classList.remove('hidden'); }
  function hide() { document.getElementById('restriction-section')?.classList.add('hidden'); }

  function resetState() {
    state.enabled = false;
    state.selectedDay = null;
    state.selectedTime = '';
    document.getElementById('restriction-on').checked = false;
    document.getElementById('restriction-picker')?.classList.add('hidden');
  }

  function render() {
    const hasDays = Array.isArray(config.available_days) && config.available_days.length > 0;
    const hasTime = !!config.time_range_from && !!config.time_range_to;

    // Render type options (filter to those with data)
    const typesWrap = document.getElementById('restriction-type-options');
    if (typesWrap) {
      const visible = TYPE_OPTIONS.filter(t => {
        if (t.type === TYPES.PLAY_FROM_TIME) return hasTime;
        return hasDays;
      });
      typesWrap.innerHTML = visible.map(t => {
        const active = state.type === t.type ? ' active' : '';
        return `
          <button type="button" class="restriction-type-btn${active}" data-type="${t.type}">
            <span class="restriction-type-icon">${t.icon}</span>
            <span>${t.label}</span>
          </button>`;
      }).join('');
    }

    // Render the per-type body (day chips OR time slots) — exactly one
    const dayWrap = document.getElementById('restriction-day-chips');
    const timeWrap = document.getElementById('restriction-time-block');
    const dayBlock = document.getElementById('restriction-day-block');

    const showDays = state.type === TYPES.PLAY_ONLY_DAY || state.type === TYPES.EXCLUDE_DAY;
    const showTime = state.type === TYPES.PLAY_FROM_TIME;
    dayBlock?.classList.toggle('hidden', !showDays);
    timeWrap?.classList.toggle('hidden', !showTime);

    if (showDays && dayWrap) {
      const days = (config.available_days || []).slice().sort((a, b) => a - b);
      dayWrap.innerHTML = days.map(d => {
        const active = state.selectedDay === d ? ' active' : '';
        return `<button type="button" class="day-chip${active}" data-iso="${d}">${ISO_DAY_NAMES[d] || d}</button>`;
      }).join('');
    }

    if (showTime) {
      const select = document.getElementById('restriction-time-from');
      if (select) {
        const slots = buildTimeSlots(config.time_range_from, config.time_range_to, config.time_slot_minutes);
        select.innerHTML = '<option value="">Selecciona una hora</option>' + slots
          .map(t => `<option value="${t}"${t === state.selectedTime ? ' selected' : ''}>${formatTimeLabel(t)}</option>`)
          .join('');
      }
    }
  }

  function bind() {
    document.getElementById('restriction-on')?.addEventListener('change', (e) => {
      state.enabled = !!e.target.checked;
      const picker = document.getElementById('restriction-picker');
      if (state.enabled) picker?.classList.remove('hidden');
      else {
        picker?.classList.add('hidden');
        // Clear selections when disabled
        state.selectedDay = null;
        state.selectedTime = '';
      }
    });

    // Type buttons (delegated)
    document.getElementById('restriction-type-options')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.restriction-type-btn');
      if (!btn) return;
      const t = btn.getAttribute('data-type');
      if (!t || t === state.type) return;
      state.type = t;
      // Clear previous selection — switching type means starting over
      state.selectedDay = null;
      state.selectedTime = '';
      render();
    });

    // Day chips (single-select; delegated)
    document.getElementById('restriction-day-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.day-chip');
      if (!btn) return;
      const iso = parseInt(btn.getAttribute('data-iso'), 10);
      if (!Number.isFinite(iso)) return;
      state.selectedDay = (state.selectedDay === iso) ? null : iso;
      render();
    });

    // Time select
    document.getElementById('restriction-time-from')?.addEventListener('change', (e) => {
      state.selectedTime = e.target.value || '';
    });
  }

  // Returns the JSON string to send as `restriction`, or '' when no restriction.
  function serialize() {
    const section = document.getElementById('restriction-section');
    if (!section || section.classList.contains('hidden')) return '';
    if (!state.enabled) return '';

    if (state.type === TYPES.PLAY_FROM_TIME) {
      if (!state.selectedTime) return '';
      return JSON.stringify({ time_from: state.selectedTime });
    }
    if (state.selectedDay == null) return '';
    const mode = state.type === TYPES.EXCLUDE_DAY ? 'not' : 'only';
    return JSON.stringify({ mode, days: [state.selectedDay] });
  }

  // ---------- Helpers ----------
  function buildTimeSlots(fromStr, toStr, slotMinutes) {
    if (!fromStr || !toStr) return [];
    const from = parseHHmm(fromStr);
    const to = parseHHmm(toStr);
    const step = Number(slotMinutes) > 0 ? Number(slotMinutes) : 30;
    if (from == null || to == null || from >= to) return [];
    const out = [];
    for (let m = from; m <= to; m += step) out.push(toHHmm(m));
    return out;
  }
  function parseHHmm(s) {
    if (typeof s !== 'string') return null;
    const m = s.match(/^(\d{2}):(\d{2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }
  function toHHmm(totalMin) {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  function formatTimeLabel(t) {
    if (t === '23:59') return 'Medianoche (12:00 AM)';
    const m = parseHHmm(t);
    if (m == null) return t;
    const h = Math.floor(m / 60), min = m % 60;
    const hour12 = ((h + 11) % 12) + 1;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${hour12}:${String(min).padStart(2, '0')} ${ampm}`;
  }

  return { init, serialize };
})();
