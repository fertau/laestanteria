// Trucapp - Build Trigger edcb59c
import { useState, useEffect } from 'react';
import { MatchScreen } from './components/MatchScreen';
import { SplashScreen } from './components/SplashScreen';
import { PlayerSelection } from './components/PlayerSelection';
import { TeamConfiguration } from './components/TeamConfiguration';
import { HistoryScreen } from './components/HistoryScreen';
import { AccountSelector } from './components/AccountSelector';
import { HomeScreen } from './components/HomeScreen';
import { PicaPicaSetup } from './components/PicaPicaSetup';
import { PicaPicaHub } from './components/PicaPicaHub';
import { Leaderboard } from './components/Leaderboard';

import { useMatchStore } from './store/useMatchStore';
import { useHistoryStore } from './store/useHistoryStore';
import { useAuthStore } from './store/useAuthStore';
import { usePicaPicaStore } from './store/usePicaPicaStore';
import { usePairStore } from './store/usePairStore';
import { useUserStore } from './store/useUserStore';
import type { Player } from './types';
import './index.css';

// Updated Flow:
// 1. Account Selection (if no auth)
// 2. Home Screen
// 3. Setup Flow
// 4. Match OR PicaPica Setup -> Hub -> SubMatch
// 5. Returns to PicaHub -> Home

type AppStep = 'AUTH' | 'HOME' | 'SETUP_PLAYERS_COUNT' | 'SETUP_PLAYERS_SELECT' | 'SETUP_TEAMS' |
  'MATCH' | 'HISTORY' | 'LEADERBOARD' | 'SOCIAL' |
  'PICAPICA_SETUP' | 'PICAPICA_HUB';

import { SocialHub } from './components/SocialHub';

