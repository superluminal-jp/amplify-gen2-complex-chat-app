"use client";
export default function ToggleSidebarButton({
    isOpen,
    onToggle,
}: {
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            className="fixed left-4 top-4 z-50 bg-gray-900 text-white px-2 py-1 rounded-md shadow-md"
            onClick={onToggle}
        >
            {isOpen ? "✕" : "☰"}
        </button>
    );
}
