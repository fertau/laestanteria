import { useEffect, useState } from 'react';
import { useMatchStore } from '../store/useMatchStore';
import { usePicaPicaStore } from '../store/usePicaPicaStore';
import { ScoreBoard } from './ScoreBoard';
import { PicaPicaScoreBoard } from './PicaPicaScoreBoard';
import { HandIndicator } from './HandIndicator';
import { CerrarManoButton } from './CerrarManoButton';
import { PairingReorder } from './PairingReorder';
import { FaltaEnvidoModal } from './FaltaEnvidoModal';
import type { TeamId } from '../types';

interface MatchScreenProps {
    onFinish: () => void;
}

export const MatchScreen = ({ onFinish }: MatchScreenProps) => {
    const teams = useMatchStore(state => state.teams);
    const mode = useMatchStore(state => state.mode);
    const isFinished = useMatchStore(state => state.isFinished);
    const winner = useMatchStore(state => state.winner);
    const undo = useMatchStore(state => state.undo);
    const addPoints = useMatchStore(state => state.addPoints);
    const history = useMatchStore(state => state.history);

    // Pica-pica state
    const picaPicaActive = usePicaPicaStore(state => state.isActive);
    const currentHandNumber = usePicaPicaStore(state => state.currentHandNumber);
    const currentHandType = usePicaPicaStore(state => state.currentHandType);
    const currentHandHasPoints = usePicaPicaStore(state => state.currentHandHasPoints);
    const isFirstPicaPicaHand = usePicaPicaStore(state => state.isFirstPicaPicaHand);
    const trackRedondoPoints = usePicaPicaStore(state => state.trackRedondoPoints);
    const closeHand = usePicaPicaStore(state => state.closeHand);
    const startHand = usePicaPicaStore(state => state.startHand);
    const rotatePairings = usePicaPicaStore(state => state.rotatePairings);

    const is3v3 = mode === '3v3' && picaPicaActive;

    const [showFaltaModal, setShowFaltaModal] = useState(false);
    const [showManualScore, setShowManualScore] = useState(false);
    const [showPairingReorder, setShowPairingReorder] = useState(false);

    // Track redondo hand points via history changes
    const [lastHistoryLength, setLastHistoryLength] = useState(history.length);
    useEffect(() => {
        if (!is3v3 || currentHandType !== 'redondo') {
            setLastHistoryLength(history.length);
            return;
        }
        if (history.length > lastHistoryLength) {
            const lastAction = history[history.length - 1];
            if (lastAction && lastAction.type === 'ADD_POINTS') {
                trackRedondoPoints(lastAction.team, lastAction.amount);
            }
        }
        setLastHistoryLength(history.length);
    }, [history.length, is3v3, currentHandType]);

    // Show pairing reorder when first pica-pica hand starts
    useEffect(() => {
        if (is3v3 && currentHandType === 'picapica' && isFirstPicaPicaHand) {
            setShowPairingReorder(true);
        }
    }, [is3v3, currentHandType, isFirstPicaPicaHand]);

    const handleCerrarMano = () => {
        const { pointsNosotros, pointsEllos } = closeHand();

        // Flush pica-pica points to general score
        if (pointsNosotros > 0) {
            addPoints('nosotros', pointsNosotros, 'score_tap');
        }
        if (pointsEllos > 0) {
            addPoints('ellos', pointsEllos, 'score_tap');
        }

        // Check if match ended
        const matchState = useMatchStore.getState();
        if (!matchState.isFinished) {
            // Auto-rotate pairings if this was a pica-pica hand
            if (currentHandType === 'picapica') {
                rotatePairings();
            }
            startHand(matchState.teams.nosotros.score, matchState.teams.ellos.score);
        }
    };

    const handleUndo = () => {
        if (is3v3 && currentHandType === 'picapica') {
            // In pica-pica, undo the most recent action across all pairs
            const pairings = usePicaPicaStore.getState().currentPairings;
            let latestPairIndex = -1;
            let latestTimestamp = 0;
            pairings.forEach((p) => {
                if (p.history.length > 0) {
                    const lastAction = p.history[p.history.length - 1];
                    if (lastAction.timestamp > latestTimestamp) {
                        latestTimestamp = lastAction.timestamp;
                        latestPairIndex = p.pairIndex;
                    }
                }
            });
            if (latestPairIndex >= 0) {
                usePicaPicaStore.getState().undoPairAction(latestPairIndex);
            }
        } else {
            undo();
        }
    };

    const onRequestFaltaEnvido = () => {
        setShowFaltaModal(true);
    };

    const onFinishManualMatch = (scoreNos: number, scoreEll: number) => {
        const currentNos = teams.nosotros.score;
        const currentEll = teams.ellos.score;

        if (scoreNos > currentNos) addPoints('nosotros', scoreNos - currentNos, 'penalty');
        if (scoreEll > currentEll) addPoints('ellos', scoreEll - currentEll, 'penalty');

        setShowManualScore(false);
    };

    // Listen for custom event from ScoreBoard button
    useEffect(() => {
        const handler = () => onRequestFaltaEnvido();
        window.addEventListener('requestFaltaEnvido', handler);
        return () => window.removeEventListener('requestFaltaEnvido', handler);
    }, []);

    if (isFinished && winner) {
        return <WinnerCelebration winner={winner} teams={teams} onFinish={onFinish} />;
    }

    return (
        <div className="full-screen bg-[var(--color-bg)] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--color-border)] z-50">
                <button
                    onClick={handleUndo}
                    className="text-[var(--color-text-muted)] text-[10px] font-semibold uppercase tracking-[0.1em] px-3 py-2 rounded-md active:bg-[var(--color-surface)] transition-colors"
                >
                    Deshacer
                </button>

                <div className="text-[10px] font-black text-[var(--color-text-muted)] tracking-[0.3em] uppercase">Trucapp</div>

                <button
                    onClick={() => setShowManualScore(true)}
                    className="text-[var(--color-danger)] text-[10px] font-semibold uppercase tracking-[0.1em] px-3 py-2 rounded-md active:bg-[var(--color-surface)] transition-colors"
                >
                    Finalizar
                </button>
            </div>

            {/* Hand Indicator (3v3 only) */}
            {is3v3 && (
                <div className="border-b border-[var(--color-border)] flex items-center justify-between px-4">
                    <HandIndicator handNumber={currentHandNumber} handType={currentHandType} />
                    {currentHandType === 'picapica' && (
                        <button
                            onClick={() => setShowPairingReorder(true)}
                            className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-2 py-1 rounded border border-[var(--color-border)] active:bg-[var(--color-surface-hover)]"
                        >
                            Rotar
                        </button>
                    )}
                </div>
            )}

            {/* Score Area */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
                <div className="flex-1 relative overflow-hidden">
                    {is3v3 && currentHandType === 'picapica' ? (
                        <PicaPicaScoreBoard />
                    ) : (
                        <ScoreBoard />
                    )}
                </div>

                {/* Cerrar Mano Button (3v3 only) */}
                {is3v3 && (
                    <div className="px-4 pb-2">
                        <CerrarManoButton
                            visible={currentHandHasPoints}
                            onClose={handleCerrarMano}
                        />
                    </div>
                )}
            </div>

            {/* Modals */}
            {showFaltaModal && (
                <FaltaEnvidoModal onClose={() => setShowFaltaModal(false)} />
            )}
            {showManualScore && (
                <ManualScoreModal
                    nosotros={{ name: teams.nosotros.name, score: teams.nosotros.score }}
                    ellos={{ name: teams.ellos.name, score: teams.ellos.score }}
                    onClose={() => setShowManualScore(false)}
                    onConfirm={onFinishManualMatch}
                />
            )}
            {showPairingReorder && (
                <PairingReorder
                    onConfirm={() => {
                        setShowPairingReorder(false);
                        // Rebuild pairings with new order if we're in a pica-pica hand
                        if (currentHandType === 'picapica') {
                            const matchState = useMatchStore.getState();
                            startHand(matchState.teams.nosotros.score, matchState.teams.ellos.score);
                        }
                    }}
                />
            )}
        </div>
    );
};

const ManualScoreModal = ({ nosotros, ellos, onClose, onConfirm }: {
    nosotros: { name: string, score: number },
    ellos: { name: string, score: number },
    onClose: () => void,
    onConfirm: (nos: number, ell: number) => void
}) => {
    const [scoreNos, setScoreNos] = useState(nosotros.score);
    const [scoreEll, setScoreEll] = useState(ellos.score);
    const [location, setLocation] = useState(useMatchStore.getState().metadata?.location || '');
    const [date, setDate] = useState(() => {
        const d = useMatchStore.getState().metadata?.date || Date.now();
        return new Date(d).toISOString().split('T')[0];
    });

    const handleConfirm = () => {
        const selectedDate = new Date(date).getTime();
        useMatchStore.getState().setMetadata(location, selectedDate);
        onConfirm(scoreNos, scoreEll);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[var(--color-bg)]/95 flex flex-col items-center justify-center p-6 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 my-8">
                <h2 className="text-xl font-black mb-1 uppercase tracking-tighter">RESULTADO FINAL</h2>
                <p className="text-xs font-bold text-[var(--color-text-muted)] mb-6 uppercase tracking-widest">Ingreso manual detallado</p>

                <div className="flex flex-col gap-4 mb-8">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-[var(--color-nosotros)] tracking-widest">{nosotros.name}</label>
                            <input
                                type="number"
                                className="bg-[var(--color-bg)] border border-[var(--color-border)] p-3 rounded-xl text-2xl font-black w-full text-center tabular-nums focus:border-[var(--color-nosotros)] outline-none"
                                value={scoreNos}
                                onChange={(e) => setScoreNos(Number(e.target.value))}
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-[var(--color-ellos)] tracking-widest">{ellos.name}</label>
                            <input
                                type="number"
                                className="bg-[var(--color-bg)] border border-[var(--color-border)] p-3 rounded-xl text-2xl font-black w-full text-center tabular-nums focus:border-[var(--color-ellos)] outline-none"
                                value={scoreEll}
                                onChange={(e) => setScoreEll(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Ubicación (Sede)</label>
                        <input
                            type="text"
                            placeholder="Ej: Club Social"
                            className="bg-[var(--color-bg)] border border-[var(--color-border)] p-3 rounded-xl text-sm font-bold w-full focus:border-[var(--color-accent)] outline-none"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Fecha</label>
                        <input
                            type="date"
                            className="bg-[var(--color-bg)] border border-[var(--color-border)] p-3 rounded-xl text-sm font-bold w-full focus:border-[var(--color-accent)] outline-none"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleConfirm}
                        className="w-full bg-[var(--color-accent)] text-[var(--color-text-primary)] py-4 rounded-xl font-black text-lg shadow-xl active:scale-95 transition-all"
                    >
                        GUARDAR Y FINALIZAR
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full text-[var(--color-text-muted)] py-2 font-bold uppercase text-[10px] tracking-widest"
                    >
                        VOLVER
                    </button>
                </div>
            </div>
        </div>
    );
};

const WinnerCelebration = ({ winner, teams, onFinish }: { winner: TeamId, teams: any, onFinish: () => void }) => {
    const winnerData = teams[winner];
    const matchId = useMatchStore(state => state.id);

    const handleNewMatch = () => {
        onFinish();
    };

    const copyShareLink = () => {
        const url = `${window.location.origin}/?matchId=${matchId}`;
        navigator.clipboard.writeText(url);
        alert(`Link copiado: ${url}`);
    };

    return (
        <div className="full-screen bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden z-[100]">
            {/* Simple confetti background */}
            <div className="absolute inset-0 z-0 opacity-30">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            backgroundColor: i % 2 === 0 ? 'var(--color-nosotros)' : 'var(--color-ellos)',
                            animation: 'bounce 2s infinite',
                            animationDelay: `${Math.random() * 2}s`,
                        }}
                    ></div>
                ))}
            </div>

            <div className="z-10 flex flex-col items-center relative w-full max-w-sm">
                <div className="flex justify-between items-center w-full mb-6">
                    <div className="text-[12px] font-black uppercase tracking-[0.5em] text-[var(--color-text-muted)]">Partido Finalizado</div>
                    <button onClick={copyShareLink} className="text-[10px] font-bold uppercase tracking-widest p-2 bg-[var(--color-surface-hover)] rounded-full hover:bg-[var(--color-surface-hover)] active:scale-95 transition-all">
                        Compartir
                    </button>
                </div>

                <h1 className="text-6xl font-black text-center mb-10 italic tracking-tighter leading-none">
                    <span className={`text-[var(--color-${winner})] block mb-2`}>¡VICTORIA!</span>
                    <span className="text-[var(--color-text-primary)] uppercase break-words px-4 text-4xl">{winnerData.name}</span>
                </h1>

                <div className="flex items-center gap-6 mb-12 bg-[var(--color-surface)] py-6 px-10 rounded-3xl border border-[var(--color-border)]">
                    <div className="flex flex-col items-center flex-1 min-w-[100px]">
                        <span className="text-[8px] font-black uppercase text-[var(--color-nosotros)]/60 mb-2 truncate max-w-[80px]">{teams.nosotros.name}</span>
                        <span className="text-5xl font-black tabular-nums">{teams.nosotros.score}</span>
                    </div>
                    <div className="w-[1px] h-12 bg-[var(--color-surface-hover)]"></div>
                    <div className="flex flex-col items-center flex-1 min-w-[100px]">
                        <span className="text-[8px] font-black uppercase text-[var(--color-ellos)]/60 mb-2 truncate max-w-[80px]">{teams.ellos.name}</span>
                        <span className="text-5xl font-black tabular-nums">{teams.ellos.score}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full relative z-20">
                    <button
                        onClick={handleNewMatch}
                        className={`w-full bg-[var(--color-${winner})] text-black py-4 rounded-xl font-black text-xl shadow-lg active:scale-95 transition-transform`}
                    >
                        NUEVO PARTIDO
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="text-[var(--color-text-muted)] font-bold uppercase tracking-widest text-xs py-4 active:text-[var(--color-text-primary)] transition-colors"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        </div>
    );
};
