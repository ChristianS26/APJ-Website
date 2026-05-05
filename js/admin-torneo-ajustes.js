// APJ Padel - Admin Torneo / Ajustes
// Reads the active tournament id from the shell selector and renders an
// editable form. Listens for selector changes and refreshes.

const APJAdminTorneoAjustes = (function () {
  let currentTournament = null;

  function start() {
    bind();
    refresh();
    window.addEventListener(APJAdminShell.TORNEO_CHANGED_EVENT, refresh);
  }

  function bind() {
    document.getElementById('aj-form')?.addEventListener('submit', onSave);
    document.getElementById('aj-reset')?.addEventListener('click', () => {
      if (currentTournament) populate(currentTournament);
    });
    document.getElementById('aj-enabled')?.addEventListener('change', onToggleEnabled);
    document.getElementById('aj-registration-open')?.addEventListener('change', onToggleRegistration);
  }

  async function refresh() {
    const id = APJAdminShell.getSelectedTournamentId();
    const empty = document.getElementById('aj-empty');
    const content = document.getElementById('aj-content');
    const subtitle = document.getElementById('aj-tournament-subtitle');

    if (!id) {
      if (subtitle) subtitle.textContent = 'Selecciona un torneo en el menu lateral.';
      empty?.classList.remove('hidden');
      content?.classList.add('hidden');
      currentTournament = null;
      return;
    }

    const cached = APJAdminShell.getCachedTournament(id);
    if (subtitle && cached) subtitle.textContent = `${cached.name} — ${(cached.start_date || '').slice(0, 10)}`;

    if (cached) {
      currentTournament = cached;
      populate(cached);
    }
    empty?.classList.add('hidden');
    content?.classList.remove('hidden');

    try {
      const fresh = await APJApi.getTournamentById(id);
      if (fresh) {
        currentTournament = fresh;
        populate(fresh);
        if (subtitle) subtitle.textContent = `${fresh.name} — ${(fresh.start_date || '').slice(0, 10)}`;
      }
    } catch (error) {
      APJToast?.error?.('Error', humanizeError(error));
    }
  }

  function populate(t) {
    document.getElementById('aj-name').value = t.name || '';
    document.getElementById('aj-start').value = (t.start_date || '').slice(0, 10);
    document.getElementById('aj-end').value = (t.end_date || '').slice(0, 10);
    document.getElementById('aj-location').value = t.location || '';
    document.getElementById('aj-type').value = t.type || 'Regular';
    document.getElementById('aj-lat').value = t.latitude ?? '';
    document.getElementById('aj-lng').value = t.longitude ?? '';
    document.getElementById('aj-max-points').value = t.max_points || '';
    document.getElementById('aj-club-logo').value = t.club_logo_url || '';
    document.getElementById('aj-enabled').checked = !!t.is_enabled;
    document.getElementById('aj-registration-open').checked = !!t.registration_open;
  }

  function readForm() {
    const lat = document.getElementById('aj-lat').value.trim();
    const lng = document.getElementById('aj-lng').value.trim();
    const clubLogo = document.getElementById('aj-club-logo').value.trim();
    return {
      name: document.getElementById('aj-name').value.trim(),
      start_date: document.getElementById('aj-start').value,
      end_date: document.getElementById('aj-end').value,
      location: document.getElementById('aj-location').value.trim() || null,
      latitude: lat === '' ? null : Number(lat),
      longitude: lng === '' ? null : Number(lng),
      type: document.getElementById('aj-type').value,
      max_points: document.getElementById('aj-max-points').value.trim() || null,
      club_logo_url: clubLogo === '' ? null : clubLogo,
    };
  }

  async function onSave(e) {
    e.preventDefault();
    if (!currentTournament) return;
    const payload = readForm();

    if (!payload.name) return APJToast?.error?.('Falta nombre', 'El torneo necesita un nombre.');
    if (!payload.start_date || !payload.end_date) return APJToast?.error?.('Faltan fechas', 'Inicio y fin son requeridos.');
    if (payload.start_date > payload.end_date) return APJToast?.error?.('Fechas invalidas', 'La fecha de inicio no puede ser despues del fin.');

    const btn = document.getElementById('aj-save');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Guardando...';

    try {
      await APJApi.updateTournament(currentTournament.id, payload);
      Object.assign(currentTournament, payload);
      APJToast?.success?.('Listo', 'Cambios guardados');
    } catch (error) {
      APJToast?.error?.('Error', humanizeError(error));
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  async function onToggleEnabled(e) {
    if (!currentTournament) return;
    const enabled = e.target.checked;
    try {
      await APJApi.setTournamentEnabled(currentTournament.id, enabled);
      currentTournament.is_enabled = enabled;
      APJToast?.success?.('Listo', enabled ? 'Torneo activado' : 'Torneo desactivado');
    } catch (error) {
      e.target.checked = !enabled;
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

  function humanizeError(error) {
    if (!error) return 'Error desconocido';
    const status = error.status;
    if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (status === 403) return 'No tienes permisos para esta accion.';
    if (status === 404) return 'No encontrado.';
    return error.message || 'Ocurrio un error inesperado.';
  }

  return { start };
})();
