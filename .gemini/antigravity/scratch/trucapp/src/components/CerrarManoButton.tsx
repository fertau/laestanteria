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
                bg-white/10 text-white border border-white/20
                active:bg-white/20 active:scale-[0.98] transition-all
                backdrop-blur-sm
            "
        >
            Cerrar Mano
        </button>
    );
};
