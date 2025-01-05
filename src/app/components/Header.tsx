"use client";
export default function Header({ onSignOut }: { onSignOut: () => void }) {
    return (
        <header className="absolute top-4 right-4">
            <button
                onClick={onSignOut}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
                Sign Out
            </button>
        </header>
    );
}