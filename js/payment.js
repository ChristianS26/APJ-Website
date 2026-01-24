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

      const paymentData = {
        amount: amount,
        currency: currency,
        playerName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
        playerUid: userData.uid || userData.id,
        partnerUid: state.selectedPartner?.uid || state.selectedPartner?.id,
        tournamentId: tournament.id || tournament.tournament_id,
        categoryId: state.selectedCategory.id || state.selectedCategory.category_id,
        email: userData.email,
        paidFor: state.paidFor
      };

      if (state.discountCode && state.paidFor === '1') {
        paymentData.discount_code = state.discountCode;
      }

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
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--error);">
          <p>Error al cargar el metodo de pago</p>
          <button class="btn btn-sm btn-outline" onclick="APJPayment.retryPaymentElement()" style="margin-top: 12px;">Reintentar</button>
        </div>
      `;
    }
  }

  /**
   * Retry creating payment element
   */
  function retryPaymentElement() {
    const state = APJRegistration.getState();
    const basePrice = state.selectedCategory?.price || state.selectedCategory?.price_cents || 99900;
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
   * Process payment
   */
  async function processPayment(paymentData) {
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
      // If we don't have a client secret yet, create the payment intent
      if (!clientSecret) {
        const response = await APJApi.createPaymentIntent(paymentData);

        if (response.free_registration) {
          APJRegistration.showSuccess();
          return;
        }

        clientSecret = response.clientSecret || response.client_secret;
      }

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/inscripcion/?success=true`,
          receipt_email: paymentData.email
        },
        redirect: 'if_required'
      });

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          APJToast.error('Error de pago', error.message);
        } else {
          APJToast.error('Error', 'Ocurrio un error inesperado');
        }
        return;
      }

      // Payment succeeded
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        APJRegistration.showSuccess();
      }

    } catch (error) {
      console.error('Payment error:', error);
      APJToast.error('Error', error.message || 'Error al procesar el pago');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        const state = APJRegistration.getState();
        const basePrice = state.selectedCategory?.price || state.selectedCategory?.price_cents || 99900;
        const quantity = state.paidFor === '2' ? 2 : 1;
        let amount = basePrice * quantity;

        if (state.discountData && state.paidFor === '1') {
          amount = state.discountData.final_amount;
        }

        submitBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> Pagar ${APJTournaments.formatPrice(amount)}`;
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
