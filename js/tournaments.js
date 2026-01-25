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
   * Helper to compare category IDs (handles int/string mismatch)
   */
  function categoryIdMatches(itemCategoryId, targetId) {
    // Convert both to numbers for comparison
    const itemId = parseInt(itemCategoryId);
    const target = parseInt(targetId);
    return !isNaN(itemId) && !isNaN(target) && itemId === target;
  }

  /**
   * Check if user is registered in a category
   */
  function isRegisteredInCategory(categoryId) {
    if (!myRegistrations || !myRegistrations.items) {
      console.log('[APJ] No registrations data available');
      return false;
    }
    const found = myRegistrations.items.some(item => {
      const itemCatId = item.category?.id || item.category?.category_id;
      const matches = categoryIdMatches(itemCatId, categoryId);
      console.log('[APJ] Checking category match:', itemCatId, 'vs', categoryId, '=', matches);
      return matches;
    });
    return found;
  }

  /**
   * Get partner info for a category (if already registered)
   */
  function getPartnerForCategory(categoryId) {
    if (!myRegistrations || !myRegistrations.items) return null;
    const reg = myRegistrations.items.find(item => {
      const itemCatId = item.category?.id || item.category?.category_id;
      return categoryIdMatches(itemCatId, categoryId);
    });
    return reg?.partner || null;
  }

  /**
   * Get registration info for a category
   */
  function getRegistrationForCategory(categoryId) {
    if (!myRegistrations || !myRegistrations.items) return null;
    const reg = myRegistrations.items.find(item => {
      const itemCatId = item.category?.id || item.category?.category_id;
      return categoryIdMatches(itemCatId, categoryId);
    });
    console.log('[APJ] getRegistrationForCategory', categoryId, '=', reg);
    return reg;
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
