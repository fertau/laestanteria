import { useHistoryStore } from '../store/useHistoryStore';
import { useAuthStore } from '../store/useAuthStore';
import { useUserStore } from '../store/useUserStore';
import type { MatchMode } from '../types';

interface HeadToHeadProps {
    mode: 'ALL' | MatchMode;
}

export const HeadToHead = ({ mode }: HeadToHeadProps) => {
    const matches = useHistoryStore(state => state.matches);
    const currentUserId = useAuthStore(state => state.currentUserId);
    const players = useUserStore(state => state.players);

    // Filter matches by mode
    const filteredMatches = mode === 'ALL'
        ? matches
        : matches.filter(m => m.mode === mode);

    // Calculate global stats for current user
    const userMatches = filteredMatches.filter(m =>
        m.teams.nosotros.players.includes(currentUserId!) ||
        m.teams.ellos.players.includes(currentUserId!)
    );

    const total = userMatches.length;
    const wins = userMatches.filter(m => {
        const isNosotros = m.teams.nosotros.players.includes(currentUserId!);
        return m.winner === (isNosotros ? 'nosotros' : 'ellos');
    }).length;

    const losses = total - wins;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    const diff = userMatches.reduce((acc, m) => {
        const isNosotros = m.teams.nosotros.players.includes(currentUserId!);
        const userScore = isNosotros ? m.teams.nosotros.score : m.teams.ellos.score;
        const oppScore = isNosotros ? m.teams.ellos.score : m.teams.nosotros.score;
        return acc + (userScore - oppScore);
    }, 0);

    // Frequent Rivals / Partners
    const rivalsMap: Record<string, number> = {};
    const partnersMap: Record<string, number> = {};

    userMatches.forEach(m => {
        const isNosotros = m.teams.nosotros.players.includes(currentUserId!);
        const rivals = isNosotros ? m.teams.ellos.players : m.teams.nosotros.players;
        const partners = (isNosotros ? m.teams.nosotros.players : m.teams.ellos.players).filter(id => id !== currentUserId);

        rivals.forEach(id => { rivalsMap[id] = (rivalsMap[id] || 0) + 1; });
        partners.forEach(id => { partnersMap[id] = (partnersMap[id] || 0) + 1; });
    });

    const topRivalId = Object.entries(rivalsMap).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topPartnerId = Object.entries(partnersMap).sort((a, b) => b[1] - a[1])[0]?.[0];

    const getPlayerName = (id?: string) => players.find(p => p.id === id)?.name || 'Varios';

    return (
        <div className="flex flex-col gap-8 w-full max-w-sm mx-auto animate-in fade-in duration-500">
            {/* Big Summary Card */}
            <div className="bg-gradient-to-br from-[#1a1a1c] to-[#0a0a0c] p-8 rounded-[2.5rem] border border-[var(--color-border)] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-accent)]/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-[var(--color-surface)] rounded-full blur-2xl -ml-8 -mb-8"></div>

                <div className="flex justify-between items-end mb-8 relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-[0.3em] mb-1">Efectividad</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-6xl font-black tracking-tighter text-[var(--color-text-primary)] italic">{winRate}</span>
                            <span className="text-2xl font-black text-[var(--color-accent)]">%</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className={`text-xl font-black ${diff >= 0 ? 'text-[var(--color-nosotros)]' : 'text-[var(--color-ellos)]'}`}>
                            {diff >= 0 ? `+${diff}` : diff}
                        </span>
                        <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Balance Pts</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 relative z-10">
                    <div className="bg-[var(--color-surface)] p-4 rounded-3xl border border-[var(--color-border)] flex flex-col items-center">
                        <span className="text-lg font-black text-[var(--color-text-primary)]">{wins}</span>
                        <span className="text-[7px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Wins</span>
                    </div>
                    <div className="bg-[var(--color-surface)] p-4 rounded-3xl border border-[var(--color-border)] flex flex-col items-center">
                        <span className="text-lg font-black text-[var(--color-text-primary)]">{losses}</span>
                        <span className="text-[7px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Losses</span>
                    </div>
                    <div className="bg-[var(--color-surface)] p-4 rounded-3xl border border-[var(--color-border)] flex flex-col items-center">
                        <span className="text-lg font-black text-[var(--color-text-primary)]">{total}</span>
                        <span className="text-[7px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Total</span>
                    </div>
                </div>
            </div>

            {/* Insights Section */}
            {(topRivalId || topPartnerId) && (
                <div className="grid grid-cols-2 gap-4">
                    {topRivalId && (
                        <div className="bg-[var(--color-surface)] p-5 rounded-[2rem] border border-[var(--color-border)]">
                            <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-[0.2em] mb-3 block">Hijo Favorito</span>
                            <div className="flex flex-col">
                                <span className="text-xs font-black uppercase text-[var(--color-text-primary)] truncate">{getPlayerName(topRivalId)}</span>
                                <span className="text-[8px] font-black uppercase text-[var(--color-ellos)] tracking-widest mt-0.5">{rivalsMap[topRivalId]} Cruces</span>
                            </div>
                        </div>
                    )}
                    {topPartnerId && (
                        <div className="bg-[var(--color-surface)] p-5 rounded-[2rem] border border-[var(--color-border)]">
                            <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-[0.2em] mb-3 block">Dúo Dinámico</span>
                            <div className="flex flex-col">
                                <span className="text-xs font-black uppercase text-[var(--color-text-primary)] truncate">{getPlayerName(topPartnerId)}</span>
                                <span className="text-[8px] font-black uppercase text-[var(--color-nosotros)] tracking-widest mt-0.5">{partnersMap[topPartnerId]} Juntos</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Form / Streak */}
            <div className="flex flex-col gap-3 px-2">
                <h4 className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.4em] ml-2">Racha</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 px-1 no-scrollbar">
                    {userMatches.slice(0, 8).map(m => {
                        const isNosotros = m.teams.nosotros.players.includes(currentUserId!);
                        const isWin = m.winner === (isNosotros ? 'nosotros' : 'ellos');
                        return (
                            <div
                                key={m.id}
                                className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-xs transition-all border ${isWin
                                    ? 'bg-[var(--color-nosotros)]/20 text-[var(--color-nosotros)] border-[var(--color-nosotros)]/40'
                                    : 'bg-[var(--color-ellos)]/20 text-[var(--color-ellos)] border-[var(--color-ellos)]/40'}`}
                            >
                                {isWin ? 'W' : 'L'}
                            </div>
                        );
                    })}
                    {userMatches.length === 0 && (
                        <div className="w-full text-center py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Sin datos</div>
                    )}
                </div>
            </div>
        </div>
    );
};
