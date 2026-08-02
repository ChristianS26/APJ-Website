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

  // Siluetas de playera que se distinguen por FORMA —recta contra entallada— y no por
  // color: asi siguen legibles en escala de grises y con daltonismo, y heredan el color
  // del boton con currentColor en vez de traer uno propio.
  //
  // No son simbolos de genero a proposito. El bug que este selector arregla nacio de
  // confundir genero con corte, y ♂/♀ reintroduciria esa confusion: el corte dama llega
  // hasta L, asi que quien necesita XL tiene que poder cambiarse sin sentir que declara
  // algo sobre si misma. Mismo trazo que en Android e iOS.
  const SHIRT_PATHS = {
    HOMBRE: 'M9 2 L4.5 3.8 L2 8.5 L5.5 9.8 L5.5 22 L18.5 22 L18.5 9.8 L22 8.5 ' +
            'L19.5 3.8 L15 2 C15 3.9 13.7 5 12 5 C10.3 5 9 3.9 9 2 Z',
    DAMA: 'M9 2 L4.5 3.8 L2 8.5 L5.5 9.8 C5.5 9.8 7.2 12.4 7.2 15 C7.2 17.8 6 22 6 22 ' +
          'L18 22 C18 22 16.8 17.8 16.8 15 C16.8 12.4 18.5 9.8 18.5 9.8 L22 8.5 ' +
          'L19.5 3.8 L15 2 C15 3.9 13.7 5 12 5 C10.3 5 9 3.9 9 2 Z',
  };

  const CUTS = [
    { value: 'HOMBRE', label: 'Hombre' },
    { value: 'DAMA', label: 'Mujer' },
  ];

  function iconSvg(cut) {
    return '<svg class="shirt-cut-icon shirt-cut-icon--' + cut.toLowerCase() + '" ' +
      'viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="' + SHIRT_PATHS[cut] + '"/></svg>';
  }

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
    // cutContainer es un <div>, no un <select>: un <option> no puede llevar SVG, y el
    // corte se elige con una silueta de la prenda junto a la etiqueta.
    const cutContainer = opts.cutContainer;
    const sizeSelect = opts.sizeSelect;
    if (!cutContainer || !sizeSelect) return null;

    let cutTouched = false;
    let currentCut = 'HOMBRE';

    cutContainer.className = 'shirt-cut-group';
    cutContainer.setAttribute('role', 'radiogroup');
    cutContainer.innerHTML = CUTS.map(c =>
      '<button type="button" class="shirt-cut-option" data-cut="' + c.value + '" ' +
      'role="radio" aria-checked="false">' + iconSvg(c.value) +
      '<span>' + c.label + '</span></button>'
    ).join('');

    const buttons = Array.prototype.slice.call(
      cutContainer.querySelectorAll('.shirt-cut-option')
    );

    function paintCut() {
      buttons.forEach(b => {
        const active = b.dataset.cut === currentCut;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }

    buttons.forEach(b => {
      b.addEventListener('click', function() {
        currentCut = b.dataset.cut;
        cutTouched = true;
        paintCut();
        renderSizes(sizeSelect.value);
      });
    });

    function renderSizes(keepSize) {
      const cut = currentCut;
      const sizes = sizesFor(cut);
      sizeSelect.innerHTML = '<option value="">Seleccionar</option>' +
        sizes.map(s => '<option value="' + s + '">' + s + '</option>').join('');
      // La medida se conserva si el otro corte tambien la tiene: cambiar de corte con la
      // M puesta debe dejarte en la M, no en blanco. Si no la tiene —6XL no existe en
      // dama— se limpia explicitamente, en vez de confiar en que el navegador tire el
      // valor viejo al repintar las opciones.
      sizeSelect.value = (keepSize && sizes.includes(keepSize)) ? keepSize : '';
      notify();
    }

    function notify() {
      if (typeof opts.onChange === 'function') {
        opts.onChange(format(currentCut, sizeSelect.value));
      }
    }

    sizeSelect.addEventListener('change', notify);

    return {
      /** Carga un valor guardado ("M-DAMA"). */
      setValue: function(raw) {
        const parsed = parse(raw);
        if (parsed) {
          currentCut = parsed.cut;
          cutTouched = true;
          paintCut();
          renderSizes(parsed.size);
        } else {
          paintCut();
          renderSizes(null);
        }
      },
      /** Reacciona a un cambio de genero mientras nadie haya tocado el corte a mano. */
      syncWithGender: function(gender) {
        if (cutTouched || sizeSelect.value) return;
        currentCut = suggestedCut(gender);
        paintCut();
        renderSizes(null);
      },
      getValue: function() {
        return format(currentCut, sizeSelect.value);
      },
      getCut: function() {
        return currentCut;
      },
      reset: function() {
        cutTouched = false;
        currentCut = suggestedCut(opts.getGender ? opts.getGender() : '');
        paintCut();
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
