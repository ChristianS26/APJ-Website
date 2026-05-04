// APJ Padel - Admin Stripe Connect (embedded onboarding)
// Auth + admin gate is handled by APJAdminShell. This module owns the
// Stripe Connect state machine: loading -> no-account -> onboarding -> connected.

const APJAdminStripeConnect = (function () {

  let stripeConnectInstance = null;
  let onboardingComponent = null;
  let cachedStatus = null;

  /** Called by the page after APJAdminShell.mount() resolves successfully. */
  function start() {
    bindEvents();
    refreshState();
  }

  function bindEvents() {
    document.getElementById('connect-create-btn')?.addEventListener('click', handleCreateAccount);
    document.getElementById('connect-resume-btn')?.addEventListener('click', () => mountOnboarding());
    document.getElementById('connect-manage-btn')?.addEventListener('click', handleManageAccount);
    document.getElementById('connect-payments-refresh-btn')?.addEventListener('click', loadRecentPayments);
  }

  function setState(stateId) {
    document.getElementById('connect-loading')?.classList.add('hidden');
    ['state-no-account', 'state-onboarding', 'state-connected']
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

    if (!window.StripeConnect || typeof window.StripeConnect.init !== 'function') {
      showError('No se pudo cargar Stripe Connect.js. Revisa tu conexion e intenta de nuevo.');
      return;
    }
    const publishableKey = APJConfig.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      showError('Falta STRIPE_PUBLISHABLE_KEY en config.js');
      return;
    }

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
            colorPrimary: '#10b981',
            colorBackground: '#ffffff',
            colorText: '#0f172a',
            colorSecondaryText: '#475569',
            colorBorder: 'rgba(15,23,42,0.10)',
            buttonPrimaryColorBackground: '#10b981',
            buttonPrimaryColorText: '#ffffff',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '8px'
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
    try {
      const status = await APJApi.getConnectAccountStatus();
      cachedStatus = status;
      renderConnected(status);
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

    const finish = document.getElementById('connect-finish-card');
    if (finish) {
      const showFinish = !!status?.requiresAction && !status?.onboardingComplete;
      finish.classList.toggle('hidden', !showFinish);
    }

    // Kick off the payments feed once we know the account is connected.
    loadRecentPayments();
  }

  async function loadRecentPayments() {
    const container = document.getElementById('connect-payments-list');
    if (!container) return;
    const refreshBtn = document.getElementById('connect-payments-refresh-btn');
    if (refreshBtn) refreshBtn.disabled = true;

    container.innerHTML = '<div class="profile-loading-page" style="padding:32px 0;"><div class="spinner" style="width:24px; height:24px;"></div><p style="font-size:13px;">Cargando pagos...</p></div>';

    try {
      const rows = await APJApi.getConnectRecentPayments(50);
      if (!Array.isArray(rows) || rows.length === 0) {
        container.innerHTML = '<div style="padding:32px 24px; text-align:center; color:var(--text-secondary); font-size:14px;">Aún no hay pagos registrados.</div>';
        return;
      }
      container.innerHTML = renderPaymentsTable(rows);
    } catch (error) {
      container.innerHTML = `<div style="padding:24px; color:#ef4444; font-size:13px;">${escapeHtml(humanizeError(error))}</div>`;
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  function renderPaymentsTable(rows) {
    const head = `
      <thead>
        <tr>
          <th style="text-align:left;">Fecha</th>
          <th style="text-align:left;">Jugador</th>
          <th style="text-align:left;">Torneo</th>
          <th style="text-align:left;">Categoria</th>
          <th style="text-align:right;">Monto</th>
          <th style="text-align:left;">Status</th>
          <th style="text-align:left;">Metodo</th>
        </tr>
      </thead>`;
    const body = rows.map(r => {
      const playerName = [r.player?.first_name, r.player?.last_name].filter(Boolean).join(' ');
      const playerEmail = r.player?.email || '';
      return `
        <tr>
          <td>${escapeHtml(formatDate(r.paid_at))}</td>
          <td>
            <div>${escapeHtml(playerName || '—')}</div>
            <div class="connect-payments-subtle">${escapeHtml(playerEmail)}</div>
          </td>
          <td>${escapeHtml(r.tournament?.name || '—')}</td>
          <td>${escapeHtml(r.category?.name || '—')}</td>
          <td style="text-align:right; white-space:nowrap; font-variant-numeric: tabular-nums;">${escapeHtml(formatAmount(r.amount))}</td>
          <td>${statusPill(r.status)}</td>
          <td>${escapeHtml(r.method || '—')}</td>
        </tr>`;
    }).join('');
    return `<div class="connect-payments-table-wrap"><table class="connect-payments-table">${head}<tbody>${body}</tbody></table></div>`;
  }

  function statusPill(status) {
    const s = String(status || '').toLowerCase();
    let color = 'yellow';
    if (s === 'succeeded' || s === 'paid' || s === 'completed') color = 'green';
    else if (s === 'failed' || s === 'cancelled' || s === 'canceled') color = 'orange';
    return `<span class="connect-badge ${color}" style="font-size:11px;">${escapeHtml(status || '—')}</span>`;
  }

  function formatAmount(amountCents) {
    if (amountCents == null) return '—';
    const value = Number(amountCents) / 100;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(value);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function badge(label, color) {
    const safe = String(label).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
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

  return { start };
})();
