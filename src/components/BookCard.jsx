import Avatar from './Avatar';

const langLabels = { es: 'ES', en: 'EN', pt: 'PT', fr: 'FR', de: 'DE', it: 'IT' };

export default function BookCard({
  book,
  onClick,
  style = {},
  animationDelay = 0,
  selectionMode = false,
  isSelected = false,
  isSelectable = false,
  onToggleSelect,
}) {
  const rating =
    book.ratingCount > 0 ? (book.ratingSum / book.ratingCount).toFixed(1) : null;

  const handleClick = () => {
    if (selectionMode) {
      if (isSelectable) onToggleSelect?.(book.id);
      return;
    }
    onClick?.(book);
  };

  return (
    <div
      className={`book-card${selectionMode && !isSelectable ? ' book-card--disabled' : ''}`}
      onClick={handleClick}
      style={{
        animation: `fadeInUp 0.3s ease ${animationDelay}ms both`,
        border: selectionMode && isSelected
          ? '2px solid var(--accent)'
          : '2px solid transparent',
        opacity: selectionMode && !isSelectable ? 0.4 : 1,
        pointerEvents: selectionMode && !isSelectable ? 'none' : 'auto',
        ...style,
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

        {/* Language badge — top-left */}
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

        {/* Selection checkbox — top-right */}
        {selectionMode && isSelectable && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(book.id);
            }}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              borderRadius: 4,
              background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
              border: isSelected
                ? '2px solid var(--accent)'
                : '2px solid rgba(232,220,200,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              zIndex: 2,
              cursor: 'pointer',
            }}
          >
            {isSelected && (
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
                ✓
              </span>
            )}
          </div>
        )}

        {/* Uploader avatar — bottom-right */}
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

    </div>
  );
}
