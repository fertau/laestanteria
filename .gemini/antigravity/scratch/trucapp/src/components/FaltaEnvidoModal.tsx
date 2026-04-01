import { useState } from 'react';
import { useMatchStore } from '../store/useMatchStore';
import type { TeamId } from '../types';

interface FaltaEnvidoModalProps {
    onClose: () => void;
}

export const FaltaEnvidoModal = ({ onClose }: FaltaEnvidoModalProps) => {
    const teams = useMatchStore(state => state.teams);
    const addPoints = useMatchStore(state => state.addPoints);
    const targetScore = useMatchStore(state => state.targetScore);

    // Logic:
    // "If opponent score is 0–14 → wins the match." -> means opponent needs exactly (Target - OpponentScore) points? No, User needs enough points to win.
    // Spec: "If opponent score is 0–14 → wins the match." -> The winner of the hand gets enough points to reach target.
    // Spec: "If opponent score is 15–29 → gains (30 - opponentScore) points." -> Wait, that's the Malas/Buenas logic.
    // Usually: 
    // Malas: Falta Envido = Win the Game (Points needed = Target - MyScore).
    // Buenas: Falta Envido = Points needed = Target - OpponentScore. 

    // Wireframe just says: "Sugerencia: Sumar X puntos". "Confirmar / Ajustar".
    // I need to implement the calculation logic.

    // Let's implement dynamic calculation per team.
    // Since we don't know WHO WON the Falta Envido yet, we need to show options or select team first?
    // Wireframe: "Score actual: ... Sugerencia: ..."
    // This implies a SINGLE suggestion relative to... whom?
    // Maybe the modal asks "Who won?". 
    // OR we show 2 suggestions: "If Nos won: X pts", "If Ell won: Y pts".

    // Let's assume user taps "Falta Envido" button -> Modal opens -> Select Winner -> Confirmation.
    // Wireframe Screen 6 notes: "[Confirmar] [Ajustar manualmente]".
    // This implies the points are already calculated.
    // But for whom?

    // I will modify the modal to have TABS or Columns for "Gana Nosotros" / "Gana Ellos"?
    // Or just a Team Selector at top.

    const [selectedTeam, setSelectedTeam] = useState<TeamId | null>(null);
    const [customPoints, setCustomPoints] = useState<string>('');
    const [isManual, setIsManual] = useState(false);

    const getPointsForTeam = (winnerTeam: TeamId, loserTeam: TeamId) => {
        const loserScore = teams[loserTeam].score;
        const isLoserInBuenas = loserScore >= (targetScore / 2); // 15

        if (isLoserInBuenas) {
            // "If opponent score is 15–29 → gains (30 - opponentScore) points."
            return targetScore - loserScore;
        } else {
            // "If opponent score is 0–14 → wins the match."
            // Winner needs (30 - WinnerScore) to reach 30?
            // "Wins the match" usually means they get all needed points.
            return targetScore - teams[winnerTeam].score;
        }
    };

    const calculatedPoints = selectedTeam
        ? getPointsForTeam(selectedTeam, selectedTeam === 'nosotros' ? 'ellos' : 'nosotros')
        : 0;

    const pointsToApply = isManual && customPoints ? parseInt(customPoints) : calculatedPoints;

    const handleConfirm = () => {
        if (!selectedTeam) return;
        addPoints(selectedTeam, pointsToApply, 'falta_envido');
        onClose();
    };

    if (!selectedTeam) {
        return (
            <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[200] p-6 animate-in fade-in duration-300 backdrop-blur-md">
                <h2 className="text-xl font-black mb-12 text-[var(--color-text-primary)] italic tracking-[0.2em]">¿QUIÉN GANÓ LA FALTA?</h2>
                <div className="flex gap-4 w-full max-w-sm">
                    <button
                        onClick={() => setSelectedTeam('nosotros')}
                        className="flex-1 bg-[var(--color-nosotros)] text-black py-8 rounded-3xl text-xl font-black shadow-2xl active:scale-95 transition-all truncate px-2"
                    >
                        {teams.nosotros.name.toUpperCase()}
                    </button>
                    <button
                        onClick={() => setSelectedTeam('ellos')}
                        className="flex-1 bg-[var(--color-ellos)] text-black py-8 rounded-3xl text-xl font-black shadow-2xl shadow-amber-900/40 active:scale-95 transition-all truncate px-2"
                    >
                        {teams.ellos.name.toUpperCase()}
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="mt-12 text-[var(--color-text-muted)] font-bold uppercase tracking-[0.2em] text-xs"
                >
                    Cancelar
                </button>
            </div>
        );
    }

    const opponent = selectedTeam === 'nosotros' ? teams.ellos : teams.nosotros;

    return (
        <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[200] p-6 animate-in slide-in-from-bottom duration-300 backdrop-blur-md">
            <h2 className="text-2xl font-black mb-8 text-[var(--color-text-primary)] tracking-[0.3em] italic">FALTA ENVIDO</h2>

            <div className="bg-[var(--color-surface)] p-6 rounded w-full mb-6 border border-[var(--color-border)]">
                <div className="flex justify-between mb-2 text-[var(--color-text-muted)] text-[10px] uppercase font-black tracking-widest">
                    <span className="truncate max-w-[120px]">{teams.nosotros.name}</span>
                    <span className="truncate max-w-[120px]">{teams.ellos.name}</span>
                </div>
                <div className="flex justify-between text-2xl font-bold">
                    <span className="text-[var(--color-text-primary)]">{teams.nosotros.score}</span>
                    <span className="text-[var(--color-text-primary)]">{teams.ellos.score}</span>
                </div>
            </div>

            <div className="text-center mb-8">
                <div className="text-[var(--color-text-muted)] text-[10px] mb-2 uppercase tracking-widest font-black">Sugerencia para {selectedTeam === 'nosotros' ? teams.nosotros.name : teams.ellos.name}</div>
                {isManual ? (
                    <input
                        type="number"
                        value={customPoints}
                        onChange={(e) => setCustomPoints(e.target.value)}
                        placeholder={calculatedPoints.toString()}
                        className="bg-transparent border-b-2 border-[var(--color-accent)] text-center text-6xl font-black text-[var(--color-text-primary)] w-32 focus:outline-none"
                        autoFocus
                    />
                ) : (
                    <div className="text-6xl font-black text-[var(--color-accent)]">
                        +{calculatedPoints}
                    </div>
                )}
                <div className="text-[var(--color-text-muted)] text-sm mt-2">
                    {opponent.score < 15 ? 'Malas (Gana partido)' : 'Buenas (Falta para 30)'}
                </div>
            </div>

            <button
                onClick={handleConfirm}
                className={`w-full bg-[var(--color-${selectedTeam})] text-[var(--color-text-primary)] py-4 rounded font-bold text-xl mb-4`}
            >
                CONFIRMAR
            </button>

            <button
                onClick={() => setIsManual(!isManual)}
                className="text-[var(--color-text-muted)] text-sm font-bold uppercase tracking-wider p-4"
            >
                {isManual ? 'Usar Automático' : 'Ajustar Manualmente'}
            </button>

            <button
                onClick={onClose}
                className="mt-4 text-[var(--color-text-muted)]"
            >
                Cancelar
            </button>
        </div>
    );
};
