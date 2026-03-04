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
            className={`
                px-1 py-1.5 rounded flex flex-col items-center justify-center gap-0.5
                border border-[var(--color-border)] active:scale-95 transition-all
                min-h-[64px] relative overflow-hidden group
                ${teamId === 'nosotros' ? 'bg-[var(--color-nosotros)]/10 text-[var(--color-nosotros)] border-[var(--color-nosotros)]/30 active:bg-[var(--color-nosotros)]/20 shadow-[0_0_15px_rgba(74,222,128,0.1)]' : 'bg-[var(--color-ellos)]/10 text-[var(--color-ellos)] border-[var(--color-ellos)]/30 active:bg-[var(--color-ellos)]/20 shadow-[0_0_15px_rgba(251,191,36,0.1)]'}
            `}
            onClick={(e) => {
                e.stopPropagation();
                onAction();
            }}
        >
            <div className="text-[10px] font-black uppercase tracking-tighter leading-none text-center group-active:scale-90 transition-transform">{label}</div>
            <div className="text-[12px] font-black opacity-60 leading-none">
                {typeof points === 'number' ? `+${points}` : points}
            </div>
            <div className="absolute inset-0 bg-white/5 opacity-0 group-active:opacity-100 transition-opacity"></div>
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
            className={`
                px-1 py-1 rounded flex items-center justify-center gap-1
                border border-[var(--color-border)] active:scale-95 transition-all
                min-h-[36px] relative overflow-hidden group text-[9px]
                ${teamId === 'nosotros' ? 'bg-[var(--color-nosotros)]/10 text-[var(--color-nosotros)] border-[var(--color-nosotros)]/30 active:bg-[var(--color-nosotros)]/20' : 'bg-[var(--color-ellos)]/10 text-[var(--color-ellos)] border-[var(--color-ellos)]/30 active:bg-[var(--color-ellos)]/20'}
            `}
            onClick={(e) => {
                e.stopPropagation();
                onAction();
            }}
        >
            <span className="font-black uppercase tracking-tighter leading-none">{label}</span>
            <span className="font-black opacity-60 leading-none">
                {typeof points === 'number' ? `+${points}` : points}
            </span>
        </button>
    );
};
