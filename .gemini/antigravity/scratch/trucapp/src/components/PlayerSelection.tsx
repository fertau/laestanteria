import { useState, useMemo } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useAuthStore } from '../store/useAuthStore';
import type { Player } from '../types';

interface PlayerSelectionProps {
    onSelect: (players: Player[]) => void;
    requiredCount: number; // 2 or 4 or 6
}

export const PlayerSelection = ({ onSelect, requiredCount }: PlayerSelectionProps) => {
    const { players, addPlayer } = useUserStore();
    const currentUserId = useAuthStore(state => state.currentUserId);
    const currentUser = players.find(p => p.id === currentUserId);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [message, setMessage] = useState('');

    const filteredPlayers = useMemo(() => {
        // Show:
        // 1. Current user
        // 2. Friends of current user
        // 3. Players with PUBLIC visibility
        return players.filter(p => {
            if (p.id === currentUserId) return true;
            if (currentUser?.friends.includes(p.id)) return true;
            return p.visibility === 'PUBLIC';
        }).sort((a, b) => {
            // Priority: Current user > Friends > Others
            if (a.id === currentUserId) return -1;
            if (b.id === currentUserId) return 1;
            const aIsFriend = currentUser?.friends.includes(a.id);
            const bIsFriend = currentUser?.friends.includes(b.id);
            if (aIsFriend && !bIsFriend) return -1;
            if (!aIsFriend && bIsFriend) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [players, currentUserId, currentUser]);

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(p => p !== id));
        } else {
            if (selectedIds.length < requiredCount) {
                setSelectedIds(prev => [...prev, id]);
            }
        }
    };

    const handleCreate = async () => {
        if (!newPlayerName.trim()) return;
        const player = await addPlayer(newPlayerName.trim(), '0000');
        setNewPlayerName('');
        toggleSelect(player.id);
        setMessage(`Usuario creado. PIN provisorio: 0000`);
        setTimeout(() => setMessage(''), 5000);
    };

    const isReady = selectedIds.length === requiredCount;

    return (
        <div className="flex flex-col h-full p-4 bg-[var(--color-bg)]">
            <h2 className="text-xl font-black uppercase italic tracking-tighter mb-4 text-[var(--color-text-primary)]">
                Seleccionar Jugadores <span className="text-[var(--color-accent)] font-mono not-italic ml-2">({selectedIds.length}/{requiredCount})</span>
            </h2>

            {/* New Player Input */}
            <div className="flex flex-col gap-2 mb-6">
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Nuevo jugador..."
                        className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl px-5 py-4 text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-all font-medium"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={!newPlayerName.trim()}
                        className="bg-[var(--color-accent)] text-[var(--color-text-primary)] w-14 rounded-2xl font-black text-2xl disabled:opacity-20 active:scale-95 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                    >
                        +
                    </button>
                </div>
                {message && <div className="text-[var(--color-accent)] text-[10px] font-black uppercase tracking-widest bg-[var(--color-accent)]/10 p-2 rounded-xl border border-[var(--color-accent)]/20 text-center animate-pulse">{message}</div>}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 custom-scrollbar">
                {filteredPlayers.length === 0 && <p className="text-[var(--color-text-muted)] text-center mt-8 font-medium italic opacity-50">No hay jugadores disponibles.</p>}

                {filteredPlayers.map(player => {
                    const isFriend = currentUser?.friends.includes(player.id);
                    const isSelected = selectedIds.includes(player.id);
                    const isSelf = player.id === currentUserId;

                    return (
                        <div
                            key={player.id}
                            onClick={() => toggleSelect(player.id)}
                            className={`p-5 rounded-3xl border transition-all cursor-pointer flex justify-between items-center group
                    ${isSelected
                                    ? 'bg-[var(--color-surface-hover)] border-[var(--color-accent)] shadow-[0_0_15px_rgba(59,130,246,0.15)] translate-x-1'
                                    : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border)]'
                                }
                `}
                        >
                            <div className="flex flex-col leading-tight">
                                <div className="flex items-center gap-2">
                                    <span className={`font-black uppercase tracking-tight ${isSelected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                                        {player.nickname || player.name}
                                    </span>
                                    {isSelf && <span className="bg-[var(--color-surface-hover)] text-[8px] font-black px-1.5 py-0.5 rounded-full text-[var(--color-text-muted)] uppercase tracking-widest">Tú</span>}
                                    {isFriend && !isSelf && <span className="text-[var(--color-accent)] text-xs">★</span>}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-[var(--color-accent)]/60' : 'text-[var(--color-text-muted)]'}`}>
                                    {isSelf ? player.name : (isFriend ? 'Amigo' : 'Público')}
                                </span>
                            </div>
                            <div className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center
                                ${isSelected ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}
                            `}>
                                {isSelected && <div className="w-3 h-3 bg-[var(--color-accent)] rounded-full animate-in zoom-in duration-200"></div>}
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                className="mt-6 w-full bg-gradient-to-br from-[var(--color-accent)] to-[#1d4ed8] text-[var(--color-text-primary)] py-5 rounded-3xl font-black text-lg uppercase tracking-widest disabled:opacity-20 disabled:scale-100 active:scale-[0.98] transition-all shadow-xl disabled:grayscale"
                disabled={!isReady}
                onClick={() => {
                    const selectedPlayers = players.filter(p => selectedIds.includes(p.id));
                    onSelect(selectedPlayers);
                }}
            >
                Continuar
            </button>
        </div>
    );
};
