// APJ Padel - Stripe Payment Integration

const APJPayment = (function() {
  let stripe = null;
  let elements = null;
  let paymentElement = null;
  let clientSecret = null;

  /**
   * Initialize Stripe
   */
  function initStripe() {
    if (stripe) return; // Already initialized

    if (typeof Stripe === 'undefined') {
      console.error('Stripe.js not loaded');
      APJToast.error('Error', 'No se pudo cargar el sistema de pagos');
      return;
    }

    stripe = Stripe(APJConfig.STRIPE_PUBLISHABLE_KEY);
  }

  /**
   * Create payment element
   */
  async function createPaymentElement(amount, currency = 'mxn') {
    if (!stripe) {
      initStripe();
    }

    const container = document.getElementById('stripe-payment-element');
    if (!container) return;

    // Show loading
    container.innerHTML = '<div style="text-align: center; padding: 20px;"><span class="spinner" style="margin: 0 auto;"></span><p style="margin-top: 12px; color: var(--text-muted);">Cargando metodo de pago...</p></div>';

    try {
      // Create payment intent first to get client secret
      const userData = APJApi.getUserData();
      const state = APJRegistration.getState();
      const tournament = APJTournaments.getActiveTournament();

      console.log('[APJ Payment] userData:', userData);
      console.log('[APJ Payment] state:', state);
      console.log('[APJ Payment] tournament:', tournament);

      // Build payment data with correct types
      const paymentData = {
        amount: Number(amount),
        currency: currency,
        playerName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
        playerUid: String(userData.uid || userData.id),
        partnerUid: String(state.selectedPartner?.uid || state.selectedPartner?.id),
        tournamentId: String(tournament.id || tournament.tournament_id),
        categoryId: Number(state.selectedCategory.category_id || state.selectedCategory.id),
        email: String(userData.email),
        paidFor: String(state.paidFor || '1')
      };

      if (state.discountCode && state.paidFor === '1') {
        paymentData.discount_code = state.discountCode;
      }

      console.log('[APJ Payment] Sending paymentData:', JSON.stringify(paymentData, null, 2));

      const response = await APJApi.createPaymentIntent(paymentData);

      // Check if free registration
      if (response.free_registration) {
        APJRegistration.showSuccess();
        return;
      }

      clientSecret = response.clientSecret || response.client_secret;

      if (!clientSecret) {
        throw new Error('No se recibio la clave de pago');
      }

      // Create Elements instance
      elements = stripe.elements({
        clientSecret: clientSecret,
        appearance: getStripeAppearance()
      });

      // Create payment element
      paymentElement = elements.create('payment', {
        layout: 'tabs'
      });

      // Clear container and mount
      container.innerHTML = '';
      paymentElement.mount('#stripe-payment-element');

    } catch (error) {
      console.error('Error creating payment element:', error);

      // Handle specific API errors based on status code
      const status = error.status || 0;
      let errorTitle = 'Error';
      let errorMessage = error.message || 'Error al cargar el método de pago';
      let showRetry = true;

      if (status === 423) {
        // Partner already registered with someone else
        errorTitle = 'Pareja no disponible';
        showRetry = false;
      } else if (status === 409) {
        // Already registered and paid
        errorTitle = 'Ya inscrito';
        showRetry = false;
      } else if (status === 400) {
        // Already registered with different partner
        errorTitle = 'Conflicto de inscripción';
        showRetry = false;
      }

      // Show toast with specific error
      APJToast.error(errorTitle, errorMessage);

      // Update container UI
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--error);">
          <p style="font-weight: 600; margin-bottom: 8px;">${errorTitle}</p>
          <p style="color: var(--text-muted);">${errorMessage}</p>
          ${showRetry ? `<button class="btn btn-sm btn-outline" onclick="APJPayment.retryPaymentElement()" style="margin-top: 12px;">Reintentar</button>` : `<a href="/inscripcion/" class="btn btn-sm btn-outline" style="margin-top: 12px;">Volver a intentar</a>`}
        </div>
      `;
    }
  }

  /**
   * Retry creating payment element
   */
  function retryPaymentElement() {
    const state = APJRegistration.getState();
    const basePrice = state.selectedCategory?.price || 999;
    const quantity = state.paidFor === '2' ? 2 : 1;
    let amount = basePrice * quantity;

    if (state.discountData && state.paidFor === '1') {
      amount = state.discountData.final_amount;
    }

    createPaymentElement(amount);
  }

  /**
   * Get Stripe appearance for dark/light mode
   */
  function getStripeAppearance() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    return {
      theme: isDark ? 'night' : 'stripe',
      variables: {
        colorPrimary: '#10b981',
        colorBackground: isDark ? '#1a1a1a' : '#ffffff',
        colorText: isDark ? '#ffffff' : '#111111',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '8px'
      }
    };
  }

  /**
   * Process payment - creates intent and handles full payment flow
   */
  async function processPayment(paymentData) {
    if (!stripe) {
      initStripe();
    }

    if (!stripe) {
      APJToast.error('Error', 'El sistema de pagos no esta listo');
      return;
    }

    const submitBtn = document.getElementById('submit-payment');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';
    }

    try {
      // Step 1: Create payment intent
      console.log('[APJ Payment] Creating payment intent...');
      const response = await APJApi.createPaymentIntent(paymentData);

      // Check if free registration (100% discount)
      if (response.free_registration) {
        APJRegistration.showSuccess();
        return;
      }

      clientSecret = response.clientSecret || response.client_secret;

      if (!clientSecret) {
        throw new Error('No se recibio la clave de pago');
      }

      // Step 2: Create Elements and mount Payment Element
      console.log('[APJ Payment] Creating Stripe Elements...');
      elements = stripe.elements({
        clientSecret: clientSecret,
        appearance: getStripeAppearance()
      });

      paymentElement = elements.create('payment', { layout: 'tabs' });

      const container = document.getElementById('stripe-payment-element');
      if (container) {
        container.innerHTML = '';
        paymentElement.mount('#stripe-payment-element');
      }

      // Step 3: Wait for element to be ready, then show confirm button
      paymentElement.on('ready', () => {
        console.log('[APJ Payment] Payment element ready');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> Confirmar Pago`;
          submitBtn.onclick = () => confirmPayment(paymentData.email);
        }
      });

    } catch (error) {
      console.error('Payment error:', error);

      // Handle specific API errors based on status code
      const status = error.status || 0;
      let errorTitle = 'Error';

      if (status === 423) {
        errorTitle = 'Pareja no disponible';
      } else if (status === 409) {
        errorTitle = 'Ya inscrito';
      } else if (status === 400) {
        errorTitle = 'Conflicto de inscripción';
      }

      APJToast.error(errorTitle, error.message || 'Error al procesar el pago');

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reintentar';
      }
    }
  }

  /**
   * Confirm payment after user enters card details
   */
  async function confirmPayment(email) {
    if (!stripe || !elements) {
      APJToast.error('Error', 'El sistema de pagos no esta listo');
      return;
    }

    const submitBtn = document.getElementById('submit-payment');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Procesando pago...';
    }

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/inscripcion/?success=true`,
          receipt_email: email
        },
        redirect: 'if_required'
      });

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          APJToast.error('Error de pago', error.message);
        } else {
          APJToast.error('Error', 'Ocurrio un error inesperado');
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> Reintentar`;
        }
        return;
      }

      // Payment succeeded
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        APJRegistration.showSuccess();
      }

    } catch (error) {
      console.error('Payment confirmation error:', error);
      APJToast.error('Error', error.message || 'Error al confirmar el pago');

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> Reintentar`;
      }
    }
  }

  /**
   * Check for success redirect
   */
  function checkSuccessRedirect() {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('success') === 'true') {
      // Remove query params from URL
      window.history.replaceState({}, '', window.location.pathname);

      // Show success message
      setTimeout(() => {
        const container = document.getElementById('registration-container');
        if (container) {
          container.innerHTML = `
            <div class="success-state">
              <div class="success-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2>Pago Exitoso</h2>
              <p>Tu pago ha sido procesado correctamente. Recibiras un correo de confirmacion con los detalles de tu inscripcion.</p>
              <a href="/" class="btn btn-primary" style="margin-top: 24px;">Volver al Inicio</a>
            </div>
          `;
        }

        // Hide steps
        const stepsEl = document.querySelector('.steps');
        if (stepsEl) stepsEl.classList.add('hidden');
      }, 100);

      return true;
    }

    return false;
  }

  // Public API
  return {
    initStripe,
    createPaymentElement,
    retryPaymentElement,
    processPayment,
    checkSuccessRedirect
  };
})();
