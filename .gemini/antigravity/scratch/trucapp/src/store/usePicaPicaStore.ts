import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TeamId, PointType, GameAction, HandType, PicaPicaScoringMode, PicaPicaPairing, HandRecord } from '../types';

const PICA_PICA_THRESHOLD = 5;

interface PicaPicaState {
    // Configuration (set at match start)
    isActive: boolean;
    scoringMode: PicaPicaScoringMode;
    playersNosotros: string[];
    playersEllos: string[];

    // Hand state
    currentHandNumber: number;
    currentHandType: HandType;
    currentHandHasPoints: boolean;

    // Pairings: indices into player arrays e.g. [[0,0],[1,1],[2,2]]
    pairingOrder: [number, number][];

    // Active pica-pica pair scores (only populated during pica-pica hands)
    currentPairings: PicaPicaPairing[];

    // History of closed hands
    closedHands: HandRecord[];

    // Track points added in current redondo hand (for closeHand accounting)
    redondoHandPointsNosotros: number;
    redondoHandPointsEllos: number;

    // Whether this is the first pica-pica hand (show pairing reorder)
    isFirstPicaPicaHand: boolean;

    // Actions
    setup: (config: {
        playersNosotros: string[];
        playersEllos: string[];
        scoringMode: PicaPicaScoringMode;
    }) => void;

    startHand: (generalScoreNos: number, generalScoreEll: number) => void;

    addPairPoints: (pairIndex: number, team: TeamId, amount: number, type: PointType) => void;
    undoPairAction: (pairIndex: number) => void;

    markPointsScored: () => void;
    trackRedondoPoints: (team: TeamId, amount: number) => void;

    closeHand: () => { pointsNosotros: number; pointsEllos: number };

    rotatePairings: () => void;
    setPairingOrder: (order: [number, number][]) => void;

    reset: () => void;
}

function computeHandType(
    closedHands: HandRecord[],
    generalScoreNos: number,
    generalScoreEll: number
): HandType {
    const maxScore = Math.max(generalScoreNos, generalScoreEll);
    if (maxScore < PICA_PICA_THRESHOLD) return 'redondo';

    // Find hands that were played in the pica-pica phase
    const handsInPhase = closedHands.filter(h =>
        h.type === 'picapica' || closedHands.indexOf(h) >= closedHands.findIndex(
            ch => ch.type === 'picapica' || ch.type === 'redondo'
        )
    );

    // If no hands closed yet in pica-pica phase, first is pica-pica
    if (handsInPhase.length === 0) return 'picapica';

    const lastHand = closedHands[closedHands.length - 1];
    if (!lastHand) return 'picapica';

    // Alternate: if last was redondo -> picapica, if last was picapica -> redondo
    return lastHand.type === 'redondo' ? 'picapica' : 'redondo';
}

function buildPairings(
    pairingOrder: [number, number][],
    playersNosotros: string[],
    playersEllos: string[]
): PicaPicaPairing[] {
    return pairingOrder.map(([nosIdx, ellIdx], i) => ({
        pairIndex: i,
        playerNosotrosId: playersNosotros[nosIdx],
        playerEllosId: playersEllos[ellIdx],
        scoreNosotros: 0,
        scoreEllos: 0,
        history: [],
    }));
}

