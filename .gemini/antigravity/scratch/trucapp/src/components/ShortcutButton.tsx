import type { TeamId, PointType } from '../types';

export const ShortcutButton = ({
    label, points, teamId, onAction
}: {
    label: string;
    points: string | number;
    type?: PointType;
    teamId: TeamId;
    onAction: () => void;
}) => {
    return (
        <button
            className="px-1 py-1.5 rounded flex flex-col items-center justify-center gap-0.5 border border-[var(--color-border)] active:scale-95 transition-all min-h-[64px] relative overflow-hidden group bg-[var(--color-surface)] text-[var(--color-text-secondary)] active:bg-[var(--color-surface-hover)]"
            onClick={(e) => {
                e.stopPropagation();
                onAction();
            }}
        >
            <div className="text-[10px] font-bold uppercase tracking-tighter leading-none text-center group-active:scale-90 transition-transform">{label}</div>
            <div className="text-[11px] font-bold opacity-50 leading-none">
                {typeof points === 'number' ? `+${points}` : points}
            </div>
            <div className="absolute inset-0 bg-[var(--color-surface)] opacity-0 group-active:opacity-100 transition-opacity" />
        </button>
    );
};

export const CompactShortcutButton = ({
    label, points, teamId, onAction
}: {
    label: string;
    points: string | number;
    type?: PointType;
    teamId: TeamId;
    onAction: () => void;
}) => {
    return (
        <button
            className="px-1 py-1 rounded flex items-center justify-center gap-1 border border-[var(--color-border)] active:scale-95 transition-all min-h-[36px] relative overflow-hidden group text-[9px] bg-[var(--color-surface)] text-[var(--color-text-secondary)] active:bg-[var(--color-surface-hover)]"
            onClick={(e) => {
                e.stopPropagation();
                onAction();
            }}
        >
            <span className="font-bold uppercase tracking-tighter leading-none">{label}</span>
            <span className="font-bold opacity-50 leading-none">
                {typeof points === 'number' ? `+${points}` : points}
            </span>
        </button>
    );
};
