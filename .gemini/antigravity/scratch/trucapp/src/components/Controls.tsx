import { useState } from 'react';
import { useMatchStore } from '../store/useMatchStore';
import type { PointType } from '../types';

interface ControlsProps {
    onRequestFaltaEnvido: () => void;
}

export const Controls = ({ onRequestFaltaEnvido }: ControlsProps) => {
    const undo = useMatchStore(state => state.undo);

    return (
        <div className="flex flex-col p-4 bg-[var(--color-surface)] border-t border-[var(--color-border)]">

            {/* Wireframe: 
          ENVIDO        TRUCO
          [ Envido ]    [ Truco ]
          [ Real ]      [ Retruco ]
          [ Falta ]     [ Vale 4 ]
          
          [ UNDO ]
      */}

            <div className="flex gap-4 mb-4">
                {/* Envido Column */}
                <div className="flex-1 flex flex-col gap-2">
                    <h3 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] text-center mb-1">Envido</h3>
                    <ShortcutButton label="Envido" points={2} type="envido" />
                    <ShortcutButton label="Real Envido" points={3} type="real_envido" />
                    <button
                        className="bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded active:scale-95 transition-all w-full flex flex-col items-center justify-center h-[60px]"
                        onClick={onRequestFaltaEnvido}
                    >
                        <div className="text-sm font-bold uppercase">Falta Envido</div>
                        <div className="text-[10px] font-black text-[var(--color-text-muted)] mt-0.5 tracking-wider">MAX</div>
                    </button>
                </div>

                {/* Truco Column */}
                <div className="flex-1 flex flex-col gap-2">
                    <h3 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] text-center mb-1">Truco</h3>
                    <ShortcutButton label="Truco" points={2} type="truco" />
                    <ShortcutButton label="Retruco" points={3} type="retruco" />
                    <ShortcutButton label="Vale 4" points={4} type="vale_cuatro" />
                </div>
            </div>

            <button
                onClick={undo}
                className="w-full text-[var(--color-text-secondary)] text-sm font-bold uppercase tracking-wider py-4 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] active:scale-95 transition-transform"
            >
                UNDO
            </button>

        </div>
    );
};

const ShortcutButton = ({ label, points, type }: { label: string, points: number, type: PointType }) => {
    const addPoints = useMatchStore(state => state.addPoints);
    const [isOpen, setIsOpen] = useState(false);

    if (isOpen) {
        return (
            <div className="flex gap-1 animate-in fade-in zoom-in duration-200 w-full h-[46px]">
                <button
                    className="flex-1 bg-[var(--color-nosotros)] text-[var(--color-text-primary)] text-xs font-bold rounded active:scale-95"
                    onClick={() => { addPoints('nosotros', points, type); setIsOpen(false); }}
                >
                    NOS
                </button>
                <button
                    className="flex-1 bg-[var(--color-ellos)] text-[var(--color-text-primary)] text-xs font-bold rounded active:scale-95"
                    onClick={() => { addPoints('ellos', points, type); setIsOpen(false); }}
                >
                    ELL
                </button>
                <button
                    className="w-6 bg-[var(--color-surface-hover)] text-xs rounded border border-[var(--color-border)]"
                    onClick={() => setIsOpen(false)}
                >
                    ✕
                </button>
            </div>
        )
    }

    return (
        <button
            className="w-full h-[60px] bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded active:scale-95 transition-all flex flex-col items-center justify-center"
            onClick={() => setIsOpen(true)}
        >
            <div className="text-sm font-bold uppercase">{label}</div>
            <div className="text-[10px] font-black text-[var(--color-text-muted)] mt-0.5 tracking-wider">+{points}</div>
        </button>
    );
}
