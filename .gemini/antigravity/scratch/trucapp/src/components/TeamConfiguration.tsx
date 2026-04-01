import { useState, useEffect } from 'react';
import { usePairStore } from '../store/usePairStore';
import type { Player, TeamId } from '../types';

interface TeamConfigurationProps {
    players: Player[];
    onStartMatch: (
        teams: { nosotros: Player[], ellos: Player[] },
        metadata: { location: string, date: number, teamNames?: { nosotros: string, ellos: string } },
        pairIds: { nosotros?: string, ellos?: string },
        targetScore?: number
    ) => void;
}

export const TeamConfiguration = ({ players, onStartMatch }: TeamConfigurationProps) => {
    // We use a pool for unassigned players
    const [pool, setPool] = useState<Player[]>([]);
    const [nosotros, setNosotros] = useState<Player[]>([]);
    const [ellos, setEllos] = useState<Player[]>([]);
    const [targetScore, setTargetScore] = useState<number>(30);

    const [location, setLocation] = useState('');
    const [customDate, setCustomDate] = useState<string>(new Date().toISOString().slice(0, 10));

    const { getOrCreatePair, updatePairName } = usePairStore();
    const [nosotrosPairName, setNosotrosPairName] = useState('');
    const [ellosPairName, setEllosPairName] = useState('');
    const [isEditingNosotrosPair, setIsEditingNosotrosPair] = useState(false);
    const [isEditingEllosPair, setIsEditingEllosPair] = useState(false);
    const [nosotrosTeamName, setNosotrosTeamName] = useState('Equipo 1');
    const [ellosTeamName, setEllosTeamName] = useState('Equipo 2');
    const [isEditingNosotrosTeam, setIsEditingNosotrosTeam] = useState(false);
    const [isEditingEllosTeam, setIsEditingEllosTeam] = useState(false);

    // Initial load: Everything in Pool
    useEffect(() => {
        setPool(players);
        setNosotros([]);
        setEllos([]);
    }, [players]);

    // Names Sync Logic
    useEffect(() => {
        // Auto-update team name if it's 1v1
        if (nosotros.length === 1 && !isEditingNosotrosTeam) {
            setNosotrosTeamName(nosotros[0].name);
        }
        if (ellos.length === 1 && !isEditingEllosTeam) {
            setEllosTeamName(ellos[0].name);
        }

        // Pairs sync for 2v2
        if (nosotros.length === 2) {
            const pair = getOrCreatePair([nosotros[0].id, nosotros[1].id] as [string, string], `${nosotros[0].name} + ${nosotros[1].name}`);
            setNosotrosPairName(pair.name);
            if (!isEditingNosotrosTeam) setNosotrosTeamName(pair.name);
        }
        if (ellos.length === 2) {
            const pair = getOrCreatePair([ellos[0].id, ellos[1].id] as [string, string], `${ellos[0].name} + ${ellos[1].name}`);
            setEllosPairName(pair.name);
            if (!isEditingEllosTeam) setEllosTeamName(pair.name);
        }
    }, [nosotros, ellos, getOrCreatePair, isEditingNosotrosTeam, isEditingEllosTeam]);

    const handlePairNameSave = (team: TeamId, name: string) => {
        if (team === 'nosotros' && nosotros.length === 2) {
            const pair = getOrCreatePair([nosotros[0].id, nosotros[1].id] as [string, string]);
            updatePairName(pair.id, name);
            setIsEditingNosotrosPair(false);
        }
        if (team === 'ellos' && ellos.length === 2) {
            const pair = getOrCreatePair([ellos[0].id, ellos[1].id] as [string, string]);
            updatePairName(pair.id, name);
            setIsEditingEllosPair(false);
        }
    };

    const getLimit = () => {
        if (players.length <= 2) return 1;
        if (players.length <= 4) return 2;
        return 3;
    };

    const moveToTeam = (player: Player, from: 'pool' | TeamId, to: 'pool' | TeamId) => {
        if (from === to) return;

        // Check limits if moving to a team
        if (to !== 'pool') {
            const targetTeam = to === 'nosotros' ? nosotros : ellos;
            if (targetTeam.length >= getLimit()) {
                // Return to pool if target is full
                return;
            }
        }

        // Remove from source
        if (from === 'pool') setPool(prev => prev.filter(p => p.id !== player.id));
        else if (from === 'nosotros') setNosotros(prev => prev.filter(p => p.id !== player.id));
        else setEllos(prev => prev.filter(p => p.id !== player.id));

        // Add to target
        if (to === 'pool') setPool(prev => [...prev, player]);
        else if (to === 'nosotros') setNosotros(prev => [...prev, player]);
        else setEllos(prev => [...prev, player]);
    };

    const randomize = () => {
        const all = [...players];
        for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [all[i], all[j]] = [all[j], all[i]];
        }
        const limit = getLimit();
        setNosotros(all.slice(0, limit));
        setEllos(all.slice(limit, limit * 2));
        const assignedIds = new Set([...all.slice(0, limit * 2)].map(p => p.id));
        setPool(all.filter(p => !assignedIds.has(p.id)));
    };

    const limit = getLimit();
    const isValid = nosotros.length === limit && ellos.length === limit;
    const is2v2 = limit === 2;

    // Drag & Drop Handlers
    const [draggedPlayer, setDraggedPlayer] = useState<{ p: Player, from: 'pool' | TeamId } | null>(null);

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg)] p-6 overflow-y-auto">
            <h2 className="text-2xl font-black mb-1 uppercase italic tracking-tighter text-center">ARMAR EQUIPOS</h2>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] text-center mb-8 uppercase tracking-[0.2em]">Arrastrar para asignar</p>

            {/* POOL SECTION */}
            <div
                className={`p-6 rounded-3xl border-2 border-dashed mb-10 transition-colors ${draggedPlayer ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'border-[var(--color-border)] bg-[var(--color-surface)]/30'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => draggedPlayer && moveToTeam(draggedPlayer.p, draggedPlayer.from, 'pool')}
            >
                <div className="text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-4 tracking-widest text-center">Banquillo de Jugadores</div>
                <div className="flex flex-wrap gap-2 justify-center min-h-[50px]">
                    {pool.map(p => (
                        <div
                            key={p.id}
                            draggable
                            onDragStart={() => setDraggedPlayer({ p, from: 'pool' })}
                            onDragEnd={() => setDraggedPlayer(null)}
                            onClick={() => {
                                if (nosotros.length < getLimit()) moveToTeam(p, 'pool', 'nosotros');
                                else if (ellos.length < getLimit()) moveToTeam(p, 'pool', 'ellos');
                            }}
                            className={`bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm cursor-grab active:scale-95 transition-all text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${draggedPlayer ? 'opacity-50' : ''}`}
                        >
                            {p.name}
                        </div>
                    ))}
                    {pool.length === 0 && <span className="text-xs text-[var(--color-text-muted)] italic font-medium">Todos asignados</span>}
                </div>
            </div>

            {/* TEAMS GRID */}
            <div className="grid grid-cols-2 gap-4 mb-10">
                {/* NOSOTROS */}
                <div
                    className={`flex flex-col p-4 rounded-3xl border-2 transition-all min-h-[160px] ${draggedPlayer ? 'border-dashed border-[var(--color-nosotros)]/40 bg-[var(--color-nosotros)]/5' : 'border-transparent bg-[var(--color-surface)] shadow-inner'} ${nosotros.length >= getLimit() ? 'opacity-60' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => draggedPlayer && moveToTeam(draggedPlayer.p, draggedPlayer.from, 'nosotros')}
                >
                    <div className="flex justify-center items-center mb-4 px-2 overflow-hidden">
                        {isEditingNosotrosTeam ? (
                            <input
                                autoFocus
                                className="bg-transparent border-b border-[var(--color-nosotros)] text-[10px] font-black uppercase text-[var(--color-nosotros)] tracking-widest text-center w-full outline-none"
                                value={nosotrosTeamName}
                                onBlur={() => setIsEditingNosotrosTeam(false)}
                                onChange={e => setNosotrosTeamName(e.target.value)}
                            />
                        ) : (
                            <div
                                onClick={() => setIsEditingNosotrosTeam(true)}
                                className="text-[10px] font-black uppercase text-[var(--color-nosotros)] tracking-widest text-center px-1 truncate cursor-edit"
                            >
                                {nosotrosTeamName}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        {nosotros.map(p => (
                            <div
                                key={p.id}
                                draggable
                                onDragStart={() => setDraggedPlayer({ p, from: 'nosotros' })}
                                onDragEnd={() => setDraggedPlayer(null)}
                                onClick={() => moveToTeam(p, 'nosotros', 'pool')}
                                className="bg-[var(--color-nosotros)] text-black p-4 rounded-2xl font-black text-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all text-center"
                            >
                                {p.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ELLOS */}
                <div
                    className={`flex flex-col p-4 rounded-3xl border-2 transition-all min-h-[160px] ${draggedPlayer ? 'border-dashed border-[var(--color-ellos)]/40 bg-[var(--color-ellos)]/5' : 'border-transparent bg-[var(--color-surface)] shadow-inner'} ${ellos.length >= getLimit() ? 'opacity-60' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => draggedPlayer && moveToTeam(draggedPlayer.p, draggedPlayer.from, 'ellos')}
                >
                    <div className="flex justify-center items-center mb-4 px-2 overflow-hidden">
                        {isEditingEllosTeam ? (
                            <input
                                autoFocus
                                className="bg-transparent border-b border-[var(--color-ellos)] text-[10px] font-black uppercase text-[var(--color-ellos)] tracking-widest text-center w-full outline-none"
                                value={ellosTeamName}
                                onBlur={() => setIsEditingEllosTeam(false)}
                                onChange={e => setEllosTeamName(e.target.value)}
                            />
                        ) : (
                            <div
                                onClick={() => setIsEditingEllosTeam(true)}
                                className="text-[10px] font-black uppercase text-[var(--color-ellos)] tracking-widest text-center px-1 truncate cursor-edit"
                            >
                                {ellosTeamName}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        {ellos.map(p => (
                            <div
                                key={p.id}
                                draggable
                                onDragStart={() => setDraggedPlayer({ p, from: 'ellos' })}
                                onDragEnd={() => setDraggedPlayer(null)}
                                onClick={() => moveToTeam(p, 'ellos', 'pool')}
                                className="bg-[var(--color-ellos)] text-black p-4 rounded-2xl font-black text-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all text-center"
                            >
                                {p.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <button
                onClick={randomize}
                className="mb-10 text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest bg-[var(--color-surface)]/50 py-2 px-4 rounded-full self-center border border-[var(--color-border)] active:scale-95 transition-all"
            >
                🔀 Mezclar Equipos
            </button>

            {/* PAIRS UI */}
            {is2v2 && (
                <div className="mb-10 flex flex-col gap-3">
                    <div className="bg-[var(--color-surface)] p-4 rounded-3xl border border-[var(--color-border)] shadow-sm">
                        <div className="text-[9px] text-[var(--color-text-muted)] uppercase font-black mb-2 tracking-widest">Nombre Pareja (Nosotros)</div>
                        {isEditingNosotrosPair ? (
                            <div className="flex gap-2">
                                <input
                                    className="bg-transparent border-b border-[var(--color-accent)] w-full font-black text-sm outline-none"
                                    value={nosotrosPairName}
                                    onChange={(e) => setNosotrosPairName(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={() => handlePairNameSave('nosotros', nosotrosPairName)} className="text-[var(--color-accent)] font-black text-xs">OK</button>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center" onClick={() => setIsEditingNosotrosPair(true)}>
                                <span className="font-black text-sm">{nosotrosPairName}</span>
                                <span className="text-[9px] text-[var(--color-accent)] font-black uppercase tracking-widest">Editar</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-[var(--color-surface)] p-4 rounded-3xl border border-[var(--color-border)] shadow-sm">
                        <div className="text-[9px] text-[var(--color-text-muted)] uppercase font-black mb-2 tracking-widest">Nombre Pareja (Ellos)</div>
                        {isEditingEllosPair ? (
                            <div className="flex gap-2">
                                <input
                                    className="bg-transparent border-b border-[var(--color-accent)] w-full font-black text-sm outline-none"
                                    value={ellosPairName}
                                    onChange={(e) => setEllosPairName(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={() => handlePairNameSave('ellos', ellosPairName)} className="text-[var(--color-accent)] font-black text-xs">OK</button>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center" onClick={() => setIsEditingEllosPair(true)}>
                                <span className="font-black text-sm">{ellosPairName}</span>
                                <span className="text-[9px] text-[var(--color-accent)] font-black uppercase tracking-widest">Editar</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Target Score Section */}
            <div className="mb-8">
                <div className="text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-4 tracking-widest border-b border-[var(--color-border)] pb-2">Puntos a Jugar</div>
                <div className="flex bg-[var(--color-surface)] p-1 rounded-2xl border border-[var(--color-border)]">
                    <button
                        onClick={() => setTargetScore(15)}
                        className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${targetScore === 15 ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-md' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                    >
                        15 PUNTOS
                        <span className="block text-[8px] font-normal opacity-70">RÁPIDO</span>
                    </button>
                    <button
                        onClick={() => setTargetScore(30)}
                        className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${targetScore === 30 ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-md' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                    >
                        30 PUNTOS
                        <span className="block text-[8px] font-normal opacity-70">ESTÁNDAR</span>
                    </button>
                </div>
            </div>

            {/* Metadata Section */}
            <div className="mb-12">
                <div className="text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-4 tracking-widest border-b border-[var(--color-border)] pb-2">Información del Partido</div>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase text-[var(--color-text-muted)] ml-2">Sede / Ubicación</label>
                        <input
                            type="text"
                            placeholder="Ej. Quincho de Julian"
                            className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl w-full font-bold text-sm outline-none focus:border-[var(--color-accent)]"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase text-[var(--color-text-muted)] ml-2">Fecha (Opcional)</label>
                        <input
                            type="date"
                            className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl w-full font-bold text-sm outline-none focus:border-[var(--color-accent)]"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <button
                className="w-full bg-[var(--color-accent)] text-[var(--color-text-primary)] py-5 rounded-3xl font-black text-xl disabled:opacity-30 mt-auto shadow-2xl active:scale-95 transition-all"
                disabled={!isValid}
                onClick={() => {
                    try {
                        let dateTs = Date.now();
                        if (customDate) {
                            const parsed = new Date(customDate + 'T00:00:00').getTime();
                            if (!isNaN(parsed)) dateTs = parsed;
                        }

                        let pIds: { nosotros?: string, ellos?: string } = {};
                        if (is2v2) {
                            const pN = getOrCreatePair([nosotros[0].id, nosotros[1].id] as [string, string]);
                            const pE = getOrCreatePair([ellos[0].id, ellos[1].id] as [string, string]);
                            pIds = { nosotros: pN.id, ellos: pE.id };
                        }
                        onStartMatch(
                            { nosotros, ellos },
                            {
                                location: location || 'Sin ubicación',
                                date: dateTs,
                                teamNames: { nosotros: nosotrosTeamName, ellos: ellosTeamName }
                            },
                            pIds,
                            targetScore
                        );
                    } catch (e) {
                        alert("Error al iniciar partido: " + JSON.stringify(e));
                        console.error(e);
                    }
                }}
            >
                COMENZAR PARTIDO
            </button>
        </div>
    );
};
