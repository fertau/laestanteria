import { useState, useMemo } from 'react';
import { usePairStore } from '../store/usePairStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { calculateHeadToHead, getGroupId } from '../services/statisticsService';

export const PairHeadToHead = ({ onBack }: { onBack: () => void }) => {
    const pairs = usePairStore(state => state.pairs);
    const matches = useHistoryStore(state => state.matches);

    const [pairAId, setPairAId] = useState<string>('');
    const [pairBId, setPairBId] = useState<string>('');

    const pairA = pairs.find(p => p.id === pairAId);
    const pairB = pairs.find(p => p.id === pairBId);

    const h2hData = useMemo(() => {
        if (!pairA || !pairB) return null;
        return calculateHeadToHead(pairA.playerIds, pairB.playerIds, matches);
    }, [pairA, pairB, matches]);

    const toggleFavorite = usePairStore(state => state.toggleFavorite);

    if (!pairAId || !pairBId) {
        return (
            <div className="full-screen bg-[var(--color-bg)] flex flex-col p-4">
                <button onClick={onBack} className="text-[var(--color-text-muted)] font-bold mb-6 self-start px-2 py-1 rounded hover:bg-[var(--color-surface)] transition-colors">← VOLVER</button>
                <div className="flex flex-col items-center mb-8">
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">COMPARAR PAREJAS</h2>
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.3em]">Módulo Estadístico</p>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase text-[var(--color-nosotros)] tracking-widest pl-1">Pareja 1</label>
                        <select
                            className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl text-[var(--color-text-primary)] font-bold outline-none focus:border-[var(--color-nosotros)]"
                            value={pairAId}
                            onChange={(e) => setPairAId(e.target.value)}
                        >
                            <option value="">Seleccionar pareja...</option>
                            {pairs.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)).map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.isFavorite ? '★ ' : ''}{p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase text-[var(--color-ellos)] tracking-widest pl-1">Pareja 2</label>
                        <select
                            className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl text-[var(--color-text-primary)] font-bold outline-none focus:border-[var(--color-ellos)]"
                            value={pairBId}
                            onChange={(e) => setPairBId(e.target.value)}
                        >
                            <option value="">Seleccionar pareja...</option>
                            {pairs.filter(p => p.id !== pairAId).map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.isFavorite ? '★ ' : ''}{p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {matches.length === 0 && (
                    <div className="mt-12 text-center p-8 bg-[var(--color-surface)] rounded-3xl border border-dashed border-[var(--color-border)]">
                        <p className="text-sm text-[var(--color-text-muted)] font-medium">No hay registros de partidos con parejas aún.</p>
                    </div>
                )}
            </div>
        )
    }

    const { totalMatches, sideAWins, sideBWins, pointDifferential, recentMatches } = h2hData!;
    const winRateA = totalMatches > 0 ? Math.round((sideAWins / totalMatches) * 100) : 0;
    const winRateB = totalMatches > 0 ? Math.round((sideBWins / totalMatches) * 100) : 0;

    return (
        <div className="full-screen bg-[var(--color-bg)] flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => { setPairAId(''); setPairBId(''); }} className="text-[var(--color-text-muted)] font-bold text-xs uppercase tracking-widest bg-[var(--color-surface)] py-2 px-4 rounded-full active:scale-95 transition-all">
                    ← Nueva Consulta
                </button>
            </div>

            <h2 className="text-center font-black text-[var(--color-text-muted)] mb-2 uppercase text-[10px] tracking-[0.4em]">CARA A CARA</h2>

            <div className="flex justify-between items-center mb-10 gap-2">
                <div className="flex-1 flex flex-col items-center">
                    <div className="font-black text-lg leading-tight text-center uppercase mb-1">{pairA?.name}</div>
                    <button
                        onClick={() => pairA && toggleFavorite(pairA.id)}
                        className={`text-xl ${pairA?.isFavorite ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] opacity-30'}`}
                    >
                        {pairA?.isFavorite ? '★' : '★'}
                    </button>
                </div>

                <div className="px-4 py-1 text-xs font-black text-[var(--color-text-muted)] italic scale-150">VS</div>

                <div className="flex-1 flex flex-col items-center">
                    <div className="font-black text-lg leading-tight text-center uppercase mb-1">{pairB?.name}</div>
                    <button
                        onClick={() => pairB && toggleFavorite(pairB.id)}
                        className={`text-xl ${pairB?.isFavorite ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] opacity-30'}`}
                    >
                        {pairB?.isFavorite ? '★' : '★'}
                    </button>
                </div>
            </div>

            {/* SUMMARY CARD */}
            <div className="bg-[var(--color-surface)] rounded-[2.5rem] p-8 mb-10 border border-[var(--color-border)] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[var(--color-nosotros)] to-[var(--color-ellos)] opacity-50"></div>

                <h3 className="text-[9px] font-black uppercase text-[var(--color-text-muted)] mb-8 text-center tracking-[0.3em]">Resumen de Enfrentamientos</h3>

                <div className="flex justify-between items-end mb-10">
                    <div className="flex-1 text-center">
                        <div className="text-6xl font-black text-[var(--color-nosotros)] tabular-nums tracking-tighter">{sideAWins}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mt-2">Win</div>
                    </div>
                    <div className="flex flex-col items-center px-4">
                        <div className="text-xl font-black text-[var(--color-text-muted)] mb-2 tabular-nums">{totalMatches}</div>
                        <div className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">PJ</div>
                    </div>
                    <div className="flex-1 text-center">
                        <div className="text-6xl font-black text-[var(--color-ellos)] tabular-nums tracking-tighter">{sideBWins}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mt-2">Win</div>
                    </div>
                </div>

                <div className="flex flex-col gap-6 border-t border-[var(--color-border)] pt-8">
                    {/* Point Differential */}
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-2">
                        <span className="text-[var(--color-text-muted)]">Diferencia PTOS</span>
                        <span className={`text-sm tracking-normal ${pointDifferential >= 0 ? 'text-[var(--color-nosotros)]' : 'text-[var(--color-ellos)]'}`}>
                            {pointDifferential > 0 ? `+${pointDifferential}` : pointDifferential}
                        </span>
                    </div>

                    {/* Performance Bar */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-[11px] font-black tabular-nums">
                            <span className="text-[var(--color-nosotros)]">{winRateA}%</span>
                            <span className="text-[var(--color-text-muted)] uppercase tracking-[0.2em] text-[8px]">Efectividad</span>
                            <span className="text-[var(--color-ellos)]">{winRateB}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--color-surface)] rounded-full overflow-hidden flex">
                            <div className="h-full bg-[var(--color-nosotros)] transition-all duration-1000" style={{ width: `${winRateA}%` }}></div>
                            <div className="h-full bg-[var(--color-ellos)] transition-all duration-1000" style={{ width: `${winRateB}%` }}></div>
                        </div>
                    </div>

                    {/* Recent Form */}
                    <div className="flex flex-col items-center gap-3 mt-2">
                        <div className="flex gap-1.5">
                            {recentMatches.map((m, i) => {
                                const isWinA = (m.winner === 'nosotros' && getGroupId(m.teams.nosotros.players.map((p: any) => p.id)) === getGroupId(pairA!.playerIds)) ||
                                    (m.winner === 'ellos' && getGroupId(m.teams.ellos.players.map((p: any) => p.id)) === getGroupId(pairA!.playerIds));
                                return (
                                    <div
                                        key={i}
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-lg ${isWinA ? 'bg-[var(--color-nosotros)] text-black' : 'bg-[var(--color-ellos)] text-black'}`}
                                    >
                                        {isWinA ? 'W' : 'L'}
                                    </div>
                                );
                            })}
                            {recentMatches.length === 0 && <span className="text-[10px] font-medium text-[var(--color-text-muted)] italic">Sin registros recientes</span>}
                        </div>
                        <div className="text-[9px] font-black uppercase text-[var(--color-text-muted)] tracking-[0.2em]">Trayectoria Reciente</div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 mb-6 pl-2">
                <div className="h-[1px] flex-1 bg-[var(--color-surface)]"></div>
                <h3 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em]">Hojas de Carpeta</h3>
                <div className="h-[1px] flex-1 bg-[var(--color-surface)]"></div>
            </div>

            <div className="flex flex-col gap-4 pb-12">
                {recentMatches.length === 0 ? (
                    <p className="text-center text-xs font-medium text-[var(--color-text-muted)] py-8 italic">No hay partidos disputados todavía.</p>
                ) : (
                    recentMatches.map(m => {
                        const date = new Date(m.metadata?.date || m.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
                        const loc = m.metadata?.location || 'Sede';
                        const isWinA = (m.winner === 'nosotros' && getGroupId(m.teams.nosotros.players.map((p: any) => p.id)) === getGroupId(pairA!.playerIds)) ||
                            (m.winner === 'ellos' && getGroupId(m.teams.ellos.players.map((p: any) => p.id)) === getGroupId(pairA!.playerIds));

                        return (
                            <div key={m.id} className="bg-[var(--color-surface)] p-5 rounded-3xl border border-[var(--color-border)] flex justify-between items-center shadow-lg active:scale-[0.98] transition-all">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter">{date}</span>
                                    <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest truncate max-w-[80px]">{loc}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-2xl font-black tabular-nums ${isWinA ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{m.teams.nosotros.score}</span>
                                        <span className="text-[10px] font-black text-[var(--color-text-muted)] italic">vs</span>
                                        <span className={`text-2xl font-black tabular-nums ${!isWinA ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{m.teams.ellos.score}</span>
                                    </div>
                                    <span className={`text-[8px] font-black uppercase mt-1 tracking-widest ${isWinA ? 'text-[var(--color-nosotros)]' : 'text-[var(--color-ellos)]'}`}>
                                        {isWinA ? 'Ganó ' + pairA?.name.split(' ')[0] : 'Ganó ' + pairB?.name.split(' ')[0]}
                                    </span>
                                </div>
                                <div className={`w-8 h-8 rounded-full border-2 ${isWinA ? 'border-[var(--color-nosotros)] bg-[var(--color-nosotros)]/10' : 'border-[var(--color-ellos)] bg-[var(--color-ellos)]/10'} flex items-center justify-center`}>
                                    <div className={`w-2 h-2 rounded-full ${isWinA ? 'bg-[var(--color-nosotros)]' : 'bg-[var(--color-ellos)]'}`}></div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    );
};