function App() {
  const currentUserId = useAuthStore(state => state.currentUserId);

  const [step, setStep] = useState<AppStep>(() => {
    const savedStep = localStorage.getItem('trucapp-app-step');
    if (savedStep === 'MATCH' && !useMatchStore.getState().id) return 'HOME';
    if (savedStep === 'STATS') return 'HOME'; // Migration: STATS is now part of HISTORY
    return (savedStep as AppStep) || 'HOME';
  });
  // ... 

  useEffect(() => {
    localStorage.setItem('trucapp-app-step', step);
  }, [step]);

  const [showSplash, setShowSplash] = useState(true); // Initial splash state

  const [playerCount, setPlayerCount] = useState<number>(2);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  // Teams for PicaPica setup
  const [teamsConfig, setTeamsConfig] = useState<{ nosotros: Player[], ellos: Player[] } | null>(null);

  const resetMatch = useMatchStore(state => state.resetMatch);
  const setPlayers = useMatchStore(state => state.setPlayers);
  const setTargetScore = useMatchStore(state => state.setTargetScore);
  const addMatchToHistory = useHistoryStore(state => state.addMatch);
  const fetchHistory = useHistoryStore(state => state.fetchMatches);

  // Migration: Removed auto-wipe to prevent data loss.
  // Old users without PINs can be handled gracefully or manually updated.

  // Load History and Players on Mount
  useEffect(() => {
    fetchHistory();
    useUserStore.getState().fetchPlayers();
  }, []);

  // Pica Pica
  const picaPicaActive = usePicaPicaStore(state => state.isActive);
  const picaPicaMatches = usePicaPicaStore(state => state.matches);
  const picaPicaUpdate = usePicaPicaStore(state => state.updateMatchResult);
  const picaPicaReset = usePicaPicaStore(state => state.reset);
  const [activeSubMatchId, setActiveSubMatchId] = useState<string | null>(null);

  const setMetadata = useMatchStore(state => state.setMetadata);
  const setPairId = useMatchStore(state => state.setPairId);
  const recordPairResult = usePairStore(state => state.recordMatchResult);
  const listenToMatch = useMatchStore(state => state.listenToMatch);

  // Cloud Sync: Check URL for matchId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedMatchId = params.get('matchId');
    if (sharedMatchId) {
      console.log("Found Shared Match ID:", sharedMatchId);
      listenToMatch(sharedMatchId);
      setStep('MATCH');
    }
  }, []);

  const startMatch = (
    teams: { nosotros: Player[], ellos: Player[] },
    metadata?: { location: string, date: number, teamNames?: { nosotros: string, ellos: string } },
    pairIds?: { nosotros?: string, ellos?: string },
    targetScore?: number
  ) => {
    if (playerCount === 6) {
      // Start PicaPica Flow
      setTeamsConfig(teams);
      setStep('PICAPICA_SETUP');
    } else {
      // Standard Match
      // Important: Reset match state FIRST, then set players/teams
      resetMatch(playerCount === 2 ? '1v1' : '2v2');

      // Set Custom Target Score if provided
      if (targetScore) {
        useMatchStore.getState().setTargetScore(targetScore);
      }

      const generateTeamName = (players: Player[]) => {
        if (players.length === 0) return 'Equipo';
        return players.map(p => p.name).join(' / ');
      };

      const nosotrosName = metadata?.teamNames?.nosotros || generateTeamName(teams.nosotros);
      const ellosName = metadata?.teamNames?.ellos || generateTeamName(teams.ellos);

      useMatchStore.getState().setTeamName('nosotros', nosotrosName);
      useMatchStore.getState().setTeamName('ellos', ellosName);

      setPlayers('nosotros', teams.nosotros.map(p => p.id));
      setPlayers('ellos', teams.ellos.map(p => p.id));

      if (metadata) {
        setMetadata(metadata.location, metadata.date);
      }

      if (pairIds) {
        if (pairIds.nosotros) setPairId('nosotros', pairIds.nosotros);
        if (pairIds.ellos) setPairId('ellos', pairIds.ellos);
      }

      setStep('MATCH');
    }
  };

  // Splash Screen Logic
  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('trucapp-splash-seen');
    if (hasSeenSplash) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashFinish = () => {
    sessionStorage.setItem('trucapp-splash-seen', 'true');
    setShowSplash(false);
  };

  const handleFinishMatch = () => {
    const matchState = useMatchStore.getState();

    // Always save history for standard matches too!
    if (!activeSubMatchId) {
      addMatchToHistory(matchState);
    }

    if (activeSubMatchId && picaPicaActive) {
      // It was a submatch
      if (matchState.winner) {
        picaPicaUpdate(activeSubMatchId, matchState.winner, matchState.teams.nosotros.score, matchState.teams.ellos.score);
        // Sync submatch to cloud history for rankings
        addMatchToHistory(matchState);
      }
      setActiveSubMatchId(null);
      setStep('PICAPICA_HUB');
    } else {
      // Standard Match
      // V2: Record Pair Results
      if (matchState.pairs) {
        if (matchState.pairs.nosotros && matchState.winner) {
          recordPairResult(matchState.pairs.nosotros, matchState.winner === 'nosotros');
        }
        if (matchState.pairs.ellos && matchState.winner) {
          recordPairResult(matchState.pairs.ellos, matchState.winner === 'ellos');
        }
      }

      setStep('HOME');
    }
  };

  // Splash Screen
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // Auth Guard
  useEffect(() => {
    if (!currentUserId && (step !== 'AUTH' && step !== 'HOME')) {
      setStep('AUTH');
    }
  }, [currentUserId, step]);

  if (!currentUserId) {
    return <AccountSelector onLoginSuccess={() => setStep('HOME')} />;
  }

  if (step === 'MATCH') {
    return <MatchScreen onFinish={handleFinishMatch} />;
  }

  if (step === 'HISTORY') {
    return <HistoryScreen onBack={() => setStep('HOME')} />;
  }

  if (step === 'LEADERBOARD') {
    return <Leaderboard onBack={() => setStep('HOME')} />;
  }

  if (step === 'SOCIAL') {
    return <SocialHub onBack={() => setStep('HOME')} />;
  }

  if (step === 'SETUP_TEAMS') {
    return <TeamConfiguration players={selectedPlayers} onStartMatch={startMatch} />;
  }

  if (step === 'PICAPICA_SETUP' && teamsConfig) {
    return (
      <PicaPicaSetup
        nosotros={teamsConfig.nosotros}
        ellos={teamsConfig.ellos}
        onStart={() => setStep('PICAPICA_HUB')}
      />
    );
  }

  if (step === 'PICAPICA_HUB') {
    return (
      <PicaPicaHub
        onPlayMatch={(id) => {
          setActiveSubMatchId(id);
          const subMatch = picaPicaMatches.find(m => m.id === id);
          if (subMatch) {
            // Init ScoreBoard for this match
            const target = usePicaPicaStore.getState().targetScore;

            resetMatch('1v1');
            setTargetScore(target);

            setPlayers('nosotros', [subMatch.playerNosotrosId]);
            setPlayers('ellos', [subMatch.playerEllosId]);
            setStep('MATCH');
          }
        }}
        onFinishPicaPica={() => {
          picaPicaReset();
          setStep('HOME');
        }}
      />
    );
  }

  if (step === 'SETUP_PLAYERS_SELECT') {
    return (
      <PlayerSelection
        requiredCount={playerCount}
        onSelect={(players) => {
          setSelectedPlayers(players);
          setStep('SETUP_TEAMS');
        }}
      />
    );
  }

  if (step === 'SETUP_PLAYERS_COUNT') {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg)] p-8 justify-center items-center relative">
        <h2 className="text-2xl font-bold mb-8">¿Cuántos juegan?</h2>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => { setPlayerCount(2); setStep('SETUP_PLAYERS_SELECT'); }}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-lg font-bold text-xl hover:bg-[var(--color-surface-hover)] transition-colors text-center"
          >
            2 jugadores (1v1)
          </button>
          <button
            onClick={() => { setPlayerCount(4); setStep('SETUP_PLAYERS_SELECT'); }}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-lg font-bold text-xl hover:bg-[var(--color-surface-hover)] transition-colors text-center"
          >
            4 jugadores (2v2)
          </button>
          <button
            onClick={() => { setPlayerCount(6); setStep('SETUP_PLAYERS_SELECT'); }}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-lg font-bold text-xl hover:bg-[var(--color-surface-hover)] transition-colors text-center"
          >
            6 jugadores (3v3 Pica-Pica)
          </button>

          <button
            onClick={() => setStep('HOME')}
            className="mt-8 text-[var(--color-text-muted)]"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // default: HOME
  return (
    <HomeScreen
      onNewMatch={() => setStep('SETUP_PLAYERS_COUNT')}
      onHistory={() => setStep('HISTORY')}
      onLeaderboard={() => setStep('LEADERBOARD')}
      onSocial={() => setStep('SOCIAL')}
    />
  );
}

export default App;
