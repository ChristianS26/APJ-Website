// APJ Padel - Admin QR Codes
// Generates a QR code for the currently-selected tournament. The QR encodes
// the public tournament detail URL (https://padeljalisco.com/torneos/detalle/?id=X).
// Android App Links and iOS Universal Links intercept this URL so users with
// the app installed land directly on the in-app detail; others fall back to web.
//
// Uses the qrcode-generator library (Kazuhiko Arase) self-hosted at
// /js/vendor/qrcode.min.js — chosen over CDN-hosted node-qrcode because
// privacy-extension users frequently have third-party CDN scripts blocked.

const APJAdminQRCodes = (function () {

  const PUBLIC_BASE = 'https://padeljalisco.com';
  const DETAIL_PATH = '/torneos/detalle/';
  const QR_SIZE_PX = 280;
  const QR_ERROR_CORRECTION = 'M';

  function start() {
    renderForSelectedTournament();

    // React to tournament changes from the shell picker. The shell dispatches
    // this event ALSO on initial load once getTournaments() resolves, so this
    // is what handles the cold-start case (cache empty during start()).
    window.addEventListener(APJAdminShell.TORNEO_CHANGED_EVENT, renderForSelectedTournament);

    document.getElementById('qr-copy-url-btn')?.addEventListener('click', copyUrl);
    document.getElementById('qr-copy-img-btn')?.addEventListener('click', copyImage);
    document.getElementById('qr-download-btn')?.addEventListener('click', downloadPng);
  }

  function buildTournamentUrl(tournamentId) {
    if (!tournamentId) return '';
    // The `from=qr` flag tells the web detail page that this visitor arrived
    // by scanning the QR (vs. e.g. a shared link). If they don't have the app,
    // the detail page auto-redirects them to /apps/ (App Store / Play Store)
    // instead of showing the web detail — per organizers' request to push QR
    // scanners to install.
    return `${PUBLIC_BASE}${DETAIL_PATH}?id=${encodeURIComponent(tournamentId)}&from=qr`;
  }

  function renderForSelectedTournament() {
    const id = APJAdminShell.getSelectedTournamentId();
    // The shell uses strict equality (id === selectedId). If cache stores ids
    // as numbers and localStorage returned a string, the lookup would return
    // null — fall back to a String-coerced match so the QR works regardless.
    const tournament = lookupTournament(id);
    const nameEl = document.getElementById('qr-tournament-name');
    const urlInput = document.getElementById('qr-url-input');
    const actions = document.getElementById('qr-actions');

    if (!id) {
      const cache = APJAdminShell.getCachedTournaments();
      if (!cache || cache.length === 0) {
        setEmptyState('Cargando torneos...');
      } else {
        setEmptyState('Selecciona un torneo en el menu lateral.');
      }
      if (nameEl) nameEl.textContent = '—';
      if (urlInput) urlInput.value = '';
      if (actions) actions.style.display = 'none';
      return;
    }

    // Even if the cached tournament entry isn't ready yet, we can still
    // build and surface the URL — the only thing missing is the friendly name.
    const url = buildTournamentUrl(id);
    if (urlInput) urlInput.value = url;
    if (nameEl) nameEl.textContent = tournament?.name || `Torneo ${id}`;

    drawQr(url);

    // Show actions only when the QR image actually rendered; otherwise the
    // user can still copy the URL from the input above.
    if (actions) {
      const hasCanvas = !!document.getElementById('qr-canvas');
      actions.style.display = hasCanvas ? 'flex' : 'none';
    }
  }

  function lookupTournament(id) {
    if (!id) return null;
    const direct = APJAdminShell.getCachedTournament(id);
    if (direct) return direct;
    const cache = APJAdminShell.getCachedTournaments();
    const target = String(id);
    return cache.find(t => String(t.id) === target) || null;
  }

  function drawQr(url) {
    const wrap = document.getElementById('qr-canvas-wrap');
    if (!wrap) return;

    if (typeof window.qrcode !== 'function') {
      // Library didn't load. Show a clear message but leave the URL input
      // untouched so the admin can still copy and share manually.
      setEmptyState('No se pudo cargar la libreria QR. Comparte la URL de arriba.');
      showError('La libreria QR no esta disponible (revisa la consola).');
      return;
    }

    try {
      const qr = window.qrcode(0, QR_ERROR_CORRECTION);
      qr.addData(url);
      qr.make();
      const moduleCount = qr.getModuleCount();

      // Pick a cell size so the rendered QR is as close to QR_SIZE_PX as
      // possible while keeping every module on a whole pixel — avoids the
      // blurry edges you get when modules straddle pixel boundaries.
      const cellSize = Math.max(2, Math.floor(QR_SIZE_PX / moduleCount));
      const margin = cellSize;
      const canvasSize = cellSize * moduleCount + margin * 2;

      wrap.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.id = 'qr-canvas';
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      // Keep CSS size predictable across devices regardless of cell math
      canvas.style.width = QR_SIZE_PX + 'px';
      canvas.style.height = QR_SIZE_PX + 'px';
      wrap.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      ctx.fillStyle = '#000000';
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect(
              margin + col * cellSize,
              margin + row * cellSize,
              cellSize,
              cellSize,
            );
          }
        }
      }
      hideError();
    } catch (e) {
      setEmptyState('No se pudo generar el QR.');
      showError('Error generando QR: ' + (e?.message || e));
    }
  }

  function setEmptyState(message) {
    const wrap = document.getElementById('qr-canvas-wrap');
    if (!wrap) return;
    wrap.innerHTML = `<div id="qr-empty" class="qr-empty-state">${escapeHtml(message)}</div>`;
  }

  function downloadPng() {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;
    const id = APJAdminShell.getSelectedTournamentId();
    const tournament = lookupTournament(id);
    const safeName = (tournament?.name || `torneo-${id}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const link = document.createElement('a');
    link.download = `qr-${safeName || 'torneo'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function copyImage() {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas || !navigator.clipboard?.write) {
      showError('Tu navegador no permite copiar imagenes. Usa "Descargar PNG".');
      return;
    }
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      flashButton('qr-copy-img-btn', 'Copiada!');
    } catch (e) {
      showError('No se pudo copiar la imagen: ' + e.message);
    }
  }

  async function copyUrl() {
    const input = document.getElementById('qr-url-input');
    if (!input || !input.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      flashButton('qr-copy-url-btn', 'Copiada!');
    } catch (_) {
      input.select();
      document.execCommand('copy');
      flashButton('qr-copy-url-btn', 'Copiada!');
    }
  }

  function flashButton(id, text) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1500);
  }

  function showError(msg) {
    const el = document.getElementById('qr-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError() {
    const el = document.getElementById('qr-error');
    el?.classList.add('hidden');
  }

  function escapeHtml(value) {
    return String(value).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { start };
})();
