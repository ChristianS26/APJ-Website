// APJ Padel - Tournaments

const APJTournaments = (function() {
  let tournaments = [];
  let activeTournament = null;
  let categories = [];
  let myRegistrations = null; // User's existing registrations for active tournament

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
   * Note: API returns full value (799 = 799 MXN), NOT cents
   */
  function formatPrice(amount, currency = 'MXN') {
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

  /**
   * Load user's registrations for a tournament
   */
  async function loadMyRegistrations(tournamentId) {
    try {
      myRegistrations = await APJApi.getMyRegistrationsByTournament(tournamentId);
      console.log('[APJ] My registrations loaded:', myRegistrations);
      return myRegistrations;
    } catch (error) {
      console.error('Error loading my registrations:', error);
      myRegistrations = { items: [] };
      return myRegistrations;
    }
  }

  /**
   * Get user's registrations
   */
  function getMyRegistrations() {
    return myRegistrations;
  }

  /**
   * Check if user is registered in a category
   * Matches by category_id (integer) from category prices against category.id from registrations
   */
  function isRegisteredInCategory(categoryId) {
    if (!myRegistrations || !myRegistrations.items) return false;

    // Get the category to find its integer category_id
    const category = getCategoryById(categoryId);
    if (!category) return false;

    // category_id is the integer ID used for matching (not the UUID 'id')
    const targetCategoryId = category.category_id;

    return myRegistrations.items.some(item => item.category?.id === targetCategoryId);
  }

  /**
   * Get partner info for a category (if already registered)
   */
  function getPartnerForCategory(categoryId) {
    const reg = getRegistrationForCategory(categoryId);
    return reg?.partner || null;
  }

  /**
   * Get registration info for a category
   */
  function getRegistrationForCategory(categoryId) {
    if (!myRegistrations || !myRegistrations.items) return null;

    const category = getCategoryById(categoryId);
    if (!category) return null;

    // Match by integer category_id
    const targetCategoryId = category.category_id;

    return myRegistrations.items.find(item => item.category?.id === targetCategoryId);
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
    getAllTournaments,
    loadMyRegistrations,
    getMyRegistrations,
    isRegisteredInCategory,
    getPartnerForCategory,
    getRegistrationForCategory
  };
})();
