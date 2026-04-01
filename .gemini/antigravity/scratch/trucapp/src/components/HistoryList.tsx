import { useHistoryStore } from '../store/useHistoryStore';
import { useAuthStore } from '../store/useAuthStore';
import type { MatchMode } from '../types';

interface HistoryListProps {
    filter: 'ALL' | MatchMode;
}

export const HistoryList = ({ filter }: HistoryListProps) => {
    const matches = useHistoryStore(state => state.matches);
    const currentUserId = useAuthStore(state => state.currentUserId);

    const filteredMatches = filter === 'ALL'
        ? matches
        : matches.filter(m => m.mode === filter);

    if (filteredMatches.length === 0) {
        return (
            <div className="text-center text-[var(--color-text-muted)] py-12 px-8 bg-[var(--color-surface)] rounded-3xl border border-dashed border-[var(--color-border)] mt-4">
                <span className="text-2xl block mb-2 opacity-20">📭</span>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-20">No hay partidos en esta categoría</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 py-2">
            {filteredMatches.map(match => {
                const isNosotros = match.teams.nosotros.players.includes(currentUserId!);
                const userTeam = isNosotros ? match.teams.nosotros : match.teams.ellos;
                const oppTeam = isNosotros ? match.teams.ellos : match.teams.nosotros;
                const isUserWin = match.winner === (isNosotros ? 'nosotros' : 'ellos');

                return (
                    <div key={match.id} className="bg-[#1a1a1c] p-5 rounded-[2.5rem] border border-[var(--color-border)] flex justify-between items-center shadow-xl active:scale-[0.99] transition-all hover:bg-[var(--color-surface)] group relative overflow-hidden">
                        <div className="flex items-center gap-5 relative z-10">
                            <div className={`w-12 h-12 rounded-[1.25rem] flex flex-col items-center justify-center font-black transition-all border ${isUserWin
                                ? 'bg-[var(--color-nosotros)]/10 text-[var(--color-nosotros)] border-[var(--color-nosotros)]/20'
                                : 'bg-[var(--color-ellos)]/10 text-[var(--color-ellos)] border-[var(--color-ellos)]/20'}`}>
                                <span className="text-sm leading-none">{isUserWin ? 'W' : 'L'}</span>
                            </div>

                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">{match.mode}</span>
                                    <span className="w-1 h-1 rounded-full bg-[var(--color-surface-hover)]"></span>
                                    <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">
                                        {new Date(match.startDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-base font-black tabular-nums ${isUserWin ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                                {userTeam.score}
                                            </span>
                                            <span className={`text-[10px] font-bold truncate max-w-[120px] ${isUserWin ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}`}>
                                                {userTeam.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-base font-black tabular-nums ${!isUserWin ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                                {oppTeam.score}
                                            </span>
                                            <span className={`text-[10px] font-bold truncate max-w-[120px] ${!isUserWin ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}`}>
                                                {oppTeam.name}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end opacity-20 group-hover:opacity-100 transition-opacity pr-2 relative z-10">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isUserWin ? 'text-[var(--color-nosotros)]' : 'text-[var(--color-ellos)]'}`}>
                                {isUserWin ? 'Ganaste' : 'Perdiste'}
                            </span>
                            <span className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-widest mt-0.5">
                                Dif. {Math.abs(userTeam.score - oppTeam.score)}
                            </span>
                        </div>

                        {/* Background glow for win/loss */}
                        <div className={`absolute top-0 right-0 w-32 h-full opacity-0 group-hover:opacity-10 transition-opacity blur-3xl pointer-events-none ${isUserWin ? 'bg-[var(--color-nosotros)]' : 'bg-[var(--color-ellos)]'}`}></div>
                    </div>
                );
            })}
        </div>
    );
};
