import { useEffect } from 'react';
import { useFollows } from '../hooks/useFollows';
import { useRecommendations } from '../hooks/useRecommendations';
import Avatar from '../components/Avatar';

export default function Notifications() {
  const { pendingIn } = useFollows();
  const { received, markAsRead, unreadCount } = useRecommendations();

  // Mark recommendations as read when viewing this page
  useEffect(() => {
    received
      .filter((r) => !r.readAt)
      .forEach((r) => markAsRead(r.id));
  }, [received, markAsRead]);

  const hasNotifications = pendingIn.length > 0 || received.length > 0;

  return (
    <div className="page">
      <h1 className="page-title">Notificaciones</h1>

      {!hasNotifications && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          No hay notificaciones.
        </p>
      )}

      {/* Follow requests */}
      {pendingIn.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 className="section-title">Solicitudes de seguimiento</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingIn.map((f) => (
              <div key={f.id} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar src={null} name={f.followerUid} size={28} />
                  <span style={{ fontSize: 13 }}>
                    Alguien quiere seguirte
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Pendiente</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Acepta o rechaza solicitudes en la seccion Personas.
          </p>
        </section>
      )}

      {/* Recommendations */}
      {received.length > 0 && (
        <section>
          <h3 className="section-title">Recomendaciones recibidas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {received.map((r) => (
              <div key={r.id} style={{
                ...rowStyle,
                opacity: r.readAt ? 0.7 : 1,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>{r.fromName}</strong> te recomendo{' '}
                    <strong>"{r.bookTitle}"</strong> de {r.bookAuthor}
                  </div>
                  {r.message && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      "{r.message}"
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {r.createdAt?.seconds ? formatTimeAgo(r.createdAt.seconds * 1000) : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  background: 'var(--surface)',
  borderRadius: 'var(--radius)',
  gap: 12,
};

function formatTimeAgo(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}sem`;
}
