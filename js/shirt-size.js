// APJ Padel - Catalogo de tallas de playera
//
// Antes cada pantalla tenia su propia lista y no coincidian: el registro ofrecia los dos
// cortes y el perfil filtraba por genero, ademas de escribir el sufijo "-MUJER" mientras
// las apps escribian "-DAMA". Esas filas ya se normalizaron en la base; este modulo existe
// para que no vuelvan a divergir.
//
// El corte NO es el genero. Se propone segun el genero, pero cualquiera puede elegir
// cualquiera: el corte dama llega hasta L, asi que una mujer que necesita XL tiene que
// poder pasarse a hombre.

const APJShirtSize = (function() {
  'use strict';

  const CUTS = [
    { value: 'DAMA', label: 'Corte dama' },
    { value: 'HOMBRE', label: 'Corte hombre' },
  ];

  const SIZES = {
    HOMBRE: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
    DAMA: ['XS', 'S', 'M', 'L'],
  };

  function sizesFor(cut) {
    return SIZES[cut] || SIZES.HOMBRE;
  }

  /** Corte sugerido a partir del genero. Solo es el punto de partida. */
  function suggestedCut(gender) {
    return String(gender || '').trim().toLowerCase() === 'femenino' ? 'DAMA' : 'HOMBRE';
  }

  /**
   * Interpreta lo guardado en users.shirt_size. Tolera los tres formatos que existen en
   * produccion: "M-DAMA" (actual), "M-MUJER" (lo que escribia este sitio) y "M" a secas
   * (filas anteriores a que existiera el corte, que se asumen hombre).
   * Devuelve { cut, size } o null.
   */
  function parse(raw) {
    const v = String(raw || '').trim().toUpperCase();
    if (!v) return null;

    const sep = v.lastIndexOf('-');
    if (sep <= 0) {
      return SIZES.HOMBRE.includes(v) ? { cut: 'HOMBRE', size: v } : null;
    }

    const size = v.slice(0, sep);
    const suffix = v.slice(sep + 1);
    const cut = (suffix === 'DAMA' || suffix === 'MUJER') ? 'DAMA'
      : (suffix === 'HOMBRE' ? 'HOMBRE' : null);
    if (!cut) return null;

    return sizesFor(cut).includes(size) ? { cut: cut, size: size } : null;
  }

  function format(cut, size) {
    if (!cut || !size) return '';
    return size + '-' + cut;
  }

  function isValid(raw) {
    return parse(raw) !== null;
  }

  /**
   * Conecta un par de <select> (corte + talla) y mantiene sincronizado el valor completo.
   *
   * @param {object} opts
   *  - cutSelect, sizeSelect: los elementos <select>
   *  - getGender: () => string, para proponer el corte inicial
   *  - onChange: (value) => void, recibe "M-DAMA" o ""
   */
  function bind(opts) {
    const cutSelect = opts.cutSelect;
    const sizeSelect = opts.sizeSelect;
    if (!cutSelect || !sizeSelect) return null;

    let cutTouched = false;

    cutSelect.innerHTML = CUTS
      .map(c => '<option value="' + c.value + '">' + c.label + '</option>')
      .join('');

    function renderSizes(keepSize) {
      const cut = cutSelect.value;
      const sizes = sizesFor(cut);
      sizeSelect.innerHTML = '<option value="">Seleccionar</option>' +
        sizes.map(s => '<option value="' + s + '">' + s + '</option>').join('');
      // La medida se conserva si el otro corte tambien la tiene: cambiar de corte con la
      // M puesta debe dejarte en la M, no en blanco.
      if (keepSize && sizes.includes(keepSize)) sizeSelect.value = keepSize;
      notify();
    }

    function notify() {
      if (typeof opts.onChange === 'function') {
        opts.onChange(format(cutSelect.value, sizeSelect.value));
      }
    }

    cutSelect.addEventListener('change', function() {
      cutTouched = true;
      renderSizes(sizeSelect.value);
    });
    sizeSelect.addEventListener('change', notify);

    return {
      /** Carga un valor guardado ("M-DAMA"). */
      setValue: function(raw) {
        const parsed = parse(raw);
        if (parsed) {
          cutSelect.value = parsed.cut;
          cutTouched = true;
          renderSizes(parsed.size);
        } else {
          renderSizes(null);
        }
      },
      /** Reacciona a un cambio de genero mientras nadie haya tocado el corte a mano. */
      syncWithGender: function(gender) {
        if (cutTouched || sizeSelect.value) return;
        cutSelect.value = suggestedCut(gender);
        renderSizes(null);
      },
      getValue: function() {
        return format(cutSelect.value, sizeSelect.value);
      },
      reset: function() {
        cutTouched = false;
        cutSelect.value = suggestedCut(opts.getGender ? opts.getGender() : '');
        renderSizes(null);
      },
    };
  }

  return {
    CUTS: CUTS,
    sizesFor: sizesFor,
    suggestedCut: suggestedCut,
    parse: parse,
    format: format,
    isValid: isValid,
    bind: bind,
  };
})();

if (typeof window !== 'undefined') window.APJShirtSize = APJShirtSize;
