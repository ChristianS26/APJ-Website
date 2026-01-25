// APJ Padel - Main Application

const APJApp = (function() {

  /**
   * Initialize application
   */
  function init() {
    // Initialize toast system
    APJToast.init();

    // Initialize auth
    APJAuth.init();

    // Check if on registration page
    if (window.location.pathname.includes('/inscripcion')) {
      // Check for payment success redirect first
      if (!APJPayment.checkSuccessRedirect()) {
        APJRegistration.init();
      }
    }

  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    init
  };
})();

// Toast notification system
const APJToast = (function() {
  let container = null;

  /**
   * Initialize toast container
   */
  function init() {
    if (container) return;

    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  /**
   * Show toast notification
   */
  function show(type, title, message, duration = 5000) {
    if (!container) init();

    const icons = {
      success: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>`,
      error: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>`,
      info: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>`
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      ${icons[type] || icons.info}
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    // Close button handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
      removeToast(toast);
    });

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        removeToast(toast);
      }, duration);
    }

    return toast;
  }

  /**
   * Remove toast
   */
  function removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }

  /**
   * Show success toast
   */
  function success(title, message, duration) {
    return show('success', title, message, duration);
  }

  /**
   * Show error toast
   */
  function error(title, message, duration) {
    return show('error', title, message, duration);
  }

  /**
   * Show info toast
   */
  function info(title, message, duration) {
    return show('info', title, message, duration);
  }

  // Public API
  return {
    init,
    show,
    success,
    error,
    info
  };
})();
