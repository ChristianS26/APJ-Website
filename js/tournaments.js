// APJ Padel - Tournaments

const APJTournaments = (function() {
  let tournaments = [];
  let activeTournament = null;
  let categories = [];

  /**
   * Load tournaments from API
   */
  async function loadTournaments() {
    try {
      tournaments = await APJApi.getTournaments();
      return tournaments;
    } catch (error) {
      console.error('Error loading tournaments:', error);
      throw error;
    }
  }

  /**
   * Get active tournament (with open registration)
   */
  function getActiveTournament() {
    if (activeTournament) return activeTournament;

    activeTournament = tournaments.find(t => t.registration_open === true);
    return activeTournament;
  }

  /**
   * Get tournament by ID
   */
  function getTournamentById(id) {
    return tournaments.find(t => t.id === id || t.tournament_id === id);
  }

  /**
   * Load categories for a tournament
   */
  async function loadCategories(tournamentId, tournamentType) {
    try {
      categories = await APJApi.getCategoryPrices(tournamentId, tournamentType);
      return categories;
    } catch (error) {
      console.error('Error loading categories:', error);
      throw error;
    }
  }

  /**
   * Get loaded categories
   */
  function getCategories() {
    return categories;
  }

  /**
   * Get category by ID
   */
  function getCategoryById(categoryId) {
    return categories.find(c => c.id === categoryId || c.category_id === categoryId);
  }

  /**
   * Format price for display
   */
  function formatPrice(amountInCents, currency = 'MXN') {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Get all tournaments
   */
  function getAllTournaments() {
    return tournaments;
  }

  // Public API
  return {
    loadTournaments,
    getActiveTournament,
    getTournamentById,
    loadCategories,
    getCategories,
    getCategoryById,
    formatPrice,
    getAllTournaments
  };
})();
