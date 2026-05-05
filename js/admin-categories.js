// APJ Padel - Admin: Categorias de torneo Regular (CRUD)
// Auth/admin gate is provided by APJAdminShell.

const APJAdminCategories = (function () {
  let cache = [];
  let editingId = null;
  let pendingDeleteId = null;

  function start() {
    bind();
    load();
  }

  function bind() {
    document.getElementById('cats-create-btn')?.addEventListener('click', openCreateModal);
    document.getElementById('cats-form-submit')?.addEventListener('click', handleSubmit);
    document.getElementById('cats-delete-confirm')?.addEventListener('click', handleDeleteConfirm);

    document.querySelectorAll('[data-cats-close]').forEach(btn => {
      btn.addEventListener('click', closeModals);
    });
    // Close on overlay click
    document.querySelectorAll('.cats-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModals();
      });
    });
    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModals();
    });
  }

  async function load() {
    clearGlobalError();
    const list = document.getElementById('cats-list');
    list.innerHTML = '<div class="profile-loading-page" style="padding:32px 0;"><div class="spinner" style="width:24px; height:24px;"></div><p style="font-size:13px;">Cargando categorias...</p></div>';

    try {
      const rows = await APJApi.adminListRegularCategories();
      cache = Array.isArray(rows) ? rows : [];
      list.innerHTML = renderTable(cache);
    } catch (error) {
      list.innerHTML = '';
      showGlobalError(humanizeError(error));
    }
  }

  function renderTable(rows) {
    if (rows.length === 0) {
      return '<div class="cats-empty">No hay categorias todavia. Crea la primera con el boton de arriba.</div>';
    }

    const head = `
      <thead>
        <tr>
          <th style="width:64px;">ID</th>
          <th>Nombre</th>
          <th style="width:96px;">Posicion</th>
          <th style="width:120px; text-align:right;">Precio</th>
          <th style="width:160px; text-align:right;">Acciones</th>
        </tr>
      </thead>`;
    const body = rows.map(r => `
      <tr>
        <td style="color:var(--text-secondary);">#${escapeHtml(r.id)}</td>
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td>${escapeHtml(r.position)}</td>
        <td style="text-align:right; font-variant-numeric: tabular-nums;">${escapeHtml(formatPrice(r.price))}</td>
        <td>
          <div class="cats-actions">
            <button type="button" class="btn btn-outline btn-sm" data-edit="${escapeAttr(r.id)}">Editar</button>
            <button type="button" class="btn btn-outline btn-sm" data-delete="${escapeAttr(r.id)}" style="color:#ef4444; border-color:rgba(239,68,68,0.4);">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');

    setTimeout(() => {
      // Bind row buttons after rendering
      document.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-edit')));
      });
      document.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.getAttribute('data-delete')));
      });
    }, 0);

    return `<div class="cats-table-wrap"><table class="cats-table">${head}<tbody>${body}</tbody></table></div>`;
  }

  function openCreateModal() {
    editingId = null;
    document.getElementById('cats-modal-title').textContent = 'Nueva categoria';
    document.getElementById('cats-form-id').value = '';
    document.getElementById('cats-form-name').value = '';
    document.getElementById('cats-form-position').value = nextPosition();
    document.getElementById('cats-form-price').value = '';
    clearFormErrors();
    document.getElementById('cats-modal').classList.add('active');
    document.getElementById('cats-form-name').focus();
  }

  function openEditModal(id) {
    const row = cache.find(r => String(r.id) === String(id));
    if (!row) return;
    editingId = row.id;
    document.getElementById('cats-modal-title').textContent = `Editar categoria #${row.id}`;
    document.getElementById('cats-form-id').value = row.id;
    document.getElementById('cats-form-name').value = row.name;
    document.getElementById('cats-form-position').value = row.position;
    document.getElementById('cats-form-price').value = row.price;
    clearFormErrors();
    document.getElementById('cats-modal').classList.add('active');
    document.getElementById('cats-form-name').focus();
  }

  function openDeleteModal(id) {
    const row = cache.find(r => String(r.id) === String(id));
    if (!row) return;
    pendingDeleteId = row.id;
    document.getElementById('cats-delete-name').textContent = row.name;
    document.getElementById('cats-delete-modal').classList.add('active');
  }

  function closeModals() {
    document.getElementById('cats-modal')?.classList.remove('active');
    document.getElementById('cats-delete-modal')?.classList.remove('active');
    editingId = null;
    pendingDeleteId = null;
  }

  function nextPosition() {
    if (cache.length === 0) return 1;
    return Math.max(...cache.map(r => Number(r.position) || 0)) + 1;
  }

  async function handleSubmit() {
    const nameEl = document.getElementById('cats-form-name');
    const posEl = document.getElementById('cats-form-position');
    const priceEl = document.getElementById('cats-form-price');
    const submitBtn = document.getElementById('cats-form-submit');

    clearFormErrors();
    const name = nameEl.value.trim();
    const position = parseInt(posEl.value, 10);
    const price = parseInt(priceEl.value, 10);

    let valid = true;
    if (!name || name.length > 80) {
      setFieldError(nameEl, name ? 'Maximo 80 caracteres' : 'Nombre requerido');
      valid = false;
    }
    if (Number.isNaN(position) || position < 0) {
      setFieldError(posEl, 'Numero entero >= 0');
      valid = false;
    }
    if (Number.isNaN(price) || price < 0) {
      setFieldError(priceEl, 'Numero entero >= 0');
      valid = false;
    }
    if (!valid) return;

    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="spinner"></span> Guardando...';

    try {
      if (editingId == null) {
        await APJApi.adminCreateRegularCategory({ name, position, price });
        APJToast?.success?.('Listo', 'Categoria creada');
      } else {
        await APJApi.adminUpdateRegularCategory(editingId, { name, position, price });
        APJToast?.success?.('Listo', 'Categoria actualizada');
      }
      closeModals();
      await load();
    } catch (error) {
      // Try to surface 400 validation errors per field if backend gave them
      if (error?.status === 400 && error?.data?.errors && Array.isArray(error.data.errors)) {
        APJToast?.error?.('Datos invalidos', error.data.errors.join(', '));
      } else {
        APJToast?.error?.('Error', humanizeError(error));
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  async function handleDeleteConfirm() {
    if (pendingDeleteId == null) return;
    const id = pendingDeleteId;
    const btn = document.getElementById('cats-delete-confirm');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Eliminando...';

    try {
      await APJApi.adminDeleteRegularCategory(id);
      APJToast?.success?.('Listo', 'Categoria eliminada');
      closeModals();
      await load();
    } catch (error) {
      if (error?.status === 409) {
        APJToast?.error?.('No se puede eliminar', error?.data?.error || 'La categoria esta asociada a torneos, equipos, ranking o pagos.');
      } else {
        APJToast?.error?.('Error', humanizeError(error));
      }
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  function clearFormErrors() {
    document.querySelectorAll('#cats-form .form-group').forEach(g => g.classList.remove('has-error'));
    document.querySelectorAll('#cats-form .form-error').forEach(e => { e.textContent = ''; });
    document.querySelectorAll('#cats-form .form-input').forEach(i => i.classList.remove('error'));
  }
  function setFieldError(input, message) {
    const group = input.closest('.form-group');
    const errEl = group?.querySelector('.form-error');
    if (group) group.classList.add('has-error');
    input.classList.add('error');
    if (errEl) errEl.textContent = message;
  }

  function showGlobalError(msg) {
    const el = document.getElementById('cats-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function clearGlobalError() {
    const el = document.getElementById('cats-error');
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
  }

  function formatPrice(price) {
    if (price == null) return '—';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(price));
  }

  function humanizeError(error) {
    if (!error) return 'Error desconocido';
    const status = error.status;
    if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (status === 403) return 'No tienes permisos para gestionar categorias.';
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
