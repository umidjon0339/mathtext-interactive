// app/linguistics/phonetics/page.tsx
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";

// ================== AUDIO SYSTEM ==================
// Global audio reference prevents overlapping audio playback
let currentAudio: HTMLAudioElement | null = null;

// ================== TYPES ==================
interface ExampleWord {
  word: string;
  ipa: string;
  position: "initial" | "middle" | "final";
}

interface LanguageExamples {
  us: ExampleWord[] | null;
  uk: ExampleWord[] | null;
  uz: ExampleWord[] | null;
}

interface LanguageSpellings {
  us: string[] | null;
  uk: string[] | null;
  uz: string[] | null;
}

interface Existence {
  us: boolean;
  uk: boolean;
  uz: boolean;
}

interface DifficultyPerLang {
  us: number;
  uk: number;
  uz: number;
}

interface CommonMistakes {
  uz: string[];
}

interface Learning {
  difficulty: DifficultyPerLang;
  common_mistakes: CommonMistakes;
  tips: string[];
}

interface Comparison {
  related_sounds: string[];
  minimal_pairs: string[][];
}

interface PlaceInfo {
  name: string;
  description: string;
}

interface MannerInfo {
  name: string;
  description: string;
}

interface Phonetics {
  voicing: "voiced" | "voiceless";
  place: PlaceInfo;
  manner: MannerInfo;
  airflow: "pulmonic";
}

interface Articulation {
  lips: string;
  tongue: string;
  vocal_cords: string;
  air_movement: string;
}

interface ChartPosition {
  row: string;
  column: string;
}

interface Practice {
  listen_words: string[];
  repeat_words: string[];
  quiz: string[];
}

interface Consonant {
  id: string;
  symbol: string;
  name: string;
  chart: ChartPosition;
  phonetics: Phonetics;
  articulation: Articulation;
  exists: Existence;
  spellings: LanguageSpellings;
  examples: LanguageExamples;
  comparison: Comparison;
  learning: Learning;
  practice: Practice;
}

interface AudioData {
  symbol: string;
  audio_url: string;
}

// ================== CONSTANTS ==================
const MANNER_ORDER = [
  "nasal",
  "plosive",
  "sibilant_fricative",
  "non_sibilant_fricative",
  "approximant",
  "tap_flap",
  "trill",
  "lateral_fricative",
  "lateral_approximant",
  "lateral_tap_flap",
];

