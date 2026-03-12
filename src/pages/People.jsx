import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useFollows } from '../hooks/useFollows';
import { useBonds } from '../hooks/useBonds';
import { useToast } from '../hooks/useToast';
import Avatar from '../components/Avatar';
import BondSetup, { BondAccept } from '../components/BondSetup';
import { Users, UserPlus, UserCheck, Clock, Link2 } from 'lucide-react';
import HelpTip from '../components/HelpTip';

export default function People() {
  const { user, profile } = useAuth();
  const {
    following,
    followers,
    pendingOut,
    pendingIn,
    getFollowStatus,
    requestFollow,
    unfollow,
    acceptFollow,
    rejectFollow,
    changeAccessLevel,
    removeFollower,
  } = useFollows();
  const { activeBonds, pendingBonds, getBondStatus, removeBond } = useBonds();
  const { toast } = useToast();

  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('bonds');
  const [bondTarget, setBondTarget] = useState(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const snap = await getDocs(collection(db, 'users'));
      setAllUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, [profile]);

  const otherUsers = allUsers.filter((u) => u.uid !== user?.uid);

  const filteredUsers = search.trim()
    ? otherUsers.filter(
        (u) =>
          u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
          u.email?.toLowerCase().includes(search.toLowerCase())
      )
    : otherUsers;

  const handleFollow = async (targetUser) => {
    try {
      await requestFollow(targetUser.uid, targetUser.privacyMode);
      if (targetUser.privacyMode === 'open') {
        toast('Ahora seguis a ' + targetUser.displayName, 'success');
      } else {
        toast('Solicitud enviada a ' + targetUser.displayName, 'info');
      }
    } catch {
      toast('Error al seguir', 'error');
    }
  };

  const handleUnfollow = async (targetUid) => {
    try {
      await unfollow(targetUid);
      toast('Dejaste de seguir', 'info');
    } catch {
      toast('Error', 'error');
    }
  };

  const handleAccept = async (followId, accessLevel) => {
    try {
      await acceptFollow(followId, accessLevel);
      toast('Solicitud aceptada', 'success');
    } catch {
      toast('Error', 'error');
    }
  };

  const handleReject = async (followId) => {
    try {
      await rejectFollow(followId);
      toast('Solicitud rechazada', 'info');
    } catch {
      toast('Error', 'error');
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  const tabs = [
    { key: 'bonds', label: `Vinculos (${activeBonds.length})`, icon: Link2 },
    { key: 'directory', label: 'Directorio', icon: Users },
    { key: 'following', label: `Siguiendo (${following.length})`, icon: UserPlus },
    { key: 'followers', label: `Seguidores (${followers.length})`, icon: UserCheck },
    { key: 'pending', label: pendingIn.length > 0 || pendingBonds.length > 0 ? `Pendientes (${pendingIn.length + pendingBonds.length})` : 'Pendientes', icon: Clock },
  ];

  return (
    <div className="page">
      <h1 className="page-title">Personas</h1>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
      }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                borderRadius: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Bonds tab */}
      {tab === 'bonds' && (
        <>
          <div className="info-card" style={{ marginBottom: 16 }}>
            Los vinculos te permiten compartir tu catalogo y enviar libros directamente al Kindle de tus amigos.
            <HelpTip text="Un vinculo requiere que ambos compartan su email @kindle.com y habiliten el remitente en Amazon. Asi se aseguran de poder enviarse libros mutuamente." />
          </div>

          {activeBonds.length === 0 && pendingBonds.length === 0 && (
            <EmptyState
              icon="🔗"
              title="Sin vinculos todavia"
              description="Busca en el Directorio y crea un vinculo con alguien para compartir libros."
              actionLabel="Ir al Directorio"
              onAction={() => setTab('directory')}
            />
          )}

          {activeBonds.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 className="section-title">Vinculos activos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeBonds.map((b) => {
                  const u = allUsers.find((u) => u.uid === b.peerUid);
                  return (
                    <div key={b.id} style={rowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar src={u?.avatar} name={b.peerName} size={36} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.peerName}</div>
                          <div style={{ fontSize: 12, color: 'var(--success)' }}>
                            Vinculo activo · Kindle: {b.peerKindleEmail}
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 12, color: 'var(--danger)' }}
                        onClick={() => removeBond(b.id)}
                      >
                        Desvincular
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pendingBonds.length > 0 && (
            <div>
              <h3 className="section-title">Vinculos pendientes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingBonds.map((b) => {
                  const u = allUsers.find((u) => u.uid === b.peerUid);
                  return (
                    <div key={b.id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <Avatar src={u?.avatar} name={b.peerName} size={36} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.peerName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {b.iAmInitiator
                              ? 'Esperando que acepte el vinculo'
                              : 'Te invito a vincularte — ingresa tu email Kindle'}
                          </div>
                        </div>
                      </div>
                      {!b.iAmInitiator && (
                        <BondAccept bond={b} />
                      )}
                      {b.iAmInitiator && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, alignSelf: 'flex-end' }}
                          onClick={() => removeBond(b.id)}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Directory tab */}
      {tab === 'directory' && (
        <>
          <div className="info-card" style={{ marginBottom: 16 }}>
            Estas son las personas registradas en La Estanteria. Seguilas para ver su actividad y, si crean un vinculo, pedir libros a su Kindle.
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            style={{ width: '100%', marginBottom: 16 }}
          />
          {filteredUsers.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No hay otros usuarios"
              description="Invita a tus amigos con un codigo de invitacion desde tu perfil."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredUsers.map((u) => (
                <UserRow
                  key={u.uid}
                  targetUser={u}
                  followStatus={getFollowStatus(u.uid)}
                  bondStatus={getBondStatus(u.uid).status}
                  onFollow={() => handleFollow(u)}
                  onUnfollow={() => handleUnfollow(u.uid)}
                  onBond={() => setBondTarget(u)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Following tab */}
      {tab === 'following' && (
        <>
          <div className="info-card" style={{ marginBottom: 16 }}>
            <strong style={{ color: 'var(--text)' }}>Niveles de acceso:</strong><br/>
            <span style={{ color: 'var(--accent)' }}>Actividad</span> — ves cuando agregan o leen libros<br/>
            <span style={{ color: 'var(--success)' }}>Biblioteca</span> — ademas podes pedirles libros a tu Kindle
          </div>
          {following.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No seguis a nadie todavia"
              description="Busca en el Directorio y empeza a seguir gente para ver sus libros."
              actionLabel="Ir al Directorio"
              onAction={() => setTab('directory')}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {following.map((f) => {
                const u = allUsers.find((u) => u.uid === f.followingUid);
                if (!u) return null;
                return (
                  <FollowingRow
                    key={f.id}
                    user={u}
                    follow={f}
                    onUnfollow={() => handleUnfollow(u.uid)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Followers tab */}
      {tab === 'followers' && (
        <>
          <div className="info-card" style={{ marginBottom: 16 }}>
            Podes elegir que nivel de acceso dar a cada seguidor. <strong style={{ color: 'var(--text)' }}>Actividad</strong> = solo ven tu actividad. <strong style={{ color: 'var(--text)' }}>Biblioteca</strong> = pueden pedirte libros a su Kindle.
          </div>
          {followers.length === 0 ? (
            <EmptyState
              icon="💬"
              title="Nadie te sigue todavia"
              description="Comparti tu perfil o invita amigos para que te sigan."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {followers.map((f) => {
                const u = allUsers.find((u) => u.uid === f.followerUid);
                if (!u) return null;
                return (
                  <FollowerRow
                    key={f.id}
                    user={u}
                    follow={f}
                    onChangeAccess={(level) => changeAccessLevel(f.id, level)}
                    onRemove={() => removeFollower(f.id)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Pending tab */}
      {tab === 'pending' && (
        <>
          <div className="info-card" style={{ marginBottom: 16 }}>
            Cuando alguien te pide seguirte (si tenes modo cerrado), las solicitudes aparecen aca. Elegí con que nivel de acceso aceptar.
          </div>

          {pendingIn.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 className="section-title">Solicitudes recibidas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingIn.map((f) => {
                  const u = allUsers.find((u) => u.uid === f.followerUid);
                  if (!u) return null;
                  return (
                    <PendingInRow
                      key={f.id}
                      user={u}
                      follow={f}
                      onAccept={(level) => handleAccept(f.id, level)}
                      onReject={() => handleReject(f.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {pendingOut.length > 0 && (
            <div>
              <h3 className="section-title">Solicitudes enviadas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingOut.map((f) => {
                  const u = allUsers.find((u) => u.uid === f.followingUid);
                  if (!u) return null;
                  return (
                    <div key={f.id} style={rowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar src={u.avatar} name={u.displayName} size={36} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Esperando respuesta</div>
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => handleUnfollow(u.uid)}
                      >
                        Cancelar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pendingIn.length === 0 && pendingOut.length === 0 && (
            <EmptyState
              icon="✓"
              title="Todo al dia"
              description="No hay solicitudes pendientes. Cuando alguien te pida seguirte, aparecera aca."
            />
          )}
        </>
      )}

      {bondTarget && (
        <BondSetup targetUser={bondTarget} onClose={() => setBondTarget(null)} />
      )}
    </div>
  );
}

// --- Shared components ---

function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '40px 20px',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>{title}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: actionLabel ? 16 : 0, lineHeight: 1.5 }}>
        {description}
      </div>
      {actionLabel && (
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={onAction}>
          {actionLabel}
        </button>
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

function AccessDot({ level }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: level === 'library' ? 'var(--success)' : 'var(--accent)',
      marginRight: 6,
    }} />
  );
}

function UserRow({ targetUser, followStatus, onFollow, onUnfollow, onBond, bondStatus }) {
  const { status } = followStatus;

  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar src={targetUser.avatar} name={targetUser.displayName} size={36} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{targetUser.displayName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{targetUser.email}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {bondStatus === 'none' && (
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={onBond}
          >
            Vincular
          </button>
        )}
        {bondStatus === 'pending' && (
          <span style={{ fontSize: 12, color: 'var(--accent)', padding: '5px 8px' }}>
            Vinculo pendiente
          </span>
        )}
        {bondStatus === 'active' && (
          <span style={{ fontSize: 12, color: 'var(--success)', padding: '5px 8px' }}>
            Vinculado
          </span>
        )}
        {status === 'none' && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '5px 14px' }}
            onClick={onFollow}
          >
            Seguir
          </button>
        )}
        {status === 'pending' && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '5px 12px' }}
            disabled
          >
            Pendiente
          </button>
        )}
        {status === 'accepted' && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={onUnfollow}
          >
            Siguiendo
          </button>
        )}
      </div>
    </div>
  );
}

function FollowingRow({ user, follow, onUnfollow }) {
  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar src={user.avatar} name={user.displayName} size={36} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.displayName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <AccessDot level={follow.accessLevel} />
            {follow.accessLevel === 'library' ? 'Biblioteca' : 'Actividad'}
          </div>
        </div>
      </div>
      <button
        className="btn btn-secondary"
        style={{ fontSize: 12, padding: '5px 12px' }}
        onClick={onUnfollow}
      >
        Dejar de seguir
      </button>
    </div>
  );
}

function FollowerRow({ user, follow, onChangeAccess, onRemove }) {
  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar src={user.avatar} name={user.displayName} size={36} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.displayName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <AccessDot level={follow.accessLevel} />
            {follow.accessLevel === 'library' ? 'Biblioteca' : 'Actividad'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={follow.accessLevel}
          onChange={(e) => onChangeAccess(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px' }}
        >
          <option value="activity">Actividad</option>
          <option value="library">Biblioteca</option>
        </select>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '4px 8px', color: 'var(--danger)' }}
          onClick={onRemove}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

function PendingInRow({ user, follow, onAccept, onReject }) {
  const isUpgrade = follow.accessLevel === 'library';

  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar src={user.avatar} name={user.displayName} size={36} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.displayName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {isUpgrade ? 'Solicita acceso a biblioteca' : 'Quiere seguirte'}
          </div>
          {!isUpgrade && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              Actividad = ve tu actividad · Biblioteca = puede pedirte libros
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!isUpgrade && (
          <>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 10px' }}
              onClick={() => onAccept('activity')}
            >
              Aceptar (actividad)
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 11, padding: '5px 10px' }}
              onClick={() => onAccept('library')}
            >
              Aceptar (biblioteca)
            </button>
          </>
        )}
        {isUpgrade && (
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '5px 10px' }}
            onClick={() => onAccept('library')}
          >
            Aceptar
          </button>
        )}
        <button
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '5px 10px' }}
          onClick={onReject}
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
