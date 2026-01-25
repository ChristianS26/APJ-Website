// APJ Padel - Configuration

// =============================================
// ENVIRONMENT SWITCH - Change this to switch environments
// =============================================
const ENV = 'prod'; // 'stage' or 'prod'

// Environment-specific configurations
const ENVIRONMENTS = {
  stage: {
    API_BASE_URL: 'https://ktor-lagartosapp-stage.up.railway.app',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_51RLpzE06aLfQAKOqIGtgP1eOhb8Y2bEtYZTv7iAkr55mn5euM8IKsdIzbBRaH0sIcmGfMSO535LzPW2SnXiFTKY700O3z8ruJ5'
  },
  prod: {
    API_BASE_URL: 'https://ktor-lagartosapp-production.up.railway.app',
    STRIPE_PUBLISHABLE_KEY: 'pk_live_51RLpz406yfSRDOzj53yssmjYSxAkqPtAVRmybHMTHF8AJPeFPA5vjkTo0LP537AxHabdfJkTxMVGaGN2cjxoJj0c00oVcx73hJ'
  }
};

const APJConfig = {
  // Current environment
  ENV: ENV,

  // API Configuration
  API_BASE_URL: ENVIRONMENTS[ENV].API_BASE_URL,

  // Stripe Configuration
  STRIPE_PUBLISHABLE_KEY: ENVIRONMENTS[ENV].STRIPE_PUBLISHABLE_KEY,

  // Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'apj_auth_token',
    USER_DATA: 'apj_user_data',
    REFRESH_TOKEN: 'apj_refresh_token'
  },

  // Validation Constants
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 8,
    MIN_NAME_LENGTH: 2,
    MIN_SEARCH_LENGTH: 3,
    PHONE_REGEX: /^\+[1-9]\d{8,14}$/,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/,
    COUNTRY_ISO_REGEX: /^[A-Z]{2}$/
  },

  // Shirt Sizes by Gender (keys match backend values: Masculino, Femenino, Otro)
  SHIRT_SIZES: {
    Femenino: ['XS', 'S', 'M', 'L'],
    Masculino: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
    Otro: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL']
  },

  // Gender Options (values match backend: Masculino, Femenino, Otro)
  GENDERS: [
    { value: 'Masculino', label: 'Masculino' },
    { value: 'Femenino', label: 'Femenino' },
    { value: 'Otro', label: 'Otro' }
  ],

  // Common Countries
  COUNTRIES: [
    { code: 'MX', name: 'Mexico', phone: '+52' },
    { code: 'US', name: 'Estados Unidos', phone: '+1' },
    { code: 'ES', name: 'Espana', phone: '+34' },
    { code: 'AR', name: 'Argentina', phone: '+54' },
    { code: 'CO', name: 'Colombia', phone: '+57' },
    { code: 'CL', name: 'Chile', phone: '+56' }
  ]
};

// Freeze config to prevent modifications
Object.freeze(APJConfig);
Object.freeze(APJConfig.STORAGE_KEYS);
Object.freeze(APJConfig.VALIDATION);
Object.freeze(APJConfig.SHIRT_SIZES);
