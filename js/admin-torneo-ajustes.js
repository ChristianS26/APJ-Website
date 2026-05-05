// APJ Padel - Admin Torneo / Ajustes
// Reads the active tournament id from the shell selector and renders an
// editable form (without lat/lng — those are kept on the model but not
// surfaced here). The club logo is uploaded directly to Cloudinary via
// the existing /cloudinary/sign-upload + Cloudinary endpoints, then
// persisted on the tournament via PATCH /tournaments/{id}/club-logo.
// The "Preview en la app" panel mocks the mobile tournament card and
// updates live as fields change.

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

    // Live preview: re-render the mock card on every change to a relevant field
    // (type is no longer in the UI — it's preserved from the cached tournament)
    ['aj-name', 'aj-start', 'aj-end', 'aj-max-points', 'aj-registration-open']
      .forEach(id => {
        document.getElementById(id)?.addEventListener('input', refreshMockCard);
        document.getElementById(id)?.addEventListener('change', refreshMockCard);
      });

    // Logo uploader
    document.getElementById('aj-logo-upload-btn')?.addEventListener('click', () => {
      document.getElementById('aj-logo-file')?.click();
    });
    document.getElementById('aj-logo-file')?.addEventListener('change', onLogoFileSelected);
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
    if (subtitle && cached) subtitle.textContent = `${cached.name} — ${formatDateShort(cached.start_date)}`;

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
        if (subtitle) subtitle.textContent = `${fresh.name} — ${formatDateShort(fresh.start_date)}`;
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
    document.getElementById('aj-max-points').value = t.max_points || '';
    document.getElementById('aj-club-logo').value = t.club_logo_url || '';
    document.getElementById('aj-enabled').checked = !!t.is_enabled;
    document.getElementById('aj-registration-open').checked = !!t.registration_open;
    renderLogoPreview(t.club_logo_url || '');
    refreshMockCard();
  }

  function readForm() {
    // Only include fields with a real value so the PATCH never accidentally
    // nulls out something the user didn't touch (location, max_points,
    // club_logo_url, latitude, longitude). Required fields always sent.
    // type is required by the backend but no longer editable in the UI —
    // forward whatever the cached tournament had.
    const out = {
      name: document.getElementById('aj-name').value.trim(),
      start_date: document.getElementById('aj-start').value,
      end_date: document.getElementById('aj-end').value,
      type: currentTournament?.type || 'Regular',
    };
    const location = document.getElementById('aj-location').value.trim();
    if (location) out.location = location;

    const maxPoints = document.getElementById('aj-max-points').value.trim();
    if (maxPoints) out.max_points = maxPoints;

    const clubLogo = document.getElementById('aj-club-logo').value.trim();
    if (clubLogo) out.club_logo_url = clubLogo;

    return out;
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

    const categoryIds = currentTournament.categoryIds || [];
    if (categoryIds.length === 0) {
      return APJToast?.error?.('Sin categorías', 'Este torneo no tiene categorías asignadas. Asígnaselas desde la app/dashboard antes de editar aquí.');
    }

    try {
      await APJApi.updateTournament(currentTournament.id, payload, categoryIds);
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
      refreshMockCard();
    } catch (error) {
      e.target.checked = !open;
      APJToast?.error?.('Error', humanizeError(error));
    }
  }

  // ----- Logo upload -----
  async function onLogoFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting same file later
    if (!file || !currentTournament) return;

    if (!file.type.startsWith('image/')) {
      APJToast?.error?.('Tipo invalido', 'Selecciona una imagen (PNG, JPG o WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      APJToast?.error?.('Imagen muy grande', 'Maximo 10 MB.');
      return;
    }

    const status = document.getElementById('aj-logo-status');
    const uploadBtn = document.getElementById('aj-logo-upload-btn');
    const clearBtn = document.getElementById('aj-logo-clear-btn');
    setStatus('Subiendo imagen...');
    if (uploadBtn) uploadBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;

    try {
      const publicId = `tournament-club-logo-${currentTournament.id}`;
      const folder = 'tournaments/club-logos';

      const sig = await APJApi.getUploadSignature(publicId, folder, true);
      const upload = await APJApi.uploadToCloudinary(file, sig, publicId, folder);
      const url = upload?.secure_url;
      if (!url) throw new Error('Cloudinary no devolvio una URL');

      // Persist on the tournament
      await APJApi.updateTournamentClubLogo(currentTournament.id, url);

      currentTournament.club_logo_url = url;
      document.getElementById('aj-club-logo').value = url;
      renderLogoPreview(url);
      refreshMockCard();
      setStatus('');
      APJToast?.success?.('Listo', 'Logo actualizado');
    } catch (error) {
      setStatus('');
      APJToast?.error?.('Error', humanizeError(error));
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
    }
  }

  function renderLogoPreview(url) {
    const wrap = document.getElementById('aj-logo-image');
    const img = document.getElementById('aj-logo-preview');
    if (url) {
      img.src = url;
      wrap?.classList.remove('empty');
    } else {
      img.removeAttribute('src');
      wrap?.classList.add('empty');
    }
  }

  function setStatus(msg) {
    const el = document.getElementById('aj-logo-status');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }

  // ----- Live mock card preview -----
  // Mirrors the Tournament card from the mobile app:
  // [logo 76×92] [name (+ lightning if Relampago) / max_points / date / status chip]
  function refreshMockCard() {
    const name = document.getElementById('aj-name')?.value.trim() || 'Nombre del torneo';
    const start = document.getElementById('aj-start')?.value || '';
    const end = document.getElementById('aj-end')?.value || '';
    const type = currentTournament?.type || 'Regular';
    const maxPoints = document.getElementById('aj-max-points')?.value.trim() || '';
    const logo = document.getElementById('aj-club-logo')?.value.trim();
    const open = !!document.getElementById('aj-registration-open')?.checked;

    // Name + lightning chip
    document.getElementById('aj-mock-name').textContent = name;
    const lightning = document.getElementById('aj-mock-lightning');
    if (lightning) lightning.classList.toggle('hidden', type !== 'Relampago');

    // Max points (small green text under name) — hidden if empty
    document.getElementById('aj-mock-points').textContent = maxPoints;

    // Date row uses the app's "startDate • endDate" format with raw ISO dates
    document.getElementById('aj-mock-date').textContent = mobileDateFormat(start, end);

    // Logo image / placeholder
    const img = document.getElementById('aj-mock-image');
    const placeholder = document.getElementById('aj-mock-logo-placeholder');
    if (img) {
      if (logo) {
        img.src = logo;
        img.style.display = 'block';
        placeholder?.classList.add('hidden');
      } else {
        img.removeAttribute('src');
        img.style.display = 'none';
        placeholder?.classList.remove('hidden');
      }
    }

    // Status chip — same logic as the app:
    //   isExpired       → "Finalizado" (red)
    //   registrationOpen → "Inscripciones abiertas" (green)
    //   start in future  → "Próximamente" (blue)
    //   otherwise        → "Inscripciones cerradas" (red)
    const status = document.getElementById('aj-mock-status');
    if (status) {
      const expired = isExpired(end);
      let label, cls;
      if (expired) {
        label = 'Finalizado'; cls = 'finalized';
      } else if (open) {
        label = 'Inscripciones abiertas'; cls = 'open';
      } else if (isFuture(start)) {
        label = 'Próximamente'; cls = 'upcoming';
      } else {
        label = 'Inscripciones cerradas'; cls = 'closed';
      }
      status.textContent = label;
      status.className = `app-card-status ${cls}`;
    }
  }

  function mobileDateFormat(start, end) {
    if (!start && !end) return 'Fecha';
    if (start && end) return `${start} • ${end}`;
    return start || end;
  }

  function isFuture(iso) {
    if (!iso) return false;
    const d = new Date(iso + 'T23:59:59');
    return !isNaN(d.getTime()) && d.getTime() > Date.now();
  }
  function isExpired(iso) {
    if (!iso) return false;
    const d = new Date(iso + 'T23:59:59');
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
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
