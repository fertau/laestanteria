import { useState, useEffect } from 'react';
import { useMatchStore } from '../store/useMatchStore';
import { ScoreSquare } from './ScoreSquare';
import { ShortcutButton } from './ShortcutButton';
import type { TeamId } from '../types';

// Long Press Hook
function useLongPress(callback: () => void, ms = 500) {
    const [startLongPress, setStartLongPress] = useState(false);

    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout>;
        if (startLongPress) {
            timerId = setTimeout(callback, ms);
        }

        return () => {
            clearTimeout(timerId);
        };
    }, [callback, ms, startLongPress]);

    return {
        onMouseDown: () => setStartLongPress(true),
        onMouseUp: () => setStartLongPress(false),
        onMouseLeave: () => setStartLongPress(false),
        onTouchStart: () => setStartLongPress(true),
        onTouchEnd: () => setStartLongPress(false),
    };
}

const SquareGroup = ({ points }: { points: number }) => {
    const squares = [];
    const totalSquares = 3;
    for (let i = 0; i < totalSquares; i++) {
        const valueForSquare = Math.min(5, Math.max(0, points - (i * 5)));
        squares.push(<ScoreSquare key={i} points={valueForSquare} />);
    }
    return <>{squares}</>;
};

export const ScoreBoard = () => {
    const teams = useMatchStore(state => state.teams);
    const addPoints = useMatchStore(state => state.addPoints);
    // @ts-ignore
    const subtractPoints = useMatchStore(state => state.subtractPoints);

    // Interaction Handlers
    const [longPressTriggered, setLongPressTriggered] = useState<{ nosotros: boolean, ellos: boolean }>({ nosotros: false, ellos: false });

    const handleLongPress = (teamId: TeamId) => {
        if (navigator.vibrate) navigator.vibrate(50);
        setLongPressTriggered({ ...longPressTriggered, [teamId]: true });
        subtractPoints(teamId, 1);
    }

    // We need separate hook instances for each button
    const longPressNosotros = useLongPress(() => handleLongPress('nosotros'), 800);
    const longPressEllos = useLongPress(() => handleLongPress('ellos'), 800);

    // Handle click - only add point if long-press wasn't triggered
    const handleColumnClick = (teamId: TeamId) => {
        if (!longPressTriggered[teamId]) {
            addPoints(teamId, 1, 'score_tap');
        }
        // Reset flag after a short delay
        setTimeout(() => {
            setLongPressTriggered({ ...longPressTriggered, [teamId]: false });
        }, 100);
    };

    return (
        <div className="flex w-full h-full relative bg-[var(--color-bg)] overflow-hidden select-none">

            {/* 1. Interaction Layer (Background Taps) */}
            <div className="absolute inset-0 flex z-0">
                <button
                    className="flex-1 active:bg-[var(--color-nosotros)]/10 transition-colors outline-none touch-manipulation group/n relative"
                    onClick={() => handleColumnClick('nosotros')}
                    {...longPressNosotros}
                >
                    <div className="absolute inset-0 bg-[var(--color-nosotros)]/5 scale-90 opacity-0 group-active/n:opacity-100 group-active/n:scale-100 transition-all duration-75"></div>
                </button>
                {/* Center visual divider for columns */}
                <div className="w-[1px] bg-[var(--color-border)] opacity-30 h-full relative z-20"></div>
                <button
                    className="flex-1 active:bg-[var(--color-ellos)]/10 transition-colors outline-none touch-manipulation group/e relative"
                    onClick={() => handleColumnClick('ellos')}
                    {...longPressEllos}
                >
                    <div className="absolute inset-0 bg-[var(--color-ellos)]/5 scale-90 opacity-0 group-active/e:opacity-100 group-active/e:scale-100 transition-all duration-75"></div>
                </button>
            </div>

            {/* 2. Visual Layer (Foreground Content) */}
            <div className="absolute inset-0 flex flex-col pointer-events-none z-10 py-4">

                {/* Headers */}
                <div className="flex w-full mb-4">
                    <div className="flex-1 text-center px-2">
                        <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[var(--color-nosotros)] truncate">
                            {teams.nosotros.name}
                        </h2>
                    </div>
                    <div className="w-[1px]"></div> {/* Spacer for grid alignment */}
                    <div className="flex-1 text-center px-2">
                        <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[var(--color-ellos)] truncate">
                            {teams.ellos.name}
                        </h2>
                    </div>
                </div>

                {/* Malas Section (Flex Row) */}
                <div className="flex w-full items-start">
                    <div className="flex-1 flex flex-col items-center gap-2">
                        <SquareGroup points={Math.min(teams.nosotros.score, 15)} />
                    </div>
                    <div className="w-[1px]"></div>
                    <div className="flex-1 flex flex-col items-center gap-2">
                        <SquareGroup points={Math.min(teams.ellos.score, 15)} />
                    </div>
                </div>

                {/* Dynamic Divider Row */}
                <div className="w-full flex items-center justify-center py-6 relative shrink-0">
                    <div className="absolute w-full h-[1px] bg-[var(--color-border)] -z-10 opacity-30 dashed"></div>
                    <div className="bg-[var(--color-bg)] px-3 py-0.5 text-[9px] font-black text-[var(--color-text-muted)] tracking-[0.3em] border border-[var(--color-border)] rounded-full shadow-lg uppercase z-20">
                        Buenas
                    </div>
                </div>

                {/* Buenas Section (Flex Row) */}
                <div className="flex w-full items-start">
                    <div className="flex-1 flex flex-col items-center gap-2">
                        <SquareGroup points={Math.max(0, teams.nosotros.score - 15)} />
                    </div>
                    <div className="w-[1px]"></div>
                    <div className="flex-1 flex flex-col items-center gap-2">
                        <SquareGroup points={Math.max(0, teams.ellos.score - 15)} />
                    </div>
                </div>

                {/* Big Score Numbers (Fills remaining space) */}
                <div className="flex-1 flex items-center w-full mt-4">
                    <div className="flex-1 flex justify-center">
                        <span className="text-6xl font-black opacity-10 tabular-nums tracking-tighter mix-blend-overlay">{teams.nosotros.score}</span>
                    </div>
                    <div className="flex-1 flex justify-center">
                        <span className="text-6xl font-black opacity-10 tabular-nums tracking-tighter mix-blend-overlay">{teams.ellos.score}</span>
                    </div>
                </div>

                {/* Controls - Pointer Events Enabed */}
                <div className="mt-auto w-full px-2 grid grid-cols-2 gap-4 pointer-events-auto z-30 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    {/* Nosotros Controls */}
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

                    {/* Ellos Controls */}
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
