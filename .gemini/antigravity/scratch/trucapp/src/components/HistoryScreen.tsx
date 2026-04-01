import { useState } from 'react';
import { HeadToHead } from './HeadToHead';
import { HistoryList } from './HistoryList';
import type { MatchMode } from '../types';

interface HistoryScreenProps {
    onBack: () => void;
}

type FilterMode = 'ALL' | MatchMode;

export const HistoryScreen = ({ onBack }: HistoryScreenProps) => {
    const [filter, setFilter] = useState<FilterMode>('ALL');

    return (
        <div className="full-screen bg-[var(--color-bg)] flex flex-col p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="text-[var(--color-text-muted)] font-black text-[10px] uppercase tracking-[0.3em] bg-[var(--color-surface)] py-2 px-4 rounded-full active:scale-95 transition-all">
                    ← VOLVER
                </button>
                <div className="bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-[var(--color-accent)]/20">
                    Estadísticas
                </div>
            </div>

            {/* Filter Chips */}
            <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
                {(['ALL', '1v1', '2v2', '3v3'] as const).map(m => (
                    <button
                        key={m}
                        onClick={() => setFilter(m)}
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${filter === m ? 'bg-white text-black border-white shadow-lg' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)]'}`}
                    >
                        {m === 'ALL' ? 'Todos' : m}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto pb-12 custom-scrollbar pr-1">
                <div className="flex flex-col gap-10">
                    <section>
                        <HeadToHead mode={filter} />
                    </section>

                    <section className="flex flex-col gap-4">
                        <div className="flex items-center gap-4 pl-2">
                            <h3 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.4em]">
                                {filter === 'ALL' ? 'Historial Completo' : `Partidos ${filter}`}
                            </h3>
                            <div className="h-[1px] flex-1 bg-[var(--color-surface)]"></div>
                        </div>
                        <HistoryList filter={filter} />
                    </section>
                </div>
            </div>
        </div>
    );
};
