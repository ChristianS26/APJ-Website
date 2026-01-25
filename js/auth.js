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

              <div class="form-group">
                <label class="form-label">Telefono <span class="required">*</span></label>
                <div class="phone-input-group">
                  <select id="register-country_code" class="form-select country-code-select" required>
                    <option value="MX|+52" selected>MX +52</option>
                    <option value="US|+1">US +1</option>
                    <option value="CA|+1">CA +1</option>
                    <option value="AR|+54">AR +54</option>
                    <option value="CO|+57">CO +57</option>
                    <option value="CL|+56">CL +56</option>
                    <option value="PE|+51">PE +51</option>
                    <option value="ES|+34">ES +34</option>
                  </select>
                  <input type="tel" id="register-phone" class="form-input phone-number-input" placeholder="1234567890" required>
                </div>
                <div class="form-error" id="register-phone-error"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="register-birthdate">Fecha de nacimiento <span class="required">*</span></label>
                <input type="date" id="register-birthdate" class="form-input" required>
                <div class="form-error"></div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="register-gender">Genero <span class="required">*</span></label>
                  <select id="register-gender" class="form-select" required>
                    <option value="">Seleccionar</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                  <div class="form-error"></div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="register-shirt_size">Talla de playera <span class="required">*</span></label>
                  <select id="register-shirt_size" class="form-select" required>
                    <option value="">Seleccionar</option>
                  </select>
                  <div class="form-error"></div>
                </div>
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
    // Clear shirt sizes until gender is selected
    updateShirtSizes('');
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

    // Get country code and dial code from select
    const countryCodeSelect = document.getElementById('register-country_code');
    const countryCodeValue = countryCodeSelect.value; // e.g., "MX|+52"
    const [countryIso, dialCode] = countryCodeValue.split('|');
    const phoneNumber = document.getElementById('register-phone').value.trim();

    // Build full phone in E.164 format (dialCode + number)
    const fullPhone = phoneNumber ? `${dialCode}${phoneNumber.replace(/\D/g, '')}` : '';

    const formData = {
      first_name: document.getElementById('register-first_name').value.trim(),
      last_name: document.getElementById('register-last_name').value.trim(),
      email: document.getElementById('register-email').value.trim(),
      password: document.getElementById('register-password').value,
      phone: fullPhone,
      birthdate: document.getElementById('register-birthdate').value,
      gender: document.getElementById('register-gender').value,
      shirt_size: document.getElementById('register-shirt_size').value,
      country_iso: countryIso
    };

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
        <a href="/inscripcion/" class="btn btn-sm btn-primary header-register-btn">Inscribirse al Torneo</a>
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
