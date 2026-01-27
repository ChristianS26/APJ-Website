// APJ Padel - User Profile Module

const APJProfile = (function() {
  let originalUserData = null;
  let isProfilePage = false;

  // Shirt sizes by gender
  const SHIRT_SIZES = {
    Femenino: [
      { value: 'XS-MUJER', label: 'XS - Mujer' },
      { value: 'S-MUJER', label: 'S - Mujer' },
      { value: 'M-MUJER', label: 'M - Mujer' },
      { value: 'L-MUJER', label: 'L - Mujer' }
    ],
    Masculino: [
      { value: 'XS-HOMBRE', label: 'XS - Hombre' },
      { value: 'S-HOMBRE', label: 'S - Hombre' },
      { value: 'M-HOMBRE', label: 'M - Hombre' },
      { value: 'L-HOMBRE', label: 'L - Hombre' },
      { value: 'XL-HOMBRE', label: 'XL - Hombre' },
      { value: '2XL-HOMBRE', label: '2XL - Hombre' },
      { value: '3XL-HOMBRE', label: '3XL - Hombre' },
      { value: '4XL-HOMBRE', label: '4XL - Hombre' },
      { value: '5XL-HOMBRE', label: '5XL - Hombre' },
      { value: '6XL-HOMBRE', label: '6XL - Hombre' }
    ],
    Otro: [
      { value: 'XS-HOMBRE', label: 'XS' },
      { value: 'S-HOMBRE', label: 'S' },
      { value: 'M-HOMBRE', label: 'M' },
      { value: 'L-HOMBRE', label: 'L' },
      { value: 'XL-HOMBRE', label: 'XL' },
      { value: '2XL-HOMBRE', label: '2XL' },
      { value: '3XL-HOMBRE', label: '3XL' },
      { value: '4XL-HOMBRE', label: '4XL' },
      { value: '5XL-HOMBRE', label: '5XL' },
      { value: '6XL-HOMBRE', label: '6XL' }
    ]
  };

  // Countries list
  const COUNTRIES = [
    { code: 'MX', name: 'Mexico', dialCode: '+52' },
    { code: 'US', name: 'Estados Unidos', dialCode: '+1' },
    { code: 'CA', name: 'Canada', dialCode: '+1' },
    { code: 'AR', name: 'Argentina', dialCode: '+54' },
    { code: 'CO', name: 'Colombia', dialCode: '+57' },
    { code: 'CL', name: 'Chile', dialCode: '+56' },
    { code: 'PE', name: 'Peru', dialCode: '+51' },
    { code: 'BR', name: 'Brasil', dialCode: '+55' },
    { code: 'ES', name: 'Espana', dialCode: '+34' },
    { code: 'GB', name: 'Reino Unido', dialCode: '+44' },
    { code: 'FR', name: 'Francia', dialCode: '+33' },
    { code: 'DE', name: 'Alemania', dialCode: '+49' },
    { code: 'IT', name: 'Italia', dialCode: '+39' }
  ].sort((a, b) => a.name.localeCompare(b.name));

  /**
   * Initialize profile module
   */
  function init() {
    isProfilePage = window.location.pathname.includes('/perfil');

    if (isProfilePage) {
      initProfilePage();
    }
  }

  /**
   * Initialize profile page
   */
  async function initProfilePage() {
    // Populate country select
    populateCountrySelect();

    // Bind events
    bindEvents();

    // Check auth
    if (!APJApi.isAuthenticated()) {
      redirectToLogin();
      return;
    }

    // Validate token is still valid
    const isValidToken = await APJApi.validateToken();
    if (!isValidToken) {
      APJToast.info('Sesion expirada', 'Por favor inicia sesion nuevamente.');
      redirectToLogin();
      return;
    }

    await loadProfile();
  }

  /**
   * Redirect to home with login prompt
   */
  function redirectToLogin() {
    window.location.href = '/?login=1';
  }

  /**
   * Populate country select options
   */
  function populateCountrySelect() {
    const countrySelect = document.getElementById('profile-country_code');
    if (!countrySelect) return;

    countrySelect.innerHTML = COUNTRIES.map(c =>
      `<option value="${c.code}|${c.dialCode}">${c.name} (${c.dialCode})</option>`
    ).join('');
  }

  /**
   * Bind event handlers
   */
  function bindEvents() {
    // Gender change - update shirt sizes
    document.getElementById('profile-gender')?.addEventListener('change', updateShirtSizes);

    // Profile form submit
    document.getElementById('profile-form')?.addEventListener('submit', handleSaveProfile);

    // Change password button
    document.getElementById('profile-change-password-btn')?.addEventListener('click', handleChangePassword);

    // Validate password fields on input
    document.getElementById('profile-new_password')?.addEventListener('input', validatePasswordFields);
    document.getElementById('profile-confirm_password')?.addEventListener('input', validatePasswordFields);

    // Profile photo handlers
    document.getElementById('profile-photo-edit-btn')?.addEventListener('click', () => {
      document.getElementById('profile-photo-input')?.click();
    });

    document.getElementById('profile-photo-input')?.addEventListener('change', handlePhotoSelect);
  }

  /**
   * Load user profile
   */
  async function loadProfile() {
    const loadingEl = document.getElementById('profile-loading');
    const contentEl = document.getElementById('profile-content');

    try {
      const response = await APJApi.getProfile();
      originalUserData = response.user;
      populateForm(response.user);
      updateCompleteness(response.user);

      loadingEl?.classList.add('hidden');
      contentEl?.classList.remove('hidden');
    } catch (error) {
      APJToast.error('Error', 'No se pudo cargar el perfil');
      // Redirect to home after error
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
  }

  /**
   * Populate form with user data
   */
  function populateForm(user) {
    document.getElementById('profile-first_name').value = user.first_name || '';
    document.getElementById('profile-last_name').value = user.last_name || '';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-birthdate').value = user.birthdate || '';
    document.getElementById('profile-gender').value = user.gender || '';

    // Set profile photo
    updateProfilePhotoUI(user.photo_url);

    // Set phone and country
    const phone = user.phone || '';
    const countryIso = user.country_iso || 'MX';

    // Find country by ISO
    const country = COUNTRIES.find(c => c.code === countryIso) || COUNTRIES.find(c => c.code === 'MX');
    const countrySelect = document.getElementById('profile-country_code');
    countrySelect.value = `${country.code}|${country.dialCode}`;

    // Strip dial code from phone if present
    let phoneNumber = phone;
    if (phone.startsWith(country.dialCode)) {
      phoneNumber = phone.slice(country.dialCode.length);
    } else if (phone.startsWith('+')) {
      // Try to strip any dial code
      for (const c of COUNTRIES) {
        if (phone.startsWith(c.dialCode)) {
          phoneNumber = phone.slice(c.dialCode.length);
          countrySelect.value = `${c.code}|${c.dialCode}`;
          break;
        }
      }
    }
    document.getElementById('profile-phone').value = phoneNumber;

    // Update shirt sizes based on gender and set value
    updateShirtSizes();
    setTimeout(() => {
      document.getElementById('profile-shirt_size').value = user.shirt_size || '';
    }, 0);
  }

  /**
   * Update shirt sizes dropdown based on selected gender
   */
  function updateShirtSizes() {
    const gender = document.getElementById('profile-gender').value;
    const shirtSelect = document.getElementById('profile-shirt_size');
    const currentValue = shirtSelect.value;

    if (!gender) {
      shirtSelect.innerHTML = '<option value="">Seleccionar genero primero</option>';
      return;
    }

    const sizes = SHIRT_SIZES[gender] || SHIRT_SIZES.Otro;
    shirtSelect.innerHTML = '<option value="">Seleccionar</option>' +
      sizes.map(s => `<option value="${s.value}">${s.label}</option>`).join('');

    // Try to restore previous value if it's valid for new gender
    if (currentValue && sizes.some(s => s.value === currentValue)) {
      shirtSelect.value = currentValue;
    }
  }

  /**
   * Update profile completeness indicator
   */
  function updateCompleteness(user) {
    const fields = ['first_name', 'last_name', 'email', 'phone', 'birthdate', 'gender', 'shirt_size', 'photo_url'];
    const filledFields = fields.filter(f => user[f] && user[f].trim() !== '');
    const percent = Math.round((filledFields.length / fields.length) * 100);

    const container = document.getElementById('profile-completeness');
    const percentEl = document.getElementById('profile-completeness-percent');
    const fillEl = document.getElementById('profile-completeness-fill');

    if (percent < 100) {
      container?.classList.remove('hidden');
      if (percentEl) percentEl.textContent = `${percent}%`;
      if (fillEl) fillEl.style.width = `${percent}%`;
    } else {
      container?.classList.add('hidden');
    }
  }

  /**
   * Handle save profile
   */
  async function handleSaveProfile(e) {
    e.preventDefault();

    const phone = document.getElementById('profile-phone').value.trim();

    // Validate phone doesn't contain letters
    if (phone && /[a-zA-Z]/.test(phone)) {
      APJToast.error('Error', 'El telefono no debe contener letras');
      return;
    }

    const countryCodeValue = document.getElementById('profile-country_code').value;
    const [countryIso, dialCode] = countryCodeValue.split('|');
    const fullPhone = phone ? `${dialCode}${phone.replace(/\D/g, '')}` : '';

    const userData = {
      uid: originalUserData.uid,
      first_name: document.getElementById('profile-first_name').value.trim(),
      last_name: document.getElementById('profile-last_name').value.trim(),
      email: originalUserData.email,
      phone: fullPhone,
      country_iso: countryIso,
      birthdate: document.getElementById('profile-birthdate').value,
      gender: document.getElementById('profile-gender').value,
      shirt_size: document.getElementById('profile-shirt_size').value
    };

    // Check if there are changes
    if (!hasChanges(userData)) {
      APJToast.info('Sin cambios', 'No hay cambios para guardar');
      return;
    }

    const saveBtn = document.getElementById('profile-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Guardando...';

    try {
      const updatedUser = await APJApi.updateProfile(userData);
      originalUserData = updatedUser;
      APJToast.success('Perfil actualizado', 'Los cambios se guardaron correctamente');
      updateCompleteness(updatedUser);

      // Update UI
      APJAuth.updateAuthUI();
    } catch (error) {
      APJToast.error('Error', error.message || 'No se pudo actualizar el perfil');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar cambios';
    }
  }

  /**
   * Check if form has changes compared to original data
   */
  function hasChanges(newData) {
    // Build original phone for comparison
    let originalPhone = originalUserData.phone || '';

    return (
      newData.first_name !== (originalUserData.first_name || '') ||
      newData.last_name !== (originalUserData.last_name || '') ||
      newData.phone !== originalPhone ||
      newData.country_iso !== (originalUserData.country_iso || '') ||
      newData.birthdate !== (originalUserData.birthdate || '') ||
      newData.gender !== (originalUserData.gender || '') ||
      newData.shirt_size !== (originalUserData.shirt_size || '')
    );
  }

  /**
   * Handle change password
   */
  async function handleChangePassword() {
    const currentPassword = document.getElementById('profile-current_password').value;
    const newPassword = document.getElementById('profile-new_password').value;
    const confirmPassword = document.getElementById('profile-confirm_password').value;

    // Clear previous errors
    clearPasswordErrors();

    // Validate fields
    if (!currentPassword) {
      showPasswordError('profile-current_password', 'Ingresa tu contrasena actual');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      showPasswordError('profile-new_password', 'La contrasena debe tener al menos 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      showPasswordError('profile-confirm_password', 'Las contrasenas no coinciden');
      return;
    }

    if (currentPassword === newPassword) {
      showPasswordError('profile-new_password', 'La nueva contrasena debe ser diferente a la actual');
      return;
    }

    const btn = document.getElementById('profile-change-password-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Actualizando...';

    try {
      await APJApi.changePassword(currentPassword, newPassword);
      APJToast.success('Contrasena actualizada', 'Tu contrasena se actualizo correctamente');
      clearPasswordFields();
    } catch (error) {
      APJToast.error('Error', error.message || 'No se pudo actualizar la contrasena');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Actualizar contrasena';
    }
  }

  /**
   * Validate password fields on input
   */
  function validatePasswordFields() {
    const newPassword = document.getElementById('profile-new_password').value;
    const confirmPassword = document.getElementById('profile-confirm_password').value;

    clearPasswordErrors();

    if (newPassword && newPassword.length < 8) {
      showPasswordError('profile-new_password', 'Debe tener al menos 8 caracteres');
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      showPasswordError('profile-confirm_password', 'Las contrasenas no coinciden');
    }
  }

  /**
   * Show password field error
   */
  function showPasswordError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const group = field?.closest('.form-group');
    const errorEl = group?.querySelector('.form-error');

    if (field) field.classList.add('error');
    if (group) group.classList.add('has-error');
    if (errorEl) errorEl.textContent = message;
  }

  /**
   * Clear password errors
   */
  function clearPasswordErrors() {
    ['profile-current_password', 'profile-new_password', 'profile-confirm_password'].forEach(id => {
      const field = document.getElementById(id);
      const group = field?.closest('.form-group');
      const errorEl = group?.querySelector('.form-error');

      if (field) field.classList.remove('error');
      if (group) group.classList.remove('has-error');
      if (errorEl) errorEl.textContent = '';
    });
  }

  /**
   * Clear password fields
   */
  function clearPasswordFields() {
    document.getElementById('profile-current_password').value = '';
    document.getElementById('profile-new_password').value = '';
    document.getElementById('profile-confirm_password').value = '';
    clearPasswordErrors();
  }

  /**
   * Update profile photo UI
   */
  function updateProfilePhotoUI(photoUrl) {
    const photoEl = document.getElementById('profile-photo');
    const placeholderEl = document.getElementById('profile-photo-placeholder');

    if (photoUrl && photoUrl.trim() !== '') {
      photoEl.src = photoUrl;
      photoEl.classList.remove('hidden');
      placeholderEl?.classList.add('hidden');
    } else {
      photoEl.classList.add('hidden');
      placeholderEl?.classList.remove('hidden');
    }
  }

  /**
   * Handle photo file selection
   */
  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      APJToast.error('Error', 'Por favor selecciona una imagen valida');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      APJToast.error('Error', 'La imagen es muy grande. Maximo 10MB');
      return;
    }

    // Show loading state
    const loadingEl = document.getElementById('profile-photo-loading');
    const editBtn = document.getElementById('profile-photo-edit-btn');
    const statusEl = document.getElementById('profile-photo-status');

    loadingEl?.classList.remove('hidden');
    if (editBtn) editBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = 'Subiendo foto...';

    try {
      // Get user ID for public_id
      const uid = originalUserData.uid;
      const publicId = `profile-${uid}`;
      const folder = 'users/profile';

      // Step 1: Get upload signature
      const signatureData = await APJApi.getUploadSignature(publicId, folder, true);

      // Step 2: Upload to Cloudinary
      const uploadResult = await APJApi.uploadToCloudinary(file, signatureData, publicId, folder);
      const photoUrl = uploadResult.secure_url;

      if (!photoUrl) {
        throw new Error('No se recibio URL de imagen');
      }

      // Step 3: Update profile with new photo URL
      await APJApi.updateProfilePhoto(photoUrl);

      // Update local data and UI
      originalUserData.photo_url = photoUrl;
      updateProfilePhotoUI(photoUrl);
      updateCompleteness(originalUserData);

      // Update header avatar
      APJAuth.updateAuthUI();

      APJToast.success('Foto actualizada', 'Tu foto de perfil se actualizo correctamente');
      if (statusEl) statusEl.textContent = '';

    } catch (error) {
      console.error('Error uploading photo:', error);
      APJToast.error('Error', 'No se pudo subir la foto. Intenta de nuevo.');
      if (statusEl) statusEl.textContent = '';
    } finally {
      loadingEl?.classList.add('hidden');
      if (editBtn) editBtn.style.display = '';
      // Clear input so same file can be selected again
      e.target.value = '';
    }
  }

  /**
   * Navigate to profile page
   */
  function goToProfile() {
    if (!APJApi.isAuthenticated()) {
      APJAuth.showLogin();
      return;
    }
    window.location.href = '/perfil/';
  }

  // Public API
  return {
    init,
    goToProfile
  };
})();