const PLACE_ORDER = [
  "bilabial",
  "labiodental",
  "dental",
  "alveolar",
  "postalveolar",
  "retroflex",
  "palatal",
  "velar",
  "uvular",
  "pharyngeal",
  "glottal",
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

type LangFilter = "all" | "us" | "uk" | "uz";
type TabType = "overview" | "examples" | "learning" | "relations";

export default function PhoneticsPage() {
  const [consonants, setConsonants] = useState<Consonant[]>([]);
  const [audioMap, setAudioMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [langFilter, setLangFilter] = useState<LangFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [selectedConsonant, setSelectedConsonant] = useState<Consonant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Rich Tooltip (Hovercard) State
  const [hoveredConsonant, setHoveredConsonant] = useState<{ x: number; y: number; cons: Consonant; isActive: boolean } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // ================== MATRIX CALCULATION ==================
  const matrixData = useMemo(() => {
    if (!consonants.length) return [];
    const map: Record<string, Record<string, { voiceless: Consonant | null; voiced: Consonant | null }>> = {};
    for (const m of MANNER_ORDER) {
      map[m] = {};
      for (const p of PLACE_ORDER) map[m][p] = { voiceless: null, voiced: null };
    }
    for (const c of consonants) {
      const row = c.chart.row;
      const col = c.chart.column;
      if (map[row]?.[col]) {
        if (c.phonetics.voicing === "voiceless") map[row][col].voiceless = c;
        else map[row][col].voiced = c;
      }
    }
    return MANNER_ORDER.map((manner) => ({
      manner,
      cells: PLACE_ORDER.map((place) => ({ place, ...map[manner][place] })),
    }));
  }, [consonants]);

  const filteredMatrix = useMemo(() => {
    return matrixData.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        const vLessActive = langFilter === "all" || (cell.voiceless && cell.voiceless.exists[langFilter as keyof Existence]);
        const vActive = langFilter === "all" || (cell.voiced && cell.voiced.exists[langFilter as keyof Existence]);
        return { ...cell, voicelessActive: vLessActive, voicedActive: vActive, hasAnyActive: vLessActive || vActive };
      }),
    }));
  }, [matrixData, langFilter]);

  const searchedMatrix = useMemo(() => {
    if (!searchTerm.trim()) return filteredMatrix;
    const term = searchTerm.toLowerCase();
    return filteredMatrix
      .map((row) => ({
        ...row,
        cells: row.cells.map((cell) => {
          const matches = (c: Consonant | null) => {
            if (!c) return false;
            return (
              c.symbol.toLowerCase().includes(term) ||
              c.name.toLowerCase().includes(term) ||
              c.phonetics.place.name.toLowerCase().includes(term) ||
              c.phonetics.manner.name.toLowerCase().includes(term) ||
              (c.examples.us?.some((ex) => ex.word.toLowerCase().includes(term))) ||
              (c.examples.uk?.some((ex) => ex.word.toLowerCase().includes(term))) ||
              (c.examples.uz?.some((ex) => ex.word.toLowerCase().includes(term)))
            );
          };
          return { ...cell, highlight: matches(cell.voiceless) || matches(cell.voiced) };
        }),
      }))
      .filter((row) => row.cells.some((c) => c.highlight));
  }, [filteredMatrix, searchTerm]);

  // ================== AUDIO ==================
  const playConsonantAudio = (symbol: string) => {
    const url = audioMap[symbol];
    
    if (!url) {
      showToast(`Audio for /${symbol}/ is unavailable.`);
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    const audio = new Audio(url);
    currentAudio = audio;
    audio.play().catch((error) => {
      console.error("Audio playback failed:", error);
      showToast(`Audio for /${symbol}/ playback failed.`);
    });
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} "${text}"`);
  };

  // ================== HOVERCARD LOGIC ==================
  const handleMouseEnterCell = (e: React.MouseEvent, cons: Consonant, isActive: boolean) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    // Position tooltip slightly to the right and down, but close enough to easily "bridge" the mouse
    let x = e.clientX + 10;
    let y = e.clientY + 15;
    
    // Boundary checks
    if (x + 320 > window.innerWidth) x = e.clientX - 330;
    if (y + 200 > window.innerHeight) y = e.clientY - 210;

    setHoveredConsonant({ x, y, cons, isActive });
  };

  const handleMouseLeave = () => {
    // Increased timeout to 400ms so users have plenty of time to move mouse to the popup
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredConsonant(null);
    }, 400); 
  };

  const handleMouseEnterTooltip = () => {
    // If the mouse enters the tooltip before the 400ms timeout finishes, cancel the hiding
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  // ================== MODAL LOGIC ==================
  const openModal = (cons: Consonant) => {
    setHoveredConsonant(null); // Close tooltip
    setSelectedConsonant(cons);
    setActiveTab("overview");
    setIsModalOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedConsonant(null);
    document.body.style.overflow = "";
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, closeModal]);

  // Fetch both data sources concurrently
  useEffect(() => {
    Promise.all([
      fetch("/phonetics/consonants.json").then((res) => res.json()),
      fetch("/phonetics/audio_consonant.json").then((res) => res.json())
    ])
      .then(([consonantsData, audioData]: [Consonant[], AudioData[]]) => {
        setConsonants(consonantsData);
        
        // Convert Audio array to a fast Map lookup { "m": "https://...", "p": "https://..." }
        const map: Record<string, string> = {};
        audioData.forEach((item) => {
          map[item.symbol] = item.audio_url;
        });
        setAudioMap(map);
        
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load phonetics data:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBFF] dark:bg-[#1A1C1E] text-[#1A1C1E] dark:text-[#E2E2E6]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0061A4] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium tracking-wide">Loading IPA data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBFF] dark:bg-[#1A1C1E] text-[#1A1C1E] dark:text-[#E2E2E6] font-sans transition-colors duration-300">
      <div className="max-w-screen-2xl mx-auto p-4 md:p-8">
        <header className="flex flex-wrap justify-between items-start mb-8 gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#0061A4] dark:text-[#9ECAFF] mb-2">
              IPA Pulmonic Consonants
            </h1>
            <p className="text-lg text-[#43474E] dark:text-[#C3C6CF]">
              Interactive chart. <strong>Click</strong> to hear pronunciation. <strong>Hover</strong> for details.
            </p>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-full p-3 bg-[#D7E2FF] dark:bg-[#004A7D] text-[#001D36] dark:text-[#D7E2FF] hover:shadow-md transition-all active:scale-95"
            aria-label="Toggle dark mode"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </header>

        {/* Action Bar */}
        <div className="flex flex-wrap gap-4 mb-4 items-center justify-between bg-[#F2F0F4] dark:bg-[#2F3033] p-4 rounded-[2rem] shadow-sm">
          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
            {(["all", "us", "uk", "uz"] as const).map((lang) => {
              const isActive = langFilter === lang;
              const labels = { all: "🌍 All", us: "🇺🇸 US", uk: "🇬🇧 UK", uz: "🇺🇿 Uzbek" };
              return (
                <button
                  key={lang}
                  onClick={() => setLangFilter(lang)}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-[#0061A4] text-white dark:bg-[#9ECAFF] dark:text-[#003258] shadow-md"
                      : "bg-transparent text-[#43474E] dark:text-[#C3C6CF] border border-[#73777F] dark:border-[#8C9199] hover:bg-[#E0E2EC] dark:hover:bg-[#43474E]"
                  }`}
                >
                  {labels[lang]}
                </button>
              );
            })}
          </div>
          <div className="flex-1 min-w-[250px] relative max-w-md">
            <input
              type="text"
              placeholder="Search symbols, terms, or examples..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full bg-[#E0E2EC] dark:bg-[#43474E] text-[#1A1C1E] dark:text-[#E2E2E6] placeholder-[#73777F] dark:placeholder-[#8C9199] outline-none focus:ring-2 focus:ring-[#0061A4] dark:focus:ring-[#9ECAFF] transition-shadow"
            />
          </div>
        </div>

        {/* Legend */}
        {langFilter !== "all" && (
          <div className="flex gap-6 mb-4 px-4 text-sm font-medium text-[#43474E] dark:text-[#C3C6CF] animate-in fade-in">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border border-[#0061A4] dark:border-[#9ECAFF] bg-[#D7E2FF] dark:bg-[#004A7D] rounded-md"></div>
              <span>Exists in {langFilter.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border border-dashed border-[#73777F] dark:border-[#8C9199] bg-transparent opacity-50 rounded-md"></div>
              <span>Does not exist</span>
            </div>
          </div>
        )}

        {/* IPA Table Matrix */}
        <div ref={tableRef} className="rounded-[2rem] shadow-sm border border-[#E0E2EC] dark:border-[#43474E] bg-white dark:bg-[#1A1C1E] relative w-full overflow-hidden overflow-x-auto pb-4">
          <table className="w-full text-sm border-collapse table-auto">
            <thead className="bg-[#F2F0F4] dark:bg-[#2F3033]">
              <tr>
                <th rowSpan={2} className="px-4 py-4 text-left font-bold text-[#43474E] dark:text-[#C3C6CF] uppercase tracking-wider text-xs border-r border-b border-[#E0E2EC] dark:border-[#43474E] align-bottom whitespace-nowrap">
                  Place →<br />Manner ↓
                </th>
                <th colSpan={2} className="px-2 py-3 text-center font-bold text-[#43474E] dark:text-[#C3C6CF] border-r border-b border-[#E0E2EC] dark:border-[#43474E]">Labial</th>
                <th colSpan={4} className="px-2 py-3 text-center font-bold text-[#43474E] dark:text-[#C3C6CF] border-r border-b border-[#E0E2EC] dark:border-[#43474E]">Coronal</th>
                <th colSpan={3} className="px-2 py-3 text-center font-bold text-[#43474E] dark:text-[#C3C6CF] border-r border-b border-[#E0E2EC] dark:border-[#43474E]">Dorsal</th>
                <th colSpan={2} className="px-2 py-3 text-center font-bold text-[#43474E] dark:text-[#C3C6CF] border-r border-b border-[#E0E2EC] dark:border-[#43474E]">Laryngeal</th>
              </tr>
              <tr>
                {PLACE_ORDER.map((place) => (
                  <th key={place} className="px-2 py-3 text-center font-semibold text-[#1A1C1E] dark:text-[#E2E2E6] border-b border-r border-[#E0E2EC] dark:border-[#43474E]">
                    {capitalize(place)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {searchedMatrix.map((row, rowIndex) => (
                <tr key={row.manner} id={`row-${row.manner}`} className={`group ${rowIndex % 2 === 0 ? "bg-[#FDFBFF] dark:bg-[#1A1C1E]" : "bg-[#F8F9FF] dark:bg-[#1E1F22]"}`}>
                  <td className="bg-inherit border-b border-r border-[#E0E2EC] dark:border-[#43474E] px-4 py-3 font-medium text-[#43474E] dark:text-[#C3C6CF] group-hover:bg-[#E0E2EC] dark:group-hover:bg-[#43474E] transition-colors whitespace-nowrap">
                    {capitalize(row.manner)}
                  </td>
                  {row.cells.map((cell, idx) => {
                    const hasContent = cell.voiceless || cell.voiced;
                    return (
                      <td
                        key={idx}
                        className={`border-b border-r border-[#E0E2EC] dark:border-[#43474E] p-1.5 text-center align-middle transition-colors ${cell.highlight ? "bg-[#FFF3CD] dark:bg-[#4D4317]" : "hover:bg-[#F2F0F4] dark:hover:bg-[#2F3033]"}`}
                      >
                        {hasContent ? (
                          <div className="flex justify-center items-center gap-1 relative">
                            {cell.voiceless && (
                              <button
                                onMouseEnter={(e) => handleMouseEnterCell(e, cell.voiceless!, cell.voicelessActive!)}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => playConsonantAudio(cell.voiceless!.symbol)}
                                className={`w-10 h-10 flex items-center justify-center rounded-2xl text-xl font-serif shadow-sm transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-[#0061A4] cursor-pointer
                                ${cell.voicelessActive 
                                  ? "bg-white dark:bg-[#2F3033] text-[#1A1C1E] dark:text-[#E2E2E6] border border-[#E0E2EC] dark:border-[#43474E] hover:border-[#0061A4] dark:hover:border-[#9ECAFF] hover:text-[#0061A4] hover:bg-[#D7E2FF] dark:hover:bg-[#004A7D]" 
                                  : "bg-transparent text-[#73777F] dark:text-[#8C9199] border border-dashed border-[#CAC4D0] dark:border-[#49454F] opacity-40 hover:opacity-100 hover:bg-[#F2F0F4] dark:hover:bg-[#2F3033]"
                                }`}
                                aria-label={`Play voiceless ${row.manner} ${cell.place}`}
                              >
                                {cell.voiceless.symbol}
                              </button>
                            )}
                            {cell.voiced && (
                              <button
                                onMouseEnter={(e) => handleMouseEnterCell(e, cell.voiced!, cell.voicedActive!)}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => playConsonantAudio(cell.voiced!.symbol)}
                                className={`w-10 h-10 flex items-center justify-center rounded-2xl text-xl font-serif shadow-sm transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-[#0061A4] cursor-pointer
                                ${cell.voicedActive 
                                  ? "bg-white dark:bg-[#2F3033] text-[#1A1C1E] dark:text-[#E2E2E6] border border-[#E0E2EC] dark:border-[#43474E] hover:border-[#0061A4] dark:hover:border-[#9ECAFF] hover:text-[#0061A4] hover:bg-[#D7E2FF] dark:hover:bg-[#004A7D]" 
                                  : "bg-transparent text-[#73777F] dark:text-[#8C9199] border border-dashed border-[#CAC4D0] dark:border-[#49454F] opacity-40 hover:opacity-100 hover:bg-[#F2F0F4] dark:hover:bg-[#2F3033]"
                                }`}
                                aria-label={`Play voiced ${row.manner} ${cell.place}`}
                              >
                                {cell.voiced.symbol}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#C3C6CF] dark:text-[#43474E] select-none text-opacity-50 font-light">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Global Toast */}
        {toastMessage && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#313033] dark:bg-[#E2E2E6] text-[#F4EFF4] dark:text-[#313033] px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-3 font-medium animate-in fade-in slide-in-from-bottom-4">
            <svg className="w-5 h-5 text-red-400 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {toastMessage}
          </div>
        )}

        {/* Rich Hovercard (Wikipedia Style) */}
        {hoveredConsonant && (
          <div
            className="fixed z-40 bg-[#FDFBFF] dark:bg-[#1A1C1E] border border-[#E0E2EC] dark:border-[#43474E] text-[#1A1C1E] dark:text-[#E2E2E6] rounded-2xl p-5 shadow-2xl w-80 pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
            style={{ left: hoveredConsonant.x, top: hoveredConsonant.y }}
            onMouseEnter={handleMouseEnterTooltip}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex items-start gap-4 mb-3 border-b border-[#E0E2EC] dark:border-[#43474E] pb-3">
              <div className="text-5xl font-serif text-[#0061A4] dark:text-[#9ECAFF] leading-none shrink-0">
                {hoveredConsonant.cons.symbol}
              </div>
              <div>
                <h4 className="font-bold text-base capitalize leading-tight mb-1">{hoveredConsonant.cons.name}</h4>
                <p className="text-xs font-mono bg-[#E0E2EC] dark:bg-[#43474E] inline-block px-2 py-0.5 rounded-full text-[#43474E] dark:text-[#C3C6CF]">
                  {hoveredConsonant.cons.phonetics.voicing}
                </p>
              </div>
            </div>

            {!hoveredConsonant.isActive && langFilter !== "all" && (
              <div className="bg-[#FFDAD6] text-[#410002] dark:bg-[#93000A] dark:text-[#FFDAD6] text-xs px-3 py-2 rounded-lg mb-3 font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                Does not occur naturally in {langFilter.toUpperCase()}
              </div>
            )}

            <p className="text-sm text-[#43474E] dark:text-[#C3C6CF] mb-4 line-clamp-3">
              {hoveredConsonant.cons.phonetics.manner.description} This sound is articulated at the {hoveredConsonant.cons.phonetics.place.name}.
            </p>

            <button
              onClick={() => openModal(hoveredConsonant.cons)}
              className="w-full py-2.5 bg-[#0061A4] text-white dark:bg-[#9ECAFF] dark:text-[#003258] rounded-full text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              View Full Details
            </button>
          </div>
        )}

        {/* Enhanced Tabbed Modal Dialog */}
        {isModalOpen && selectedConsonant && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-8 transition-opacity" onClick={closeModal} role="dialog">
            <div className="bg-[#FDFBFF] dark:bg-[#1A1C1E] rounded-[1.75rem] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="bg-[#D7E2FF] dark:bg-[#004A7D] px-8 py-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-6">
                  <span className="text-6xl font-serif text-[#001D36] dark:text-[#D7E2FF] bg-white/40 dark:bg-black/20 rounded-2xl w-24 h-24 flex items-center justify-center shadow-inner">
                    {selectedConsonant.symbol}
                  </span>
                  <div>
                    <h2 className="text-3xl font-bold text-[#001D36] dark:text-[#D7E2FF]">{selectedConsonant.name}</h2>
                    <p className="text-[#0061A4] dark:text-[#9ECAFF] font-medium mt-1">Pulmonic Consonant</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <button onClick={closeModal} className="p-2 rounded-full text-[#001D36] dark:text-[#D7E2FF] hover:bg-black/10 transition-colors" aria-label="Close dialog">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                  <button
                    onClick={() => playConsonantAudio(selectedConsonant.symbol)}
                    className="px-5 py-2 rounded-full bg-[#001D36] text-white dark:bg-[#D7E2FF] dark:text-[#001D36] font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"/></svg>
                    Play Audio
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-[#E0E2EC] dark:border-[#43474E] px-8 pt-3 bg-[#F2F0F4] dark:bg-[#2F3033] overflow-x-auto hide-scrollbar shrink-0">
                {(
                  [
                    { id: "overview", label: "Overview" },
                    { id: "examples", label: "Examples" },
                    { id: "learning", label: "Learning & Tips" },
                    { id: "relations", label: "Relations" }
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-3 font-bold text-sm whitespace-nowrap transition-colors relative border-b-2 ${
                      activeTab === tab.id
                        ? "text-[#0061A4] dark:text-[#9ECAFF] border-[#0061A4] dark:border-[#9ECAFF]"
                        : "text-[#73777F] dark:text-[#8C9199] border-transparent hover:text-[#1A1C1E] dark:hover:text-[#E2E2E6] hover:bg-black/5 dark:hover:bg-white/5 rounded-t-lg"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Body */}
              <div className="p-8 overflow-y-auto flex-1 bg-[#FDFBFF] dark:bg-[#1A1C1E]">
                
                {/* 1. OVERVIEW TAB */}
                {activeTab === "overview" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <section>
                      <h3 className="text-xl font-bold text-[#1A1C1E] dark:text-[#E2E2E6] mb-4">Articulation Profile</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#F2F0F4] dark:bg-[#2F3033] p-4 rounded-2xl">
                          <span className="text-sm text-[#73777F] dark:text-[#8C9199] block mb-1">Voicing</span>
                          <span className="font-bold text-lg capitalize text-[#1A1C1E] dark:text-[#E2E2E6]">{selectedConsonant.phonetics.voicing}</span>
                        </div>
                        <div className="bg-[#F2F0F4] dark:bg-[#2F3033] p-4 rounded-2xl">
                          <span className="text-sm text-[#73777F] dark:text-[#8C9199] block mb-1">Airflow</span>
                          <span className="font-bold text-lg capitalize text-[#1A1C1E] dark:text-[#E2E2E6]">{selectedConsonant.phonetics.airflow}</span>
                        </div>
                        <div className="bg-[#F2F0F4] dark:bg-[#2F3033] p-5 rounded-2xl col-span-2">
                          <span className="text-sm text-[#73777F] dark:text-[#8C9199] block mb-1">Place of Articulation</span>
                          <span className="font-bold text-xl capitalize text-[#0061A4] dark:text-[#9ECAFF]">{selectedConsonant.phonetics.place.name}</span>
                          <p className="text-sm mt-2 text-[#43474E] dark:text-[#C3C6CF] leading-relaxed">{selectedConsonant.phonetics.place.description}</p>
                        </div>
                        <div className="bg-[#F2F0F4] dark:bg-[#2F3033] p-5 rounded-2xl col-span-2">
                          <span className="text-sm text-[#73777F] dark:text-[#8C9199] block mb-1">Manner of Articulation</span>
                          <span className="font-bold text-xl capitalize text-[#0061A4] dark:text-[#9ECAFF]">{selectedConsonant.phonetics.manner.name}</span>
                          <p className="text-sm mt-2 text-[#43474E] dark:text-[#C3C6CF] leading-relaxed">{selectedConsonant.phonetics.manner.description}</p>
                        </div>
                      </div>
                    </section>
                    <section>
                      <h3 className="text-xl font-bold text-[#1A1C1E] dark:text-[#E2E2E6] mb-4">Physical Mechanism</h3>
                      <div className="bg-[#E0E2EC] dark:bg-[#43474E] p-6 rounded-2xl space-y-4">
                        <div className="flex gap-4"><span className="font-bold w-32 shrink-0">Lips:</span> <span>{selectedConsonant.articulation.lips}</span></div>
                        <div className="flex gap-4"><span className="font-bold w-32 shrink-0">Tongue:</span> <span>{selectedConsonant.articulation.tongue}</span></div>
                        <div className="flex gap-4"><span className="font-bold w-32 shrink-0">Vocal cords:</span> <span>{selectedConsonant.articulation.vocal_cords}</span></div>
                        <div className="flex gap-4"><span className="font-bold w-32 shrink-0">Air movement:</span> <span>{selectedConsonant.articulation.air_movement}</span></div>
                      </div>
                    </section>
                  </div>
                )}

                {/* 2. EXAMPLES TAB */}
                {activeTab === "examples" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <section>
                      <h3 className="text-xl font-bold text-[#1A1C1E] dark:text-[#E2E2E6] mb-4">Common Spellings</h3>
                      <div className="grid grid-cols-3 gap-4">
                        {(["us", "uk", "uz"] as const).map(lang => (
                          <div key={lang} className="border border-[#E0E2EC] dark:border-[#43474E] rounded-2xl p-4 text-center">
                            <span className="block text-xs font-bold text-[#73777F] dark:text-[#8C9199] mb-2 uppercase">{lang}</span>
                            <span className="font-medium text-lg text-[#1A1C1E] dark:text-[#E2E2E6]">{selectedConsonant.spellings[lang]?.join(", ") || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xl font-bold text-[#1A1C1E] dark:text-[#E2E2E6] mb-4">Words in Context</h3>
                      <div className="space-y-6">
                        {[
                          { lang: "US English", flag: "🇺🇸", data: selectedConsonant.examples.us },
                          { lang: "UK English", flag: "🇬🇧", data: selectedConsonant.examples.uk },
                          { lang: "Uzbek", flag: "🇺🇿", data: selectedConsonant.examples.uz }
                        ].map((dataset, idx) => dataset.data && (
                          <div key={idx} className="bg-[#F2F0F4] dark:bg-[#2F3033] rounded-2xl p-5">
                            <div className="font-bold text-[#0061A4] dark:text-[#9ECAFF] mb-4 flex items-center gap-2 text-lg">
                              <span>{dataset.flag}</span> {dataset.lang}
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                              {dataset.data.map((ex, i) => (
                                <div key={i} className="flex justify-between items-center bg-white dark:bg-[#1A1C1E] px-4 py-3 rounded-xl shadow-sm border border-[#E0E2EC] dark:border-[#43474E]">
                                  <div>
                                    <span className="font-bold text-[#1A1C1E] dark:text-[#E2E2E6]">{ex.word}</span>
                                    <span className="text-xs text-[#73777F] dark:text-[#8C9199] ml-2 block sm:inline capitalize">({ex.position})</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[#43474E] dark:text-[#C3C6CF] font-medium">/{ex.ipa}/</span>
                                    <button onClick={() => copyToClipboard(ex.ipa, "IPA")} className="text-[#0061A4] dark:text-[#9ECAFF] hover:opacity-70 p-1.5 bg-[#D7E2FF] dark:bg-[#004A7D] rounded-lg">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {/* 3. LEARNING TAB */}
                {activeTab === "learning" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <section>
                      <h3 className="text-xl font-bold text-[#1A1C1E] dark:text-[#E2E2E6] mb-4">Pronunciation Tips</h3>
                      <ul className="space-y-4">
                        {selectedConsonant.learning.tips.map((tip, i) => (
                          <li key={i} className="flex gap-4 text-[#1A1C1E] dark:text-[#E2E2E6] bg-[#F2F0F4] dark:bg-[#2F3033] p-4 rounded-xl">
                            <span className="text-[#0061A4] dark:text-[#9ECAFF] font-bold text-lg leading-none">💡</span>
                            <span className="leading-relaxed font-medium">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                    
                    <section>
                      <h3 className="text-xl font-bold text-[#1A1C1E] dark:text-[#E2E2E6] mb-4">Difficulty Matrix</h3>
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        {(["us", "uk", "uz"] as const).map(lang => (
                          <div key={lang} className="bg-[#E0E2EC] dark:bg-[#43474E] p-4 rounded-2xl text-center">
                            <span className="block text-sm font-bold text-[#43474E] dark:text-[#C3C6CF] mb-2 uppercase">{lang}</span>
                            <div className="flex justify-center gap-1">
                              {[1,2,3,4,5].map((star) => (
                                <span key={star} className={`text-2xl ${star <= selectedConsonant.learning.difficulty[lang] ? "text-yellow-500" : "text-[#CAC4D0] dark:text-[#73777F]"}`}>★</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {selectedConsonant.learning.common_mistakes.uz.length > 0 && (
                      <section>
                         <h3 className="text-xl font-bold text-[#1A1C1E] dark:text-[#E2E2E6] mb-4">Common Errors (Uzbek learners)</h3>
                         <div className="bg-[#FFDAD6] text-[#410002] dark:bg-[#93000A] dark:text-[#FFDAD6] p-5 rounded-2xl">
                           <ul className="list-disc list-inside space-y-2 font-medium">
                             {selectedConsonant.learning.common_mistakes.uz.map((err, i) => (
                               <li key={i}>{err}</li>
                             ))}
                           </ul>
                         </div>
                      </section>
                    )}
                  </div>
                )}

                {/* 4. RELATIONS TAB */}
                {activeTab === "relations" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <section>
                      <h3 className="text-xl font-bold text-[#1A1C1E] dark:text-[#E2E2E6] mb-4">Minimal Pairs</h3>
                      {selectedConsonant.comparison.minimal_pairs.length > 0 ? (
                        <div className="grid gap-3">
                          {selectedConsonant.comparison.minimal_pairs.map((pair, i) => (
                            <div key={i} className="flex items-center justify-between bg-[#F2F0F4] dark:bg-[#2F3033] px-6 py-4 rounded-2xl shadow-sm border border-[#E0E2EC] dark:border-[#43474E]">
                              <div className="flex items-center gap-6 text-xl font-bold">
                                <span className="text-[#0061A4] dark:text-[#9ECAFF] w-24 text-right">{pair[0]}</span>
                                <span className="text-[#73777F] dark:text-[#8C9199] text-sm italic font-normal">vs</span>
                                <span className="text-[#1A1C1E] dark:text-[#E2E2E6] w-24 text-left">{pair[1]}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[#43474E] dark:text-[#C3C6CF] italic">No minimal pairs recorded for this sound.</p>
                      )}
                    </section>

                    <section>
                      <h3 className="text-xl font-bold text-[#1A1C1E] dark:text-[#E2E2E6] mb-4">Related Sounds</h3>
                      <div className="flex flex-wrap gap-3">
                        {selectedConsonant.comparison.related_sounds.map((rel) => (
                          <span key={rel} className="bg-[#D7E2FF] text-[#001D36] dark:bg-[#004A7D] dark:text-[#D7E2FF] px-6 py-3 rounded-full text-2xl font-serif shadow-sm">
                            {rel}
                          </span>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}