export const usePicaPicaStore = create<PicaPicaState>()(
    persist(
        (set, get) => ({
            isActive: false,
            scoringMode: 'sumar_todos',
            playersNosotros: [],
            playersEllos: [],
            currentHandNumber: 1,
            currentHandType: 'redondo',
            currentHandHasPoints: false,
            pairingOrder: [[0, 0], [1, 1], [2, 2]],
            currentPairings: [],
            closedHands: [],
            redondoHandPointsNosotros: 0,
            redondoHandPointsEllos: 0,
            isFirstPicaPicaHand: true,

            setup: (config) => {
                set({
                    isActive: true,
                    scoringMode: config.scoringMode,
                    playersNosotros: config.playersNosotros,
                    playersEllos: config.playersEllos,
                    currentHandNumber: 1,
                    currentHandType: 'redondo', // First hand is always redondo (before 5 pts)
                    currentHandHasPoints: false,
                    pairingOrder: [[0, 0], [1, 1], [2, 2]],
                    currentPairings: [],
                    closedHands: [],
                    redondoHandPointsNosotros: 0,
                    redondoHandPointsEllos: 0,
                    isFirstPicaPicaHand: true,
                });
            },

            startHand: (generalScoreNos, generalScoreEll) => {
                const state = get();
                const handType = computeHandType(state.closedHands, generalScoreNos, generalScoreEll);
                const pairings = handType === 'picapica'
                    ? buildPairings(state.pairingOrder, state.playersNosotros, state.playersEllos)
                    : [];

                set({
                    currentHandNumber: state.closedHands.length + 1,
                    currentHandType: handType,
                    currentHandHasPoints: false,
                    currentPairings: pairings,
                    redondoHandPointsNosotros: 0,
                    redondoHandPointsEllos: 0,
                });
            },

            addPairPoints: (pairIndex, team, amount, type) => {
                set((state) => {
                    const newPairings = state.currentPairings.map(p => {
                        if (p.pairIndex !== pairIndex) return p;

                        const action: GameAction = {
                            id: crypto.randomUUID(),
                            timestamp: Date.now(),
                            type: 'ADD_POINTS',
                            team,
                            amount,
                            reason: type,
                        };

                        return {
                            ...p,
                            scoreNosotros: team === 'nosotros' ? p.scoreNosotros + amount : p.scoreNosotros,
                            scoreEllos: team === 'ellos' ? p.scoreEllos + amount : p.scoreEllos,
                            history: [...p.history, action],
                        };
                    });

                    return {
                        currentPairings: newPairings,
                        currentHandHasPoints: true,
                    };
                });
            },

            undoPairAction: (pairIndex) => {
                set((state) => {
                    const newPairings = state.currentPairings.map(p => {
                        if (p.pairIndex !== pairIndex) return p;
                        if (p.history.length === 0) return p;

                        const newHistory = [...p.history];
                        const lastAction = newHistory.pop()!;

                        return {
                            ...p,
                            scoreNosotros: lastAction.team === 'nosotros'
                                ? p.scoreNosotros - lastAction.amount
                                : p.scoreNosotros,
                            scoreEllos: lastAction.team === 'ellos'
                                ? p.scoreEllos - lastAction.amount
                                : p.scoreEllos,
                            history: newHistory,
                        };
                    });

                    // Check if any points remain across all pairings
                    const hasPoints = newPairings.some(p => p.history.length > 0);

                    return {
                        currentPairings: newPairings,
                        currentHandHasPoints: hasPoints,
                    };
                });
            },

            markPointsScored: () => {
                set({ currentHandHasPoints: true });
            },

            trackRedondoPoints: (team, amount) => {
                set((state) => ({
                    currentHandHasPoints: true,
                    redondoHandPointsNosotros: team === 'nosotros'
                        ? state.redondoHandPointsNosotros + amount
                        : state.redondoHandPointsNosotros,
                    redondoHandPointsEllos: team === 'ellos'
                        ? state.redondoHandPointsEllos + amount
                        : state.redondoHandPointsEllos,
                }));
            },

            closeHand: () => {
                const state = get();
                let pointsNosotros = 0;
                let pointsEllos = 0;

                if (state.currentHandType === 'picapica') {
                    if (state.scoringMode === 'sumar_todos') {
                        pointsNosotros = state.currentPairings.reduce((sum, p) => sum + p.scoreNosotros, 0);
                        pointsEllos = state.currentPairings.reduce((sum, p) => sum + p.scoreEllos, 0);
                    } else {
                        // sumar_diferencia
                        const netDelta = state.currentPairings.reduce(
                            (sum, p) => sum + (p.scoreNosotros - p.scoreEllos), 0
                        );
                        if (netDelta > 0) {
                            pointsNosotros = netDelta;
                        } else if (netDelta < 0) {
                            pointsEllos = Math.abs(netDelta);
                        }
                    }
                } else {
                    // Redondo: points already flushed to useMatchStore, just record
                    pointsNosotros = state.redondoHandPointsNosotros;
                    pointsEllos = state.redondoHandPointsEllos;
                }

                const handRecord: HandRecord = {
                    handNumber: state.currentHandNumber,
                    type: state.currentHandType,
                    pointsNosotros,
                    pointsEllos,
                    pairings: state.currentHandType === 'picapica'
                        ? [...state.currentPairings]
                        : undefined,
                };

                const wasPicaPica = state.currentHandType === 'picapica';

                set({
                    closedHands: [...state.closedHands, handRecord],
                    currentPairings: [],
                    currentHandHasPoints: false,
                    redondoHandPointsNosotros: 0,
                    redondoHandPointsEllos: 0,
                    isFirstPicaPicaHand: wasPicaPica ? false : state.isFirstPicaPicaHand,
                });

                // For redondo, points already went to matchStore, return 0
                if (state.currentHandType === 'redondo') {
                    return { pointsNosotros: 0, pointsEllos: 0 };
                }

                // For pica-pica, return points to flush to matchStore
                return { pointsNosotros, pointsEllos };
            },

            rotatePairings: () => {
                set((state) => {
                    const current = state.pairingOrder;
                    // Rotate ellos indices: [0,1,2] -> [1,2,0]
                    const newOrder: [number, number][] = current.map(([nosIdx], i) => {
                        const nextEllIdx = current[(i + 1) % current.length][1];
                        return [nosIdx, nextEllIdx];
                    });
                    return { pairingOrder: newOrder };
                });
            },

            setPairingOrder: (order) => {
                set({ pairingOrder: order });
            },

            reset: () => {
                set({
                    isActive: false,
                    scoringMode: 'sumar_todos',
                    playersNosotros: [],
                    playersEllos: [],
                    currentHandNumber: 1,
                    currentHandType: 'redondo',
                    currentHandHasPoints: false,
                    pairingOrder: [[0, 0], [1, 1], [2, 2]],
                    currentPairings: [],
                    closedHands: [],
                    redondoHandPointsNosotros: 0,
                    redondoHandPointsEllos: 0,
                    isFirstPicaPicaHand: true,
                });
            },
        }),
        { name: 'trucapp-pica-pica-v2' }
    )
);
