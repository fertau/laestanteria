import Avatar from './Avatar';

const langLabels = { es: 'ES', en: 'EN', pt: 'PT', fr: 'FR', de: 'DE', it: 'IT' };

export default function BookCard({ book, onClick, style = {}, animationDelay = 0 }) {
  const rating =
    book.ratingCount > 0 ? (book.ratingSum / book.ratingCount).toFixed(1) : null;

  return (
    <div
      onClick={() => onClick?.(book)}
      style={{
        cursor: 'pointer',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--surface)',
        transition: 'transform var(--transition), box-shadow var(--transition)',
        animation: `fadeInUp 0.3s ease ${animationDelay}ms both`,
        position: 'relative',
        ...style,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Cover */}
      <div style={{
        aspectRatio: '2/3',
        background: 'var(--bg)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : null}

        {/* Fallback title on cover */}
        {!book.coverUrl && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            textAlign: 'center',
            background: 'linear-gradient(135deg, #1a1510 0%, #0f0c08 100%)',
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.3,
              color: 'var(--text)',
              marginBottom: 4,
            }}>
              {book.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {book.author}
            </div>
          </div>
        )}

        {/* Language badge */}
        {book.language && (
          <span style={{
            position: 'absolute',
            top: 6,
            left: 6,
            background: 'rgba(0,0,0,0.7)',
            color: 'var(--text-muted)',
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: 3,
          }}>
            {langLabels[book.language] || book.language.toUpperCase()}
          </span>
        )}

        {/* Uploader avatar */}
        <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
          <Avatar
            src={null}
            name={book.uploadedBy?.displayName}
            size={22}
            style={{ border: '2px solid var(--bg)' }}
          />
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {book.title}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: 2,
        }}>
          {book.author}
        </div>

        {rating && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            fontSize: 11,
            color: 'var(--accent)',
          }}>
            <span>{'★'}</span>
            <span>{rating}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
              ({book.ratingCount})
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
