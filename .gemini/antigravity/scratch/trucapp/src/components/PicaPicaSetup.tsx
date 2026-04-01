import { useState } from 'react';
import { usePicaPicaStore } from '../store/usePicaPicaStore';
import { useMatchStore } from '../store/useMatchStore';
import type { Player, PicaPicaScoringMode } from '../types';

interface PicaPicaSetupProps {
    nosotros: Player[];
    ellos: Player[];
    onStart: () => void;
}

export const PicaPicaSetup = ({ nosotros, ellos, onStart }: PicaPicaSetupProps) => {
    const setup = usePicaPicaStore(state => state.setup);
    const startHand = usePicaPicaStore(state => state.startHand);
    const resetMatch = useMatchStore(state => state.resetMatch);
    const setTargetScoreStore = useMatchStore(state => state.setTargetScore);
    const setPlayers = useMatchStore(state => state.setPlayers);
    const setPicaPicaScoringMode = useMatchStore(state => state.setPicaPicaScoringMode);

    const [targetScore, setTargetScore] = useState(25);
    const [scoringMode, setScoringMode] = useState<PicaPicaScoringMode>('sumar_todos');

    const handleStart = () => {
        // Setup pica-pica store
        setup({
            playersNosotros: nosotros.map(p => p.id),
            playersEllos: ellos.map(p => p.id),
            scoringMode,
        });

        // Setup match store
        resetMatch('3v3');
        setTargetScoreStore(targetScore);
        setPicaPicaScoringMode(scoringMode);

        const generateTeamName = (players: Player[]) =>
            players.map(p => p.name).join(' / ');

        useMatchStore.getState().setTeamName('nosotros', generateTeamName(nosotros));
        useMatchStore.getState().setTeamName('ellos', generateTeamName(ellos));
        setPlayers('nosotros', nosotros.map(p => p.id));
        setPlayers('ellos', ellos.map(p => p.id));

        // Start first hand (scores are 0,0 so it'll be redondo)
        startHand(0, 0);

        onStart();
    };

    return (
        <div className="full-screen bg-[var(--color-bg)] flex flex-col p-6">
            <h2 className="text-2xl font-black mb-8 tracking-tighter text-center">PICA-PICA</h2>

            {/* Target Score */}
            <div className="bg-[var(--color-surface)] p-6 rounded border border-[var(--color-border)] mb-4">
                <label className="block text-[var(--color-text-muted)] text-sm font-bold uppercase mb-2">Objetivo (Puntos)</label>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setTargetScore(Math.max(15, targetScore - 5))}
                        className="w-12 h-12 rounded bg-[var(--color-surface-hover)] font-bold text-xl"
                    >
                        -
                    </button>
                    <div className="flex-1 text-center text-4xl font-black text-[var(--color-text-primary)]">
                        {targetScore}
                    </div>
                    <button
                        onClick={() => setTargetScore(Math.min(30, targetScore + 5))}
                        className="w-12 h-12 rounded bg-[var(--color-surface-hover)] font-bold text-xl"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* Scoring Mode */}
            <div className="bg-[var(--color-surface)] p-4 rounded border border-[var(--color-border)] mb-6">
                <label className="block text-[var(--color-text-muted)] text-sm font-bold uppercase mb-3">Modo de puntaje (Pica-Pica)</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setScoringMode('sumar_todos')}
                        className={`p-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${
                            scoringMode === 'sumar_todos'
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                        }`}
                    >
                        <div className="font-black text-sm mb-1">Sumar todos</div>
                        <div className="text-[9px] opacity-70 normal-case">Cada equipo suma todos los puntos de los 3 pica-pica</div>
                    </button>
                    <button
                        onClick={() => setScoringMode('sumar_diferencia')}
                        className={`p-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${
                            scoringMode === 'sumar_diferencia'
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                        }`}
                    >
                        <div className="font-black text-sm mb-1">Sumar diferencia</div>
                        <div className="text-[9px] opacity-70 normal-case">Solo se suma la diferencia neta al equipo ganador</div>
                    </button>
                </div>
            </div>

            {/* Pairings Preview */}
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-3 tracking-wider">Emparejamientos iniciales</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] mb-3">Se pueden cambiar antes de cada mano pica-pica</p>

            <div className="flex flex-col gap-2 mb-8 flex-1 overflow-y-auto">
                {nosotros.map((p, i) => (
                    <div key={p.id} className="flex justify-between items-center p-4 bg-[var(--color-surface)] rounded border border-[var(--color-border)]">
                        <div className="font-bold text-[var(--color-nosotros)]">{p.name}</div>
                        <div className="text-[var(--color-text-muted)] text-xs font-bold">VS</div>
                        <div className="font-bold text-[var(--color-ellos)]">{ellos[i]?.name}</div>
                    </div>
                ))}
            </div>

            <button
                onClick={handleStart}
                className="w-full bg-[var(--color-accent)] text-[var(--color-text-primary)] py-4 rounded font-bold text-xl shadow-lg active:scale-95 transition-all"
            >
                Empezar Pica-Pica
            </button>
        </div>
    );
};
