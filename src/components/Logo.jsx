/**
 * Logo SVG — "La Estantería del Lector"
 * Estantería minimalista: 3 estantes + 4 libros silueteados.
 * Un libro inclinado con estrella dorada = recomendación de amigo.
 */
export default function Logo({ size = 40, className = '' }) {
  const scale = size / 80; // Base viewBox is 100x80

  return (
    <svg
      width={100 * scale}
      height={80 * scale}
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="La Estantería logo"
      role="img"
    >
      {/* === Estantes (3 líneas horizontales) === */}
      <rect x="8" y="30" width="84" height="2" rx="1" fill="#C17B3F" />
      <rect x="8" y="55" width="84" height="2" rx="1" fill="#C17B3F" />
      <rect x="8" y="76" width="84" height="2.5" rx="1.25" fill="#C17B3F" />

      {/* Patas laterales de la estantería */}
      <rect x="8" y="28" width="2" height="50.5" rx="1" fill="#C17B3F" />
      <rect x="90" y="28" width="2" height="50.5" rx="1" fill="#C17B3F" />

      {/* === Estante superior: libros === */}

      {/* Libro 1 — delgado, alto */}
      <rect x="18" y="10" width="6" height="20" rx="1" fill="#C17B3F" opacity="0.85" />

      {/* Libro 2 — mediano */}
      <rect x="27" y="13" width="8" height="17" rx="1" fill="#C17B3F" opacity="0.65" />

      {/* Libro 3 — EL RECOMENDADO: inclinado con estrella */}
      <g transform="rotate(-8 48 30)">
        <rect x="42" y="8" width="7" height="22" rx="1" fill="#C17B3F" opacity="0.9" />
      </g>

      {/* Estrella dorada sobre el libro inclinado */}
      <polygon
        points="44,3 45.5,6.5 49.3,6.8 46.5,9.2 47.4,13 44,10.8 40.6,13 41.5,9.2 38.7,6.8 42.5,6.5"
        fill="#C17B3F"
        opacity="1"
      />

      {/* Libro 4 — grueso, bajo */}
      <rect x="54" y="16" width="10" height="14" rx="1" fill="#C17B3F" opacity="0.7" />

      {/* Libro 5 — pequeño extra */}
      <rect x="67" y="18" width="5" height="12" rx="1" fill="#C17B3F" opacity="0.5" />

      {/* === Estante inferior: libros === */}

      {/* Libro A — grueso */}
      <rect x="18" y="37" width="10" height="18" rx="1" fill="#C17B3F" opacity="0.6" />

      {/* Libro B — delgado */}
      <rect x="31" y="40" width="5" height="15" rx="1" fill="#C17B3F" opacity="0.75" />

      {/* Libro C — mediano */}
      <rect x="39" y="38" width="8" height="17" rx="1" fill="#C17B3F" opacity="0.55" />

      {/* Libro D — apoyado/acostado */}
      <rect x="52" y="48" width="15" height="6" rx="1" fill="#C17B3F" opacity="0.45" />

      {/* Libro E — alto */}
      <rect x="70" y="35" width="7" height="20" rx="1" fill="#C17B3F" opacity="0.65" />

      {/* === Estante más bajo: pocos libros === */}

      {/* Libro F */}
      <rect x="20" y="62" width="9" height="14" rx="1" fill="#C17B3F" opacity="0.5" />

      {/* Libro G */}
      <rect x="33" y="64" width="6" height="12" rx="1" fill="#C17B3F" opacity="0.7" />

      {/* Libro H — acostado */}
      <rect x="55" y="70" width="14" height="5" rx="1" fill="#C17B3F" opacity="0.4" />
    </svg>
  );
}
