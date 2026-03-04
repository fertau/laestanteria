import type { HandType } from '../types';

interface HandIndicatorProps {
    handNumber: number;
    handType: HandType;
}

export const HandIndicator = ({ handNumber, handType }: HandIndicatorProps) => {
    const isPicaPica = handType === 'picapica';

    return (
        <div className="flex items-center justify-center gap-2 py-1.5">
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                Mano {handNumber}
            </span>
            <span className={`
                text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full
                ${isPicaPica
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }
            `}>
                {isPicaPica ? 'Pica-Pica' : 'Redondo'}
            </span>
        </div>
    );
};
