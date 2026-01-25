// APJ Padel - Authentication

const APJAuth = (function() {
  let loginModal = null;
  let registerModal = null;

  /**
   * Initialize auth module
   */
  function init() {
    createModals();
    bindEvents();
    updateAuthUI();

    // Listen for auth events
    window.addEventListener('apj:auth:expired', handleAuthExpired);
    window.addEventListener('apj:auth:logout', updateAuthUI);
  }

  /**
   * Create auth modals
   */
  function createModals() {
    // Login Modal
    const loginModalHtml = `
      <div id="login-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Iniciar Sesion</h3>
            <button type="button" class="modal-close" data-close-modal>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <form id="login-form">
              <div class="form-group">
                <label class="form-label" for="login-email">Correo electronico <span class="required">*</span></label>
                <input type="email" id="login-email" class="form-input" placeholder="tu@email.com" required>
                <div class="form-error"></div>
              </div>
              <div class="form-group">
                <label class="form-label" for="login-password">Contrasena <span class="required">*</span></label>
                <input type="password" id="login-password" class="form-input" placeholder="Tu contrasena" required>
                <div class="form-error"></div>
              </div>
              <button type="submit" class="btn btn-primary btn-block" id="login-submit">
                Iniciar Sesion
              </button>
            </form>
            <div class="auth-switch">
              No tienes cuenta? <a href="#" data-show-register>Registrate</a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Register Modal
    const registerModalHtml = `
      <div id="register-modal" class="modal-overlay">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3 class="modal-title">Crear Cuenta</h3>
            <button type="button" class="modal-close" data-close-modal>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <form id="register-form">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="register-first_name">Nombre <span class="required">*</span></label>
                  <input type="text" id="register-first_name" class="form-input" placeholder="Tu nombre" required>
                  <div class="form-error"></div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="register-last_name">Apellido <span class="required">*</span></label>
                  <input type="text" id="register-last_name" class="form-input" placeholder="Tu apellido" required>
                  <div class="form-error"></div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="register-email">Correo electronico <span class="required">*</span></label>
                <input type="email" id="register-email" class="form-input" placeholder="tu@email.com" required>
                <div class="form-error"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="register-password">Contrasena <span class="required">*</span></label>
                <input type="password" id="register-password" class="form-input" placeholder="Minimo 8 caracteres" required>
                <div class="form-error"></div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="register-phone">Telefono</label>
                  <input type="tel" id="register-phone" class="form-input" placeholder="+52 1234567890">
                  <div class="form-error"></div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="register-birthdate">Fecha de nacimiento</label>
                  <input type="date" id="register-birthdate" class="form-input">
                  <div class="form-error"></div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="register-gender">Genero</label>
                  <select id="register-gender" class="form-select">
                    <option value="">Seleccionar</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                  <div class="form-error"></div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="register-shirt_size">Talla de playera</label>
                  <select id="register-shirt_size" class="form-select">
                    <option value="">Seleccionar</option>
                  </select>
                  <div class="form-error"></div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="register-country_iso">Pais</label>
                <select id="register-country_iso" class="form-select">
                  <option value="">Seleccionar</option>
                  <option value="MX">Mexico</option>
                  <option value="US">Estados Unidos</option>
                  <option value="ES">Espana</option>
                  <option value="AR">Argentina</option>
                  <option value="CO">Colombia</option>
                  <option value="CL">Chile</option>
                </select>
                <div class="form-error"></div>
              </div>

              <button type="submit" class="btn btn-primary btn-block" id="register-submit">
                Crear Cuenta
              </button>
            </form>
            <div class="auth-switch">
              Ya tienes cuenta? <a href="#" data-show-login>Iniciar Sesion</a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Append modals to body
    document.body.insertAdjacentHTML('beforeend', loginModalHtml);
    document.body.insertAdjacentHTML('beforeend', registerModalHtml);

    loginModal = document.getElementById('login-modal');
    registerModal = document.getElementById('register-modal');
  }

  /**
   * Bind event handlers
   */
  function bindEvents() {
    // Login button clicks
    document.addEventListener('click', e => {
      if (e.target.matches('[data-show-login]')) {
        e.preventDefault();
        showLogin();
      }

      if (e.target.matches('[data-show-register]')) {
        e.preventDefault();
        showRegister();
      }

      if (e.target.matches('[data-logout]')) {
        e.preventDefault();
        APJApi.logout();
        // Use replace to prevent back button returning to authenticated pages
        window.location.replace('/');
      }

      if (e.target.matches('[data-close-modal]') || e.target.closest('[data-close-modal]')) {
        e.preventDefault();
        closeModals();
      }
    });

    // Close modal on overlay click
    document.addEventListener('click', e => {
      if (e.target.classList.contains('modal-overlay')) {
        closeModals();
      }
    });

    // Close modal on escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeModals();
      }
    });

    // Login form submit
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);

    // Register form submit
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);

    // Gender change - update shirt sizes
    document.getElementById('register-gender')?.addEventListener('change', e => {
      updateShirtSizes(e.target.value);
    });
  }

  /**
   * Update shirt size options based on gender
   */
  function updateShirtSizes(gender) {
    const select = document.getElementById('register-shirt_size');
    if (!select) return;

    const sizes = APJValidation.getShirtSizesForGender(gender);

    select.innerHTML = '<option value="">Seleccionar</option>';
    sizes.forEach(size => {
      select.insertAdjacentHTML('beforeend', `<option value="${size}">${size}</option>`);
    });
  }

  /**
   * Show login modal
   */
  function showLogin() {
    closeModals();
    loginModal?.classList.add('active');
    document.getElementById('login-email')?.focus();
  }

  /**
   * Show register modal
   */
  function showRegister() {
    closeModals();
    registerModal?.classList.add('active');
    document.getElementById('register-first_name')?.focus();
    // Initialize shirt sizes with default gender
    updateShirtSizes('masculino');
  }

  /**
   * Close all modals
   */
  function closeModals() {
    loginModal?.classList.remove('active');
    registerModal?.classList.remove('active');
    APJValidation.clearFormErrors('login-form');
    APJValidation.clearFormErrors('register-form');
  }

  /**
   * Handle login form submission
   */
  async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Validate
    APJValidation.clearFormErrors('login-form');
    const validation = APJValidation.validateLogin({ email, password });

    if (!validation.isValid) {
      Object.entries(validation.errors).forEach(([field, message]) => {
        APJValidation.showFieldError(`login-${field}`, message);
      });
      return;
    }

    // Submit
    const submitBtn = document.getElementById('login-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Iniciando sesion...';

    try {
      await APJApi.login(email, password);
      closeModals();
      updateAuthUI();
      APJToast.success('Bienvenido', 'Has iniciado sesion correctamente');
      window.dispatchEvent(new CustomEvent('apj:auth:login'));
    } catch (error) {
      APJToast.error('Error', error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar Sesion';
    }
  }

  /**
   * Handle register form submission
   */
  async function handleRegister(e) {
    e.preventDefault();

    const formData = {
      first_name: document.getElementById('register-first_name').value.trim(),
      last_name: document.getElementById('register-last_name').value.trim(),
      email: document.getElementById('register-email').value.trim(),
      password: document.getElementById('register-password').value,
      phone: document.getElementById('register-phone').value.trim() || undefined,
      birthdate: document.getElementById('register-birthdate').value || undefined,
      gender: document.getElementById('register-gender').value || undefined,
      shirt_size: document.getElementById('register-shirt_size').value || undefined,
      country_iso: document.getElementById('register-country_iso').value || undefined
    };

    // Clean undefined values
    Object.keys(formData).forEach(key => {
      if (formData[key] === undefined || formData[key] === '') {
        delete formData[key];
      }
    });

    // Validate
    APJValidation.clearFormErrors('register-form');
    const validation = APJValidation.validateRegistration(formData);

    if (!validation.isValid) {
      Object.entries(validation.errors).forEach(([field, message]) => {
        APJValidation.showFieldError(`register-${field}`, message);
      });
      return;
    }

    // Submit
    const submitBtn = document.getElementById('register-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Creando cuenta...';

    try {
      await APJApi.register(formData);

      // Auto-login after registration
      await APJApi.login(formData.email, formData.password);

      closeModals();
      updateAuthUI();
      APJToast.success('Cuenta creada', 'Tu cuenta ha sido creada exitosamente');
      window.dispatchEvent(new CustomEvent('apj:auth:login'));
    } catch (error) {
      APJToast.error('Error', error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear Cuenta';
    }
  }

  /**
   * Handle auth expired
   */
  function handleAuthExpired() {
    updateAuthUI();
    APJToast.error('Sesion expirada', 'Por favor inicia sesion nuevamente');
    showLogin();
  }

  /**
   * Update UI based on auth state
   */
  function updateAuthUI() {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');

    if (!authButtons || !userMenu) return;

    if (APJApi.isAuthenticated()) {
      const userData = APJApi.getUserData();
      const userName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : 'Usuario';
      const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

      authButtons.classList.add('hidden');
      userMenu.classList.remove('hidden');
      userMenu.innerHTML = `
        <span class="user-name">${userName}</span>
        <div class="user-avatar">${initials}</div>
        <button class="btn btn-sm btn-outline" data-logout>Salir</button>
      `;
    } else {
      authButtons.classList.remove('hidden');
      userMenu.classList.add('hidden');
    }
  }

  /**
   * Require authentication - shows login modal if not logged in
   * Returns true if authenticated, false otherwise
   */
  function requireAuth() {
    if (APJApi.isAuthenticated()) {
      return true;
    }
    showLogin();
    return false;
  }

  // Public API
  return {
    init,
    showLogin,
    showRegister,
    closeModals,
    updateAuthUI,
    requireAuth
  };
})();
