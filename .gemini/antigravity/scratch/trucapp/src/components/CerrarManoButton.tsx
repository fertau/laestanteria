interface CerrarManoButtonProps {
    visible: boolean;
    onClose: () => void;
}

export const CerrarManoButton = ({ visible, onClose }: CerrarManoButtonProps) => {
    if (!visible) return null;

    return (
        <button
            onClick={onClose}
            className="
                w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider
                bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]
                active:bg-[var(--color-surface-hover)] active:scale-[0.98] transition-all
                backdrop-blur-sm
            "
        >
            Cerrar Mano
        </button>
    );
};
