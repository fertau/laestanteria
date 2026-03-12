import { useState } from 'react';
import { useRequests } from '../hooks/useRequests';
import { useBonds } from '../hooks/useBonds';
import { useToast } from '../hooks/useToast';

/**
 * Modal for the book owner to review and approve/reject a book request.
 * Books are sent directly to the requester's Kindle.
 */
export default function RequestModal({ request, onClose }) {
  const { approveAndSend, rejectBooks } = useRequests();
  const { getKindleEmailFor } = useBonds();
  const { toast } = useToast();

  const [selected, setSelected] = useState(
    () => new Set(request.books.filter((b) => b.status === 'pending').map((b) => b.bookId))
  );
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({});

  const kindleEmail = getKindleEmailFor(request.fromUid);
  const pendingBooks = request.books.filter((b) => b.status === 'pending');

  const toggleBook = (bookId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const handleSend = async () => {
    if (!kindleEmail) {
      toast('No se encontro el email Kindle del solicitante', 'error');
      return;
    }
    if (selected.size === 0) return;

    setSending(true);
    try {
      await approveAndSend(request.id, [...selected], kindleEmail);
      toast(`${selected.size} libro(s) enviado(s) al Kindle de ${request.fromName}`, 'success');
      onClose();
    } catch (err) {
      toast('Error al enviar: ' + err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleReject = async () => {
    const toReject = pendingBooks
      .filter((b) => !selected.has(b.bookId))
      .map((b) => b.bookId);

    if (toReject.length === 0) {
      // Reject all pending
      try {
        await rejectBooks(request.id, pendingBooks.map((b) => b.bookId));
        toast('Pedido rechazado', 'info');
        onClose();
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      }
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        width: '100%',
        maxWidth: 520,
        maxHeight: '80vh',
        overflowY: 'auto',
        padding: 28,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
            Pedido de {request.fromName}
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 18 }}>X</button>
        </div>

        {kindleEmail && (
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 16,
            padding: '8px 12px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
          }}>
            Se enviara a: <strong style={{ color: 'var(--text)' }}>{kindleEmail}</strong>
          </div>
        )}

        {!kindleEmail && (
          <div style={{
            fontSize: 12,
            color: 'var(--danger)',
            marginBottom: 16,
            padding: '8px 12px',
            background: 'rgba(192,57,43,0.1)',
            borderRadius: 'var(--radius)',
          }}>
            No hay email Kindle configurado para este usuario. El vinculo puede estar incompleto.
          </div>
        )}

        {/* Book list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {request.books.map((b) => {
            const isPending = b.status === 'pending';
            const isSelected = selected.has(b.bookId);

            return (
              <div
                key={b.bookId}
                onClick={() => isPending && toggleBook(b.bookId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  cursor: isPending ? 'pointer' : 'default',
                  opacity: isPending ? 1 : 0.6,
                  border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                {isPending && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleBook(b.bookId)}
                    style={{ flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.author}</div>
                </div>
                <div style={{ fontSize: 12, flexShrink: 0 }}>
                  {b.status === 'sent' && <span style={{ color: 'var(--success)' }}>Enviado</span>}
                  {b.status === 'rejected' && <span style={{ color: 'var(--danger)' }}>Rechazado</span>}
                  {b.status === 'failed' && <span style={{ color: 'var(--danger)' }}>Error</span>}
                  {b.status === 'pending' && <span style={{ color: 'var(--text-dim)' }}>Pendiente</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        {pendingBooks.length > 0 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={handleReject}
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
              disabled={sending}
            >
              Rechazar todo
            </button>
            <button
              onClick={handleSend}
              className="btn btn-primary"
              style={{ fontSize: 13 }}
              disabled={sending || selected.size === 0 || !kindleEmail}
            >
              {sending
                ? 'Enviando...'
                : `Enviar ${selected.size} al Kindle`}
            </button>
          </div>
        )}

        {pendingBooks.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 16,
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            Todos los libros de este pedido ya fueron procesados.
          </div>
        )}
      </div>
    </div>
  );
}
