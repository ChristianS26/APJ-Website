// APJ Padel - Form Validation

const APJValidation = (function() {

  /**
   * Validate email
   */
  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return APJConfig.VALIDATION.EMAIL_REGEX.test(email.trim());
  }

  /**
   * Validate password
   */
  function isValidPassword(password) {
    if (!password || typeof password !== 'string') return false;
    return password.length >= APJConfig.VALIDATION.MIN_PASSWORD_LENGTH;
  }

  /**
   * Validate name (first or last)
   */
  function isValidName(name) {
    if (!name || typeof name !== 'string') return false;
    return name.trim().length >= APJConfig.VALIDATION.MIN_NAME_LENGTH;
  }

  /**
   * Validate phone (E.164 format) - Required
   */
  function isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    if (phone.trim() === '') return false;
    return APJConfig.VALIDATION.PHONE_REGEX.test(phone.trim());
  }

  /**
   * Validate birthdate (YYYY-MM-DD format) - Required
   */
  function isValidBirthdate(date) {
    if (!date || typeof date !== 'string') return false;
    if (date.trim() === '') return false;

    if (!APJConfig.VALIDATION.DATE_REGEX.test(date)) return false;

    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return false;

    // Check if date is in the past
    return parsed < new Date();
  }

  /**
   * Validate country ISO code - Required
   */
  function isValidCountryIso(code) {
    if (!code || typeof code !== 'string') return false;
    if (code.trim() === '') return false;
    return APJConfig.VALIDATION.COUNTRY_ISO_REGEX.test(code.toUpperCase());
  }

  /**
   * Validate gender - Required (Masculino, Femenino, Otro)
   */
  function isValidGender(gender) {
    if (!gender || typeof gender !== 'string') return false;
    if (gender.trim() === '') return false;
    return ['Masculino', 'Femenino', 'Otro'].includes(gender);
  }

  /**
   * Validate shirt size based on gender - Required
   */
  function isValidShirtSize(size, gender) {
    if (!size || typeof size !== 'string') return false;
    if (size.trim() === '') return false;

    const validGender = gender || 'Masculino';
    const validSizes = APJConfig.SHIRT_SIZES[validGender] || APJConfig.SHIRT_SIZES.Masculino;

    return validSizes.includes(size.toUpperCase());
  }

  /**
   * Get available shirt sizes for gender
   */
  function getShirtSizesForGender(gender) {
    return APJConfig.SHIRT_SIZES[gender] || APJConfig.SHIRT_SIZES.Masculino;
  }

  /**
   * Validate registration form data - All fields required
   */
  function validateRegistration(data) {
    const errors = {};

    // Required fields
    if (!isValidEmail(data.email)) {
      errors.email = 'Ingresa un correo electronico valido';
    }

    if (!isValidPassword(data.password)) {
      errors.password = `La contrasena debe tener al menos ${APJConfig.VALIDATION.MIN_PASSWORD_LENGTH} caracteres`;
    }

    if (!isValidName(data.first_name)) {
      errors.first_name = `El nombre debe tener al menos ${APJConfig.VALIDATION.MIN_NAME_LENGTH} caracteres`;
    }

    if (!isValidName(data.last_name)) {
      errors.last_name = `El apellido debe tener al menos ${APJConfig.VALIDATION.MIN_NAME_LENGTH} caracteres`;
    }

    if (!isValidPhone(data.phone)) {
      errors.phone = 'Ingresa un telefono valido (minimo 8 digitos)';
    }

    if (!isValidBirthdate(data.birthdate)) {
      errors.birthdate = 'Selecciona tu fecha de nacimiento';
    }

    if (!isValidGender(data.gender)) {
      errors.gender = 'Selecciona tu genero';
    }

    if (!isValidShirtSize(data.shirt_size, data.gender)) {
      errors.shirt_size = 'Selecciona tu talla de playera';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Validate login form data
   */
  function validateLogin(data) {
    const errors = {};

    if (!isValidEmail(data.email)) {
      errors.email = 'Ingresa un correo electronico valido';
    }

    if (!data.password || data.password.length === 0) {
      errors.password = 'Ingresa tu contrasena';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Show field error
   */
  function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const group = field.closest('.form-group');
    if (group) {
      group.classList.add('has-error');
      const errorEl = group.querySelector('.form-error');
      if (errorEl) {
        errorEl.textContent = message;
      }
    }

    field.classList.add('error');
  }

  /**
   * Clear field error
   */
  function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const group = field.closest('.form-group');
    if (group) {
      group.classList.remove('has-error');
    }

    field.classList.remove('error');
  }

  /**
   * Clear all errors in a form
   */
  function clearFormErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.querySelectorAll('.form-group.has-error').forEach(group => {
      group.classList.remove('has-error');
    });

    form.querySelectorAll('.form-input.error').forEach(input => {
      input.classList.remove('error');
    });
  }

  /**
   * Apply validation errors to form
   */
  function applyFormErrors(errors) {
    Object.entries(errors).forEach(([field, message]) => {
      showFieldError(field, message);
    });
  }

  // Public API
  return {
    isValidEmail,
    isValidPassword,
    isValidName,
    isValidPhone,
    isValidBirthdate,
    isValidCountryIso,
    isValidGender,
    isValidShirtSize,
    getShirtSizesForGender,
    validateRegistration,
    validateLogin,
    showFieldError,
    clearFieldError,
    clearFormErrors,
    applyFormErrors
  };
})();
