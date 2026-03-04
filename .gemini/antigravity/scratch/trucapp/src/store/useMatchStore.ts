import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { MatchState, TeamId, PointType, GameAction, PicaPicaScoringMode } from '../types';

interface MatchStore extends MatchState {
    // Actions
    addPoints: (team: TeamId, amount: number, type: PointType) => void;
    subtractPoints: (team: TeamId, amount: number) => void;
    undo: () => void;
    resetMatch: (mode?: '1v1' | '2v2' | '3v3') => void;
    setTeamName: (team: TeamId, name: string) => void;
    setPlayers: (team: TeamId, playerIds: string[]) => void;
    setTargetScore: (score: number) => void;

    // V2 Actions
    setMetadata: (location: string, date?: number) => void;
    setPairId: (team: TeamId, pairId: string) => void;

    // V3 Pica-pica
    setPicaPicaScoringMode: (mode: PicaPicaScoringMode | null) => void;

    // Cloud Persistence
    isCloudSynced: boolean;
    unsubscribe: (() => void) | null;
    listenToMatch: (matchId: string) => void;
    stopListening: () => void;
}

const INITIAL_STATE: Omit<MatchState, 'id' | 'startDate'> = {
    mode: '2v2',
    targetScore: 30,
    teams: {
        nosotros: { id: 'nosotros', name: 'Equipo 1', players: [], score: 0 },
        ellos: { id: 'ellos', name: 'Equipo 2', players: [], score: 0 },
    },
    history: [],
    isFinished: false,
};

// Helper to extract only data from the store for persistence
const getMatchData = (state: MatchStore) => ({
    id: state.id,
    startDate: state.startDate,
    mode: state.mode,
    targetScore: state.targetScore,
    teams: state.teams,
    history: state.history,
    isFinished: state.isFinished,
    winner: state.winner ?? null,
    metadata: state.metadata ?? null,
    pairs: state.pairs ?? null,
    picaPicaScoringMode: state.picaPicaScoringMode ?? null
});

