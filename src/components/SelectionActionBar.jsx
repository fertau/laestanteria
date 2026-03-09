/**
 * Floating action bar for bulk book operations.
 * Appears at the bottom of the viewport when books are selected.
 * Glass effect + slide-up animation.
 */
export default function SelectionActionBar({
  count,
  onDelete,
  onUpdateMetadata,
  confirmDelete,
  setConfirmDelete,
  deleting,
}) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: 'rgba(22, 18, 14, 0.95)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border)',
      padding: '12px 20px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      animation: 'slideUp 0.25s ease both',
    }}>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        {/* Left: count */}
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--accent)',
          whiteSpace: 'nowrap',
        }}>
          {count} {count === 1 ? 'libro' : 'libros'}
        </span>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            onClick={onUpdateMetadata}
            style={{ fontSize: 13 }}
          >
            Actualizar metadata
          </button>
          <button
            className={confirmDelete ? 'btn btn-danger' : 'btn btn-ghost'}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              onDelete();
            }}
            disabled={deleting}
            style={{
              fontSize: 13,
              color: confirmDelete ? '#fff' : 'var(--danger)',
            }}
          >
            {deleting
              ? 'Eliminando...'
              : confirmDelete
                ? 'Confirmar eliminacion'
                : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
