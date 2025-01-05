"use client";
import { useState } from "react";
import { Amplify } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import outputs from "../../amplify_outputs.json";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ToggleSidebarButton from "./components/ToggleSidebarButton";
import "./globals.css";

Amplify.configure(outputs);

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <html lang="en">
            <body>
                <Authenticator>
                    {({ signOut }) => (
                        <main className="flex min-h-screen flex-col items-center p-4">
                            <Header onSignOut={() => signOut?.()} />
                            <ToggleSidebarButton
                                isOpen={isSidebarOpen}
                                onToggle={() =>
                                    setIsSidebarOpen(!isSidebarOpen)
                                }
                            />
                            <Sidebar
                                isOpen={isSidebarOpen}
                                onClose={() => setIsSidebarOpen(false)}
                            />
                            {children}
                        </main>
                    )}
                </Authenticator>
            </body>
        </html>
    );
}
