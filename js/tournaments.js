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
   * Find registration for a category by matching ID or name
   * The API returns different ID types:
   * - Categories from getCategoryPrices have UUID ids
   * - Categories in registrations have integer ids
   * So we need to match by name as fallback
   */
  function findRegistrationForCategory(category) {
    if (!myRegistrations || !myRegistrations.items || !category) return null;

    const targetId = category.id || category.category_id;
    const targetName = (category.name || category.category_name || '').toLowerCase().trim();

    console.log('[APJ] Finding registration for category:', targetName, 'ID:', targetId);

    const reg = myRegistrations.items.find(item => {
      const itemCat = item.category;
      if (!itemCat) return false;

      // Try to match by name (most reliable since IDs are different types)
      const itemName = (itemCat.name || itemCat.category_name || '').toLowerCase().trim();
      const nameMatches = itemName && targetName && itemName === targetName;

      // Also try direct ID match as backup
      const itemId = itemCat.id || itemCat.category_id;
      const idMatches = itemId && targetId && String(itemId) === String(targetId);

      console.log('[APJ] Comparing:', itemName, '(' + itemId + ') vs', targetName, '(' + targetId + ') => name:', nameMatches, 'id:', idMatches);

      return nameMatches || idMatches;
    });

    return reg;
  }

  /**
   * Check if user is registered in a category
   */
  function isRegisteredInCategory(categoryId) {
    // Get the full category object to match by name
    const category = getCategoryById(categoryId);
    if (!category) {
      console.log('[APJ] Category not found for ID:', categoryId);
      return false;
    }
    return findRegistrationForCategory(category) !== null;
  }

  /**
   * Get partner info for a category (if already registered)
   */
  function getPartnerForCategory(categoryId) {
    const category = getCategoryById(categoryId);
    if (!category) return null;
    const reg = findRegistrationForCategory(category);
    return reg?.partner || null;
  }

  /**
   * Get registration info for a category
   */
  function getRegistrationForCategory(categoryId) {
    const category = getCategoryById(categoryId);
    if (!category) return null;
    const reg = findRegistrationForCategory(category);
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
