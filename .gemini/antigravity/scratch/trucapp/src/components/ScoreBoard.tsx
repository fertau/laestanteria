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

                {/* Big score numbers at top */}
                <div className="flex items-center pt-6 pb-2 px-4">
                    <div className="flex-1 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-nosotros)] mb-1 truncate px-2">
                            {teams.nosotros.name}
                        </div>
                        <div className={`transition-all duration-200 ${showNumbers ? 'text-[72px] leading-none' : 'text-[40px] leading-none'} font-black text-[var(--color-text-primary)] tabular-nums tracking-[-3px]`}>
                            {nosScore}
                        </div>
                    </div>

                    {/* Center divider */}
                    <div className="flex flex-col items-center gap-1 px-2">
                        <div className="w-[1px] h-8 bg-[var(--color-border)]" />
                        <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">a {targetScore}</span>
                        <div className="w-[1px] h-8 bg-[var(--color-border)]" />
                    </div>

                    <div className="flex-1 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-ellos)] mb-1 truncate px-2">
                            {teams.ellos.name}
                        </div>
                        <div className={`transition-all duration-200 ${showNumbers ? 'text-[72px] leading-none' : 'text-[40px] leading-none'} font-black text-[var(--color-text-primary)] tabular-nums tracking-[-3px]`}>
                            {ellScore}
                        </div>
                    </div>
                </div>

                {/* Malas label */}
                <div className="flex items-center px-6 mt-2 mb-1">
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

                {/* Spacer */}
                <div className="flex-1" />

                {/* Shortcut buttons */}
                <div className="w-full px-3 grid grid-cols-2 gap-3 pointer-events-auto z-30 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                    <div className="grid grid-cols-3 gap-1">
                        <ShortcutButton label="Envido" points={2} type="envido" teamId="nosotros" onAction={() => addPoints('nosotros', 2, 'envido')} />
                        <ShortcutButton label="Real Env" points={3} type="real_envido" teamId="nosotros" onAction={() => addPoints('nosotros', 3, 'real_envido')} />
                        <ShortcutButton
                            label="Falta"
                            points={ellScore < 15 ? 'MATCH' : `+${30 - ellScore}`}
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
                        <ShortcutButton label="Real Env" points={3} type="real_envido" teamId="ellos" onAction={() => addPoints('ellos', 3, 'real_envido')} />
                        <ShortcutButton
                            label="Falta"
                            points={nosScore < 15 ? 'MATCH' : `+${30 - nosScore}`}
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
