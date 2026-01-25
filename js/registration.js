// APJ Padel - Tournament Registration

const APJRegistration = (function() {
  // State
  let currentStep = 1;
  let selectedCategory = null;
  let selectedPartner = null;
  let partnerIsLocked = false; // True if partner is locked due to existing registration
  let paymentMethod = 'card'; // 'card' or 'code'
  let paidFor = '1'; // '1' = just me, '2' = both
  let discountCode = null;
  let discountData = null;
  let searchTimeout = null;
  let justAutoAdvanced = false; // Flag to prevent double-advance

  /**
   * Initialize registration flow
   */
  async function init() {
    // Check if on registration page
    if (!document.getElementById('registration-container')) return;

    // Check auth
    if (!APJApi.isAuthenticated()) {
      APJAuth.showLogin();
      window.addEventListener('apj:auth:login', () => {
        location.reload();
      }, { once: true });
      return;
    }

    bindEvents();
    await loadTournamentData();
    updateUI();
  }

  /**
   * Load tournament and category data
   */
  async function loadTournamentData() {
    const loadingEl = document.getElementById('loading-state');
    const contentEl = document.getElementById('step-content');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('hidden');

    try {
      await APJTournaments.loadTournaments();
      const tournament = APJTournaments.getActiveTournament();

      if (!tournament) {
        showNoTournament();
        return;
      }

      // Update tournament info
      const tournamentNameEl = document.getElementById('tournament-name');
      if (tournamentNameEl) {
        tournamentNameEl.textContent = tournament.name || tournament.tournament_name || 'Torneo APJ';
      }

      // Load categories
      await APJTournaments.loadCategories(
        tournament.id || tournament.tournament_id,
        tournament.type || tournament.tournament_type || 'regular'
      );

      // Load user's existing registrations for this tournament
      await APJTournaments.loadMyRegistrations(tournament.id || tournament.tournament_id);

      renderCategories();

      if (loadingEl) loadingEl.classList.add('hidden');
      if (contentEl) contentEl.classList.remove('hidden');
    } catch (error) {
      console.error('Error loading tournament data:', error);
      APJToast.error('Error', 'No se pudo cargar la informacion del torneo');
    }
  }

  /**
   * Show no tournament available message
   */
  function showNoTournament() {
    const container = document.getElementById('registration-container');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h2>No hay torneos disponibles</h2>
        <p>No hay torneos con inscripciones abiertas en este momento. Visita nuestra app para ver el calendario completo.</p>
        <a href="/" class="btn btn-primary" style="margin-top: 20px;">Volver al inicio</a>
      </div>
    `;
  }

  /**
   * Render category cards - grouped by registration status (like Android)
   */
  function renderCategories() {
    const container = document.getElementById('category-list');
    if (!container) return;

    const categories = APJTournaments.getCategories();

    if (!categories || categories.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No hay categorias disponibles para este torneo.</p>
        </div>
      `;
      return;
    }

    // Separate categories into registered and available (like Android's "Tuyas" and "Otras")
    const registeredCategories = [];
    const availableCategories = [];

    categories.forEach(cat => {
      const categoryId = cat.id || cat.category_id;
      const isRegistered = APJTournaments.isRegisteredInCategory(categoryId);
      if (isRegistered) {
        registeredCategories.push(cat);
      } else {
        availableCategories.push(cat);
      }
    });

    let html = '';

    // Registered categories section ("Tuyas" in Android)
    if (registeredCategories.length > 0) {
      html += `
        <div class="category-section">
          <h3 class="category-section-title">Mis Inscripciones</h3>
          ${registeredCategories.map(cat => renderCategoryCard(cat, true)).join('')}
        </div>
      `;
    }

    // Available categories section ("Otras" in Android)
    if (availableCategories.length > 0) {
      html += `
        <div class="category-section">
          <h3 class="category-section-title">${registeredCategories.length > 0 ? 'Otras Categorias' : 'Categorias Disponibles'}</h3>
          ${availableCategories.map(cat => renderCategoryCard(cat, false)).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
  }

  /**
   * Render a single category card
   */
  function renderCategoryCard(cat, isRegistered) {
    const categoryId = cat.id || cat.category_id;
    const registration = isRegistered ? APJTournaments.getRegistrationForCategory(categoryId) : null;

    // Debug logging
    console.log('[APJ] Rendering category:', cat.name || cat.category_name, 'ID:', categoryId);
    console.log('[APJ] Registration data:', registration);

    const partner = registration?.partner;
    // API returns snake_case: paid_by_me, paid_by_partner
    const paidByMe = registration?.paid_by_me === true;
    const paidByPartner = registration?.paid_by_partner === true;

    console.log('[APJ] Payment status - paidByMe:', paidByMe, 'paidByPartner:', paidByPartner);

    let statusHtml = '';
    let cardClass = 'category-card';
    let actionText = '';
    let isClickable = true;

    if (isRegistered) {
      const partnerName = partner
        ? `${partner.firstName || partner.first_name || ''} ${partner.lastName || partner.last_name || ''}`.trim()
        : 'Sin pareja';

      if (paidByMe && paidByPartner) {
        // Fully paid - can't do anything
        statusHtml = `
          <div class="category-status-row">
            <span class="category-status paid">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Inscrito
            </span>
          </div>
          <p class="category-partner">Con: ${partnerName}</p>
        `;
        cardClass += ' registered disabled fully-paid';
        actionText = 'Ya registrado';
        isClickable = false;
      } else if (paidByMe) {
        // I paid, waiting for partner
        statusHtml = `
          <div class="category-status-row">
            <span class="category-status pending">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Esperando pago
            </span>
          </div>
          <p class="category-partner">Pareja: ${partnerName}</p>
        `;
        cardClass += ' registered disabled waiting-partner';
        actionText = 'Esperando a tu pareja';
        isClickable = false;
      } else if (paidByPartner) {
        // Partner paid, I need to pay - ACTIONABLE
        statusHtml = `
          <div class="category-status-row">
            <span class="category-status needs-payment">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Pagar mi inscripcion
            </span>
          </div>
          <p class="category-partner">${partnerName} ya pago su parte</p>
        `;
        cardClass += ' registered needs-payment actionable';
        actionText = 'Completar pago';
        isClickable = true;
      } else {
        // Registered but neither has paid - ACTIONABLE
        statusHtml = `
          <div class="category-status-row">
            <span class="category-status pending">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Pendiente de pago
            </span>
          </div>
          <p class="category-partner">Pareja: ${partnerName}</p>
        `;
        cardClass += ' registered pending-payment actionable';
        actionText = 'Completar pago';
        isClickable = true;
      }
    } else {
      // Available category
      cardClass += ' available';
      actionText = 'Inscribirse';
      isClickable = true;
    }

    return `
      <div class="${cardClass}${isClickable ? '' : ' non-clickable'}" data-category-id="${categoryId}"${!isClickable ? ' tabindex="-1"' : ''}>
        <div class="category-info">
          <h4>${cat.name || cat.category_name}</h4>
          ${cat.description ? `<p class="category-description">${cat.description}</p>` : ''}
          ${statusHtml}
        </div>
        <div class="category-action">
          <div class="category-price">
            ${APJTournaments.formatPrice(cat.price || 999)}
          </div>
          ${isClickable ? `<span class="category-cta">${actionText} →</span>` : `<span class="category-cta disabled">${actionText}</span>`}
        </div>
      </div>
    `;
  }

  /**
   * Bind event handlers
   */
  function bindEvents() {
    // Category selection
    document.addEventListener('click', e => {
      const categoryCard = e.target.closest('.category-card');
      if (categoryCard) {
        e.stopImmediatePropagation(); // Prevent other document click handlers from running
        selectCategory(categoryCard.dataset.categoryId);
      }
    });

    // Partner search
    const searchInput = document.getElementById('partner-search');
    console.log('[APJ] Partner search input found:', !!searchInput);
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        console.log('[APJ] Search query:', query);

        if (query.length < APJConfig.VALIDATION.MIN_SEARCH_LENGTH) {
          document.getElementById('search-results').innerHTML = '';
          return;
        }

        searchTimeout = setTimeout(() => searchPartners(query), 300);
      });
    }

    // Search result selection
    document.addEventListener('click', e => {
      const resultEl = e.target.closest('.search-result');
      if (resultEl) {
        selectPartner(resultEl.dataset.userId);
      }
    });

    // Remove partner
    document.addEventListener('click', e => {
      if (e.target.closest('.remove-partner')) {
        removePartner();
      }
    });

    // Payment method selection
    document.addEventListener('click', e => {
      const option = e.target.closest('.payment-option');
      if (option) {
        setPaymentMethod(option.dataset.method);
      }
    });

    // Paid for selection
    document.addEventListener('change', e => {
      if (e.target.name === 'paid-for') {
        setPaidFor(e.target.value);
      }
    });

    // Discount code
    document.getElementById('apply-discount')?.addEventListener('click', applyDiscountCode);
    document.addEventListener('click', e => {
      if (e.target.closest('.discount-remove')) {
        removeDiscount();
      }
    });

    // Navigation buttons (using event delegation for multiple buttons)
    document.addEventListener('click', e => {
      if (e.target.closest('.btn-next')) {
        nextStep();
      }
      if (e.target.closest('.btn-prev')) {
        prevStep();
      }
    });

    // Submit registration code
    document.getElementById('submit-code')?.addEventListener('click', submitRegistrationCode);

    // Submit payment
    document.getElementById('submit-payment')?.addEventListener('click', submitPayment);
  }

  /**
   * Select category
   */
  function selectCategory(categoryId) {
    const catId = parseInt(categoryId) || categoryId;
    console.log('[APJ] selectCategory called with:', categoryId, 'parsed:', catId);

    // Check if category is non-clickable (fully paid or waiting for partner)
    const card = document.querySelector(`.category-card[data-category-id="${categoryId}"]`);
    console.log('[APJ] Card classes:', card?.className);

    if (card && card.classList.contains('non-clickable')) {
      APJToast.error('Categoria no disponible', 'Ya estas inscrito en esta categoria o esperando pago de tu pareja');
      return;
    }

    selectedCategory = APJTournaments.getCategoryById(catId);

    // Check if already registered in this category
    const isRegistered = APJTournaments.isRegisteredInCategory(catId);
    const existingPartner = APJTournaments.getPartnerForCategory(catId);

    if (isRegistered && existingPartner) {
      // Lock the partner to the existing one
      selectedPartner = {
        uid: existingPartner.uid,
        id: existingPartner.uid,
        first_name: existingPartner.firstName || existingPartner.first_name,
        last_name: existingPartner.lastName || existingPartner.last_name,
        email: existingPartner.email,
        photo_url: existingPartner.photoUrl || existingPartner.photo_url
      };
      partnerIsLocked = true;
      console.log('[APJ] Partner locked to existing registration:', selectedPartner);
    } else {
      // Clear partner if switching to a new category
      if (partnerIsLocked) {
        selectedPartner = null;
        partnerIsLocked = false;
      }
    }

    // Update UI
    document.querySelectorAll('.category-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.categoryId === categoryId.toString());
    });

    // Clear discount when category changes
    removeDiscount();

    updateUI();
    updatePartnerUI();

    // Auto-advance to step 2 after selecting a valid category
    // Only advance if we're still on step 1
    if (selectedCategory && currentStep === 1) {
      console.log('[APJ] Auto-advancing from step 1 to step 2');
      justAutoAdvanced = true;
      currentStep = 2;
      updateUI();
      updatePartnerUI();
      // Clear flag after current event loop completes
      setTimeout(() => { justAutoAdvanced = false; }, 0);
    }
  }

  /**
   * Update partner UI based on locked state
   */
  function updatePartnerUI() {
    const searchContainer = document.getElementById('partner-search-container');
    const selectedContainer = document.getElementById('selected-partner');

    if (partnerIsLocked && selectedPartner) {
      // Show locked partner
      const name = `${selectedPartner.first_name || ''} ${selectedPartner.last_name || ''}`.trim() || 'Pareja';
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

      if (searchContainer) searchContainer.classList.add('hidden');
      if (selectedContainer) {
        selectedContainer.classList.remove('hidden');
        selectedContainer.innerHTML = `
          <div class="selected-partner-info">
            <div class="search-result-avatar">
              ${selectedPartner.photo_url ? `<img src="${selectedPartner.photo_url}" alt="${name}">` : initials}
            </div>
            <div>
              <div class="search-result-name">${name}</div>
              <div class="search-result-email">${selectedPartner.email || ''}</div>
              <small style="color: var(--accent);">Pareja fija (ya inscrito en esta categoria)</small>
            </div>
          </div>
        `;
      }
    } else if (!selectedPartner) {
      // Show search
      if (searchContainer) searchContainer.classList.remove('hidden');
      if (selectedContainer) selectedContainer.classList.add('hidden');
    }
  }

  /**
   * Search for partners
   */
  async function searchPartners(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) {
      console.error('[APJ] search-results container not found');
      return;
    }

    console.log('[APJ] Searching for partners with query:', query);

    // Show loading state
    resultsContainer.innerHTML = `
      <div class="search-result" style="cursor: default; justify-content: center;">
        <span class="spinner"></span>
      </div>
    `;

    try {
      const users = await APJApi.searchUsers(query);
      console.log('[APJ] Search results:', users);
      console.log('[APJ] Search results type:', typeof users, Array.isArray(users));

      const currentUser = APJApi.getUserData();
      console.log('[APJ] Current user:', currentUser);

      // Filter out current user (only compare if values exist)
      const filteredUsers = Array.isArray(users) ? users.filter(u => {
        const sameUid = currentUser?.uid && u.uid === currentUser.uid;
        const sameId = currentUser?.id && u.id === currentUser.id;
        const isCurrentUser = sameUid || sameId;
        console.log('[APJ] User', u.email, 'isCurrentUser:', isCurrentUser);
        return !isCurrentUser;
      }) : [];

      console.log('[APJ] Filtered users:', filteredUsers.length);

      if (filteredUsers.length === 0) {
        resultsContainer.innerHTML = `
          <div class="search-result" style="cursor: default;">
            <span style="color: var(--text-muted);">No se encontraron usuarios</span>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = filteredUsers.map(user => {
        const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Usuario';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        return `
          <div class="search-result" data-user-id="${user.uid || user.id}" data-user='${JSON.stringify(user).replace(/'/g, "\\'")}'>
            <div class="search-result-avatar">
              ${user.photo_url ? `<img src="${user.photo_url}" alt="${name}">` : initials}
            </div>
            <div>
              <div class="search-result-name">${name}</div>
              <div class="search-result-email">${user.email || ''}</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (error) {
      console.error('Error searching users:', error);
      resultsContainer.innerHTML = `
        <div class="search-result" style="cursor: default;">
          <span style="color: var(--error);">Error al buscar usuarios</span>
        </div>
      `;
    }
  }

  /**
   * Select partner
   */
  function selectPartner(userId) {
    const resultEl = document.querySelector(`.search-result[data-user-id="${userId}"]`);
    if (!resultEl) return;

    try {
      selectedPartner = JSON.parse(resultEl.dataset.user);
    } catch (e) {
      console.error('Error parsing user data:', e);
      return;
    }

    // Update UI
    const searchContainer = document.getElementById('partner-search-container');
    const selectedContainer = document.getElementById('selected-partner');

    if (searchContainer) searchContainer.classList.add('hidden');
    if (selectedContainer) {
      const name = `${selectedPartner.first_name || ''} ${selectedPartner.last_name || ''}`.trim() || 'Usuario';
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

      selectedContainer.classList.remove('hidden');
      selectedContainer.innerHTML = `
        <div class="selected-partner-info">
          <div class="search-result-avatar">
            ${selectedPartner.photo_url ? `<img src="${selectedPartner.photo_url}" alt="${name}">` : initials}
          </div>
          <div>
            <div class="search-result-name">${name}</div>
            <div class="search-result-email">${selectedPartner.email || ''}</div>
          </div>
        </div>
        <span class="remove-partner">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </span>
      `;
    }

    updateUI();
  }

  /**
   * Remove selected partner
   */
  function removePartner() {
    selectedPartner = null;

    const searchContainer = document.getElementById('partner-search-container');
    const selectedContainer = document.getElementById('selected-partner');
    const searchInput = document.getElementById('partner-search');
    const searchResults = document.getElementById('search-results');

    if (searchContainer) searchContainer.classList.remove('hidden');
    if (selectedContainer) selectedContainer.classList.add('hidden');
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.innerHTML = '';

    updateUI();
  }

  /**
   * Set payment method
   */
  function setPaymentMethod(method) {
    paymentMethod = method;

    document.querySelectorAll('.payment-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.method === method);
    });

    // Show/hide relevant sections
    const cardSection = document.getElementById('card-payment-section');
    const codeSection = document.getElementById('code-payment-section');

    if (cardSection) cardSection.classList.toggle('hidden', method !== 'card');
    if (codeSection) codeSection.classList.toggle('hidden', method !== 'code');

    updateUI();
  }

  /**
   * Set paid for option
   */
  function setPaidFor(value) {
    paidFor = value;

    // Discount not available when paying for both
    const discountSection = document.getElementById('discount-section');
    if (discountSection) {
      discountSection.classList.toggle('hidden', paidFor === '2');
    }

    // Clear discount if switching to pay for both
    if (paidFor === '2') {
      removeDiscount();
    }

    updatePriceSummary();
  }

  /**
   * Apply discount code
   */
  async function applyDiscountCode() {
    const codeInput = document.getElementById('discount-code');
    const code = codeInput?.value.trim();

    if (!code) {
      APJToast.error('Error', 'Ingresa un codigo de descuento');
      return;
    }

    if (!selectedCategory) {
      APJToast.error('Error', 'Primero selecciona una categoria');
      return;
    }

    const applyBtn = document.getElementById('apply-discount');
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.innerHTML = '<span class="spinner"></span>';
    }

    try {
      const amount = selectedCategory.price || 999;
      discountData = await APJApi.validateDiscountCode(code, amount);

      if (discountData.valid) {
        discountCode = code;
        showDiscountApplied();
        APJToast.success('Codigo aplicado', `Descuento de ${APJTournaments.formatPrice(discountData.discount_applied)} aplicado`);
      } else {
        APJToast.error('Codigo invalido', 'El codigo ingresado no es valido');
      }
    } catch (error) {
      APJToast.error('Error', error.message || 'No se pudo validar el codigo');
    } finally {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Aplicar';
      }
    }

    updatePriceSummary();
  }

  /**
   * Show discount applied UI
   */
  function showDiscountApplied() {
    const discountRow = document.getElementById('discount-input-row');
    const appliedRow = document.getElementById('discount-applied');

    if (discountRow) discountRow.classList.add('hidden');
    if (appliedRow) {
      appliedRow.classList.remove('hidden');

      const discountText = discountData.discount_type === 'percentage'
        ? `${discountData.discount_value}% de descuento`
        : APJTournaments.formatPrice(discountData.discount_applied) + ' de descuento';

      appliedRow.innerHTML = `
        <span class="discount-applied-text">${discountCode}: ${discountText}</span>
        <span class="discount-remove">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </span>
      `;
    }
  }

  /**
   * Remove discount
   */
  function removeDiscount() {
    discountCode = null;
    discountData = null;

    const codeInput = document.getElementById('discount-code');
    const discountRow = document.getElementById('discount-input-row');
    const appliedRow = document.getElementById('discount-applied');

    if (codeInput) codeInput.value = '';
    if (discountRow) discountRow.classList.remove('hidden');
    if (appliedRow) appliedRow.classList.add('hidden');

    updatePriceSummary();
  }

  /**
   * Update price summary
   */
  function updatePriceSummary() {
    if (!selectedCategory) return;

    const basePrice = selectedCategory.price || 999;
    const quantity = paidFor === '2' ? 2 : 1;
    let subtotal = basePrice * quantity;
    let discount = 0;
    let total = subtotal;

    if (discountData && paidFor === '1') {
      discount = discountData.discount_applied || 0;
      total = discountData.final_amount || (subtotal - discount);
    }

    // Update price summary UI
    const subtotalEl = document.getElementById('price-subtotal');
    const discountEl = document.getElementById('price-discount');
    const totalEl = document.getElementById('price-total');

    if (subtotalEl) {
      subtotalEl.textContent = `${APJTournaments.formatPrice(basePrice)} x ${quantity}`;
    }

    if (discountEl) {
      if (discount > 0) {
        discountEl.parentElement.classList.remove('hidden');
        discountEl.textContent = `-${APJTournaments.formatPrice(discount)}`;
      } else {
        discountEl.parentElement.classList.add('hidden');
      }
    }

    if (totalEl) {
      totalEl.textContent = APJTournaments.formatPrice(total);
    }

    // Update submit button text
    const submitBtn = document.getElementById('submit-payment');
    if (submitBtn) {
      if (total === 0) {
        submitBtn.textContent = 'Completar Inscripcion Gratis';
        submitBtn.classList.remove('btn-stripe');
        submitBtn.classList.add('btn-primary');
      } else {
        submitBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> Pagar ${APJTournaments.formatPrice(total)}`;
        submitBtn.classList.add('btn-stripe');
        submitBtn.classList.remove('btn-primary');
      }
    }
  }

  /**
   * Next step
   */
  function nextStep() {
    console.log('[APJ] nextStep called, currentStep before:', currentStep, 'justAutoAdvanced:', justAutoAdvanced);

    // Prevent double-advance when auto-advancing from category selection
    if (justAutoAdvanced) {
      console.log('[APJ] Skipping nextStep - just auto-advanced');
      return;
    }

    if (!validateCurrentStep()) return;

    currentStep++;
    console.log('[APJ] nextStep advancing to:', currentStep);
    updateUI();

    // Initialize Stripe on step 3 (but don't create payment intent yet)
    if (currentStep === 3 && paymentMethod === 'card') {
      console.log('[APJ] Entering step 3 - initializing Stripe');
      APJPayment.initStripe();
    }
  }

  /**
   * Previous step
   */
  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      updateUI();
    }
  }

  /**
   * Validate current step
   */
  function validateCurrentStep() {
    switch (currentStep) {
      case 1:
        if (!selectedCategory) {
          APJToast.error('Selecciona una categoria', 'Debes elegir una categoria para continuar');
          return false;
        }
        return true;

      case 2:
        if (!selectedPartner) {
          APJToast.error('Selecciona una pareja', 'Debes elegir una pareja para continuar');
          return false;
        }
        return true;

      default:
        return true;
    }
  }

  /**
   * Submit registration with code
   */
  async function submitRegistrationCode() {
    const codeInput = document.getElementById('registration-code');
    const code = codeInput?.value.trim();

    if (!code) {
      APJToast.error('Error', 'Ingresa tu codigo de registro');
      return;
    }

    const submitBtn = document.getElementById('submit-code');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Validando...';
    }

    try {
      const tournament = APJTournaments.getActiveTournament();
      const userData = APJApi.getUserData();

      await APJApi.redeemCode(code, {
        tournamentId: tournament.id || tournament.tournament_id,
        categoryId: selectedCategory.id || selectedCategory.category_id,
        playerUid: userData.uid || userData.id,
        partnerUid: selectedPartner.uid || selectedPartner.id
      });

      showSuccess();
    } catch (error) {
      // Handle specific API errors based on status code
      const status = error.status || 0;
      let errorTitle = 'Error';

      if (status === 423) {
        errorTitle = 'Pareja no disponible';
      } else if (status === 409) {
        errorTitle = 'Ya inscrito';
      } else if (status === 400) {
        errorTitle = 'Código inválido';
      }

      APJToast.error(errorTitle, error.message || 'No se pudo procesar el código');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Registrar con Codigo';
      }
    }
  }

  /**
   * Submit payment
   */
  async function submitPayment() {
    const tournament = APJTournaments.getActiveTournament();
    const userData = APJApi.getUserData();
    // Price is in full value (799 = 799 MXN), not cents
    const basePrice = selectedCategory.price || 999;
    const paidForInt = parseInt(paidFor) || 1; // Backend expects integer: 1 or 2
    const quantity = paidForInt === 2 ? 2 : 1;
    let amount = basePrice * quantity;

    if (discountData && paidForInt === 1) {
      amount = discountData.final_amount;
    }

    // Build payment request matching Android's PaymentRequestDto structure
    const paymentData = {
      amount: amount,                                    // Full value, not cents
      currency: 'mxn',
      restriction: '',                                   // Required by backend
      playerName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      playerUid: String(userData.uid || userData.id),
      partnerUid: String(selectedPartner.uid || selectedPartner.id),
      tournamentId: String(tournament.id || tournament.tournament_id),
      categoryId: selectedCategory.category_id,          // Integer category ID
      email: String(userData.email),
      paidFor: paidForInt                                // Integer: 1 or 2
    };

    if (discountCode && paidForInt === 1) {
      paymentData.discount_code = discountCode;
    }

    console.log('[APJ] Payment data:', paymentData);

    // If free registration
    if (amount === 0) {
      await completeFreeRegistration(paymentData);
      return;
    }

    // Otherwise use Stripe
    await APJPayment.processPayment(paymentData);
  }

  /**
   * Complete free registration (100% discount)
   */
  async function completeFreeRegistration(paymentData) {
    const submitBtn = document.getElementById('submit-payment');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';
    }

    try {
      const response = await APJApi.createPaymentIntent(paymentData);

      if (response.free_registration) {
        showSuccess();
      } else {
        APJToast.error('Error', 'Ocurrio un error al procesar tu inscripcion');
      }
    } catch (error) {
      APJToast.error('Error', error.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Completar Inscripcion Gratis';
      }
    }
  }

  /**
   * Show success state
   */
  function showSuccess() {
    currentStep = 4; // Success step
    updateUI();

    const contentEl = document.getElementById('step-content');
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="success-state">
          <div class="success-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2>Inscripcion Exitosa</h2>
          <p>Tu inscripcion al torneo ha sido completada. Recibiras un correo de confirmacion con los detalles.</p>
          <a href="/" class="btn btn-primary" style="margin-top: 24px;">Volver al Inicio</a>
        </div>
      `;
    }

    // Hide steps
    const stepsEl = document.querySelector('.steps');
    if (stepsEl) stepsEl.classList.add('hidden');
  }

  /**
   * Update UI based on current step
   */
  function updateUI() {
    // Update step indicators
    document.querySelectorAll('.step').forEach((step, idx) => {
      const stepNum = idx + 1;
      step.classList.toggle('active', stepNum === currentStep);
      step.classList.toggle('completed', stepNum < currentStep);
    });

    // Show/hide step content
    document.querySelectorAll('.step-content').forEach(content => {
      const stepNum = parseInt(content.dataset.step);
      content.classList.toggle('active', stepNum === currentStep);
    });

    // Update navigation buttons for current step
    const currentStepNav = document.querySelector(`.step-navigation[data-step="${currentStep}"]`);
    if (currentStepNav) {
      const prevBtn = currentStepNav.querySelector('.btn-prev');
      const nextBtn = currentStepNav.querySelector('.btn-next');

      if (prevBtn) {
        prevBtn.classList.toggle('hidden', currentStep === 1);
      }

      if (nextBtn) {
        nextBtn.classList.toggle('hidden', currentStep >= 3);
        nextBtn.disabled = (currentStep === 1 && !selectedCategory) ||
                           (currentStep === 2 && !selectedPartner);
      }
    }

    // Update price summary when on step 3
    if (currentStep === 3) {
      updatePriceSummary();
    }
  }

  /**
   * Get current state (for payment module)
   */
  function getState() {
    return {
      selectedCategory,
      selectedPartner,
      paymentMethod,
      paidFor,
      discountCode,
      discountData
    };
  }

  // Public API
  return {
    init,
    getState,
    showSuccess,
    updatePriceSummary
  };
})();
