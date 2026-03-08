import { useMemo } from 'react';
import { useBooks } from '../hooks/useBooks';
import { useFollows } from '../hooks/useFollows';
import { useAllReadingStatuses } from '../hooks/useReadingStatus';

export default function Stats() {
  const { books, loading: booksLoading } = useBooks();
  const { following, followers } = useFollows();
  const { wantToRead, reading, finished, loading: statusLoading } = useAllReadingStatuses();

  // Genre distribution
  const genreData = useMemo(() => {
    const counts = {};
    books.forEach((b) => {
      const g = b.genre || 'Sin genero';
      counts[g] = (counts[g] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [books]);

  // Language distribution
  const langData = useMemo(() => {
    const labels = { es: 'Espanol', en: 'Ingles', pt: 'Portugues', fr: 'Frances', de: 'Aleman', it: 'Italiano' };
    const counts = {};
    books.forEach((b) => {
      const l = labels[b.language] || b.language || 'Otro';
      counts[l] = (counts[l] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [books]);

  // Top rated books
  const topRated = useMemo(() => {
    return [...books]
      .filter((b) => b.ratingCount > 0)
      .map((b) => ({ ...b, avg: (b.ratingSum / b.ratingCount).toFixed(1) }))
      .sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg))
      .slice(0, 5);
  }, [books]);

  // Top contributors (most uploads)
  const topContributors = useMemo(() => {
    const counts = {};
    books.forEach((b) => {
      const name = b.uploadedBy?.displayName || 'Desconocido';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [books]);

  const maxGenre = genreData.length > 0 ? genreData[0].count : 1;
  const maxLang = langData.length > 0 ? langData[0].count : 1;

  if (booksLoading || statusLoading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Estadisticas</h1>

      {/* Overview cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 12,
        marginBottom: 32,
      }}>
        <StatCard label="Libros totales" value={books.length} />
        <StatCard label="Quiero leer" value={wantToRead.length} />
        <StatCard label="Leyendo" value={reading.length} />
        <StatCard label="Leidos" value={finished.length} />
        <StatCard label="Siguiendo" value={following.length} />
        <StatCard label="Seguidores" value={followers.length} />
      </div>

      {/* Genre chart */}
      {genreData.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="section-title">Generos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {genreData.map((g) => (
              <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, minWidth: 120, color: 'var(--text-muted)' }}>{g.name}</span>
                <div style={{ flex: 1, height: 20, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(g.count / maxGenre) * 100}%`,
                    background: 'var(--accent)',
                    borderRadius: 4,
                    minWidth: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{g.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Language chart */}
      {langData.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="section-title">Idiomas</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {langData.map((l) => (
              <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, minWidth: 100, color: 'var(--text-muted)' }}>{l.name}</span>
                <div style={{ flex: 1, height: 20, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(l.count / maxLang) * 100}%`,
                    background: 'var(--info)',
                    borderRadius: 4,
                    minWidth: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{l.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top rated */}
      {topRated.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="section-title">Mejor valorados</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topRated.map((b, i) => (
              <div key={b.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', minWidth: 24 }}>
                  #{i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.author}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{'★'} {b.avg}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {b.ratingCount} {b.ratingCount === 1 ? 'voto' : 'votos'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top contributors */}
      {topContributors.length > 0 && (
        <section>
          <h2 className="section-title">Contribuciones</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topContributors.map((c, i) => (
              <div key={c.name} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', minWidth: 24 }}>
                    #{i + 1}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {c.count} {c.count === 1 ? 'libro' : 'libros'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      padding: '16px 20px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: 'var(--accent)',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
