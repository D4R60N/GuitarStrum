import React, { useState, useEffect, useRef } from "react";

interface MetronomeProps {
    initialBpm?: number;
    isMuted?: boolean;
}

export const Metronome: React.FC<MetronomeProps> = ({ initialBpm = 85, isMuted = false }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [bpm, setBpm] = useState(initialBpm);
    const [activeBeat, setActiveBeat] = useState<number | null>(null);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const intervalRef = useRef<number | null>(null);

    // Sync BPM if song tempo changes
    useEffect(() => {
        if (initialBpm) setBpm(initialBpm);
    }, [initialBpm]);

    // Audio click synthesizer
    const playClick = (pitch: number) => {
        if (isMuted) return;
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(pitch, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    };

    // Toggle Metronome
    const toggleMetronome = () => {
        if (isRunning) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsRunning(false);
            setActiveBeat(null);
        } else {
            setIsRunning(true);
            let beat = 0;
            setActiveBeat(0);
            playClick(1000); // Accent on Beat 1

            const beatMs = (60 / bpm) * 1000;
            intervalRef.current = window.setInterval(() => {
                beat = (beat + 1) % 4; // 4/4 time
                setActiveBeat(beat);
                playClick(beat === 0 ? 1000 : 600);
            }, beatMs);
        }
    };

    // Cleanup on unmount or BPM change
    useEffect(() => {
        if (isRunning) {
            toggleMetronome(); // Reset to new speed
            toggleMetronome();
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [bpm]);

    return (
        <div className="metronome-widget-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#1e1e24" }}>
          ⏱ Metronome
        </span>
                <button
                    onClick={toggleMetronome}
                    style={{
                        padding: "2px 8px",
                        background: isRunning ? "#e63946" : "#2a9d8f",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                    }}
                >
                    {isRunning ? "⏹ Stop" : "▶ Start"}
                </button>
            </div>

            {/* BPM Controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "0.6rem" }}>
                <button
                    onClick={() => setBpm((b) => Math.max(40, b - 5))}
                    style={{ padding: "1px 6px", background: "#e2e8f0", border: "none", borderRadius: "3px", cursor: "pointer", fontWeight: "bold" }}
                >
                    -5
                </button>
                <span style={{ fontWeight: "bold", fontSize: "0.85rem", color: "#d63384", minWidth: "55px", textAlign: "center" }}>
          {bpm} BPM
        </span>
                <button
                    onClick={() => setBpm((b) => Math.min(240, b + 5))}
                    style={{ padding: "1px 6px", background: "#e2e8f0", border: "none", borderRadius: "3px", cursor: "pointer", fontWeight: "bold" }}
                >
                    +5
                </button>
            </div>

            {/* 4 Animated Beating Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", alignItems: "center" }}>
                {[0, 1, 2, 3].map((b) => {
                    const isActive = activeBeat === b;
                    return (
                        <div
                            key={b}
                            className={`metro-dot ${b === 0 ? "accent-dot" : ""} ${isActive ? "active-metro-dot" : ""}`}
                        />
                    );
                })}
            </div>

            {/* Scoped CSS */}
            <style>{`
        .metronome-widget-card {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 0.85rem 1rem;
          min-width: 170px;
        }

        .metro-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #cbd5e1;
          transition: transform 0.05s ease-out, background 0.05s;
        }

        .metro-dot.accent-dot {
          border: 2px solid #94a3b8;
        }

        .metro-dot.active-metro-dot {
          background: #3a86ff !important;
          transform: scale(1.4);
          box-shadow: 0 0 8px rgba(58, 134, 255, 0.7);
        }

        .metro-dot.accent-dot.active-metro-dot {
          background: #ff006e !important;
          box-shadow: 0 0 10px rgba(255, 0, 110, 0.8);
        }
      `}</style>
        </div>
    );
};