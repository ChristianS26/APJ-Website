// APJ Padel - Player restriction picker (web /inscripcion/)
// Reads /api/tournaments/{id}/restriction-config; if the admin enabled
// restrictions, renders a toggle + structured picker that mirrors the
// Courtbit pattern. Used by registration.js — call init(tournamentId)
// after loading the tournament, and serialize() right before submit.

const RestrictionPicker = (function () {
  const ISO_DAY_NAMES = {
    1: 'Lunes', 2: 'Martes', 3: 'Miercoles', 4: 'Jueves',
    5: 'Viernes', 6: 'Sabado', 7: 'Domingo',
  };

  const state = {
    enabled: false,        // outer toggle (player has any restriction)
    mode: 'only',          // 'only' | 'not'
    days: [],              // ISO 1..7
    timeEnabled: false,    // inner toggle for time range
    timeFrom: '',          // 'HH:mm'
  };

  let config = null;       // last fetched RestrictionConfig
  let timeSlots = [];      // generated from config.time_range_from..to / time_slot_minutes

  async function init(tournamentId) {
    const section = document.getElementById('restriction-section');
    if (!section || !tournamentId) {
      hide();
      return;
    }
    try {
      config = await APJApi.getTournamentRestrictionConfig(tournamentId);
    } catch (e) {
      hide();
      return;
    }
    if (!config?.enabled || !Array.isArray(config.available_days) || config.available_days.length === 0) {
      hide();
      return;
    }

    show();
    timeSlots = buildTimeSlots(config.time_range_from, config.time_range_to, config.time_slot_minutes);
    resetState();
    render();
    bind();
  }

  function show() { document.getElementById('restriction-section')?.classList.remove('hidden'); }
  function hide() { document.getElementById('restriction-section')?.classList.add('hidden'); }

  function resetState() {
    state.enabled = false;
    state.mode = 'only';
    state.days = [];
    state.timeEnabled = false;
    state.timeFrom = '';
    document.getElementById('restriction-on').checked = false;
    document.getElementById('restriction-time-on').checked = false;
    document.getElementById('restriction-picker')?.classList.add('hidden');
    const timeFromEl = document.getElementById('restriction-time-from');
    if (timeFromEl) {
      timeFromEl.value = '';
      timeFromEl.classList.add('hidden');
    }
  }

  function render() {
    // Day chips — only the days the admin allowed
    const wrap = document.getElementById('restriction-day-chips');
    if (wrap) {
      const days = (config.available_days || []).slice().sort((a, b) => a - b);
      wrap.innerHTML = days.map(d => {
        const active = state.days.includes(d) ? ' active' : '';
        return `<button type="button" class="day-chip${active}" data-iso="${d}">${ISO_DAY_NAMES[d] || d}</button>`;
      }).join('');
    }

    // Time block visibility — only when admin defined a range
    const timeBlock = document.getElementById('restriction-time-block');
    if (timeBlock) {
      const hasRange = timeSlots.length > 0;
      timeBlock.classList.toggle('hidden', !hasRange);
    }

    // Time slots — populate the dropdown
    const timeFromEl = document.getElementById('restriction-time-from');
    if (timeFromEl) {
      timeFromEl.innerHTML = '<option value="">Selecciona</option>' + timeSlots
        .map(t => `<option value="${t}">${formatTimeLabel(t)}</option>`)
        .join('');
    }

    // Mode buttons
    document.querySelectorAll('.restriction-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === state.mode);
    });
  }

  function bind() {
    // Outer toggle
    document.getElementById('restriction-on')?.addEventListener('change', (e) => {
      state.enabled = !!e.target.checked;
      const picker = document.getElementById('restriction-picker');
      if (state.enabled) picker?.classList.remove('hidden');
      else picker?.classList.add('hidden');
    });

    // Mode buttons
    document.querySelectorAll('.restriction-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mode = btn.getAttribute('data-mode') || 'only';
        render();
      });
    });

    // Day chips (delegated)
    document.getElementById('restriction-day-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.day-chip');
      if (!btn) return;
      const iso = parseInt(btn.getAttribute('data-iso'), 10);
      if (!Number.isFinite(iso)) return;
      if (state.days.includes(iso)) {
        state.days = state.days.filter(d => d !== iso);
      } else {
        state.days = state.days.concat(iso).sort((a, b) => a - b);
      }
      render();
    });

    // Time toggle
    document.getElementById('restriction-time-on')?.addEventListener('change', (e) => {
      state.timeEnabled = !!e.target.checked;
      const select = document.getElementById('restriction-time-from');
      if (state.timeEnabled) select?.classList.remove('hidden');
      else {
        select?.classList.add('hidden');
        state.timeFrom = '';
        if (select) select.value = '';
      }
    });

    // Time select
    document.getElementById('restriction-time-from')?.addEventListener('change', (e) => {
      state.timeFrom = e.target.value || '';
    });
  }

  // Returns the JSON string to send as `restriction`, or '' if no restriction.
  function serialize() {
    const section = document.getElementById('restriction-section');
    if (!section || section.classList.contains('hidden')) return '';
    if (!state.enabled) return '';

    const out = {};
    if (state.days.length > 0) {
      out.mode = state.mode;
      out.days = state.days.slice().sort((a, b) => a - b);
    }
    if (state.timeEnabled && state.timeFrom) {
      out.time_from = state.timeFrom;
    }
    if (Object.keys(out).length === 0) return '';
    return JSON.stringify(out);
  }

  // ---------- Helpers ----------
  function buildTimeSlots(fromStr, toStr, slotMinutes) {
    if (!fromStr || !toStr) return [];
    const from = parseHHmm(fromStr);
    const to = parseHHmm(toStr);
    const step = Number(slotMinutes) > 0 ? Number(slotMinutes) : 30;
    if (from == null || to == null || from >= to) return [];
    const out = [];
    for (let m = from; m <= to; m += step) {
      out.push(toHHmm(m));
    }
    return out;
  }

  function parseHHmm(s) {
    if (typeof s !== 'string') return null;
    const m = s.match(/^(\d{2}):(\d{2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  function toHHmm(totalMin) {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function formatTimeLabel(t) {
    const m = parseHHmm(t);
    if (m == null) return t;
    const h = Math.floor(m / 60);
    const min = m % 60;
    if (t === '23:59') return 'Medianoche (12:00 AM)';
    const hour12 = ((h + 11) % 12) + 1;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${hour12}:${String(min).padStart(2, '0')} ${ampm}`;
  }

  return { init, serialize };
})();
