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
   * Validate current token with the server
   * Returns true if valid, false if invalid/expired
   */
  async function validateToken() {
    const token = getAuthToken();
    if (!token) return false;

    try {
      // Try to get profile - this validates the token
      await request('/api/auth/me', { redirectOnUnauth: false });
      return true;
    } catch (error) {
      if (error.status === 401) {
        // Token is invalid - clear it
        clearAuth();
        return false;
      }
      // Network error or other issue - assume token might still be valid
      return true;
    }
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

      // Parse response first to get error messages
      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle 401 - clear auth and redirect if needed
      // Only clear auth if the request was authenticated (auth !== false)
      if (response.status === 401) {
        if (options.auth !== false) {
          clearAuth();
          if (options.redirectOnUnauth !== false) {
            window.dispatchEvent(new CustomEvent('apj:auth:expired'));
          }
        }
        // Use backend error message if available, otherwise generic message
        const message = data?.error || data?.message || 'No autorizado';
        throw new ApiError(message, 401, data);
      }

      if (!response.ok) {
        const message = data?.message || data?.error || 'Error en la solicitud';
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
   * Forgot password - request password reset email
   */
  async function forgotPassword(email) {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
      auth: false
    });
  }

  /**
   * Get current user profile
   */
  async function getProfile() {
    const response = await request('/api/auth/me');
    if (response.user) {
      setUserData(response.user);
    }
    return response;
  }

  /**
   * Update user profile
   */
  async function updateProfile(userData) {
    const response = await request('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(userData)
    });
    if (response) {
      setUserData(response);
    }
    return response;
  }

  /**
   * Change password
   */
  async function changePassword(currentPassword, newPassword) {
    return request('/api/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  /**
   * Get Cloudinary upload signature
   */
  async function getUploadSignature(publicId, folder, overwrite = true) {
    const formData = new URLSearchParams();
    formData.append('public_id', publicId);
    formData.append('folder', folder);
    formData.append('overwrite', overwrite.toString());

    return request('/api/cloudinary/sign-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
  }

  /**
   * Upload image to Cloudinary
   */
  async function uploadToCloudinary(file, signatureData, publicId, folder) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signatureData.apiKey);
    formData.append('timestamp', signatureData.timestamp);
    formData.append('signature', signatureData.signature);
    formData.append('public_id', publicId);
    formData.append('folder', folder);
    formData.append('overwrite', 'true');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/auto/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      throw new ApiError('Error al subir imagen', response.status);
    }

    return response.json();
  }

  /**
   * Update profile photo URL
   */
  async function updateProfilePhoto(photoUrl) {
    return request('/api/auth/profile/photo', {
      method: 'PATCH',
      body: JSON.stringify({ photo_url: photoUrl })
    });
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
   * Redeem registration code (legacy)
   */
  async function redeemCode(code, registrationData) {
    return request('/api/payments/redeem-code', {
      method: 'POST',
      body: JSON.stringify({ code, ...registrationData })
    });
  }

  /**
   * Redeem registration code - sends request object directly
   */
  async function redeemCodeDirect(requestData) {
    return request('/api/payments/redeem-code', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  }

  /**
   * Get tournament draws (rol de juego)
   * Note: Backend requires auth for this endpoint
   */
  async function getTournamentDraws(tournamentId) {
    return request(`/api/tournament_details/draws?tournament_id=${encodeURIComponent(tournamentId)}`, {
      redirectOnUnauth: false
    });
  }

  /**
   * Get Stripe Connect dashboard/onboarding link (admin only)
   * Returns { url } — Stripe-hosted onboarding link if account is not yet
   * fully onboarded, or an Express Dashboard login link if it is.
   */
  async function getStripeConnectDashboardLink() {
    return request('/api/connect/dashboard-link', {
      redirectOnUnauth: false
    });
  }

  /**
   * Get Stripe Connect account status (admin only).
   * Throws ApiError(404) when no account has been created yet.
   * Returns { accountId, chargesEnabled, payoutsEnabled, onboardingComplete, requiresAction }.
   */
  async function getConnectAccountStatus() {
    return request('/api/connect/account-status', {
      redirectOnUnauth: false
    });
  }

  /**
   * Create the Stripe Express account (admin only).
   * Idempotent: returns the existing account if one is already persisted.
   * Returns { accountId }.
   */
  async function createConnectAccount() {
    return request('/api/connect/create-account', {
      method: 'POST',
      redirectOnUnauth: false
    });
  }

  /**
   * Create an AccountSession for the embedded onboarding component (admin only).
   * Returns { clientSecret }.
   */
  async function createConnectAccountSession() {
    return request('/api/connect/account-session', {
      method: 'POST',
      redirectOnUnauth: false
    });
  }

  /**
   * Recent payments feed for the Stripe Connect admin view.
   * Returns array of RecentPaymentRow with nested tournament/player/category.
   */
  async function getConnectRecentPayments(limit = 50) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    return request(`/api/connect/recent-payments?limit=${safeLimit}`, {
      redirectOnUnauth: false
    });
  }

  // ----- Tournaments (admin views read + write) -----
  async function getTournamentById(id) {
    return request(`/api/tournaments/${encodeURIComponent(id)}`, {
      auth: false, // public endpoint
      redirectOnUnauth: false,
    });
  }
  async function updateTournament(id, payload) {
    return request(`/api/tournaments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      redirectOnUnauth: false,
    });
  }
  async function setTournamentEnabled(id, enabled) {
    return request(`/api/tournaments/${encodeURIComponent(id)}/enabled`, {
      method: 'PATCH',
      body: JSON.stringify({ is_enabled: !!enabled }),
      redirectOnUnauth: false,
    });
  }
  async function setTournamentRegistrationOpen(id, open) {
    return request(`/api/tournaments/${encodeURIComponent(id)}/registration-open`, {
      method: 'PATCH',
      body: JSON.stringify({ registration_open: !!open }),
      redirectOnUnauth: false,
    });
  }
  async function updateTournamentClubLogo(id, url) {
    return request(`/api/tournaments/${encodeURIComponent(id)}/club-logo`, {
      method: 'PATCH',
      body: JSON.stringify({ club_logo_url: url }),
      redirectOnUnauth: false,
    });
  }
  async function getTeamsByTournamentGrouped(tournamentId) {
    return request(`/api/teams/by-tournament?tournamentId=${encodeURIComponent(tournamentId)}`, {
      auth: false, // public endpoint per TeamRoutes
      redirectOnUnauth: false,
    });
  }

  // ----- Admin: Regular tournament categories CRUD -----
  async function adminListRegularCategories() {
    return request('/api/categories/admin/regular', { redirectOnUnauth: false });
  }
  async function adminCreateRegularCategory({ name, position, price }) {
    return request('/api/categories/admin/regular', {
      method: 'POST',
      body: JSON.stringify({ name, position, price }),
      redirectOnUnauth: false,
    });
  }
  async function adminUpdateRegularCategory(id, { name, position, price }) {
    return request(`/api/categories/admin/regular/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, position, price }),
      redirectOnUnauth: false,
    });
  }
  async function adminDeleteRegularCategory(id) {
    return request(`/api/categories/admin/regular/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      redirectOnUnauth: false,
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
    validateToken,

    // API methods
    request,
    register,
    login,
    logout,
    forgotPassword,
    getProfile,
    updateProfile,
    changePassword,
    getUploadSignature,
    uploadToCloudinary,
    updateProfilePhoto,
    searchUsers,
    getTournaments,
    getTournamentDraws,
    getMyRegistrationsByTournament,
    getCategoryPrices,
    validateDiscountCode,
    createPaymentIntent,
    redeemCode,
    redeemCodeDirect,
    getStripeConnectDashboardLink,
    getConnectAccountStatus,
    createConnectAccount,
    createConnectAccountSession,
    getConnectRecentPayments,
    adminListRegularCategories,
    adminCreateRegularCategory,
    adminUpdateRegularCategory,
    adminDeleteRegularCategory,
    getTournamentById,
    updateTournament,
    setTournamentEnabled,
    setTournamentRegistrationOpen,
    updateTournamentClubLogo,
    getTeamsByTournamentGrouped,

    // Error class
    ApiError
  };
})();
