// APJ Padel - Admin QR Codes
// Generates a QR code for the currently-selected tournament. The QR encodes
// the public tournament detail URL (https://padeljalisco.com/torneos/detalle/?id=X).
// Android App Links and iOS Universal Links intercept this URL so users with
// the app installed land directly on the in-app detail; others fall back to web.

const APJAdminQRCodes = (function () {

  const PUBLIC_BASE = 'https://padeljalisco.com';
  const DETAIL_PATH = '/torneos/detalle/';

  function start() {
    // The QRCode library is loaded via CDN. If it failed (CSP block, offline,
    // CDN outage), surface that to the user instead of silently rendering nothing.
    if (typeof window.QRCode === 'undefined' || typeof window.QRCode.toCanvas !== 'function') {
      showError('No se cargo la libreria QR. Revisa tu conexion o el bloqueador.');
      setEmptyState('Libreria QR no disponible.');
      return;
    }

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
    return `${PUBLIC_BASE}${DETAIL_PATH}?id=${encodeURIComponent(tournamentId)}`;
  }

  function renderForSelectedTournament() {
    const id = APJAdminShell.getSelectedTournamentId();
    // The shell uses strict equality (id === selectedId). If cache stores ids
    // as numbers and localStorage returned a string, we end up with null.
    // Fallback to a String coercion match so the QR works regardless of type.
    const tournament = lookupTournament(id);
    const nameEl = document.getElementById('qr-tournament-name');
    const urlInput = document.getElementById('qr-url-input');
    const actions = document.getElementById('qr-actions');

    if (!id) {
      const cache = APJAdminShell.getCachedTournaments();
      // Distinguish "shell still loading" from "no tournament chosen"
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

    if (!tournament) {
      // We have an id but no matching tournament in cache yet. This happens
      // briefly between the shell setting a savedId and the cache being
      // populated; wait for the next TORNEO_CHANGED_EVENT.
      setEmptyState('Cargando torneo...');
      if (actions) actions.style.display = 'none';
      return;
    }

    if (nameEl) nameEl.textContent = tournament.name || `Torneo ${id}`;
    const url = buildTournamentUrl(id);
    if (urlInput) urlInput.value = url;

    drawQr(url);

    if (actions) actions.style.display = 'flex';
  }

  function lookupTournament(id) {
    if (!id) return null;
    const direct = APJAdminShell.getCachedTournament(id);
    if (direct) return direct;
    // Type-flexible fallback
    const cache = APJAdminShell.getCachedTournaments();
    const target = String(id);
    return cache.find(t => String(t.id) === target) || null;
  }

  function drawQr(url) {
    const wrap = document.getElementById('qr-canvas-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'qr-canvas';
    wrap.appendChild(canvas);
    try {
      window.QRCode.toCanvas(canvas, url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 280,
        color: { dark: '#000000', light: '#FFFFFF' },
      }, (err) => {
        if (err) {
          showError('No se pudo generar el QR: ' + (err.message || err));
          return;
        }
        hideError();
      });
    } catch (e) {
      showError('Error al generar el QR: ' + (e.message || e));
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
