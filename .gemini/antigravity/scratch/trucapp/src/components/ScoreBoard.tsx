import { useState, useEffect } from 'react';
import { useMatchStore } from '../store/useMatchStore';
import { TallyMarks } from './TallyMarks';
import type { TeamId } from '../types';

function useLongPress(callback: () => void, ms = 500) {
    const [startLongPress, setStartLongPress] = useState(false);

    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout>;
        if (startLongPress) {
            timerId = setTimeout(callback, ms);
        }
        return () => { clearTimeout(timerId); };
    }, [callback, ms, startLongPress]);

    return {
        onMouseDown: () => setStartLongPress(true),
        onMouseUp: () => setStartLongPress(false),
        onMouseLeave: () => setStartLongPress(false),
        onTouchStart: () => setStartLongPress(true),
        onTouchEnd: () => setStartLongPress(false),
    };
}

const EyeIcon = ({ open }: { open: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {open ? (
            <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
            </>
        ) : (
            <>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
            </>
        )}
    </svg>
);

export const ScoreBoard = () => {
    const teams = useMatchStore(state => state.teams);
    const targetScore = useMatchStore(state => state.targetScore);
    const addPoints = useMatchStore(state => state.addPoints);
    // @ts-ignore
    const subtractPoints = useMatchStore(state => state.subtractPoints);

    const [showNumbers, setShowNumbers] = useState(true);
    const [longPressTriggered, setLongPressTriggered] = useState<{ nosotros: boolean; ellos: boolean }>({ nosotros: false, ellos: false });

    const handleLongPress = (teamId: TeamId) => {
        if (navigator.vibrate) navigator.vibrate(50);
        setLongPressTriggered(prev => ({ ...prev, [teamId]: true }));
        subtractPoints(teamId, 1);
    };

    const longPressNosotros = useLongPress(() => handleLongPress('nosotros'), 800);
    const longPressEllos = useLongPress(() => handleLongPress('ellos'), 800);

    const handleColumnClick = (teamId: TeamId) => {
        if (!longPressTriggered[teamId]) {
            addPoints(teamId, 1, 'score_tap');
        }
        setTimeout(() => {
            setLongPressTriggered(prev => ({ ...prev, [teamId]: false }));
        }, 100);
    };

    const nosScore = teams.nosotros.score;
    const ellScore = teams.ellos.score;

    return (
        <div className="flex flex-col w-full h-full relative bg-[var(--color-bg)] overflow-hidden select-none">

            {/* Tap zones */}
            <div className="absolute inset-0 flex z-0">
                <button
                    className="flex-1 active:bg-[#4ade80]/5 transition-colors outline-none touch-manipulation"
                    onClick={() => handleColumnClick('nosotros')}
                    {...longPressNosotros}
                />
                <button
                    className="flex-1 active:bg-[#fbbf24]/5 transition-colors outline-none touch-manipulation"
                    onClick={() => handleColumnClick('ellos')}
                    {...longPressEllos}
                />
            </div>

            {/* Content */}
            <div className="absolute inset-0 flex flex-col pointer-events-none z-10">

                {/* Team headers */}
                <div className="flex w-full pt-4 pb-2">
                    <div className="flex-1 text-center">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-nosotros)] truncate px-2">
                            {teams.nosotros.name}
                        </h2>
                    </div>
                    <div className="w-[1px]" />
                    <div className="flex-1 text-center">
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-ellos)] truncate px-2">
                            {teams.ellos.name}
                        </h2>
                    </div>
                </div>

                {/* Malas label */}
                <div className="flex items-center px-6 mb-1">
                    <div className="h-[1px] flex-1 bg-[var(--color-border)]/40" />
                    <span className="px-3 text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.3em]">Malas</span>
                    <div className="h-[1px] flex-1 bg-[var(--color-border)]/40" />
                </div>

                {/* Malas tally marks */}
                <div className="flex w-full px-6 py-2">
                    <div className="flex-1 flex justify-center">
                        <TallyMarks points={Math.min(nosScore, 15)} />
                    </div>
                    <div className="w-[1px] bg-[var(--color-border)]/20 mx-2" />
                    <div className="flex-1 flex justify-center">
                        <TallyMarks points={Math.min(ellScore, 15)} />
                    </div>
                </div>

                {/* Buenas label */}
                <div className="flex items-center px-6 mt-2 mb-1">
                    <div className="h-[1px] flex-1 bg-[var(--color-border)]/40" />
                    <span className="px-3 text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.3em]">Buenas</span>
                    <div className="h-[1px] flex-1 bg-[var(--color-border)]/40" />
                </div>

                {/* Buenas tally marks */}
                <div className="flex w-full px-6 py-2">
                    <div className="flex-1 flex justify-center">
                        <TallyMarks points={Math.max(0, nosScore - 15)} />
                    </div>
                    <div className="w-[1px] bg-[var(--color-border)]/20 mx-2" />
                    <div className="flex-1 flex justify-center">
                        <TallyMarks points={Math.max(0, ellScore - 15)} />
                    </div>
                </div>

                {/* Numeric scores — ghost style, toggleable */}
                <div className={`flex items-center justify-center gap-4 mt-4 transition-all duration-250 ${showNumbers ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                    <span className="text-5xl font-black tabular-nums tracking-tighter leading-none opacity-10">{nosScore}</span>
                    <span className="text-lg opacity-10">—</span>
                    <span className="text-5xl font-black tabular-nums tracking-tighter leading-none opacity-10">{ellScore}</span>
                </div>
                {showNumbers && (
                    <div className="text-center mt-0.5">
                        <span className="text-[10px] text-[var(--color-text-muted)] opacity-40">a {targetScore}</span>
                    </div>
                )}

                {/* Eye toggle */}
                <div className="flex justify-center mt-2 pointer-events-auto">
                    <button
                        onClick={() => setShowNumbers(v => !v)}
                        className="text-[var(--color-text-muted)] p-2 rounded-full active:bg-[var(--color-surface)] transition-colors"
                    >
                        <EyeIcon open={showNumbers} />
                    </button>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Point buttons: +1 to +5 per team */}
                <div className="w-full px-3 grid grid-cols-2 gap-3 pointer-events-auto z-30 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                    {/* Nosotros */}
                    <div className="grid grid-cols-5 gap-1">
                        {[1, 2, 3, 4, 5].map(n => (
                            <button
                                key={n}
                                onClick={(e) => { e.stopPropagation(); addPoints('nosotros', n, 'score_tap'); }}
                                className="py-3 rounded-md bg-[#4ade80]/8 border border-[#4ade80]/15 text-[#4ade80] font-black text-sm active:scale-95 active:bg-[#4ade80]/20 transition-all"
                            >
                                +{n}
                            </button>
                        ))}
                    </div>
                    {/* Ellos */}
                    <div className="grid grid-cols-5 gap-1">
                        {[1, 2, 3, 4, 5].map(n => (
                            <button
                                key={n}
                                onClick={(e) => { e.stopPropagation(); addPoints('ellos', n, 'score_tap'); }}
                                className="py-3 rounded-md bg-[#fbbf24]/8 border border-[#fbbf24]/15 text-[#fbbf24] font-black text-sm active:scale-95 active:bg-[#fbbf24]/20 transition-all"
                            >
                                +{n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