export const useMatchStore = create<MatchStore>()(
    persist(
        (set, get) => ({
            id: crypto.randomUUID(),
            startDate: Date.now(),
            ...INITIAL_STATE,
            isCloudSynced: false,
            unsubscribe: null,

            listenToMatch: (matchId) => {
                // Cleanup previous listener if any
                const prevUnsub = get().unsubscribe;
                if (prevUnsub) prevUnsub();

                console.log('Listening to match:', matchId);

                const unsub = onSnapshot(doc(db, 'matches', matchId), (doc) => {
                    if (doc.exists()) {
                        const data = doc.data() as MatchState;
                        const currentState = get();

                        // Basic validation
                        if (!data.teams || !data.teams.nosotros) return;

                        // ONLY update if:
                        // 1. Cloud history is longer (more actions occurred)
                        // 2. Or if we don't have this match loaded locally yet (id mismatch)
                        // 3. Or if cloud history is the same length but content might differ (e.g. sync repair)
                        //    but we prioritize local history length to avoid "jumping back"

                        const isNewer = (data.history?.length || 0) > (currentState.history?.length || 0);
                        const isDifferentMatch = currentState.id !== matchId;

                        if (isNewer || isDifferentMatch) {
                            console.log('Syncing from cloud (data is newer or different match)');
                            set({
                                ...data,
                                isCloudSynced: true,
                            });
                        } else {
                            // If history is same length, we could still update if there are specific changes (like names)
                            // But for scores, history length is the primary driver.
                            // Let's at least update metadata/names if they changed?
                            // Actually, simpler is better for now: only overwrite if cloud is ahead.
                            if (JSON.stringify(data.teams.nosotros.name) !== JSON.stringify(currentState.teams.nosotros.name) ||
                                JSON.stringify(data.teams.ellos.name) !== JSON.stringify(currentState.teams.ellos.name)) {
                                set({
                                    teams: data.teams,
                                    isCloudSynced: true
                                });
                            }
                        }
                    } else {
                        console.log('Match document does not exist (yet)');
                    }
                }, (error) => {
                    console.error("onSnapshot error:", error);
                });

                set({ unsubscribe: unsub, id: matchId, isCloudSynced: true });
            },

            stopListening: () => {
                const unsub = get().unsubscribe;
                if (unsub) unsub();
                set({ unsubscribe: null, isCloudSynced: false });
            },

            addPoints: (teamId, amount, type) => {
                set((state) => {
                    if (state.isFinished) return state;

                    // Create Action
                    const action: GameAction = {
                        id: crypto.randomUUID(),
                        timestamp: Date.now(),
                        type: 'ADD_POINTS',
                        team: teamId,
                        amount,
                        reason: type
                    };

                    const newHistory = [...state.history, action];
                    const currentScore = state.teams[teamId].score;
                    let newScore = currentScore + amount;
                    const isWin = newScore >= state.targetScore;
                    if (isWin) newScore = state.targetScore;

                    const newTeams = {
                        ...state.teams,
                        [teamId]: { ...state.teams[teamId], score: newScore }
                    };

                    const newState = {
                        teams: newTeams,
                        history: newHistory,
                        isFinished: isWin,
                        winner: isWin ? teamId : null
                    };

                    // Cloud Write
                    if (state.isCloudSynced) {
                        updateDoc(doc(db, 'matches', state.id), newState).catch(err => console.error("Cloud update failed", err));
                    } else {
                        // First write -> Create doc to start syncing? 
                        // For now we assume listeners are set up explicitly, 
                        // but let's auto-create if we are in "Cloud Mode" intended.
                        // Actually, let's just write if we have an ID.
                        const matchData = getMatchData(state);
                        setDoc(doc(db, 'matches', state.id), {
                            ...matchData,
                            ...newState, // Apply updates
                        }, { merge: true }).catch(err => console.error("Cloud init failed", err));
                    }

                    return newState;
                });
            },

            subtractPoints: (teamId, amount) => {
                set((state) => {
                    if (state.isFinished) return state;
                    if (state.teams[teamId].score < amount) return state;

                    const currentScore = state.teams[teamId].score;
                    const newScore = currentScore - amount;

                    const newTeams = {
                        ...state.teams,
                        [teamId]: { ...state.teams[teamId], score: newScore }
                    };

                    const newState = { teams: newTeams };

                    // Cloud Write
                    if (state.id) {
                        updateDoc(doc(db, 'matches', state.id), newState).catch(() => {
                            // If doc doesn't exist, create it (optimistic)
                            const matchData = getMatchData(state);
                            setDoc(doc(db, 'matches', state.id), { ...matchData, ...newState }, { merge: true });
                        });
                    }

                    return newState;
                });
            },

            undo: () => set((state) => {
                if (state.history.length === 0) return state;

                const newHistory = [...state.history];
                const lastAction = newHistory.pop();

                if (!lastAction || lastAction.type !== 'ADD_POINTS') return { history: newHistory };

                const teamId = lastAction.team;
                const currentScore = state.teams[teamId].score;
                const newScore = currentScore - lastAction.amount;

                const newTeams = {
                    ...state.teams,
                    [teamId]: { ...state.teams[teamId], score: newScore }
                };

                const newState = {
                    history: newHistory,
                    teams: newTeams,
                    isFinished: false,
                    winner: null
                };

                // Cloud Write
                if (state.id) {
                    updateDoc(doc(db, 'matches', state.id), newState).catch(console.error);
                }

                return newState;
            }),

            resetMatch: (mode = '2v2') => {
                // Stop listening to old match if we are resetting fully?
                // Usually reset means NEW match.
                get().stopListening();

                const newId = crypto.randomUUID();

                set({
                    id: newId,
                    startDate: Date.now(),
                    ...INITIAL_STATE,
                    mode,
                    winner: null, // Ensure reset
                    isFinished: false,
                    isCloudSynced: false // Start local until shared/synced
                });
            },

            setTeamName: (team, name) => set((state) => {
                const newTeams = {
                    ...state.teams,
                    [team]: { ...state.teams[team], name }
                };
                const newState = { teams: newTeams };

                if (state.id) {
                    const matchData = getMatchData(state);
                    setDoc(doc(db, 'matches', state.id), { ...matchData, ...newState }, { merge: true });
                }

                return newState;
            }),

            setPlayers: (team, playerIds) => set((state) => ({
                teams: {
                    ...state.teams,
                    [team]: { ...state.teams[team], players: playerIds.map(id => ({ id } as any)) } // Simplified for store
                }
            })),

            setTargetScore: (score) => set({ targetScore: score }),

            setMetadata: (location, date) => set({ metadata: { location, date } }),

            setPairId: (team, pairId) => set((state) => ({
                pairs: { ...state.pairs, [team]: pairId }
            })),

            setPicaPicaScoringMode: (mode) => set({ picaPicaScoringMode: mode })
        }),
        {
            name: 'trucapp-match-storage-v1', // unique name
            partialize: (state) => ({
                id: state.id,
                mode: state.mode,
                targetScore: state.targetScore,
                teams: state.teams,
                history: state.history,
                isFinished: state.isFinished,
                winner: state.winner,
                metadata: state.metadata,
                pairs: state.pairs,
                picaPicaScoringMode: state.picaPicaScoringMode
            })
        }
    )
);
