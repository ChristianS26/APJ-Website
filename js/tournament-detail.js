// APJ Padel - Tournament Detail Page

const APJTournamentDetail = (function() {
  let currentTournament = null;
  let draws = [];

  /**
   * Initialize tournament detail page
   */
  async function init() {
    // Check if on detail page - check for detail-content element instead of path
    const detailContent = document.getElementById('detail-content');
    if (!detailContent) return;

    // Get tournament ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('id');

    if (!tournamentId) {
      showError();
      return;
    }

    // Bind tab events
    bindTabEvents();

    // Bind retry button
    document.getElementById('retry-draws')?.addEventListener('click', () => loadDraws(tournamentId));

    await loadTournamentDetail(tournamentId);
  }

  /**
   * Bind tab switching events
   */
  function bindTabEvents() {
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        switchTab(tabName);
      });
    });
  }

  /**
   * Switch between tabs
   */
  function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');

    // Load draws if switching to draws tab and not loaded yet
    if (tabName === 'draws' && currentTournament && draws.length === 0) {
      loadDraws(currentTournament.id);
    }
  }

  /**
   * Load tournament detail
   */
  async function loadTournamentDetail(tournamentId) {
    const loadingEl = document.getElementById('detail-loading');
    const errorEl = document.getElementById('detail-error');
    const contentEl = document.getElementById('detail-content');

    loadingEl?.classList.remove('hidden');
    errorEl?.classList.add('hidden');
    contentEl?.classList.add('hidden');

    try {
      // Load tournaments if not already loaded
      const tournaments = await APJTournaments.loadTournaments();

      // Find the specific tournament
      currentTournament = tournaments.find(t =>
        String(t.id) === tournamentId || String(t.tournament_id) === tournamentId
      );

      if (!currentTournament) {
        showError();
        return;
      }

      renderTournamentDetail(currentTournament);

      loadingEl?.classList.add('hidden');
      contentEl?.classList.remove('hidden');

      // Update page title
      document.title = `${currentTournament.name || 'Torneo'} | APJ Padel`;

    } catch (error) {
      console.error('[APJ] Error loading tournament detail:', error);
      showError();
    }
  }

  /**
   * Show error state
   */
  function showError() {
    document.getElementById('detail-loading')?.classList.add('hidden');
    document.getElementById('detail-error')?.classList.remove('hidden');
    document.getElementById('detail-content')?.classList.add('hidden');
  }

  /**
   * Render tournament detail
   */
  function renderTournamentDetail(tournament) {
    const name = tournament.name || tournament.tournament_name || 'Torneo APJ';
    const startDate = formatDate(tournament.start_date);
    const endDate = formatDate(tournament.end_date);
    const location = tournament.location || 'Sin ubicacion';
    const flyerUrl = tournament.flyer_url;
    const type = tournament.type || 'regular';
    const isLightning = type.toLowerCase() === 'relampago' || type.toLowerCase() === 'lightning';

    // Get status
    const status = getTournamentStatus(tournament);

    // Update elements
    document.getElementById('tournament-name').textContent = name;
    document.getElementById('tournament-dates').textContent = `${startDate} - ${endDate}`;
    document.getElementById('tournament-location').textContent = location;

    // Status badge
    const statusEl = document.getElementById('tournament-status');
    statusEl.textContent = status.label;
    statusEl.className = `tournament-status ${status.class}`;

    // Lightning badge
    const typeBadge = document.getElementById('tournament-type-badge');
    if (isLightning) {
      typeBadge.classList.remove('hidden');
    }

    // Flyer image
    const flyerImg = document.getElementById('tournament-flyer');
    const flyerLarge = document.getElementById('tournament-flyer-large');
    const flyerSection = document.getElementById('tournament-flyer-section');

    if (flyerUrl) {
      flyerImg.src = flyerUrl;
      flyerImg.onerror = () => { flyerImg.src = '/img/apj_logo.png'; };
      flyerLarge.src = flyerUrl;
      flyerSection.classList.remove('hidden');
    } else {
      flyerImg.src = '/img/apj_logo.png';
    }

    // Register button (only if registration is open)
    const registerBtn = document.getElementById('tournament-register-btn');
    if (status.canRegister) {
      registerBtn.classList.remove('hidden');
      registerBtn.querySelector('a').href = `/inscripcion/?torneo=${tournament.id}`;
    }
  }

  /**
   * Get tournament status
   */
  function getTournamentStatus(tournament) {
    const endDate = new Date(tournament.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate < today) {
      return {
        label: 'Finalizado',
        class: 'finalized',
        canRegister: false
      };
    }

    if (tournament.registration_open) {
      return {
        label: 'Inscripciones abiertas',
        class: 'registration-open',
        canRegister: true
      };
    }

    return {
      label: 'Inscripciones cerradas',
      class: 'registration-closed',
      canRegister: false
    };
  }

  /**
   * Load tournament draws
   */
  async function loadDraws(tournamentId) {
    const loadingEl = document.getElementById('draws-loading');
    const emptyEl = document.getElementById('draws-empty');
    const errorEl = document.getElementById('draws-error');
    const listEl = document.getElementById('draws-list');

    loadingEl?.classList.remove('hidden');
    emptyEl?.classList.add('hidden');
    errorEl?.classList.add('hidden');
    listEl?.classList.add('hidden');

    try {
      draws = await APJApi.getTournamentDraws(tournamentId);

      loadingEl?.classList.add('hidden');

      if (!draws || draws.length === 0) {
        emptyEl?.classList.remove('hidden');
        return;
      }

      // Sort by category position
      draws.sort((a, b) => (a.category?.position || 0) - (b.category?.position || 0));

      renderDraws(draws);
      listEl?.classList.remove('hidden');

    } catch (error) {
      loadingEl?.classList.add('hidden');

      // Show appropriate error message
      if (error.status === 401) {
        // User not authenticated - show login prompt
        const errorTitle = errorEl?.querySelector('h3');
        const errorText = errorEl?.querySelector('p');
        if (errorTitle) errorTitle.textContent = 'Inicia sesion';
        if (errorText) errorText.textContent = 'Debes iniciar sesion para ver el rol de juego.';
      }

      errorEl?.classList.remove('hidden');
    }
  }

  /**
   * Render draws list
   */
  function renderDraws(draws) {
    const listEl = document.getElementById('draws-list');
    if (!listEl) return;

    listEl.innerHTML = draws.map(draw => createDrawCard(draw)).join('');

    // Bind click events
    listEl.querySelectorAll('.draw-card').forEach(card => {
      card.addEventListener('click', () => {
        const pdfUrl = card.dataset.pdfUrl;
        if (pdfUrl) {
          window.open(pdfUrl, '_blank');
        }
      });
    });
  }

  /**
   * Create draw card HTML
   */
  function createDrawCard(draw) {
    const categoryName = draw.category?.name || 'Categoria';
    const pdfUrl = draw.pdf_url || draw.pdfUrl || '';

    return `
      <div class="draw-card" data-pdf-url="${pdfUrl}">
        <div class="draw-card-icon">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div class="draw-card-content">
          <div class="draw-card-title">Categoria: ${categoryName}</div>
          <div class="draw-card-subtitle">
            <span class="draw-badge">PDF</span>
            <span>Toca para abrir</span>
          </div>
        </div>
        <div class="draw-card-arrow">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    `;
  }

  /**
   * Format date for display
   */
  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('es-MX', options);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    init
  };
})();
