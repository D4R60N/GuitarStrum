import React, { useMemo, useState, useRef, useEffect } from "react";
import ChordSheetJS from "chordsheetjs";
const STRING_FREQS = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];
const DEFAULT_CHORD_SHEET = `Capo 3rd fret
[Tempo: 80]
 
[Verse 1]
           C
When the days are cold
s:         D - D - D - D -
           G
And the cards all fold
s:         D - D - D - D -
           Am
And the saints we see
s:         D - D - D - D -
          F
Are all made of gold
s:        D - D - D - D -

[Tempo: 105]
[Chorus]
C                  G
  When you feel my heat
s:D - D U - U D -    D - D U - U D -
             Am
Look into my eyes
s:           D - D U - U D -
                     F
It's where my demons hide
s:                   D - D U - U D -
                     C
It's where my demons hide
s:                   D - D U - U D -`;

const CHORD_TOKEN_REGEX = /\b([A-G][b#]?(?:maj|min|m|M|sus|dim|aug|add)?[0-9]*(?:\/[A-G][b#]?)?)\b|N\.C\./g;

// SVG Chord Box Component
const CHORD_DB: Record<string, number[]> = {
    C: [-1, 3, 2, 0, 1, 0],
    G: [3, 2, 0, 0, 3, 3],
    Am: [-1, 0, 2, 2, 1, 0],
    F: [1, 3, 3, 2, 1, 1],
    D: [-1, -1, 0, 2, 3, 2],
    Dm: [-1, -1, 0, 2, 3, 1],
    Em: [0, 2, 2, 0, 0, 0],
    E: [0, 2, 2, 1, 0, 0],
    A: [-1, 0, 2, 2, 2, 0],
};

const ChordBox = ({ chord }: { chord: string }) => {
    const frets = CHORD_DB[chord] || [-1, 0, 0, 0, 0, 0];
    return (
        <div className="chord-box-wrapper">
            <div className="chord-box-name">{chord}</div>
            <svg width="55" height="70" viewBox="0 0 60 75">
                <line x1="10" y1="18" x2="50" y2="18" stroke="#333" strokeWidth="3" />
                {[28, 38, 48, 58].map((y, i) => (
                    <line key={i} x1="10" y1={y} x2="50" y2={y} stroke="#bbb" strokeWidth="1" />
                ))}
                {[10, 18, 26, 34, 42, 50].map((x, i) => (
                    <line key={i} x1={x} y1="18" x2={x} y2="58" stroke="#bbb" strokeWidth="1" />
                ))}
                {frets.map((fret, stringIdx) => {
                    const x = 10 + stringIdx * 8;
                    if (fret === -1) return <text key={stringIdx} x={x} y="13" fontSize="9" textAnchor="middle" fill="#888">×</text>;
                    if (fret === 0) return <circle key={stringIdx} cx={x} cy="10" r="2.5" fill="none" stroke="#666" strokeWidth="1" />;
                    return <circle key={stringIdx} cx={x} cy={18 + fret * 10 - 5} r="3.5" fill="#d63384" />;
                })}
            </svg>
        </div>
    );
};

interface StrumTimelineItem {
    id: number;
    stroke: string; // "D", "U", "X", "-"
    tempo: number;  // Current road-sign tempo at this stroke
    chord?: string;
}

export const ChordSheetViewer: React.FC = () => {
    const [rawText, setRawText] = useState(DEFAULT_CHORD_SHEET.trim());
    const [transposeDelta, setTransposeDelta] = useState(0);
    const [fontSize] = useState(15);

    // Playback States
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [countdownBeats, setCountdownBeats] = useState<number>(4);
    const [currentCountdown, setCurrentCountdown] = useState<number | null>(null);
    const [activeGlobalStrokeId, setActiveGlobalStrokeId] = useState<number | null>(null);
    const [activeHeaderPattern, setActiveHeaderPattern] = useState<string | null>(null);
    const [activeHeaderStroke, setActiveHeaderStroke] = useState<number | null>(null);
    const headerIntervalRef = useRef<number | null>(null);

    // Parse top Strumming cards: Strumming (Verse - 75 bpm): D - D -
    const headerPatterns = useMemo(() => {
        const found: { name: string; pattern: string; bpm: number }[] = [];
        const lines = rawText.split("\n");
        let defBpm = 90;

        for (const l of lines) {
            const tm = l.match(/tempo:\s*(\d+)/i);
            if (tm) defBpm = parseInt(tm[1], 10);

            const sm = l.match(/^strumming(?:\s*\(([^)]+)\))?:\s*([D|U|X|\-|\s]+)/i);
            if (sm) {
                const header = sm[1]?.trim() || "Main";
                let bpm = defBpm;
                let name = header;
                const bpmMatch = header.match(/(.*?)(?:[-,\s]+)(\d+)\s*(?:bpm)?$/i);
                if (bpmMatch) {
                    name = bpmMatch[1].trim();
                    bpm = parseInt(bpmMatch[2], 10);
                }
                found.push({ name, pattern: sm[2].trim(), bpm });
            }
        }
        return found;
    }, [rawText]);

    // Audio for Header Cards
    const toggleHeaderStrum = (name: string, pattern: string, bpm: number) => {
        if (activeHeaderPattern === name) {
            if (headerIntervalRef.current) clearInterval(headerIntervalRef.current);
            setActiveHeaderPattern(null);
            setActiveHeaderStroke(null);
        } else {
            if (headerIntervalRef.current) clearInterval(headerIntervalRef.current);
            const strokes = pattern.replace(/\s+/g, "").split("");
            if (strokes.length === 0) return;

            const stepMs = (60 / bpm / 2) * 1000;
            setActiveHeaderPattern(name);
            setActiveHeaderStroke(0);

            if (strokes[0].toUpperCase() === "D") playClick(700);
            else if (["U", "X"].includes(strokes[0].toUpperCase())) playClick(500);

            let step = 1;
            headerIntervalRef.current = window.setInterval(() => {
                const idx = step % strokes.length;
                setActiveHeaderStroke(idx);
                const s = strokes[idx].toUpperCase();
                if (s === "D") playClick(700);
                else if (["U", "X"].includes(s)) playClick(500);
                step++;
            }, stepMs);
        }
    };

    const renderStrummingHeader = () => {
        if (headerPatterns.length === 0) return null;
        return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
                {headerPatterns.map((item, pIdx) => {
                    const strokes = item.pattern.replace(/\s+/g, "").split("");
                    const isPlaying = activeHeaderPattern === item.name;
                    return (
                        <div key={pIdx} className="strumming-card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>🎸 {item.name}: <span style={{ color: "#d63384" }}>{item.bpm} BPM</span></span>
                                <button
                                    onClick={() => toggleHeaderStrum(item.name, item.pattern, item.bpm)}
                                    style={{ padding: "2px 8px", background: isPlaying ? "#e63946" : "#2a9d8f", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}
                                >
                                    {isPlaying ? "⏹ Stop" : "▶ Play"}
                                </button>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                                {strokes.map((stroke, i) => {
                                    const s = stroke.toUpperCase();
                                    const isActive = isPlaying && i === activeHeaderStroke;
                                    let label = "-";
                                    let color = "#bbb";
                                    if (s === "D") { label = "↓"; color = isActive ? "#fff" : "#3a86ff"; }
                                    else if (s === "U") { label = "↑"; color = isActive ? "#fff" : "#ff006e"; }
                                    else if (s === "X") { label = "✕"; color = isActive ? "#fff" : "#fb5607"; }
                                    return (
                                        <div key={i} className={`strum-box ${isActive ? "active-header-stroke" : ""}`}>
                                            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color }}>{label}</span>
                                            <span style={{ fontSize: "0.6rem", color: isActive ? "#fff" : "#888", textTransform: "uppercase" }}>
                        {s === "-" ? "rest" : s === "D" ? "down" : s === "U" ? "up" : "mute"}
                      </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const playbackTimeoutRef = useRef<number | null>(null);

    // Audio Click Synthesizer
    const playClick = (pitch = 880) => {
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
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
    };

    const playGuitarStrum = (chordName: string | undefined, stroke: string) => {
        if (isMuted || !chordName || stroke === "-") return;

        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume();

        // Muted string "thud" for X
        if (stroke === "X") {
            playClick(300);
            return;
        }

        const frets = CHORD_DB[chordName] || [-1, 3, 2, 0, 1, 0];
        const isDown = stroke === "D";
        const now = ctx.currentTime;

        frets.forEach((fret, stringIdx) => {
            if (fret === -1) return; // Muted string

            // Frequency = BaseFreq * 2^(fret / 12)
            const freq = STRING_FREQS[stringIdx] * Math.pow(2, fret / 12);

            // Strum roll delay: 10ms between strings (low to high for D, high to low for U)
            const delay = isDown ? stringIdx * 0.012 : (5 - stringIdx) * 0.012;
            const startTime = now + delay;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle"; // Sounds warm like an acoustic guitar string
            osc.frequency.setValueAtTime(freq, startTime);

            // Acoustic string pluck envelope
            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.linearRampToValueAtTime(0.12, startTime + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 1.2);
        });
    };

    const transposeToken = (chordStr: string, delta: number): string => {
        if (delta === 0 || chordStr.toUpperCase() === "N.C.") return chordStr;
        try {
            const parsed = ChordSheetJS.Chord.parse(chordStr);
            return parsed ? parsed.transpose(delta).toString() : chordStr;
        } catch {
            return chordStr;
        }
    };

    const isChordLine = (line: string): boolean => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith("s:")) return false;
        const withoutChords = line.replace(CHORD_TOKEN_REGEX, "").trim();
        return withoutChords.length === 0;
    };

// Helper to enlarge spaces between words to push a target word to a specific column
    const justifyText = (text: string, targetCol: number, currentWordCol: number): string => {
        const diff = targetCol - currentWordCol;
        if (diff <= 0) return text;

        // Split the text before the target word into words & spaces
        const prefix = text.slice(0, currentWordCol);
        const suffix = text.slice(currentWordCol);
        const parts = prefix.split(/(\s+)/); // Keeps words and whitespace chunks
        const spaceIndices = parts.map((_, i) => i).filter((i) => /^\s+$/.test(parts[i]));
        if (spaceIndices.length === 0) {
            return " ".repeat(diff) + text;
        }

        // Distribute the extra spaces evenly across the word gaps
        const baseAdd = Math.floor(diff / spaceIndices.length);
        let remainder = diff % spaceIndices.length;

        spaceIndices.forEach((idx) => {
            const add = baseAdd + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder--;
            parts[idx] += " ".repeat(add);
        });

        return parts.join("") + suffix;
    };

    // Compile full timeline: auto-justifies words and chords to match strumming
    const { timeline, lineStructures } = useMemo(() => {
        const lines = rawText.split("\n");
        let currentTempo = 90;
        let strokeCounter = 0;
        const allStrokes: StrumTimelineItem[] = [];
        const structured: any[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Road Sign Tempo
            const tempoMatch = trimmed.match(/^\[?tempo:\s*(\d+)\]?$/i);
            if (tempoMatch) {
                currentTempo = parseInt(tempoMatch[1], 10);
                structured.push({ type: "tempo", tempo: currentTempo, text: `⏱ Tempo: ${currentTempo} BPM` });
                continue;
            }

            if (/^strumming/i.test(trimmed)) continue;

            // Strumming line with two-way auto-alignment:
            // 1. Indents the strumming line to start right under the first chord
            // 2. Expands words/chords if strumming is wider than the lyrics
            if (/^(s:|strum:)/i.test(trimmed)) {
                let content = line.replace(/^(s:|strum:)/i, "");

                // Find all [Chord] anchors
                const anchorRegex = /\[([A-G][b#]?[^\]]*)\]/gi;
                let match;
                const anchors: { chord: string; targetCol: number }[] = [];

                let cleanContent = "";
                let lastIdx = 0;

                while ((match = anchorRegex.exec(content)) !== null) {
                    cleanContent += content.slice(lastIdx, match.index);
                    anchors.push({ chord: match[1], targetCol: cleanContent.length });
                    lastIdx = match.index + match[0].length;
                }
                cleanContent += content.slice(lastIdx);

                const prevChordLine = structured.slice().reverse().find((s) => s.type === "chord");
                const prevLyricLine = structured.slice().reverse().find((s) => s.type === "lyric");

                // 1. Initial Indent
                if (anchors.length > 0 && prevChordLine && prevChordLine.text) {
                    const firstAnchor = anchors[0];
                    const firstChordRegex = new RegExp(`\\b${firstAnchor.chord}\\b`, "i");
                    const firstMatch = prevChordLine.text.match(firstChordRegex);

                    if (firstMatch && firstMatch.index !== undefined) {
                        const initialIndent = firstMatch.index - firstAnchor.targetCol;
                        if (initialIndent > 0) {
                            const pad = " ".repeat(initialIndent);
                            cleanContent = pad + cleanContent;
                            anchors.forEach((a) => (a.targetCol += initialIndent));
                        }
                    }
                }

                // 2. Expand words for subsequent chord changes
                for (let i = 1; i < anchors.length; i++) {
                    const anchor = anchors[i];
                    if (prevChordLine && prevChordLine.text) {
                        const chordRegex = new RegExp(`\\b${anchor.chord}\\b`, "i");
                        const chordMatch = prevChordLine.text.match(chordRegex);

                        if (chordMatch && chordMatch.index !== undefined) {
                            const currentChordCol = chordMatch.index;
                            const diff = anchor.targetCol - currentChordCol;

                            if (diff > 0) {
                                prevChordLine.text =
                                    prevChordLine.text.slice(0, currentChordCol) +
                                    " ".repeat(diff) +
                                    prevChordLine.text.slice(currentChordCol);

                                if (prevLyricLine && prevLyricLine.text) {
                                    prevLyricLine.text = justifyText(prevLyricLine.text, anchor.targetCol, currentChordCol);
                                }
                            }
                        }
                    }
                }

                // 3. Build playback strokes with active chord mapping
                let activeChordForStrokes =
                    anchors[0]?.chord || prevChordLine?.text?.trim().split(/\s+/)[0] || "C";
                let anchorScanIdx = 0;

                const strokeElements: { isStroke: boolean; char: string; strokeId?: number }[] = [];
                for (let i = 0; i < cleanContent.length; i++) {
                    const char = cleanContent[i];
                    const upper = char.toUpperCase();

                    // Switch chord when the cursor reaches the next anchor position
                    if (anchorScanIdx < anchors.length && i >= anchors[anchorScanIdx].targetCol) {
                        activeChordForStrokes = anchors[anchorScanIdx].chord;
                        anchorScanIdx++;
                    }

                    if (["D", "U", "X", "-"].includes(upper)) {
                        const strokeId = strokeCounter++;
                        allStrokes.push({
                            id: strokeId,
                            stroke: upper,
                            tempo: currentTempo,
                            chord: activeChordForStrokes, // 👈 Saves the chord to this stroke
                        });
                        strokeElements.push({ char: upper, isStroke: true, strokeId });
                    } else {
                        strokeElements.push({ char, isStroke: false });
                    }
                }

                structured.push({ type: "strum", elements: strokeElements });
                continue;
            }

            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                structured.push({ type: "section", text: trimmed });
                continue;
            }

            if (isChordLine(line)) {
                structured.push({ type: "chord", text: line });
                continue;
            }

            structured.push({ type: "lyric", text: line });
        }

        return { timeline: allStrokes, lineStructures: structured };
    }, [rawText]);

    // Unique chords for diagram header
    const uniqueChords = useMemo(() => {
        const list = new Set<string>();
        const matches = rawText.match(CHORD_TOKEN_REGEX);
        if (matches) {
            matches.forEach((c) => {
                if (c.toUpperCase() !== "N.C.") list.add(transposeToken(c, transposeDelta));
            });
        }
        return Array.from(list);
    }, [rawText, transposeDelta]);

    // Stop Playback
    const stopPlayback = () => {
        if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
        setIsPlaying(false);
        setCurrentCountdown(null);
        setActiveGlobalStrokeId(null);
    };

    // Start Playback with Configurable Countdown
    const startPlayback = () => {
        if (isPlaying) {
            stopPlayback();
            return;
        }
        if (timeline.length === 0) return;

        setIsPlaying(true);

        const initialTempo = timeline[0]?.tempo || 90;
        const beatDurationMs = (60 / initialTempo) * 1000;

        // Countdown routine
        let count = countdownBeats;

        if (count > 0) {
            setCurrentCountdown(count);
            playClick(1000); // High click for countdown start

            const countInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    setCurrentCountdown(count);
                    playClick(880);
                } else {
                    clearInterval(countInterval);
                    setCurrentCountdown(null);
                    playClick(1200); // "Go!" click
                    runTimelineStep(0);
                }
            }, beatDurationMs);
        } else {
            runTimelineStep(0);
        }
    };

    const runTimelineStep = (stepIdx: number) => {
        if (stepIdx >= timeline.length) {
            stopPlayback();
            return;
        }

        const currentStroke = timeline[stepIdx];
        setActiveGlobalStrokeId(currentStroke.id);

        // 👈 Plays the synthesized guitar chord (transposed) instead of the click
        const activeChord = transposeToken(currentStroke.chord || "", transposeDelta);
        playGuitarStrum(activeChord, currentStroke.stroke);

        // Dynamic tempo duration (8th note timing: half a beat)
        const strokeDurationMs = (60 / currentStroke.tempo / 2) * 1000;

        playbackTimeoutRef.current = window.setTimeout(() => {
            runTimelineStep(stepIdx + 1);
        }, strokeDurationMs);
    };

    useEffect(() => {
        return () => {
            if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
        };
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setRawText(event.target?.result as string);
            stopPlayback();
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const handleExport = () => {
        const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "song-with-strumming.txt";
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Tab") {
            e.preventDefault(); // Stop focus jumping to the next button

            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const tabSpaces = "    "; // 4 spaces (standard for tabs & chord spacing)

            // Insert spaces at cursor position
            const newText = rawText.substring(0, start) + tabSpaces + rawText.substring(end);
            setRawText(newText);

            // Restore cursor position after the inserted spaces
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + tabSpaces.length;
            }, 0);
        }
    };
    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "sans-serif" }}>
            {/* Top Navbar */}
            <div
                style={{
                    padding: "0.75rem 1.25rem",
                    background: "#1e1e24",
                    color: "white",
                    display: "flex",
                    gap: "1rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                    borderBottom: "1px solid #333",
                }}
            >
                {/* Play / Stop Button */}
                <button
                    onClick={startPlayback}
                    style={{
                        background: isPlaying ? "#e63946" : "#2a9d8f",
                        color: "white",
                        padding: "6px 16px",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "bold",
                    }}
                >
                    {isPlaying ? "⏹ Stop" : "▶ Play Song"}
                </button>

                {/* Countdown Selector */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
                    <span>Countdown:</span>
                    <select
                        value={countdownBeats}
                        onChange={(e) => setCountdownBeats(parseInt(e.target.value, 10))}
                        style={{ background: "#2b2b36", color: "white", border: "1px solid #555", borderRadius: "4px", padding: "4px" }}
                    >
                        <option value={0}>Off</option>
                        <option value={3}>3 Beats</option>
                        <option value={4}>4 Beats</option>
                    </select>
                </div>

                {/* Sound Toggle */}
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    style={{
                        background: isMuted ? "#6c757d" : "#3a86ff",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                    }}
                >
                    {isMuted ? "🔇 Sound Off" : "🔊 Sound On"}
                </button>

                <div style={{ width: "1px", height: "20px", background: "#444" }} />

                {/* Open / Save */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: "#495057", color: "white", padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer" }}
                >
                    📁 Open
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.cho,.chopro,.crd" onChange={handleFileUpload} style={{ display: "none" }} />

                <button
                    onClick={handleExport}
                    style={{ background: "#495057", color: "white", padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer" }}
                >
                    💾 Save
                </button>

                <div style={{ width: "1px", height: "20px", background: "#444" }} />

                {/* Transpose */}
                <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>Transpose:</span>
                <button onClick={() => setTransposeDelta((p) => p - 1)} style={{ padding: "4px 8px", background: "#495057", color: "white", border: "none", borderRadius: "4px" }}>
                    ♭
                </button>
                <span style={{ minWidth: "20px", textAlign: "center" }}>{transposeDelta > 0 ? `+${transposeDelta}` : transposeDelta}</span>
                <button onClick={() => setTransposeDelta((p) => p + 1)} style={{ padding: "4px 8px", background: "#495057", color: "white", border: "none", borderRadius: "4px" }}>
                    ♯
                </button>
            </div>

            {/* Main Split View */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
                {/* Countdown Floating Banner */}
                {currentCountdown !== null && (
                    <div className="countdown-overlay">
                        <div className="countdown-number">{currentCountdown}</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>Get Ready...</div>
                    </div>
                )}

                {/* Editor (Left) */}
                <textarea
                    value={rawText}
                    onChange={(e) => {
                        setRawText(e.target.value);
                        stopPlayback();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Use s: under words for strumming..."
                    style={{
                        width: "40%",
                        background: "#282c34",
                        color: "#61dafb",
                        padding: "1.5rem",
                        fontFamily: "'Courier New', Courier, monospace",
                        fontSize: `${fontSize}px`,
                        lineHeight: "1.5",
                        border: "none",
                        outline: "none",
                        resize: "none",
                        whiteSpace: "pre",
                        overflowWrap: "normal",
                        overflowX: "auto",
                    }}
                />

                {/* Formatted Sheet (Right) */}
                <div style={{ flex: 1, padding: "2rem", overflowY: "auto", overflowX: "auto", background: "#ffffff" }}>
                    {/* Chord Boxes Header */}
                    {uniqueChords.length > 0 && (
                        <div className="chords-diagram-bar">
                            <span style={{ fontWeight: "bold", fontSize: "0.85rem", color: "#888", marginRight: "6px" }}>CHORDS:</span>
                            {uniqueChords.map((chord) => (
                                <ChordBox key={chord} chord={chord} />
                            ))}
                        </div>
                    )}
                    {/* Strumming Pattern Cards */}
                    {renderStrummingHeader()}

                    {/* Sheet output with inline strumming arrows */}
                    <div className="sheet-container" style={{ fontSize: `${fontSize}px`, lineHeight: "1.5" }}>
                        {lineStructures.map((item, idx) => {
                            if (!item) return null;
                            if (item.type === "tempo") {
                                return (
                                    <div key={idx} className="tempo-road-sign">
                                        {item.text}
                                    </div>
                                );
                            }

                            if (item.type === "section") {
                                return (
                                    <div key={idx} className="sheet-section">
                                        {item.text}
                                    </div>
                                );
                            }

                            if (item.type === "chord") {
                                const elements: React.ReactNode[] = [];
                                let lastIndex = 0;
                                let match: RegExpExecArray | null;
                                CHORD_TOKEN_REGEX.lastIndex = 0;

                                while ((match = CHORD_TOKEN_REGEX.exec(item.text!)) !== null) {
                                    if (match.index > lastIndex) elements.push(item.text!.substring(lastIndex, match.index));
                                    const chord = match[0];
                                    elements.push(
                                        <span key={match.index} className="sheet-chord-badge">
                      {transposeToken(chord, transposeDelta)}
                    </span>
                                    );
                                    lastIndex = match.index + chord.length;
                                }
                                if (lastIndex < item.text!.length) elements.push(item.text!.substring(lastIndex));

                                return (
                                    <div key={idx} className="sheet-line chord-line">
                                        {elements}
                                    </div>
                                );
                            }

                            if (item.type === "strum") {
                                return (
                                    <div key={idx} className="sheet-line inline-strum-line">
                                        {item.elements!.map((elem: any, eIdx: number) => {
                                            if (!elem.isStroke) return elem.char;

                                            const isActive = elem.strokeId === activeGlobalStrokeId;
                                            let label = "-";
                                            if (elem.char === "D") label = "↓";
                                            else if (elem.char === "U") label = "↑";
                                            else if (elem.char === "X") label = "✕";

                                            return (
                                                <span
                                                    key={eIdx}
                                                    className={`inline-stroke-box ${isActive ? "active-stroke" : ""}`}
                                                >
                          {label}
                        </span>
                                            );
                                        })}
                                    </div>
                                );
                            }

                            // Normal lyric
                            return (
                                <div key={idx} className="sheet-line lyric-line">
                                    {item.text}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Styles */}
            <style>{`
        .sheet-container {
          font-family: 'Courier New', Courier, monospace;
          white-space: pre;
          color: #212529;
          text-align: left;
        }

        .tempo-road-sign {
          display: inline-block;
          background: #ffe3e3;
          color: #d63384;
          font-weight: bold;
          font-size: 0.85em;
          padding: 3px 8px;
          border-radius: 4px;
          margin-top: 1.2em;
          margin-bottom: 0.2em;
          border: 1px dashed #ff8787;
        }

        .sheet-section {
          font-weight: bold;
          font-size: 1.15em;
          color: #198754;
          margin-top: 1em;
          margin-bottom: 0.2em;
        }

        .sheet-line {
          min-height: 1.3em;
        }

        .chord-line {
          font-weight: bold;
        }

        .sheet-chord-badge {
          background-color: #e9ecef;
          color: #212529;
          font-weight: bold;
          display: inline;
          border-radius: 3px;
          box-shadow: 0 0 0 2px #e9ecef;
        }

        /* Inline Strumming Arrows */
        .inline-strum-line {
          color: #6c757d;
          height: 1.6em;
        }

        .inline-stroke-box {
          display: inline-block;
          font-weight: bold;
          color: #3a86ff;
          transition: transform 0.05s ease-out;
        }

        .inline-stroke-box.active-stroke {
          background-color: #ffbe0b;
          color: #000 !important;
          border-radius: 2px;
          transform: scale(1.35);
          box-shadow: 0 0 6px rgba(255, 190, 11, 0.8);
          font-weight: 900;
        }

        /* Countdown Overlay */
        .countdown-overlay {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(30, 30, 36, 0.95);
          color: white;
          padding: 2rem 3.5rem;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
          z-index: 100;
        }

        .countdown-number {
          font-size: 4.5rem;
          font-weight: 900;
          color: #ffbe0b;
          line-height: 1;
        }

        .chords-diagram-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 1.2rem;
          flex-wrap: wrap;
        }

        .chord-box-wrapper {
          background: #fdfdfd;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 4px 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .chord-box-name {
          font-size: 0.8rem;
          font-weight: bold;
          color: #212529;
          margin-bottom: 2px;
        }
        /* Strumming Cards at Top */
        .strumming-card {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 0.85rem 1rem;
          min-width: 250px;
        }

        .strum-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #ffffff;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 6px 10px;
          min-width: 24px;
          transition: all 0.08s ease-in-out;
        }

        .strum-box.active-header-stroke {
          background: #3a86ff !important;
          border-color: #2667d4 !important;
          transform: translateY(-3px);
          box-shadow: 0 4px 10px rgba(58, 134, 255, 0.4);
        }
        /* Chord pill badge inside strumming lines */
        .strum-chord-tag {
          margin: 0 4px;
          background: #dbeafe !important;
          color: #1e40af !important;
          box-shadow: 0 0 0 2px #dbeafe !important;
          font-size: 0.85em;
        }
      `}</style>
        </div>
    );
};