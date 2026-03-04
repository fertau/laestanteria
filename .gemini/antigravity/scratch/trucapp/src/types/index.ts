export type TeamId = 'nosotros' | 'ellos';
export type MatchMode = '1v1' | '2v2' | '3v3';
export type PointType = 'envido' | 'real_envido' | 'falta_envido' | 'truco' | 'retruco' | 'vale_cuatro' | 'score_tap' | 'penalty';

// Pica-pica (3v3) hand system
export type HandType = 'redondo' | 'picapica';
export type PicaPicaScoringMode = 'sumar_todos' | 'sumar_diferencia';

export interface PicaPicaPairing {
    pairIndex: number;
    playerNosotrosId: string;
    playerEllosId: string;
    scoreNosotros: number;
    scoreEllos: number;
    history: GameAction[];
}

export interface HandRecord {
    handNumber: number;
    type: HandType;
    pointsNosotros: number;
    pointsEllos: number;
    pairings?: PicaPicaPairing[];
}

export interface Player {
    id: string;
    name: string;
    nickname?: string; // Short name for display
    avatar?: string; // Emoji or Icon ID
    pinHash?: string; // Replaces plain text PIN
    visibility: 'PUBLIC' | 'PRIVATE';
    friends: string[]; // List of friend player IDs
    createdAt: number;
    updatedAt: number;
    lastActiveAt?: number;
    wins?: number;
    matchesPlayed?: number;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
    id: string;
    fromUserId: string;
    toUserId: string;
    status: FriendRequestStatus;
    createdAt: number;
    updatedAt: number;
}

export interface Team {
    id: TeamId;
    name: string;
    players: string[]; // Player IDs
    score: number;
}

export interface GameAction {
    id: string;
    timestamp: number;
    type: 'ADD_POINTS' | 'UNDO'; // Simplified
    team: TeamId;
    amount: number;
    reason: PointType;
}

export interface Pair {
    id: string;
    name: string; // "Fernando + Julián"
    playerIds: [string, string]; // Always 2
    matchCount: number;
    winCount: number;
    lastPlayedAt: number;
    isFavorite?: boolean;
}

export interface MatchMetadata {
    location?: string | null;
    date?: number | null;
    customDate?: number | null; // If user edits the date
}

export interface MatchState {
    id: string;
    mode: MatchMode;
    startDate: number; // timestamp (creation)

    // V2 Metadata
    metadata?: MatchMetadata;

    targetScore: number;
    teams: {
        nosotros: Team;
        ellos: Team;
    };

    // V2 Pairs
    pairs?: {
        nosotros?: string | null; // PairId
        ellos?: string | null;    // PairId
    } | null;

    history: GameAction[];
    isFinished: boolean;
    winner?: TeamId | null;

    // 3v3 Pica-pica config
    picaPicaScoringMode?: PicaPicaScoringMode | null;
}
