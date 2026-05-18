// APJ Padel - Admin QR Codes
// Generates a QR code for the currently-selected tournament. The QR encodes
// the public tournament detail URL (https://padeljalisco.com/torneos/detalle/?id=X).
// Android App Links and iOS Universal Links intercept this URL so users with
// the app installed land directly on the in-app detail; others fall back to web.

const APJAdminQRCodes = (function () {

  const PUBLIC_BASE = 'https://padeljalisco.com';
  const DETAIL_PATH = '/torneos/detalle/';

  function start() {
    renderForSelectedTournament();

    // React to tournament changes from the shell picker
    window.addEventListener(APJAdminShell.TORNEO_CHANGED_EVENT, () => {
      renderForSelectedTournament();
    });

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
    const tournament = id ? APJAdminShell.getCachedTournament(id) : null;
    const nameEl = document.getElementById('qr-tournament-name');
    const urlInput = document.getElementById('qr-url-input');
    const wrap = document.getElementById('qr-canvas-wrap');
    const emptyEl = document.getElementById('qr-empty');
    const actions = document.getElementById('qr-actions');

    if (!id || !tournament) {
      if (nameEl) nameEl.textContent = '—';
      if (urlInput) urlInput.value = '';
      if (actions) actions.style.display = 'none';
      // Clear the canvas and restore the empty-state hint
      if (wrap) {
        wrap.innerHTML = '<div id="qr-empty" class="qr-empty-state">Selecciona un torneo arriba para generar el QR.</div>';
      }
      return;
    }

    if (nameEl) nameEl.textContent = tournament.name || `Torneo ${id}`;
    const url = buildTournamentUrl(id);
    if (urlInput) urlInput.value = url;

    if (wrap) {
      // Replace any previous canvas with a fresh one
      wrap.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.id = 'qr-canvas';
      wrap.appendChild(canvas);
      // Library: node-qrcode (window.QRCode). Use medium error correction so
      // a logo overlay could be added later without invalidating the code.
      window.QRCode.toCanvas(canvas, url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 280,
        color: { dark: '#000000', light: '#FFFFFF' },
      }, (err) => {
        if (err) {
          showError('No se pudo generar el QR: ' + err.message);
          return;
        }
        hideError();
      });
    }

    if (actions) actions.style.display = 'flex';
  }

  function downloadPng() {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;
    const id = APJAdminShell.getSelectedTournamentId();
    const tournament = APJAdminShell.getCachedTournament(id);
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
      // Fallback for older browsers without Clipboard API
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

  return { start };
})();
