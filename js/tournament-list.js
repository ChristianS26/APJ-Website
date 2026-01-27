// APJ Padel - Tournament List Page

const APJTournamentList = (function() {

  /**
   * Initialize tournament list page
   */
  async function init() {
    // Check if on tournaments page
    if (!window.location.pathname.includes('/torneos')) return;

    // Bind retry button
    document.getElementById('retry-load')?.addEventListener('click', loadTournaments);

    await loadTournaments();
  }

  /**
   * Load and display tournaments
   */
  async function loadTournaments() {
    const loadingEl = document.getElementById('tournaments-loading');
    const errorEl = document.getElementById('tournaments-error');
    const emptyEl = document.getElementById('tournaments-empty');
    const listEl = document.getElementById('tournaments-list');

    // Show loading
    loadingEl?.classList.remove('hidden');
    errorEl?.classList.add('hidden');
    emptyEl?.classList.add('hidden');
    listEl?.classList.add('hidden');

    try {
      const allTournaments = await APJTournaments.loadTournaments();

      // Filter: only show enabled tournaments (same as Android: filter { it.isEnabled })
      const visibleTournaments = allTournaments.filter(t => t.is_enabled === true);

      loadingEl?.classList.add('hidden');

      if (visibleTournaments.length === 0) {
        emptyEl?.classList.remove('hidden');
        return;
      }

      // Sort by start date (most recent/upcoming last, oldest first)
      visibleTournaments.sort((a, b) => {
        const dateA = new Date(a.start_date);
        const dateB = new Date(b.start_date);
        return dateB - dateA;
      });

      renderTournaments(visibleTournaments);
      listEl?.classList.remove('hidden');

    } catch (error) {
      console.error('[APJ] Error loading tournaments:', error);
      loadingEl?.classList.add('hidden');
      errorEl?.classList.remove('hidden');
    }
  }

  /**
   * Render tournament cards
   */
  function renderTournaments(tournaments) {
    const listEl = document.getElementById('tournaments-list');
    if (!listEl) return;

    listEl.innerHTML = tournaments.map(tournament => createTournamentCard(tournament)).join('');

    // Bind click events
    listEl.querySelectorAll('.tournament-card').forEach(card => {
      card.addEventListener('click', () => {
        const tournamentId = card.dataset.tournamentId;
        const tournament = tournaments.find(t => String(t.id) === tournamentId);
        handleTournamentClick(tournament);
      });
    });
  }

  /**
   * Create tournament card HTML
   */
  function createTournamentCard(tournament) {
    const name = tournament.name || tournament.tournament_name || 'Torneo APJ';
    const startDate = formatDate(tournament.start_date);
    const endDate = formatDate(tournament.end_date);
    const location = tournament.location || 'Sin ubicacion';
    const maxPoints = tournament.max_points;
    const type = tournament.type || 'regular';
    const isLightning = type.toLowerCase() === 'relampago' || type.toLowerCase() === 'lightning';
    const flyerUrl = tournament.flyer_url;

    // Determine status
    const status = getTournamentStatus(tournament);

    // Use flyer as main image, fallback to APJ logo
    const imageUrl = flyerUrl || '/img/apj_logo.png';

    return `
      <div class="tournament-card ${status.class}" data-tournament-id="${tournament.id}">
        <div class="tournament-card-image">
          <img src="${imageUrl}" alt="${name}" onerror="this.src='/img/apj_logo.png'">
          ${isLightning ? '<span class="tournament-badge lightning">Relampago</span>' : ''}
          <span class="tournament-status ${status.class}">${status.label}</span>
        </div>
        <div class="tournament-card-content">
          <h3 class="tournament-card-name">${name}</h3>
          ${maxPoints ? `<div class="tournament-card-points">${maxPoints} pts max</div>` : ''}
          <div class="tournament-card-info">
            <div class="tournament-card-row">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <span>${startDate} - ${endDate}</span>
            </div>
            <div class="tournament-card-row">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span>${location}</span>
            </div>
          </div>
          ${status.showButton ? `<button class="tournament-card-btn">${status.cta}</button>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Get tournament status (following Android logic)
   */
  function getTournamentStatus(tournament) {
    const endDate = new Date(tournament.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if tournament has ended
    if (endDate < today) {
      return {
        label: 'Finalizado',
        class: 'finalized',
        cta: 'Ver detalles',
        showButton: false
      };
    }

    // Check registration status
    if (tournament.registration_open) {
      return {
        label: 'Inscripciones abiertas',
        class: 'registration-open',
        cta: 'Inscribirme',
        showButton: true
      };
    }

    return {
      label: 'Inscripciones cerradas',
      class: 'registration-closed',
      cta: 'Ver detalles',
      showButton: false
    };
  }

  /**
   * Format date for display (dd MMM yyyy)
   */
  function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString + 'T00:00:00');
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('es-MX', options);
  }

  /**
   * Handle tournament card click
   */
  function handleTournamentClick(tournament) {
    if (!tournament) return;

    // Add click animation
    const card = document.querySelector(`.tournament-card[data-tournament-id="${tournament.id}"]`);
    if (card) {
      card.classList.add('clicked');
      setTimeout(() => card.classList.remove('clicked'), 200);
    }

    // Check if registration is open
    const endDate = new Date(tournament.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isFinalized = endDate < today;

    if (tournament.registration_open && !isFinalized) {
      // Navigate to registration with tournament ID
      setTimeout(() => {
        window.location.href = `/inscripcion/?torneo=${tournament.id}`;
      }, 150);
    } else {
      // Show info toast
      if (isFinalized) {
        APJToast.info('Torneo finalizado', 'Este torneo ya ha concluido. Consulta los resultados en la app.');
      } else {
        APJToast.info('Inscripciones cerradas', 'Las inscripciones para este torneo estan cerradas.');
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    init,
    loadTournaments
  };
})();
