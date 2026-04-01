import { useState, useEffect } from 'react';
import { useMatchStore } from '../store/useMatchStore';
import { TallyMarks } from './TallyMarks';
import { ShortcutButton } from './ShortcutButton';
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

    return (
        <div className="flex flex-col w-full h-full relative bg-[var(--color-bg)] overflow-hidden select-none">

            {/* Interaction Layer */}
            <div className="absolute inset-0 flex z-0">
                <button
                    className="flex-1 active:bg-[var(--color-nosotros)]/10 transition-colors outline-none touch-manipulation"
                    onClick={() => handleColumnClick('nosotros')}
                    {...longPressNosotros}
                />
                <div className="w-[1px] bg-[var(--color-border)] opacity-30 h-full" />
                <button
                    className="flex-1 active:bg-[var(--color-ellos)]/10 transition-colors outline-none touch-manipulation"
                    onClick={() => handleColumnClick('ellos')}
                    {...longPressEllos}
                />
            </div>

            {/* Visual Layer */}
            <div className="absolute inset-0 flex flex-col pointer-events-none z-10 py-4">

                {/* Team Headers */}
                <div className="flex w-full mb-4">
                    <div className="flex-1 text-center px-2">
                        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-nosotros)] truncate">
                            {teams.nosotros.name}
                        </h2>
                    </div>
                    <div className="w-[1px]" />
                    <div className="flex-1 text-center px-2">
                        <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-ellos)] truncate">
                            {teams.ellos.name}
                        </h2>
                    </div>
                </div>

                {/* Malas Tally */}
                <div className="flex w-full px-4">
                    <div className="flex-1 flex justify-center">
                        <TallyMarks points={Math.min(teams.nosotros.score, 15)} />
                    </div>
                    <div className="w-[1px]" />
                    <div className="flex-1 flex justify-center">
                        <TallyMarks points={Math.min(teams.ellos.score, 15)} />
                    </div>
                </div>

                {/* Buenas Divider */}
                <div className="w-full flex items-center justify-center py-4 relative shrink-0">
                    <div className="absolute w-full h-[1px] bg-[var(--color-border)] opacity-30" />
                    <div className="bg-[var(--color-bg)] px-3 py-0.5 text-[9px] font-bold text-[var(--color-text-muted)] tracking-[0.3em] border border-[var(--color-border)] rounded-full uppercase z-10">
                        Buenas
                    </div>
                </div>

                {/* Buenas Tally */}
                <div className="flex w-full px-4">
                    <div className="flex-1 flex justify-center">
                        <TallyMarks points={Math.max(0, teams.nosotros.score - 15)} />
                    </div>
                    <div className="w-[1px]" />
                    <div className="flex-1 flex justify-center">
                        <TallyMarks points={Math.max(0, teams.ellos.score - 15)} />
                    </div>
                </div>

                {/* Numeric Score (toggleable) */}
                <div className={`flex items-center justify-center gap-4 mt-4 transition-all duration-200 ${showNumbers ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                    <span className="text-[48px] font-black text-[var(--color-text-primary)] tabular-nums tracking-tighter leading-none">{teams.nosotros.score}</span>
                    <span className="text-xl text-[var(--color-text-muted)] font-light">—</span>
                    <span className="text-[48px] font-black text-[var(--color-text-primary)] tabular-nums tracking-tighter leading-none">{teams.ellos.score}</span>
                </div>
                {showNumbers && (
                    <div className="text-center mt-1">
                        <span className="text-[10px] text-[var(--color-text-muted)]">a {targetScore}</span>
                    </div>
                )}

                {/* Toggle */}
                <div className="flex justify-center mt-3 pointer-events-auto">
                    <button
                        onClick={() => setShowNumbers(v => !v)}
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-3 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)] active:bg-[var(--color-surface-hover)] transition-colors"
                    >
                        {showNumbers ? 'Ocultar números' : 'Mostrar números'}
                    </button>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Controls */}
                <div className="mt-auto w-full px-2 grid grid-cols-2 gap-4 pointer-events-auto z-30 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    <div className="grid grid-cols-3 gap-1">
                        <ShortcutButton label="Envido" points={2} type="envido" teamId="nosotros" onAction={() => addPoints('nosotros', 2, 'envido')} />
                        <ShortcutButton label="Real Envido" points={3} type="real_envido" teamId="nosotros" onAction={() => addPoints('nosotros', 3, 'real_envido')} />
                        <ShortcutButton
                            label="Falta Envido"
                            points={teams.ellos.score < 15 ? 'MATCH' : `+${30 - teams.ellos.score}`}
                            type="falta_envido"
                            teamId="nosotros"
                            onAction={() => window.dispatchEvent(new CustomEvent('requestFaltaEnvido'))}
                        />
                        <ShortcutButton label="Truco" points={2} type="truco" teamId="nosotros" onAction={() => addPoints('nosotros', 2, 'truco')} />
                        <ShortcutButton label="Retruco" points={3} type="retruco" teamId="nosotros" onAction={() => addPoints('nosotros', 3, 'retruco')} />
                        <ShortcutButton label="Vale 4" points={4} type="vale_cuatro" teamId="nosotros" onAction={() => addPoints('nosotros', 4, 'vale_cuatro')} />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        <ShortcutButton label="Envido" points={2} type="envido" teamId="ellos" onAction={() => addPoints('ellos', 2, 'envido')} />
                        <ShortcutButton label="Real Envido" points={3} type="real_envido" teamId="ellos" onAction={() => addPoints('ellos', 3, 'real_envido')} />
                        <ShortcutButton
                            label="Falta Envido"
                            points={teams.nosotros.score < 15 ? 'MATCH' : `+${30 - teams.nosotros.score}`}
                            type="falta_envido"
                            teamId="ellos"
                            onAction={() => window.dispatchEvent(new CustomEvent('requestFaltaEnvido'))}
                        />
                        <ShortcutButton label="Truco" points={2} type="truco" teamId="ellos" onAction={() => addPoints('ellos', 2, 'truco')} />
                        <ShortcutButton label="Retruco" points={3} type="retruco" teamId="ellos" onAction={() => addPoints('ellos', 3, 'retruco')} />
                        <ShortcutButton label="Vale 4" points={4} type="vale_cuatro" teamId="ellos" onAction={() => addPoints('ellos', 4, 'vale_cuatro')} />
                    </div>
                </div>
            </div>
        </div>
    );
};
