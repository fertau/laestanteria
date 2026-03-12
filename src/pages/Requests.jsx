import { useState } from 'react';
import { useRequests } from '../hooks/useRequests';
import RequestModal from '../components/RequestModal';
import Avatar from '../components/Avatar';

export default function Requests() {
  const { incoming, outgoing, pendingIncoming } = useRequests();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [tab, setTab] = useState('incoming');

  const tabs = [
    { key: 'incoming', label: `Recibidos (${pendingIncoming.length})` },
    { key: 'outgoing', label: 'Enviados' },
  ];

  return (
    <div className="page">
      <h1 className="page-title">Pedidos de libros</h1>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        borderBottom: '1px solid var(--border)',
      }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="btn-ghost"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
              borderRadius: 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Incoming requests */}
      {tab === 'incoming' && (
        <>
          {incoming.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>
                Sin pedidos pendientes
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Cuando alguien te pida libros, aparecera aca.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incoming.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                direction="incoming"
                onClick={() => setSelectedRequest(r)}
              />
            ))}
          </div>
        </>
      )}

      {/* Outgoing requests */}
      {tab === 'outgoing' && (
        <>
          {outgoing.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>
                No pediste libros todavia
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Explora el catalogo y pedi libros que te interesen.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outgoing.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                direction="outgoing"
              />
            ))}
          </div>
        </>
      )}

      {selectedRequest && (
        <RequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}

function RequestRow({ request, direction, onClick }) {
  const bookCount = request.books?.length || 0;
  const sentCount = request.books?.filter((b) => b.status === 'sent').length || 0;
  const pendingCount = request.books?.filter((b) => b.status === 'pending').length || 0;

  const name = direction === 'incoming' ? request.fromName : request.toName;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        cursor: onClick ? 'pointer' : 'default',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar src={null} name={name} size={36} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {direction === 'incoming' ? `${name} te pidio` : `Pediste a ${name}`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {bookCount} {bookCount === 1 ? 'libro' : 'libros'}
            {sentCount > 0 && ` · ${sentCount} enviado${sentCount > 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, flexShrink: 0 }}>
        {request.status === 'pending' && (
          <span style={{
            color: 'var(--accent)',
            fontWeight: 600,
            padding: '3px 8px',
            background: 'rgba(200,160,60,0.15)',
            borderRadius: 4,
          }}>
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </span>
        )}
        {request.status === 'completed' && (
          <span style={{ color: 'var(--success)' }}>Completado</span>
        )}
        {request.status === 'partial' && (
          <span style={{ color: 'var(--accent)' }}>Parcial</span>
        )}
      </div>
    </div>
  );
}
