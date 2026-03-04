import { useState } from 'react';
import { usePicaPicaStore } from '../store/usePicaPicaStore';
import { useUserStore } from '../store/useUserStore';

interface PairingReorderProps {
    onConfirm: () => void;
}

export const PairingReorder = ({ onConfirm }: PairingReorderProps) => {
    const pairingOrder = usePicaPicaStore(state => state.pairingOrder);
    const playersNosotros = usePicaPicaStore(state => state.playersNosotros);
    const playersEllos = usePicaPicaStore(state => state.playersEllos);
    const setPairingOrder = usePicaPicaStore(state => state.setPairingOrder);
    const rotatePairings = usePicaPicaStore(state => state.rotatePairings);
    const allPlayers = useUserStore(state => state.players);

    const [dragIndex, setDragIndex] = useState<number | null>(null);

    const getPlayerName = (id: string) => {
        const p = allPlayers.find(pl => pl.id === id);
        return p?.nickname || p?.name || '?';
    };

    const handleSwap = (fromIdx: number, toIdx: number) => {
        if (fromIdx === toIdx) return;
        const newOrder: [number, number][] = [...pairingOrder.map(p => [...p] as [number, number])];
        // Swap the ellos indices
        const temp = newOrder[fromIdx][1];
        newOrder[fromIdx][1] = newOrder[toIdx][1];
        newOrder[toIdx][1] = temp;
        setPairingOrder(newOrder);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-4">
                <h3 className="text-center font-bold text-sm uppercase tracking-wider mb-1">
                    Emparejar jugadores
                </h3>
                <p className="text-center text-[10px] text-[var(--color-text-muted)] mb-4">
                    Arrastra para cambiar los emparejamientos
                </p>

                <div className="flex flex-col gap-2 mb-4">
                    {pairingOrder.map(([nosIdx, ellIdx], i) => (
                        <div
                            key={i}
                            className={`
                                flex items-center gap-2 p-3 rounded-lg border transition-all
                                ${dragIndex === i
                                    ? 'border-amber-500/50 bg-amber-500/10 scale-[1.02]'
                                    : 'border-[var(--color-border)] bg-[var(--color-bg)]'
                                }
                            `}
                            draggable
                            onDragStart={() => setDragIndex(i)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                                if (dragIndex !== null) handleSwap(dragIndex, i);
                                setDragIndex(null);
                            }}
                            onDragEnd={() => setDragIndex(null)}
                        >
                            {/* Drag handle */}
                            <div className="text-[var(--color-text-muted)] text-xs cursor-grab active:cursor-grabbing">
                                ⋮⋮
                            </div>

                            {/* Nosotros player */}
                            <div className="flex-1 text-right">
                                <span className="text-xs font-bold text-[var(--color-nosotros)]">
                                    {getPlayerName(playersNosotros[nosIdx])}
                                </span>
                            </div>

                            <span className="text-[9px] font-bold text-[var(--color-text-muted)] px-1">VS</span>

                            {/* Ellos player */}
                            <div className="flex-1 text-left">
                                <span className="text-xs font-bold text-[var(--color-ellos)]">
                                    {getPlayerName(playersEllos[ellIdx])}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={() => { rotatePairings(); }}
                        className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-[var(--color-border)] bg-[var(--color-bg)] active:scale-95 transition-all"
                    >
                        Rotar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500 text-black active:scale-95 transition-all"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};
