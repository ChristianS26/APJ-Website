// APJ Padel - Regreso a la app después de Stripe Checkout
//
// El backend apunta success_url y cancel_url de Stripe a pago/success.html y
// pago/cancel.html (ver PaymentService.kt en APJ-Ktor). La app espera
// lagartospadel://payment/<success|cancel>: en iOS, ASWebAuthenticationSession
// cierra la hoja en cuanto ve ese esquema y la app lee el resultado de la ruta.
//
// Antes estas páginas vivían en Netlify; cuando ese sitio desapareció, el jugador
// pagaba, caía en un 404, cerraba la hoja y la app le decía que el pago no se
// completó aunque Stripe sí le había cobrado.

(function () {
  var result = document.body.getAttribute('data-payment-result') === 'success'
    ? 'success'
    : 'cancel';

  var tournamentId = new URLSearchParams(window.location.search).get('tournamentId');
  var deepLink = 'lagartospadel://payment/' + result +
    (tournamentId ? '?tournamentId=' + encodeURIComponent(tournamentId) : '');

  var button = document.getElementById('open-app');
  if (button) button.href = deepLink;

  window.location.replace(deepLink);

  // Si seguimos aquí, la app no tomó el control sola. En Android el navegador
  // puede exigir un toque para abrir un esquema propio.
  setTimeout(function () {
    var hint = document.getElementById('open-app-hint');
    if (hint) hint.classList.add('is-visible');
  }, 1500);
})();
