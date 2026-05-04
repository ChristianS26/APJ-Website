// APJ Padel - Admin Stripe Connect (embedded onboarding)

const APJAdminStripeConnect = (function () {

  let stripeConnectInstance = null;
  let onboardingComponent = null;
  let cachedStatus = null;

  function init() {
    if (!window.location.pathname.includes('/admin/stripe-connect')) return;
    initPage();
  }

  async function initPage() {
    // Auth gate — show login screen rather than auto-redirect, so the user
    // sees the page they navigated to and can sign in inline.
    if (!APJApi.isAuthenticated()) {
      hideAll();
      document.getElementById('connect-need-login')?.classList.remove('hidden');
      // Re-run after successful login
      window.addEventListener('apj:auth:login', () => initPage(), { once: true });
      return;
    }

    const isValid = await APJApi.validateToken();
    if (!isValid) {
      hideAll();
      document.getElementById('connect-need-login')?.classList.remove('hidden');
      APJToast?.info?.('Sesion expirada', 'Por favor inicia sesion nuevamente.');
      window.addEventListener('apj:auth:login', () => initPage(), { once: true });
      return;
    }

    // Refresh user (role might have changed) — fall back to cache on error
    try { await APJApi.getProfile(); } catch (_) { /* ignore */ }

    const user = APJApi.getUserData();
    const isAdmin = (user?.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
      hideAll();
      document.getElementById('connect-forbidden')?.classList.remove('hidden');
      return;
    }

    // Admin: show content shell, then drive the state machine
    hideAll();
    document.getElementById('connect-content')?.classList.remove('hidden');
    bindEvents();

    await refreshState();
  }

  function bindEvents() {
    document.getElementById('connect-create-btn')?.addEventListener('click', handleCreateAccount);
    document.getElementById('connect-resume-btn')?.addEventListener('click', () => mountOnboarding());
    document.getElementById('connect-manage-btn')?.addEventListener('click', handleManageAccount);
  }

  function hideAll() {
    ['connect-loading','connect-forbidden','connect-need-login','connect-content']
      .forEach(id => document.getElementById(id)?.classList.add('hidden'));
  }

  function setState(stateId) {
    ['state-no-account','state-onboarding','state-connected']
      .forEach(id => document.getElementById(id)?.classList.toggle('hidden', id !== stateId));
  }

  function showError(msg) {
    const el = document.getElementById('connect-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function clearError() {
    const el = document.getElementById('connect-error');
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
  }

  /** Decide which state to render based on the server-side status. */
  async function refreshState() {
    clearError();
    try {
      const status = await APJApi.getConnectAccountStatus();
      cachedStatus = status;
      if (status?.onboardingComplete) {
        renderConnected(status);
      } else {
        await mountOnboarding();
      }
    } catch (error) {
      if (error?.status === 404) {
        // No account yet — let the admin create one
        cachedStatus = null;
        setState('state-no-account');
      } else {
        showError(humanizeError(error));
        setState('state-no-account');
      }
    }
  }

  async function handleCreateAccount() {
    clearError();
    const btn = document.getElementById('connect-create-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Conectando...';
    }
    try {
      await APJApi.createConnectAccount();
      await mountOnboarding();
    } catch (error) {
      showError(humanizeError(error));
      APJToast?.error?.('Error', humanizeError(error));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Conectar con Stripe';
      }
    }
  }

  async function mountOnboarding() {
    clearError();
    setState('state-onboarding');

    // Connect.js loaded yet?
    if (!window.StripeConnect || typeof window.StripeConnect.init !== 'function') {
      showError('No se pudo cargar Stripe Connect.js. Revisa tu conexion e intenta de nuevo.');
      return;
    }
    const publishableKey = APJConfig.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      showError('Falta STRIPE_PUBLISHABLE_KEY en config.js');
      return;
    }

    // Tear down any previous instance to avoid double-mounting
    const mount = document.getElementById('connect-onboarding-mount');
    if (mount) mount.innerHTML = '<div class="profile-loading-page" style="padding:60px 0;"><div class="spinner" style="width:32px;height:32px;"></div><p>Cargando onboarding...</p></div>';
    onboardingComponent = null;
    stripeConnectInstance = null;

    try {
      stripeConnectInstance = window.StripeConnect.init({
        publishableKey,
        fetchClientSecret: async () => {
          const { clientSecret } = await APJApi.createConnectAccountSession();
          return clientSecret;
        },
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#635BFF',
            fontFamily: 'Inter, system-ui, sans-serif'
          }
        },
        locale: 'es'
      });

      onboardingComponent = stripeConnectInstance.create('account-onboarding');
      onboardingComponent.setOnExit(handleOnboardingExit);

      if (mount) {
        mount.innerHTML = '';
        mount.appendChild(onboardingComponent);
      }
    } catch (error) {
      console.error('[APJ Connect] init/mount failed', error);
      showError(humanizeError(error) || 'No se pudo iniciar el onboarding embebido.');
    }
  }

  async function handleOnboardingExit() {
    APJToast?.success?.('Verificacion enviada', 'Stripe procesara la informacion en breve.');
    // Re-fetch status; if onboardingComplete, swap to connected; else stay
    try {
      const status = await APJApi.getConnectAccountStatus();
      cachedStatus = status;
      if (status?.onboardingComplete) {
        renderConnected(status);
      } else {
        // Still missing things — keep showing the embedded component for now
        renderConnected(status);
      }
    } catch (error) {
      showError(humanizeError(error));
    }
  }

  function renderConnected(status) {
    setState('state-connected');

    const idEl = document.getElementById('connect-account-id');
    if (idEl) idEl.textContent = status?.accountId ? `Cuenta: ${status.accountId}` : '';

    const badges = document.getElementById('connect-status-badges');
    if (badges) {
      const items = [];
      items.push(badge(status?.chargesEnabled ? 'Cobros activos' : 'Cobros pendientes', status?.chargesEnabled ? 'green' : 'yellow'));
      items.push(badge(status?.payoutsEnabled ? 'Payouts activos' : 'Payouts pendientes', status?.payoutsEnabled ? 'green' : 'yellow'));
      if (status?.requiresAction) items.push(badge('Accion requerida', 'orange'));
      badges.innerHTML = items.join('');
    }

    // Show "completar verificacion" only when there's pending action and onboarding is incomplete
    const finish = document.getElementById('connect-finish-card');
    if (finish) {
      const showFinish = !!status?.requiresAction && !status?.onboardingComplete;
      finish.classList.toggle('hidden', !showFinish);
    }
  }

  function badge(label, color) {
    const safe = String(label).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    return `<span class="connect-badge ${color}">${safe}</span>`;
  }

  async function handleManageAccount() {
    const btn = document.getElementById('connect-manage-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Abriendo...'; }
    try {
      const { url } = await APJApi.getStripeConnectDashboardLink();
      if (!url) throw new Error('Stripe no devolvio una URL');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      APJToast?.error?.('Error', humanizeError(error));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Administrar cuenta'; }
    }
  }

  function humanizeError(error) {
    if (!error) return 'Error desconocido';
    const status = error.status;
    if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    if (status === 403) return 'No tienes permisos para gestionar Stripe Connect.';
    if (status === 404) return 'Stripe Connect aun no esta configurado.';
    return error.message || 'Ocurrio un error inesperado.';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
