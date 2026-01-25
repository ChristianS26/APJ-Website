// APJ Padel - API Client

const APJApi = (function() {

  /**
   * Get stored auth token
   */
  function getAuthToken() {
    return localStorage.getItem(APJConfig.STORAGE_KEYS.AUTH_TOKEN);
  }

  /**
   * Set auth token
   */
  function setAuthToken(token) {
    localStorage.setItem(APJConfig.STORAGE_KEYS.AUTH_TOKEN, token);
  }

  /**
   * Clear auth data
   */
  function clearAuth() {
    localStorage.removeItem(APJConfig.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(APJConfig.STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(APJConfig.STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Get stored user data
   */
  function getUserData() {
    const data = localStorage.getItem(APJConfig.STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Set user data
   */
  function setUserData(data) {
    localStorage.setItem(APJConfig.STORAGE_KEYS.USER_DATA, JSON.stringify(data));
  }

  /**
   * Check if user is authenticated
   */
  function isAuthenticated() {
    return !!getAuthToken();
  }

  /**
   * Make API request
   */
  async function request(endpoint, options = {}) {
    const url = `${APJConfig.API_BASE_URL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth token if available and not explicitly disabled
    if (options.auth !== false) {
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle 401 - clear auth and redirect if needed
      if (response.status === 401) {
        clearAuth();
        if (options.redirectOnUnauth !== false) {
          window.dispatchEvent(new CustomEvent('apj:auth:expired'));
        }
        throw new ApiError('Sesion expirada. Por favor inicia sesion nuevamente.', 401);
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const message = data.message || data.error || 'Error en la solicitud';
        throw new ApiError(message, response.status, data);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Error de conexion. Verifica tu internet.', 0, error);
    }
  }

  /**
   * Custom API Error class
   */
  class ApiError extends Error {
    constructor(message, status, data = null) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  }

  // API Methods

  /**
   * Register new user
   */
  async function register(userData) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
      auth: false
    });
  }

  /**
   * Login user
   */
  async function login(email, password) {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      auth: false
    });

    if (response.token) {
      setAuthToken(response.token);
      if (response.user) {
        setUserData(response.user);
      }
    }

    return response;
  }

  /**
   * Logout user
   */
  function logout() {
    clearAuth();
    window.dispatchEvent(new CustomEvent('apj:auth:logout'));
  }

  /**
   * Search users (for partner search)
   */
  async function searchUsers(query) {
    console.log('[APJ API] searchUsers called with query:', query);
    console.log('[APJ API] Auth token present:', !!getAuthToken());
    try {
      const result = await request(`/api/auth/search-users?query=${encodeURIComponent(query)}`);
      console.log('[APJ API] searchUsers result:', result);
      return result;
    } catch (error) {
      console.error('[APJ API] searchUsers error:', error);
      throw error;
    }
  }

  /**
   * Get tournaments list
   */
  async function getTournaments() {
    return request('/api/tournaments', { auth: false });
  }

  /**
   * Get my registrations for a tournament
   */
  async function getMyRegistrationsByTournament(tournamentId) {
    return request(`/api/teams/me/by-tournament?tournamentId=${encodeURIComponent(tournamentId)}`);
  }

  /**
   * Get category prices for a tournament
   */
  async function getCategoryPrices(tournamentId, tournamentType) {
    return request(`/api/tournaments/category-prices?tournamentId=${encodeURIComponent(tournamentId)}&tournamentType=${encodeURIComponent(tournamentType)}`);
  }

  /**
   * Validate discount code
   */
  async function validateDiscountCode(code, amount) {
    return request('/api/discount-codes/validate', {
      method: 'POST',
      body: JSON.stringify({ code, amount })
    });
  }

  /**
   * Create payment intent
   */
  async function createPaymentIntent(paymentData) {
    return request('/api/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  }

  /**
   * Redeem registration code
   */
  async function redeemCode(code, registrationData) {
    return request('/api/payments/redeem-code', {
      method: 'POST',
      body: JSON.stringify({ code, ...registrationData })
    });
  }

  // Public API
  return {
    // Auth helpers
    getAuthToken,
    setAuthToken,
    clearAuth,
    getUserData,
    setUserData,
    isAuthenticated,

    // API methods
    request,
    register,
    login,
    logout,
    searchUsers,
    getTournaments,
    getMyRegistrationsByTournament,
    getCategoryPrices,
    validateDiscountCode,
    createPaymentIntent,
    redeemCode,

    // Error class
    ApiError
  };
})();
