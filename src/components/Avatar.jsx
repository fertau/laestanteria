const COLORS = ['#C17B3F', '#8B5E3C', '#6B8E23', '#4682B4', '#9370DB', '#CD5C5C', '#20B2AA'];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ src, name, size = 32, style = {} }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          ...style,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colorForName(name),
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 700,
        flexShrink: 0,
        ...style,
      }}
    >
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}
