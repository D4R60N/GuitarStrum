import React, { useEffect, useRef, useState } from "react";
import { AlphaTabApi } from "@coderline/alphatab";

// Valid AlphaTex syntax: Note the parentheses around chord beats
const DEFAULT_SONG = `
\\tempo 100
\\chord("C" x 3 2 0 1 0)
\\chord("G" 3 2 0 0 3 3)
\\chord("Am" x 0 2 2 1 0)
\\chord("F" 1 3 3 2 1 1)
.
(3.5 2.4 0.3 1.2 0.1).2{ch "C"} (3.6 2.5 0.4 0.3 3.2 3.1).2{ch "G"} |
(0.5 2.4 2.3 1.2 0.1).2{ch "Am"} (1.6 3.5 3.4 2.3 1.2 1.1).2{ch "F"} |
(3.5 2.4 0.3 1.2 0.1).4{ch "C"} (3.5 2.4 0.3 1.2 0.1).4 (3.6 2.5 0.4 0.3 3.2 3.1).4{ch "G"} (3.6 2.5 0.4 0.3 3.2 3.1).4 |
(0.5 2.4 2.3 1.2 0.1).4{ch "Am"} (0.5 2.4 2.3 1.2 0.1).4 (1.6 3.5 3.4 2.3 1.2 1.1).2{ch "F"}
`;
export const TabViewer: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<AlphaTabApi | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [status, setStatus] = useState("Loading...");

    useEffect(() => {
        if (!containerRef.current) return;

        try {
            const api = new AlphaTabApi(containerRef.current, {
                core: {
                    engine: "svg",
                    fontDirectory: "/font/",
                },
                player: {
                    enablePlayer: true,
                    enableCursor: true,
                    soundFont:
                        "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2",
                },
                display: {
                    staveProfile: "Default",
                },
                // 👇 This tells alphaTab to draw the chord diagrams!
                notation: {
                    elements: new Map([
                        ["ChordDiagrams", true],
                    ]),
                },
            });

            api.soundFontLoaded.on(() => {
                setStatus("● Synth Ready");
            });

            api.playerStateChanged.on((args) => {
                setIsPlaying(args.state === 1);
            });

            // Load song
            api.tex(DEFAULT_SONG.trim());

            apiRef.current = api;
        } catch (err) {
            console.error("AlphaTab error:", err);
            setStatus("Error loading engine");
        }

        return () => {
            apiRef.current?.destroy();
            apiRef.current = null;
        };
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !apiRef.current) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            apiRef.current?.load(data);
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh" }}>
            {/* Top Navbar */}
            <div
                style={{
                    padding: "1rem",
                    background: "#1e1e24",
                    color: "white",
                    display: "flex",
                    gap: "1rem",
                    alignItems: "center",
                    flexShrink: 0,
                }}
            >
                <button
                    onClick={() => apiRef.current?.playPause()}
                    style={{
                        padding: "8px 16px",
                        background: isPlaying ? "#e63946" : "#2a9d8f",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                    }}
                >
                    {isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>

                <button
                    onClick={() => apiRef.current?.stop()}
                    style={{
                        padding: "8px 16px",
                        background: "#495057",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                    }}
                >
                    ⏹ Stop
                </button>

                <label
                    style={{
                        background: "#3a86ff",
                        color: "white",
                        padding: "8px 16px",
                        borderRadius: "4px",
                        cursor: "pointer",
                    }}
                >
                    📁 Open Guitar Pro File
                    <input
                        type="file"
                        accept=".gp,.gp3,.gp4,.gp5,.gpx"
                        onChange={handleFileUpload}
                        style={{ display: "none" }}
                    />
                </label>

                <span style={{ fontSize: "0.85rem", color: "#aaa" }}>{status}</span>
            </div>

            {/* Visible Tab Container */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    background: "#ffffff",
                    color: "#000000",
                    padding: "2rem",
                }}
            >
                <div ref={containerRef} style={{ width: "100%", minHeight: "400px" }} />
            </div>
        </div>
    );
};