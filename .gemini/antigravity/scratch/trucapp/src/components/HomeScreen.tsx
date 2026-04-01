import { useAuthStore } from '../store/useAuthStore';
import { useUserStore } from '../store/useUserStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { Logo } from './Logo';

interface HomeScreenProps {
    onNewMatch: () => void;
    onHistory: () => void;
    onLeaderboard: () => void;
    onSocial: () => void;
}

export const HomeScreen = ({ onNewMatch, onHistory, onLeaderboard, onSocial }: HomeScreenProps) => {
    const currentUserId = useAuthStore(state => state.currentUserId);
    const players = useUserStore(state => state.players);
    const matches = useHistoryStore(state => state.matches);

    const recentMatches = matches.slice(0, 3);
    const user = players.find(p => p.id === currentUserId);

    return (
        <div className="full-screen bg-[var(--color-bg)] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                    <Logo className="w-7 h-7 text-[var(--color-text-primary)]" />
                    <span className="text-sm font-black tracking-[0.2em] text-[var(--color-text-primary)] uppercase">Trucapp</span>
                </div>
                <button onClick={onSocial} className="w-9 h-9 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-secondary)] border border-[var(--color-border)] active:scale-95 transition-all">
                    {user?.avatar || user?.name?.substring(0, 2).toUpperCase()}
                </button>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col px-6 pb-6 overflow-y-auto">
                {/* Hero CTA */}
                <button
                    onClick={onNewMatch}
                    className="w-full bg-[var(--color-accent)] text-[#181614] py-5 rounded-lg font-black text-base uppercase tracking-[0.1em] active:scale-[0.98] transition-all mt-4 mb-6"
                >
                    Nuevo Partido
                </button>

                {/* Nav grid */}
                <div className="grid grid-cols-3 gap-2 mb-8">
                    <button
                        onClick={onHistory}
                        className="flex flex-col items-center gap-2 py-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] active:bg-[var(--color-surface-hover)] transition-colors"
                    >
                        <span className="text-lg">📊</span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Stats</span>
                    </button>
                    <button
                        onClick={onLeaderboard}
                        className="flex flex-col items-center gap-2 py-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] active:bg-[var(--color-surface-hover)] transition-colors"
                    >
                        <span className="text-lg">🏆</span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Ranking</span>
                    </button>
                    <button
                        onClick={onSocial}
                        className="flex flex-col items-center gap-2 py-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] active:bg-[var(--color-surface-hover)] transition-colors"
                    >
                        <span className="text-lg">👥</span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">Social</span>
                    </button>
                </div>

                {/* Recent matches */}
                <div className="flex items-center mb-3">
                    <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Últimos partidos</span>
                    <div className="h-[1px] flex-1 bg-[var(--color-border)] ml-3" />
                </div>

                <div className="flex flex-col gap-2">
                    {recentMatches.length === 0 && (
                        <p className="text-[var(--color-text-muted)] text-sm py-4 text-center">Sin partidos todavía</p>
                    )}

                    {recentMatches.map(m => (
                        <div key={m.id} className="flex items-center bg-[var(--color-surface)] px-4 py-3 rounded-lg border border-[var(--color-border)]">
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <span className={`text-[12px] font-semibold truncate mr-2 ${m.winner === 'nosotros' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {m.teams.nosotros.name}
                                    </span>
                                    <span className={`text-[12px] font-black tabular-nums ${m.winner === 'nosotros' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {m.teams.nosotros.score}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className={`text-[12px] font-semibold truncate mr-2 ${m.winner === 'ellos' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {m.teams.ellos.name}
                                    </span>
                                    <span className={`text-[12px] font-black tabular-nums ${m.winner === 'ellos' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {m.teams.ellos.score}
                                    </span>
                                </div>
                            </div>
                            <div className="text-[9px] font-semibold text-[var(--color-text-muted)] tracking-wider ml-3 pl-3 border-l border-[var(--color-border)]">
                                {new Date(m.startDate).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
