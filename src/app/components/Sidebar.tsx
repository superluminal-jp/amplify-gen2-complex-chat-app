"use client";
import Link from "next/link";

export default function Sidebar({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    return (
        <>
            <div
                className={`sidebar-overlay ${isOpen ? "visible" : ""}`}
                onClick={onClose}
            ></div>
            <div className={`sidebar ${isOpen ? "open" : ""}`}>
                <div className="sidebar-header">
                    <h2>Navigation</h2>
                    <button onClick={onClose}>✕</button>
                </div>
                <Link href="/" className="sidebar-item">
                    Simple Chat
                </Link>
                <Link href="/contextualChat" className="sidebar-item">
                    Contextual Chat
                </Link>
                <Link href="/formChat" className="sidebar-item">
                    Form Chat
                </Link>
                <Link href="/ragChat" className="sidebar-item">
                    RAG Chat
                </Link>
                <Link href="/chatHistory" className="sidebar-item">
                    Chat History
                </Link>
                
            </div>
        </>
    );
}
