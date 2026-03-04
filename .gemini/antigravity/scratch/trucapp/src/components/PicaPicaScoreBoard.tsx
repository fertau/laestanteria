import { useState, useEffect, useCallback } from 'react';
import { usePicaPicaStore } from '../store/usePicaPicaStore';
import { useMatchStore } from '../store/useMatchStore';
import { useUserStore } from '../store/useUserStore';
import { CompactShortcutButton } from './ShortcutButton';
import type { TeamId, PointType } from '../types';

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

const PairMiniBoard = ({ pairIndex }: { pairIndex: number }) => {
    const pairing = usePicaPicaStore(state => state.currentPairings[pairIndex]);
    const addPairPoints = usePicaPicaStore(state => state.addPairPoints);
    const undoPairAction = usePicaPicaStore(state => state.undoPairAction);
    const players = useUserStore(state => state.players);

    const [longPressTriggered, setLongPressTriggered] = useState<{ nosotros: boolean; ellos: boolean }>({ nosotros: false, ellos: false });

    const handleLongPress = useCallback((team: TeamId) => {
        if (navigator.vibrate) navigator.vibrate(50);
        setLongPressTriggered(prev => ({ ...prev, [team]: true }));
        undoPairAction(pairIndex);
    }, [pairIndex, undoPairAction]);

    const longPressNos = useLongPress(() => handleLongPress('nosotros'), 800);
    const longPressEll = useLongPress(() => handleLongPress('ellos'), 800);

    if (!pairing) return null;

    const nosPlayer = players.find(p => p.id === pairing.playerNosotrosId);
    const ellPlayer = players.find(p => p.id === pairing.playerEllosId);
    const nosName = nosPlayer?.nickname || nosPlayer?.name || '?';
    const ellName = ellPlayer?.nickname || ellPlayer?.name || '?';

    const handleTap = (team: TeamId) => {
        if (!longPressTriggered[team]) {
            addPairPoints(pairIndex, team, 1, 'score_tap');
        }
        setTimeout(() => setLongPressTriggered(prev => ({ ...prev, [team]: false })), 100);
    };

    const handleAddPoints = (team: TeamId, amount: number, type: PointType) => {
        addPairPoints(pairIndex, team, amount, type);
    };

    return (
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface)]">
            {/* Pair header + scores */}
            <div className="flex items-stretch">
                {/* Nosotros side */}
                <button
                    className="flex-1 flex flex-col items-center py-2 px-2 active:bg-[var(--color-nosotros)]/10 transition-colors"
                    onClick={() => handleTap('nosotros')}
                    {...longPressNos}
                >
                    <span className="text-[10px] font-bold text-[var(--color-nosotros)] truncate max-w-full">{nosName}</span>
                    <span className="text-2xl font-black text-[var(--color-nosotros)] tabular-nums">{pairing.scoreNosotros}</span>
                </button>

                {/* Divider + VS */}
                <div className="w-[1px] bg-[var(--color-border)] relative flex items-center justify-center">
                    <span className="absolute bg-[var(--color-surface)] px-1 text-[8px] font-bold text-[var(--color-text-muted)]">VS</span>
                </div>

                {/* Ellos side */}
                <button
                    className="flex-1 flex flex-col items-center py-2 px-2 active:bg-[var(--color-ellos)]/10 transition-colors"
                    onClick={() => handleTap('ellos')}
                    {...longPressEll}
                >
                    <span className="text-[10px] font-bold text-[var(--color-ellos)] truncate max-w-full">{ellName}</span>
                    <span className="text-2xl font-black text-[var(--color-ellos)] tabular-nums">{pairing.scoreEllos}</span>
                </button>
            </div>

            {/* Compact scoring buttons */}
            <div className="grid grid-cols-2 gap-1 p-1 border-t border-[var(--color-border)]">
                {/* Nosotros buttons */}
                <div className="grid grid-cols-3 gap-0.5">
                    <CompactShortcutButton label="Env" points={2} teamId="nosotros" onAction={() => handleAddPoints('nosotros', 2, 'envido')} />
                    <CompactShortcutButton label="RE" points={3} teamId="nosotros" onAction={() => handleAddPoints('nosotros', 3, 'real_envido')} />
                    <CompactShortcutButton label="Tru" points={2} teamId="nosotros" onAction={() => handleAddPoints('nosotros', 2, 'truco')} />
                </div>
                {/* Ellos buttons */}
                <div className="grid grid-cols-3 gap-0.5">
                    <CompactShortcutButton label="Env" points={2} teamId="ellos" onAction={() => handleAddPoints('ellos', 2, 'envido')} />
                    <CompactShortcutButton label="RE" points={3} teamId="ellos" onAction={() => handleAddPoints('ellos', 3, 'real_envido')} />
                    <CompactShortcutButton label="Tru" points={2} teamId="ellos" onAction={() => handleAddPoints('ellos', 2, 'truco')} />
                </div>
            </div>
        </div>
    );
};

export const PicaPicaScoreBoard = () => {
    const currentPairings = usePicaPicaStore(state => state.currentPairings);
    const teams = useMatchStore(state => state.teams);

    return (
        <div className="flex flex-col w-full h-full bg-[var(--color-bg)] overflow-hidden select-none">
            {/* General score header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
                <div className="flex flex-col items-center flex-1">
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{teams.nosotros.name}</span>
                    <span className="text-xl font-black text-[var(--color-nosotros)] tabular-nums">{teams.nosotros.score}</span>
                </div>
                <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-2">
                    General
                </div>
                <div className="flex flex-col items-center flex-1">
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{teams.ellos.name}</span>
                    <span className="text-xl font-black text-[var(--color-ellos)] tabular-nums">{teams.ellos.score}</span>
                </div>
            </div>

            {/* 3 mini-scoreboards */}
            <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto">
                {currentPairings.map((_, idx) => (
                    <PairMiniBoard key={idx} pairIndex={idx} />
                ))}
            </div>
        </div>
    );
};
