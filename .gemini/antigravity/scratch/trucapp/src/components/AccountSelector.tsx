import { useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useAuthStore } from '../store/useAuthStore';
import { PinInput } from './PinInput';

interface AccountSelectorProps {
    onLoginSuccess: () => void;
}

type AuthMode = 'initial' | 'login' | 'create';
type CreateStep = 'name' | 'pin';

export const AccountSelector = ({ onLoginSuccess }: AccountSelectorProps) => {
    const { players, addPlayer } = useUserStore();
    const { rememberedIds, login, removeRememberedAccount } = useAuthStore();

    // Mode State
    const [mode, setMode] = useState<AuthMode>('initial');

    // Create State
    const [createStep, setCreateStep] = useState<CreateStep>('name');
    const [newName, setNewName] = useState('');
    const [newPin, setNewPin] = useState('');

    // Login State
    const [selectedUser, setSelectedUser] = useState<{ id: string, name: string } | null>(null);
    const [loginPin, setLoginPin] = useState('');
    const [search, setSearch] = useState('');

    // Shared
    const [error, setError] = useState('');
    const [shakeError, setShakeError] = useState(false);

    // Helpers
    const triggerError = (msg: string) => {
        setError(msg);
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
    };

    const handleLoginSubmit = (pinFromInput?: string) => {
        if (!selectedUser) return;

        const actualPin = typeof pinFromInput === 'string' ? pinFromInput : loginPin;

        console.log('Login attempt:', { selectedUser: selectedUser?.name, pinLength: actualPin.length });

        if (actualPin.length !== 4) {
            triggerError('El PIN debe tener 4 dígitos');
            return;
        }

        const success = login(selectedUser.id, actualPin);
        if (success) {
            onLoginSuccess();
        } else {
            // Find user to check if default PIN
            const user = players.find(p => p.id === selectedUser.id);
            if (user && (user.pinHash === '0000' || user.pinHash === 'hash_0000')) {
                triggerError('PIN incorrecto (Probá con 0000)');
            } else {
                triggerError('PIN incorrecto');
            }
            setLoginPin(''); // Clear PIN on error
        }
    };

    const handleCreateNameSubmit = () => {
        if (!newName.trim()) {
            triggerError('Ingresá un nombre');
            return;
        }

        // Check if exists
        const existing = players.find(p => p.name.toLowerCase() === newName.trim().toLowerCase());
        if (existing) {
            // Auto-switch to login
            setSelectedUser({ id: existing.id, name: existing.name });
            setMode('login');
            setError('¡Te encontramos! Tu usuario ya existe. Ingresá tu PIN.');
            return;
        }

        setCreateStep('pin');
        setError('');
    };

    const handleCreateComplete = async () => {
        if (newPin.length !== 4) return;
        try {
            // Store is prepared for pinHash, we pass the raw pin for now (or pre-hash)
            // useUserStore.addPlayer(name, pinHash)
            const newP = await addPlayer(newName.trim(), `hash_${newPin}`);
            login(newP.id, newPin);
            onLoginSuccess();
        } catch (e) {
            console.error(e);
            triggerError('Error al crear usuario');
        }
    };

    const resetState = () => {
        setMode('initial');
        setCreateStep('name');
        setNewName('');
        setNewPin('');
        setSelectedUser(null);
        setLoginPin('');
        setError('');
    };

    // --- RENDERERS ---

    if (mode === 'initial') {
        const rememberedUsers = players.filter(p => rememberedIds.includes(p.id));

        return (
            <div className="full-screen bg-[var(--color-bg)] flex flex-col p-6 items-center justify-center overflow-y-auto">
                <h1 className="text-4xl font-black tracking-tighter mb-2 text-center text-[var(--color-text-primary)] italic">TRUCAPP</h1>
                <p className="text-[var(--color-text-muted)] mb-12 uppercase tracking-widest text-xs font-bold">Seleccioná tu perfil</p>

                {rememberedUsers.length > 0 ? (
                    <div className="w-full max-w-sm grid grid-cols-2 gap-4 mb-12">
                        {rememberedUsers.map(user => (
                            <div key={user.id} className="relative group">
                                <button
                                    onClick={() => { setSelectedUser(user); setMode('login'); }}
                                    className="w-full aspect-square flex flex-col items-center justify-center gap-3 bg-[var(--color-surface)] rounded-[2.5rem] border border-[var(--color-border)] active:scale-95 transition-all shadow-xl hover:bg-[var(--color-surface)]"
                                >
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[#1d4ed8] flex items-center justify-center font-black text-[var(--color-text-primary)] text-2xl shadow-lg">
                                        {user.avatar || user.name.substring(0, 1).toUpperCase()}
                                    </div>
                                    <div className="font-black text-xs text-[var(--color-text-primary)] uppercase tracking-tight truncate w-full px-4 text-center">
                                        {user.nickname || user.name}
                                    </div>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeRememberedAccount(user.id); }}
                                    className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-[var(--color-bg)]/60 backdrop-blur-md border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-400/30 transition-all z-10 text-[10px]"
                                    title="Quitar de este dispositivo"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mb-12 p-8 text-center bg-[var(--color-surface)] rounded-[2.5rem] border border-dashed border-[var(--color-border)] w-full max-w-sm">
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest leading-relaxed">
                            No hay cuentas recordadas en este dispositivo
                        </p>
                    </div>
                )}

                <div className="flex flex-col gap-4 w-full max-w-sm">
                    <button
                        onClick={() => { setMode('create'); setCreateStep('name'); }}
                        className="bg-white text-black py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3"
                    >
                        <span>Crear Perfil</span>
                        <span className="text-[10px] opacity-40">→</span>
                    </button>

                    <button
                        onClick={() => { setSelectedUser(null); setMode('login'); }}
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] py-4 rounded-[1.5rem] text-[var(--color-text-muted)] font-bold text-[10px] uppercase tracking-widest hover:bg-[var(--color-surface-hover)] active:scale-95 transition-all text-center"
                    >
                        Ya tengo cuenta / Buscar
                    </button>
                </div>
            </div>
        );
    }

    if (mode === 'login') {
        // Step 1: Select User (if not selected)
        if (!selectedUser) {
            const allUsers = players; // Potentially unnecessary filter

            // Defensive coding: Filter nulls and ensure name exists
            const filtered = Array.isArray(allUsers)
                ? allUsers.filter(u => u && typeof u === 'object' && typeof u.name === 'string' && u.name.toLowerCase().includes(search.toLowerCase()))
                : [];

            return (
                <div className="full-screen bg-[var(--color-bg)] flex flex-col p-6">
                    <button onClick={resetState} className="self-start text-[var(--color-text-muted)] mb-6 font-bold">← Volver</button>
                    <h2 className="text-2xl font-black text-[var(--color-text-primary)] mb-6">¿Quién sos?</h2>

                    <input
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-xl text-[var(--color-text-primary)] mb-6 focus:border-[var(--color-accent)] focus:outline-none"
                        placeholder="Buscar tu nombre..."
                        value={search}
                        autoFocus
                        onChange={e => setSearch(e.target.value)}
                    />

                    <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                        {filtered.map(user => (
                            <button
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className="flex items-center gap-4 p-4 rounded-xl hover:bg-[var(--color-surface)] text-left border border-transparent hover:border-[var(--color-border)] transition-all"
                            >
                                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center font-bold text-[var(--color-text-secondary)]">
                                    {(user?.name || '?').substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-bold text-[var(--color-text-primary)]">{user?.name || 'Sin nombre'}</span>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <div className="text-center text-[var(--color-text-muted)] mt-10">
                                No encontramos a "{search}". <br />
                                <button onClick={() => { setMode('create'); setNewName(search); setCreateStep('name'); }} className="text-[var(--color-accent)] font-bold mt-2 underline">Crear cuenta nueva</button>
                            </div>
                        )}
                    </div>
                </div>
            )
        }

        // Step 2: PIN Entry
        return (
            <div className="full-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-8">
                <button onClick={() => setSelectedUser(null)} className="absolute top-8 left-8 text-[var(--color-text-muted)] font-bold">← Cambiar usuario</button>

                <div className="w-20 h-20 rounded-full bg-[var(--color-surface)] flex items-center justify-center font-black text-3xl text-[var(--color-text-primary)] mb-6 border-2 border-[var(--color-border)]">
                    {selectedUser.name.substring(0, 2).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black text-[var(--color-text-primary)] mb-2">{selectedUser.name}</h2>
                <p className="text-sm text-[var(--color-text-muted)] mb-8">Ingresá tu PIN para entrar</p>

                <div className={`${shakeError ? 'animate-shake' : ''}`}>
                    <PinInput
                        value={loginPin}
                        onChange={(val) => { setLoginPin(val); setError(''); }}
                        onComplete={(pin) => handleLoginSubmit(pin)}
                        autoFocus={true}
                    />
                </div>

                {error && <div className={`mt-6 font-bold ${error.includes('encontramos') ? 'text-[var(--color-accent)]' : 'text-red-500'}`}>{error}</div>}
                {!error && <div className="h-6 mt-6"></div>} {/* Spacer */}

                <button onClick={() => handleLoginSubmit()} className="mt-8 bg-[var(--color-accent)] text-[var(--color-text-primary)] font-bold py-3 px-8 rounded-xl disabled:opacity-50" disabled={loginPin.length !== 4}>
                    Ingresar
                </button>
            </div>
        )
    }

    if (mode === 'create') {
        return (
            <div className="full-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-8">
                <button onClick={resetState} className="absolute top-8 left-8 text-[var(--color-text-muted)] font-bold">← Cancelar</button>

                {createStep === 'name' ? (
                    <>
                        <h2 className="text-2xl font-black text-[var(--color-text-primary)] mb-2">Crear Cuenta</h2>
                        <p className="text-sm text-[var(--color-text-muted)] mb-8">¿Cómo querés llamarte?</p>
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 text-center text-xl text-[var(--color-text-primary)] rounded-xl w-full max-w-xs mb-6 focus:border-[var(--color-accent)] outline-none"
                            placeholder="Tu Nombre"
                            autoFocus
                        />
                        <button onClick={handleCreateNameSubmit} className="bg-[var(--color-accent)] text-[var(--color-text-primary)] font-bold py-3 px-8 rounded-xl">
                            Siguiente
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-2xl font-black text-[var(--color-text-primary)] mb-2">Creá tu PIN</h2>
                        <p className="text-sm text-[var(--color-text-muted)] mb-8">4 números para entrar</p>
                        <PinInput
                            value={newPin}
                            onChange={setNewPin}
                            autoFocus
                            onComplete={() => { /* Wait for button? Or auto? Let's wait for button to confirm visual */ }}
                        />
                        <button onClick={handleCreateComplete} disabled={newPin.length !== 4} className="mt-8 bg-[var(--color-accent)] text-[var(--color-text-primary)] font-bold py-3 px-8 rounded-xl disabled:opacity-50">
                            Crear y Entrar
                        </button>
                    </>
                )}

                {error && <div className="mt-6 text-red-500 font-bold animate-pulse">{error}</div>}
            </div>
        )
    }

    return null;
};
