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
    const isNosotros = teamId === 'nosotros';
    return (
        <button
            className={`
                px-1 py-2 rounded-lg flex flex-col items-center justify-center gap-0.5
                active:scale-95 transition-all min-h-[56px] relative overflow-hidden
                border
                ${isNosotros
                    ? 'bg-[#4ade80]/8 border-[#4ade80]/15 text-[#4ade80] active:bg-[#4ade80]/15'
                    : 'bg-[#fbbf24]/8 border-[#fbbf24]/15 text-[#fbbf24] active:bg-[#fbbf24]/15'
                }
            `}
            onClick={(e) => {
                e.stopPropagation();
                onAction();
            }}
        >
            <div className="text-[9px] font-bold uppercase tracking-tight leading-none text-center">{label}</div>
            <div className="text-[11px] font-black opacity-60 leading-none">
                {typeof points === 'number' ? `+${points}` : points}
            </div>
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
    const isNosotros = teamId === 'nosotros';
    return (
        <button
            className={`
                px-1 py-1 rounded-md flex items-center justify-center gap-1
                active:scale-95 transition-all min-h-[36px] relative overflow-hidden
                text-[9px] border
                ${isNosotros
                    ? 'bg-[#4ade80]/8 border-[#4ade80]/15 text-[#4ade80] active:bg-[#4ade80]/15'
                    : 'bg-[#fbbf24]/8 border-[#fbbf24]/15 text-[#fbbf24] active:bg-[#fbbf24]/15'
                }
            `}
            onClick={(e) => {
                e.stopPropagation();
                onAction();
            }}
        >
            <span className="font-bold uppercase tracking-tight leading-none">{label}</span>
            <span className="font-black opacity-60 leading-none">
                {typeof points === 'number' ? `+${points}` : points}
            </span>
        </button>
    );
};
