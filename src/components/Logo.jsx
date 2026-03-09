/**
 * Logo SVG — "La Cueva"
 * Silueta de entrada de cueva con libros geométricos en estantes internos.
 * Un libro destacado con brillo dorado más claro.
 */
export default function Logo({ size = 40, className = '' }) {
  const scale = size / 100;

  return (
    <svg
      width={100 * scale}
      height={100 * scale}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="La Cueva logo"
      role="img"
    >
      {/* === Arco de cueva (silueta exterior) === */}
      <path
        d="M15 88 C15 88 10 50 20 32 C30 14 42 8 50 8 C58 8 70 14 80 32 C90 50 85 88 85 88"
        stroke="#C17B3F"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />

      {/* Borde inferior de la cueva */}
      <line x1="12" y1="88" x2="88" y2="88" stroke="#C17B3F" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />

      {/* === Estante superior (dentro de la cueva) === */}
      <line x1="28" y1="48" x2="72" y2="48" stroke="#C17B3F" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

      {/* Libros estante superior */}
      <rect x="32" y="32" width="5" height="16" rx="1" fill="#C17B3F" opacity="0.7" />
      <rect x="39" y="35" width="7" height="13" rx="1" fill="#C17B3F" opacity="0.55" />
      {/* Libro destacado — brillo dorado */}
      <rect x="48" y="30" width="6" height="18" rx="1" fill="#D4904F" opacity="1" />
      <rect x="56" y="37" width="5" height="11" rx="1" fill="#C17B3F" opacity="0.6" />
      <rect x="63" y="34" width="4" height="14" rx="1" fill="#C17B3F" opacity="0.45" />

      {/* === Estante inferior (dentro de la cueva) === */}
      <line x1="24" y1="72" x2="76" y2="72" stroke="#C17B3F" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

      {/* Libros estante inferior */}
      <rect x="28" y="56" width="8" height="16" rx="1" fill="#C17B3F" opacity="0.6" />
      <rect x="38" y="59" width="5" height="13" rx="1" fill="#C17B3F" opacity="0.5" />
      <rect x="45" y="57" width="7" height="15" rx="1" fill="#C17B3F" opacity="0.65" />
      {/* Libro acostado */}
      <rect x="55" y="66" width="12" height="5" rx="1" fill="#C17B3F" opacity="0.4" />
      <rect x="69" y="58" width="5" height="14" rx="1" fill="#C17B3F" opacity="0.55" />

      {/* === Destellos sutiles en el arco === */}
      <circle cx="25" cy="45" r="1" fill="#C17B3F" opacity="0.3" />
      <circle cx="75" cy="45" r="1" fill="#C17B3F" opacity="0.3" />
      <circle cx="50" cy="12" r="1.5" fill="#D4904F" opacity="0.4" />
    </svg>
  );
}
