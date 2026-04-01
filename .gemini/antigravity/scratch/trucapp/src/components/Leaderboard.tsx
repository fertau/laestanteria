import { useState, useMemo } from 'react';
import { useUserStore } from '../store/useUserStore';
import { usePairStore } from '../store/usePairStore';
import { useHistoryStore } from '../store/useHistoryStore';

type RankingType = 'PLAYERS' | 'PAIRS';

export const Leaderboard = ({ onBack }: { onBack: () => void }) => {
    const [rankingType, setRankingType] = useState<RankingType>('PLAYERS');
    const players = useUserStore(state => state.players);
    const pairs = usePairStore(state => state.pairs);
    const matches = useHistoryStore(state => state.matches);

    const playerStats = useMemo(() => {
        const statsMap: Record<string, { wins: number, total: number }> = {};

        matches.forEach(m => {
            if (!m.winner) return;

            const nosotrosPlayers = m.teams.nosotros.players;
            const ellosPlayers = m.teams.ellos.players;

            nosotrosPlayers.forEach(pId => {
                if (!statsMap[pId]) statsMap[pId] = { wins: 0, total: 0 };
                statsMap[pId].total++;
                if (m.winner === 'nosotros') statsMap[pId].wins++;
            });

            ellosPlayers.forEach(pId => {
                if (!statsMap[pId]) statsMap[pId] = { wins: 0, total: 0 };
                statsMap[pId].total++;
                if (m.winner === 'ellos') statsMap[pId].wins++;
            });
        });

        return players.map(p => {
            const s = statsMap[p.id] || { wins: 0, total: 0 };
            const winRate = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
            return {
                id: p.id,
                name: p.name,
                wins: s.wins,
                total: s.total,
                winRate
            };
        }).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
    }, [matches, players]);

    const pairStats = useMemo(() => {
        const statsMap: Record<string, { wins: number, total: number }> = {};

        matches.forEach(m => {
            if (!m.winner || !m.pairs) return;

            const pNos = m.pairs.nosotros;
            const pEll = m.pairs.ellos;

            if (pNos) {
                if (!statsMap[pNos]) statsMap[pNos] = { wins: 0, total: 0 };
                statsMap[pNos].total++;
                if (m.winner === 'nosotros') statsMap[pNos].wins++;
            }

            if (pEll) {
                if (!statsMap[pEll]) statsMap[pEll] = { wins: 0, total: 0 };
                statsMap[pEll].total++;
                if (m.winner === 'ellos') statsMap[pEll].wins++;
            }
        });

        return pairs.map(p => {
            const s = statsMap[p.id] || { wins: 0, total: 0 };
            const winRate = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
            return {
                id: p.id,
                name: p.name,
                wins: s.wins,
                total: s.total,
                winRate
            };
        }).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
    }, [matches, pairs]);

    const activeList = rankingType === 'PLAYERS' ? playerStats : pairStats;

    return (
        <div className="full-screen bg-[var(--color-bg)] flex flex-col p-4 overflow-y-auto">
            <button onClick={onBack} className="text-[var(--color-text-muted)] font-bold mb-6 self-start">← VOLVER</button>

            <h2 className="text-2xl font-black mb-6 tracking-tighter uppercase italic text-center">RANKING GLOBAL</h2>

            {/* Selector */}
            <div className="flex bg-[var(--color-surface)] p-1 rounded-xl mb-8 border border-[var(--color-border)]">
                <button
                    onClick={() => setRankingType('PLAYERS')}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${rankingType === 'PLAYERS' ? 'bg-[var(--color-bg)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
                >
                    JUGADORES
                </button>
                <button
                    onClick={() => setRankingType('PAIRS')}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${rankingType === 'PAIRS' ? 'bg-[var(--color-bg)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
                >
                    PAREJAS
                </button>
            </div>

            {/* List */}
            <div className="flex flex-col gap-3">
                {activeList.map((item, index) => {
                    const isTop = index < 3;
                    return (
                        <div key={item.id} className={`bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] flex items-center gap-4 ${isTop ? 'ring-1 ring-[var(--color-accent)]/20 shadow-lg' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-yellow-500 text-black' :
                                    index === 1 ? 'bg-slate-300 text-black' :
                                        index === 2 ? 'bg-amber-700 text-[var(--color-text-primary)]' :
                                            'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                                }`}>
                                {index + 1}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="font-bold truncate text-[var(--color-text-primary)]">{item.name}</div>
                                <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    {item.total} Partidos
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-xl font-black text-[var(--color-accent)]">{item.winRate}%</div>
                                <div className="text-[9px] font-black uppercase text-[var(--color-text-muted)]">Win Rate</div>
                            </div>
                        </div>
                    );
                })}

                {activeList.length === 0 && (
                    <div className="text-center py-12 text-[var(--color-text-muted)] font-medium">
                        No hay datos suficientes para generar el ranking.
                    </div>
                )}
            </div>
        </div>
    );
};
