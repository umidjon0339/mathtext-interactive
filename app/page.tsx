"use client";

import { useEffect, useState, useRef } from "react";
import { InlineMath } from "react-katex";
import Confetti from "react-confetti";
import { evaluate } from "mathjs";
import "katex/dist/katex.min.css";
import {
  Play, BookOpen, Lightbulb, Volume2, ChevronDown, Search,
  ClipboardCheck, Target, Star, Columns, Minimize2, Maximize2,
  Sun, Moon, Eye, EyeOff, Languages, BookA,
  X, ChevronLeft, ChevronRight, ImageIcon
} from "lucide-react";

// ---------- Types ----------
type MultilingualString = Record<string, string>;

interface InlinePlain { type: "plain"; text: string }
interface InlineTerm { type: "term"; id: string; display: string }
interface InlineMathNode { type: "math"; latex: string }
interface InlineStyled { type: "bold" | "italic" | "underline"; text: InlineNode[] }
interface InlineHighlight { type: "highlight"; text: InlineNode[] }

type InlineNode = InlinePlain | InlineTerm | InlineMathNode | InlineStyled | InlineHighlight;

interface BlockBase { type: string; id?: string | number }

interface LearningTargetBlock extends BlockBase { type: "learning_target"; target: Record<string, InlineNode[]>; success_criteria?: Record<string, InlineNode[][]>; }
interface ExploreItBlock extends BlockBase { type: "explore_it"; header?: { title: MultilingualString }; margin_content?: BlockBase[]; body: BlockBase[]; }
interface LessonConceptBlock extends BlockBase { type: "lesson_concept"; title: MultilingualString; margin_content?: BlockBase[]; body: BlockBase[]; }
interface ExampleBlock extends BlockBase { type: "example_block"; has_video?: boolean; label: MultilingualString; title: MultilingualString; margin_content?: BlockBase[]; body: BlockBase[]; hints?: Record<string, InlineNode[][]>; }
interface SelfAssessmentBlock extends BlockBase { type: "self_assessment_block"; title: MultilingualString; rating_scale: { value: number; text: MultilingualString }[]; body: BlockBase[]; }
interface ParagraphBlock extends BlockBase { type: "paragraph"; text: Record<string, InlineNode[]>; }
interface InstructionTextBlock extends BlockBase { type: "instruction_text"; text: Record<string, InlineNode[]>; }
interface BulletListBlock extends BlockBase { type: "bullet_list"; items: Record<string, InlineNode[]>[]; }
interface EquationGridBlock extends BlockBase { type: "equation_grid"; columns: number; align: "left" | "center"; items: { id: string; latex: string }[]; }
interface QuestionGridBlock extends BlockBase { type: "question_grid"; columns: number; items: { id: string; label: string; latex: string; expected?: string }[]; }
interface CardTilesBlock extends BlockBase { type: "card_tiles"; tiles: { id: string; latex: string }[]; }
interface WorkedSolutionsBlock extends BlockBase { type: "worked_solutions"; steps: { label?: string; expression?: string; work: { line: string; explanation: Record<string, InlineNode[]> }[] }[]; }
interface KeyIdeasBoxBlock extends BlockBase { type: "key_ideas_box"; style?: string; title: MultilingualString; concepts: { subtitle: MultilingualString; matrix: { label: MultilingualString; text?: Record<string, InlineNode[]>; latex?: string; translations?: Record<string, { latex: string }> }[]; content?: BlockBase[]; }[]; }
interface VocabularyBoxBlock extends BlockBase { type: "vocabulary_box"; icon?: string; title: MultilingualString; terms: { term: MultilingualString; reference: string }[]; }
interface StudyTipBoxBlock extends BlockBase { type: "study_tip_box"; icon?: string; title: MultilingualString; text: Record<string, InlineNode[]>; }
interface MtrBadgeBlock extends BlockBase { type: "mtr_badge"; id: number; badge: string; prompt: Record<string, InlineNode[]>; }
interface ImageBlock extends BlockBase { type: "image"; src: string; style?: string; alt: MultilingualString; }
interface VideoBlock extends BlockBase { type: "video"; src: string; poster?: string; }
interface TaskBlock extends BlockBase { type: "task_block"; label?: string; level: number; instruction: Record<string, InlineNode[]>; content?: BlockBase[]; }
interface PropertyMatrixBlock extends BlockBase {
  type: "property_matrix";
  rows: {
    label: MultilingualString;
    text?: Record<string, InlineNode[]>;
    latex?: string;
    translations?: Record<string, { latex: string }>;
  }[];
}

type Block = LearningTargetBlock | ExploreItBlock | LessonConceptBlock | ExampleBlock | SelfAssessmentBlock | ParagraphBlock | InstructionTextBlock | BulletListBlock | EquationGridBlock | QuestionGridBlock | CardTilesBlock | WorkedSolutionsBlock | KeyIdeasBoxBlock | VocabularyBoxBlock | StudyTipBoxBlock | MtrBadgeBlock | ImageBlock | VideoBlock | TaskBlock | PropertyMatrixBlock;

interface Lesson { id: string; title: MultilingualString; langs: string[]; blocks: Block[]; }
interface DictionaryEntry { id: string; word: MultilingualString; definition: MultilingualString; images: string[]; examples: Record<string, string[]>; relatedConcepts: string[]; }
type Dictionary = Record<string, DictionaryEntry>;

// ---------- Helpers ----------
function pickLang<T extends Record<string, any>>(obj: T, lang: string): T[keyof T] | undefined {
  return obj[lang] || obj["en"];
}
// ---------- FIXED TermTooltip ----------
function TermTooltip({ entry, lang, dictionary, onTermClick, children }: { entry: DictionaryEntry; lang: string; dictionary: Dictionary; onTermClick: (id: string) => void; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const tw = 340, th = 260;
    let top = rect.bottom + 8, left = rect.left + rect.width / 2 - tw / 2;
    if (top + th > window.innerHeight - 10) top = rect.top - th - 8;
    if (left < 8) left = 8;
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    setPos({ top, left });
    setShow(true);
  };
  const handleLeave = () => { hideTimeout.current = setTimeout(() => setShow(false), 200); };

  // ✅ Guaranteed to be a string array (not undefined)
  const examples = (pickLang(entry.examples, lang) || pickLang(entry.examples, "en") || []) as string[];

  return (
    <span className="relative inline" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button ref={buttonRef} onClick={() => onTermClick(entry.id)} className="font-semibold underline decoration-dotted underline-offset-2 text-primary-600 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200">
        {children}
      </button>
      {show && (
        <div ref={tooltipRef} className="fixed z-[100] bg-surface-container-lowest border border-border rounded-2xl shadow-2xl p-4 w-80 text-sm" style={{ top: `${pos.top}px`, left: `${pos.left}px` }} onMouseEnter={() => hideTimeout.current && clearTimeout(hideTimeout.current)} onMouseLeave={handleLeave}>
          {entry.images?.[0] && <img src={entry.images[0]} alt="" className="w-full h-32 object-contain rounded-lg mb-3 bg-surface" />}
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-on-surface">{entry.word[lang] || entry.word.en || entry.word.uz || entry.word.ru}</p>
            <button onClick={(e) => { e.stopPropagation(); onTermClick(entry.id); }} className="text-xs text-primary-600 dark:text-primary-400 hover:underline"><BookOpen className="w-4 h-4" /></button>
          </div>
          <p className="text-on-surface-variant leading-relaxed">{pickLang(entry.definition, lang) || pickLang(entry.definition, "en")}</p>
          {examples.length > 0 && <p className="text-xs text-on-surface-variant mt-2 italic">e.g., {examples[0]}</p>}
        </div>
      )}
    </span>
  );
}

// ---------- InlineText ----------
function InlineText({ nodes, dictionary, onTermClick, lang }: { nodes: InlineNode[]; dictionary: Dictionary; onTermClick: (id: string) => void; lang: string }) {
  if (!nodes) return null;
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "term") {
          const entry = dictionary[node.id];
          if (!entry) return <span key={i}>{node.display}</span>;
          return <TermTooltip key={i} entry={entry} lang={lang} dictionary={dictionary} onTermClick={onTermClick}>{node.display}</TermTooltip>;
        }
        if (node.type === "math") return <InlineMath key={i} math={node.latex} />;
        if (node.type === "plain") return <span key={i}>{node.text}</span>;
        if (node.type === "bold") return <strong key={i}><InlineText nodes={node.text} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></strong>;
        if (node.type === "italic") return <em key={i}><InlineText nodes={node.text} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></em>;
        if (node.type === "underline") return <u key={i}><InlineText nodes={node.text} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></u>;
        if (node.type === "highlight") return <mark key={i} className="bg-accent-100 dark:bg-accent-800/30 rounded px-1.5 py-0.5"><InlineText nodes={node.text} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></mark>;
        return null;
      })}
    </>
  );
}

// ---------- Collapsible Worked Solution ----------
function CollapsibleWorkedSolution({ block, dictionary, onTermClick, lang }: { block: WorkedSolutionsBlock; dictionary: Dictionary; onTermClick: (id: string) => void; lang: string }) {
  const l = (obj: any) => pickLang(obj, lang);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  return (
    <div className="space-y-3">
      {block.steps.map((step, idx) => {
        const isOpen = openSteps[idx] ?? false;
        return (
          <div key={idx} className="bg-surface-alt rounded-xl p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {step.label && <span className="font-bold text-primary-700 dark:text-primary-300">{step.label} </span>}
                {step.expression && <InlineMath math={step.expression} />}
              </div>
              <button onClick={() => setOpenSteps((prev) => ({ ...prev, [idx]: !isOpen }))} className="px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition">
                {isOpen ? "Hide Solution" : "Show Solution"}
              </button>
            </div>
            {isOpen && (
              <div className="mt-3 space-y-3">
                {step.work.map((line, j) => (
                  <div key={j} className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="sm:w-48 shrink-0 bg-surface-container-lowest p-2 rounded-lg"><InlineMath math={line.line} /></div>
                    <div className="text-sm text-on-surface-variant flex-1 italic"><InlineText nodes={l(line.explanation)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Self Assessment Block View ----------
function SelfAssessmentBlockView({ block, dictionary, onTermClick, lang, hideRatingScale = false }: { block: SelfAssessmentBlock; dictionary: Dictionary; onTermClick: (id: string) => void; lang: string; hideRatingScale?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [score, setScore] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const l = (obj: any) => pickLang(obj, lang);

  const handleAnswerChange = (id: string, value: string) => setAnswers((prev) => ({ ...prev, [id]: value }));
  const checkAnswer = (id: string, expected?: string) => {
    if (!expected) return;
    setSubmitted((prev) => ({ ...prev, [id]: true }));
    const userAnswer = answers[id]?.trim() || "";
    try {
      const userVal = evaluate(userAnswer.replace(/\\/g, ""));
      const expectedVal = evaluate(expected.replace(/\\/g, ""));
      if (Math.abs(userVal - expectedVal) < 1e-9) return true;
    } catch { if (userAnswer === expected) return true; }
    return false;
  };

  const allQuestionItems = block.body.flatMap((b) => b.type === "question_grid" ? (b as QuestionGridBlock).items : []);

  const handleSubmit = () => {
    let correct = 0;
    allQuestionItems.forEach((item) => { if (item.expected && checkAnswer(item.id, item.expected)) correct++; });
    setScore(correct);
    if (correct === allQuestionItems.filter(i => i.expected).length) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  return (
    <div className="w-full">
      {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}
      {!hideRatingScale && (
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-6 pb-5 border-b border-border">
          <div className="shrink-0">
            <h3 className="text-lg font-bold text-on-surface uppercase tracking-wider">{l(block.title) || "SELF-ASSESSMENT"}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">How well do you understand?</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-[1200px] mx-auto">
            {block.rating_scale.map((r) => {
              const isSelected = selected === r.value;
              return (
                <button key={r.value} onClick={() => setSelected(r.value)} className={`flex items-center w-full shadow-sm rounded overflow-hidden select-none text-left transition-all ${isSelected ? "ring-2 ring-accent-500 ring-offset-2 dark:ring-offset-slate-800 scale-[1.01]" : "opacity-85 hover:opacity-100"}`}>
                  <span className="w-7 h-7 bg-accent-500 text-white text-xs font-black flex items-center justify-center shrink-0">{r.value}</span>
                  <span className="flex-1 bg-surface-container-lowest text-on-surface text-xs font-medium px-3 py-1 border-y border-r border-accent-500/30 rounded-r whitespace-nowrap overflow-hidden text-ellipsis">{l(r.text)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="bg-surface-alt/60 border border-border p-5 sm:p-6 rounded-2xl">
        <div className="space-y-5 text-on-surface">
          {block.body.map((b, i) => {
            if (b.type === "question_grid") {
              const grid = b as QuestionGridBlock;
              return (
                <div key={i} className={`grid gap-4 ${grid.columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                  {grid.items.map((item) => (
                    <div key={item.id} className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-surface-container-high">
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-primary-500 dark:text-primary-400 text-base shrink-0 min-w-[1.25rem]">{item.label}</span>
                        <div className="text-on-surface font-medium"><InlineMath math={item.latex} /></div>
                      </div>
                      {item.expected && (
                        <div className="flex gap-2 items-center shrink-0 sm:w-48 relative">
                          <input type="text" value={answers[item.id] || ""} onChange={(e) => handleAnswerChange(item.id, e.target.value)} className="border border-outline-variant dark:border-outline rounded-lg px-3 py-1.5 text-xs bg-surface-container-lowest w-full shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-500 pr-7" placeholder="Your answer" />
                          {submitted[item.id] && (
                            <span className={`absolute right-2.5 font-bold text-sm ${checkAnswer(item.id, item.expected) ? "text-accent-600" : "text-error"}`}>{checkAnswer(item.id, item.expected) ? "✓" : "✗"}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            }
            return <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />;
          })}
        </div>
        {allQuestionItems.some((item) => item.expected) && (
          <div className="mt-6 pt-4 border-t border-outline-variant/50 flex gap-4 items-center">
            <button onClick={handleSubmit} className="bg-primary-600 hover:bg-primary-700 active:scale-95 text-white px-5 py-2 rounded-xl font-bold transition text-xs tracking-wider uppercase shadow-sm">Check Answers</button>
            {score !== null && <p className="text-sm font-semibold text-on-surface">You got <span className="text-primary-600 dark:text-primary-400 font-bold text-base">{score}</span> / {allQuestionItems.filter(i => i.expected).length} correct</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Block Renderer ----------
function BlockRenderer({ block, dictionary, onTermClick, lang, compact = false, globalCollapsed = false }: { block: Block; dictionary: Dictionary; onTermClick: (id: string) => void; lang: string; compact?: boolean; globalCollapsed?: boolean }) {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const collapsed = globalCollapsed || localCollapsed;
  const l = (obj: any) => pickLang(obj, lang);

  const CollapseToggle = () => (
    <button onClick={() => setLocalCollapsed(!localCollapsed)} className="ml-2 p-1 rounded-full hover:bg-surface-container-high transition" title={localCollapsed ? "Expand" : "Collapse"}>
      {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-180" />}
    </button>
  );

  const CardWrapper = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-2xl bg-surface-container-lowest shadow-sm border border-border overflow-hidden ${className}`}>{children}</div>
  );

  switch (block.type) {
    case "learning_target":
      return (
        <div className="mb-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="flex items-stretch bg-primary-50 dark:bg-primary-950/20 pt-3 pb-3 px-3 border-b border-border">
            <div className="bg-surface-container-lowest border-2 border-primary-600 rounded-lg px-3 sm:px-5 py-1.5 flex items-center justify-center relative z-10 translate-x-3 shadow-sm min-w-[9.5rem] sm:min-w-[11rem]">
              <span className="text-primary-600 dark:text-primary-400 font-extrabold uppercase tracking-widest text-sm sm:text-base whitespace-nowrap">🎯 Target</span>
            </div>
            <div className="bg-primary-600 flex-1 flex items-center justify-between pl-6 sm:pl-8 pr-4 py-2 rounded-lg shadow-sm">
              <h2 className="text-white font-bold text-sm sm:text-lg tracking-wide">Learning Target</h2>
              <div className="text-white ml-4"><CollapseToggle /></div>
            </div>
          </div>
          {!collapsed && (
            <div className="p-5 sm:p-8 space-y-6">
              <div className="text-on-surface font-medium text-base leading-[1.75]">
                <InlineText nodes={l(block.target)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
              </div>
              {block.success_criteria && (
                <div className="bg-primary-50/50 dark:bg-primary-900/20 rounded-xl p-5">
                  <h3 className="font-semibold text-on-primary-container mb-3 text-sm uppercase tracking-wider">✅ Success Criteria</h3>
                  <ul className="space-y-3">
                    {l(block.success_criteria)?.map((crit: InlineNode[], idx: number) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-200 dark:bg-primary-800 text-on-primary-container text-xs font-bold mt-0.5">{idx + 1}</span>
                        <span className="text-on-surface text-sm leading-relaxed"><InlineText nodes={crit} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      );

    case "explore_it": {
      return (
        <div className="mb-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-border overflow-hidden">
          {block.header && (
            <div className="flex items-stretch bg-surface-alt pt-3 pb-3 px-3 border-b border-border">
              <div className="bg-surface-container-lowest border-2 border-primary-600 rounded-lg px-3 sm:px-5 py-1.5 flex items-center justify-center relative z-10 translate-x-3 shadow-sm min-w-[9.5rem] sm:min-w-[11rem]">
                <span className="text-primary-600 dark:text-primary-400 font-extrabold uppercase tracking-widest text-sm sm:text-base whitespace-nowrap">Explore It!</span>
              </div>
              <div className="bg-primary-600 flex-1 flex items-center justify-between pl-6 sm:pl-8 pr-4 py-2 rounded-lg shadow-sm">
                <h2 className="text-white font-bold text-sm sm:text-lg tracking-wide truncate">{l(block.header.title)}</h2>
                <div className="text-white ml-4"><CollapseToggle /></div>
              </div>
            </div>
          )}
          {!collapsed && (
            <div className="p-5 sm:p-8">
              {block.margin_content && block.margin_content.length > 0 && (
                <div className="mb-6 flex justify-end">
                  <details className="group relative z-20">
                    <summary className="list-none cursor-pointer flex items-center gap-2 bg-primary-50 hover:bg-primary-100 dark:bg-surface-container-high dark:hover:bg-surface-container-highest text-primary-600 dark:text-primary-400 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider border border-primary-200 dark:border-primary-900/30 shadow-sm transition-all duration-200">
                      <span className="bg-primary-600 text-white px-2 py-0.5 rounded-md text-[10px]">1 MTR</span>
                      Analyze a Problem
                      <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="absolute right-0 top-full mt-2 w-72 bg-surface-container-lowest p-5 rounded-xl shadow-2xl border border-primary-100 dark:border-primary-900/30 origin-top-right animate-fade-in-down">
                      {block.margin_content.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={true} />)}
                    </div>
                  </details>
                </div>
              )}
              <div className="space-y-8 text-on-surface text-base leading-[1.75] tracking-[0.01em]">
                {block.body.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
              </div>
            </div>
          )}
        </div>
      );
    }

    case "lesson_concept":
      return (
        <div className="mb-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="flex items-stretch bg-primary-50 dark:bg-primary-950/20 pt-3 pb-3 px-3 border-b border-border">
            <div className="bg-surface-container-lowest border-2 border-primary-600 rounded-lg px-3 sm:px-5 py-1.5 flex items-center justify-center relative z-10 translate-x-3 shadow-sm min-w-[9.5rem] sm:min-w-[11rem]">
              <span className="text-primary-600 dark:text-primary-400 font-extrabold uppercase tracking-widest text-sm sm:text-base whitespace-nowrap">📘 Concept</span>
            </div>
            <div className="bg-primary-600 flex-1 flex items-center justify-between pl-6 sm:pl-8 pr-4 py-2 rounded-lg shadow-sm">
              <h3 className="text-white font-bold text-sm sm:text-lg tracking-wide truncate">{l(block.title)}</h3>
              <div className="text-white ml-4"><CollapseToggle /></div>
            </div>
          </div>
          {!collapsed && (
            <div className="p-5 sm:p-8 space-y-8">
              {block.margin_content && block.margin_content.length > 0 && (
                <div className="bg-surface-container-high p-5 rounded-xl border border-primary-100 dark:border-primary-900/30">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-primary-100/80 dark:border-primary-900/30 select-none">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <BookOpen className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <span className="font-bold text-xs uppercase tracking-widest text-primary-700 dark:text-primary-400">Vocabulary</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {block.margin_content.map((b, i) => {
                      if (b.type === "vocabulary_box") {
                        const vBlock = b as VocabularyBoxBlock;
                        return vBlock.terms.map((term, idx) => {
                          const vocabId = Object.keys(dictionary).find((k) => dictionary[k].word.en === term.term.en || dictionary[k].word.uz === term.term.uz || dictionary[k].word.ru === term.term.ru);
                          const entry = vocabId ? dictionary[vocabId] : null;
                          const def = entry ? pickLang(entry.definition, lang) || pickLang(entry.definition, "en") : "";
                          const speak = () => {
                            const word = entry?.word.en || term.term.en;
                            if (word && window.speechSynthesis) {
                              const utterance = new SpeechSynthesisUtterance(word);
                              utterance.lang = "en-US";
                              speechSynthesis.speak(utterance);
                            }
                          };
                          return (
                            <details key={idx} className="group py-2 border-b border-border last:border-0 last:pb-0">
                              <summary className="flex items-center justify-between cursor-pointer select-none">
                                <span className="font-semibold text-primary-700 dark:text-primary-400 text-sm">{l(term.term)}</span>
                                <div className="flex items-center gap-3">
                                  <button onClick={(e) => { e.preventDefault(); speak(); }} className="text-on-surface-variant hover:text-primary-600 dark:hover:text-primary-400 transition" title="Listen"><Volume2 className="w-4 h-4" /></button>
                                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180 text-on-surface-variant" />
                                </div>
                              </summary>
                              <p className="mt-2 text-sm text-on-surface leading-[1.6] ml-2">{def}</p>
                              <span className="text-xs text-on-surface-variant ml-2">{term.reference}</span>
                            </details>
                          );
                        });
                      }
                      return <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />;
                    })}
                  </div>
                </div>
              )}
              <div className="space-y-6 text-on-surface">
                {block.body.map((b, i) => {
                  if (b.type === "paragraph") {
                    return (
                      <div key={i} className="text-base leading-relaxed tracking-[0.01em]">
                        <InlineText nodes={l((b as ParagraphBlock).text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
                      </div>
                    );
                  }
                  if (b.type === "bullet_list") {
                    return (
                      <div key={i} className="mt-2 mb-4">
                        <BlockRenderer block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />
                      </div>
                    );
                  }
                  return <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />;
                })}
              </div>
            </div>
          )}
        </div>
      );

    case "example_block": {
      const hints = block.hints ? pickLang(block.hints, lang) : undefined;
      return (
        <CardWrapper>
          <div className="p-5 sm:p-6">
            <div className="flex items-start md:items-center justify-between mb-5 pb-4 border-b border-border">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <span className="inline-flex items-center px-4 py-1 rounded-lg text-xs font-bold bg-primary-800 text-white shadow-sm uppercase tracking-wide">{l(block.label)}</span>
                <h4 className="text-lg font-semibold text-on-surface">{l(block.title)}</h4>
              </div>
              <div className="flex items-center gap-3">
                {block.has_video && (
                  <button className="flex items-center gap-1.5 bg-error-container text-on-error-container px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-error-container/80 transition">
                    <Play className="w-3.5 h-3.5 fill-current" /> Watch
                  </button>
                )}
                <CollapseToggle />
              </div>
            </div>
            {!collapsed && (
              <>
                {hints && hints.length > 0 && (
                  <div className="mb-5">
                    <button onClick={() => setHintIndex((hintIndex + 1) % (hints.length + 1))} className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4" />
                      {hintIndex === 0 ? "Need a hint?" : "Next hint"}
                    </button>
                    {hintIndex > 0 && hintIndex <= hints.length && (
                      <div className="mt-2 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/30 rounded-lg text-sm text-on-primary-container shadow-inner">
                        <InlineText nodes={hints[hintIndex - 1]} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-4">
                  {block.body.map((b, i) => b.type === "worked_solutions" ? <CollapsibleWorkedSolution key={i} block={b as WorkedSolutionsBlock} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /> : <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
                </div>
                {block.margin_content && (
                  <aside className="mt-5 pt-4 border-t border-border space-y-3">
                    {block.margin_content.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
                  </aside>
                )}
              </>
            )}
          </div>
        </CardWrapper>
      );
    }

    case "self_assessment_block":
      return (
        <div className="mb-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="flex items-stretch bg-primary-50 dark:bg-primary-950/20 pt-3 pb-3 px-3 border-b border-border">
            <div className="bg-surface-container-lowest border-2 border-primary-600 rounded-lg px-3 sm:px-5 py-1.5 flex items-center justify-center relative z-10 translate-x-3 shadow-sm min-w-[9.5rem] sm:min-w-[11rem]">
              <span className="text-primary-600 dark:text-primary-400 font-extrabold uppercase tracking-widest text-sm sm:text-base whitespace-nowrap"><ClipboardCheck className="w-4 h-4 inline-block mr-1" /> Assess</span>
            </div>
            <div className="bg-primary-600 flex-1 flex items-center justify-between pl-6 sm:pl-8 pr-4 py-2 rounded-lg shadow-sm">
              <h3 className="text-white font-bold text-sm sm:text-lg tracking-wide">{l(block.title) || "Self Assessment"}</h3>
              <div className="text-white ml-4"><CollapseToggle /></div>
            </div>
          </div>
          {!collapsed && (
            <div className="p-5 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {block.rating_scale.map((r) => (
                  <div key={r.value} className="flex items-center shadow-sm rounded-sm overflow-hidden select-none">
                    <span className="w-6 h-6 bg-accent-500 text-white text-xs font-extrabold flex items-center justify-center shrink-0">{r.value}</span>
                    <span className="bg-surface-container-lowest text-on-surface text-[11px] font-medium px-3 py-1 border-y border-r border-accent-500/60 rounded-r-sm whitespace-nowrap">{l(r.text)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <SelfAssessmentBlockView block={block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} hideRatingScale={true} />
              </div>
            </div>
          )}
        </div>
      );

    case "paragraph":
      return (
        <p className="text-on-surface text-base leading-[1.75] tracking-[0.01em] my-3">
          <InlineText nodes={l(block.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
        </p>
      );

    case "property_matrix":
      return (
        <div className="grid gap-3 mt-4">
          {(block as PropertyMatrixBlock).rows.map((row, j) => (
            <div key={j} className="flex flex-wrap items-baseline gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
              <span className="font-semibold text-primary-600 dark:text-primary-400 w-20 shrink-0 text-xs uppercase tracking-wide">{l(row.label)}</span>
              <div className="flex-1 text-on-surface text-sm leading-relaxed">
                {row.text ? (<InlineText nodes={l(row.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />)
                : row.translations ? (<InlineMath math={l(row.translations)?.latex ?? ""} />)
                : row.latex ? (<InlineMath math={row.latex} />) : null}
              </div>
            </div>
          ))}
        </div>
      );

    case "instruction_text":
      return (
        <p className="italic font-semibold text-on-surface-variant text-base leading-[1.75] mt-4 mb-3 tracking-wide">
          <InlineText nodes={l(block.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
        </p>
      );

    case "bullet_list":
      return (
        <ul className="mt-4 mb-6 space-y-3.5 pl-2 sm:pl-4">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-on-surface text-base leading-[1.75]">
              <span className="text-primary-600 dark:text-primary-400 select-none mt-[6px] text-xs shrink-0">●</span>
              <div className="flex-1 min-w-0"><InlineText nodes={l(item)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></div>
            </li>
          ))}
        </ul>
      );

    case "equation_grid":
      return (
        <div className={`grid gap-4 my-6 ${block.columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"} ${block.align === "center" ? "justify-items-center" : ""}`}>
          {block.items.map((item) => (
            <div key={item.id} className="flex items-center justify-start p-4 bg-surface-alt border border-border rounded-xl transition-all hover:bg-surface-container-high text-sm">
              <InlineMath math={item.latex} />
            </div>
          ))}
        </div>
      );

    case "question_grid":
      return (
        <div className={`grid gap-x-12 gap-y-8 my-6 ${block.columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
          {block.items.map((item) => (
            <div key={item.id} className="group flex flex-col justify-between items-start transition-all">
              <div className="flex items-start gap-4 w-full">
                <span className="font-extrabold text-on-surface text-base min-w-[1.5rem] text-right mt-[2px]">{item.label}</span>
                <div className="flex-1 text-on-surface text-base leading-[1.75] pt-[1px]"><InlineMath math={item.latex} /></div>
              </div>
              {item.expected && (
                <div className="mt-3 pl-10 w-full max-w-xs">
                  <input type="text" placeholder="Your answer" className="w-full border border-outline-variant focus:border-primary-600 dark:border-outline dark:focus:border-primary-400 rounded-xl px-3 py-2 text-sm bg-surface-container-lowest outline-none shadow-inner transition-colors" />
                </div>
              )}
            </div>
          ))}
        </div>
      );

    case "card_tiles":
      return (
        <div className="flex flex-wrap items-center justify-start gap-3 my-6 pl-2 sm:pl-4">
          {block.tiles.map((tile) => (
            <div key={tile.id} className="bg-surface-container-low px-4 py-2.5 rounded-lg shadow-sm border border-border min-w-[3.5rem] h-12 flex items-center justify-center text-center font-medium transition-transform hover:-translate-y-0.5 select-none">
              <div className="text-on-surface text-base md:text-lg"><InlineMath math={tile.latex} /></div>
            </div>
          ))}
        </div>
      );

    case "worked_solutions":
      return <CollapsibleWorkedSolution block={block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />;

    case "key_ideas_box":
      return (
        <CardWrapper>
          <div className="relative p-5 sm:p-6 overflow-hidden bg-surface-container-lowest">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600 dark:bg-primary-400 rounded-r-md"></div>
            <div className="flex items-center justify-between mb-6 pl-2">
              <h5 className="text-lg font-bold text-primary-800 dark:text-primary-200 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center border border-primary-200 dark:border-primary-800/50 shadow-sm shrink-0">
                  <Lightbulb className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                {l(block.title)}
              </h5>
              <CollapseToggle />
            </div>
            {!collapsed && (
              <div className="space-y-5 pl-2">
                {block.concepts.map((concept, i) => (
                  <div key={i} className="border-l-2 border-primary-200 dark:border-primary-800 pl-4">
                    <h4 className="font-semibold text-primary-700 dark:text-primary-300 text-sm mb-2">{l(concept.subtitle)}</h4>
                    {concept.content ? (
                      <div className="space-y-3">
                        {concept.content.map((b, j) => (<BlockRenderer key={j} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />))}
                      </div>
                    ) : concept.matrix ? (
                      <div className="grid gap-2 mt-1">
                        {concept.matrix.map((row, j) => (
                          <div key={j} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
                            <span className="font-bold text-primary-600 dark:text-primary-400 w-16 shrink-0 text-sm">{l(row.label)}</span>
                            <div className="flex-1 min-w-0">
                              {row.text ? (<InlineText nodes={l(row.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />)
                              : row.translations ? (<InlineMath math={l(row.translations)?.latex ?? ""} />)
                              : row.latex ? (<InlineMath math={row.latex} />) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardWrapper>
      );

    case "vocabulary_box":
  return (
    <div className="mb-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="flex items-stretch bg-primary-50 dark:bg-primary-950/20 pt-3 pb-3 px-3 border-b border-border">
        <div className="bg-surface-container-lowest border-2 border-primary-600 rounded-lg px-3 sm:px-5 py-1.5 flex items-center justify-center relative z-10 translate-x-3 shadow-sm min-w-[9.5rem] sm:min-w-[11rem]">
          <span className="text-primary-600 dark:text-primary-400 font-extrabold uppercase tracking-widest text-sm sm:text-base whitespace-nowrap">
            <BookOpen className="w-4 h-4 inline-block mr-1" /> Vocab
          </span>
        </div>
        <div className="bg-primary-600 flex-1 flex items-center justify-between pl-6 sm:pl-8 pr-4 py-2 rounded-lg shadow-sm">
          <h2 className="text-white font-bold text-sm sm:text-lg tracking-wide">{l(block.title) || "Vocabulary"}</h2>
          <div className="text-white ml-4"><CollapseToggle /></div>
        </div>
      </div>
      {!collapsed && (
        <div className="p-5 sm:p-8 space-y-4">
          {block.terms.map((term, idx) => {
            const vocabId = Object.keys(dictionary).find((k) => dictionary[k].word.en === term.term.en || dictionary[k].word.uz === term.term.uz || dictionary[k].word.ru === term.term.ru);
            const entry = vocabId ? dictionary[vocabId] : null;
            const def = entry ? pickLang(entry.definition, lang) || pickLang(entry.definition, "en") : "";
            const speak = () => {
              const word = entry?.word.en || term.term.en;
              if (word && window.speechSynthesis) {
                const utterance = new SpeechSynthesisUtterance(word);
                utterance.lang = "en-US";
                speechSynthesis.speak(utterance);
              }
            };
            return (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6 py-2.5 border-b border-border last:border-0 last:pb-0">
                <button onClick={() => vocabId && onTermClick(vocabId)} className="w-full sm:w-48 text-left shrink-0 group">
                  <span className="font-semibold text-primary-700 dark:text-primary-400 underline decoration-dashed decoration-primary-300 dark:decoration-primary-600 underline-offset-4 group-hover:text-primary-800 group-hover:decoration-primary-500 transition-colors text-sm">{l(term.term)}</span>
                </button>
                <div className="flex-1 text-sm text-on-surface leading-[1.6]">{def}</div>
                <div className="flex items-center gap-3">
                  <button onClick={speak} className="text-on-surface-variant hover:text-primary-600 dark:hover:text-primary-400 transition" title="Listen"><Volume2 className="w-4 h-4" /></button>
                  <span className="text-sm text-on-surface-variant italic shrink-0 sm:text-right sm:w-20">{term.reference}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

    case "study_tip_box":
      return (
        <CardWrapper className="bg-surface-container-high border-outline-variant">
          <div className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1"><span className="text-xl">💡</span><h5 className="text-sm font-bold text-on-surface">{l(block.title)}</h5></div>
              <CollapseToggle />
            </div>
            {!collapsed && <p className="text-sm text-on-surface-variant"><InlineText nodes={l(block.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></p>}
          </div>
        </CardWrapper>
      );

    case "mtr_badge":
      return (
        <CardWrapper className="bg-error-container border-error/20">
          <div className="p-3">
            <div className="flex items-center justify-between">
              <span className="inline-block bg-error text-on-error px-2 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider">{block.badge}</span>
              <CollapseToggle />
            </div>
            {!collapsed && <p className="text-sm mt-2 text-on-error-container"><InlineText nodes={l(block.prompt)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></p>}
          </div>
        </CardWrapper>
      );

    case "image":
      return <img src={block.src} alt={l(block.alt)} className="max-w-full h-auto rounded-xl shadow-sm" />;

    case "video":
      return <video controls poster={block.poster} className="w-full rounded-xl shadow" />;

    case "task_block":
      return (
        <div className="mb-2 pl-6">
          <div className="flex">
            {block.label && (<span className="font-extrabold text-primary-600 dark:text-primary-400 text-lg w-6 shrink-0 -ml-6 mr-1 text-right">{block.label}</span>)}
            <div className="flex-1 min-w-0">
              <div className="text-on-surface text-sm"><InlineText nodes={l(block.instruction)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></div>
              {block.content?.map((b, i) => (<BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />))}
            </div>
          </div>
        </div>
      );

    default:
      return <div className="text-red-500 text-sm">Unknown block type: {(block as any).type}</div>;
  }
}

// ---------- Dictionary Modal ----------
function DictionaryModal({ termId, dictionary, onClose, onTermClick, currentLang }: { termId: string; dictionary: Dictionary; onClose: () => void; onTermClick: (id: string) => void; currentLang: string }) {
  const entry = dictionary[termId];
  if (!entry) return null;

  const [targetLang, setTargetLang] = useState(currentLang === "en" ? "uz" : "en");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState<"current" | "target" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => setCurrentImageIndex(0), [termId]);

  const images = entry.images || [];
  const availableLangs = ["en", "uz", "ru"];

  const speak = (lang: string, type: "current" | "target") => {
    const wordToSpeak = entry.word[lang];
    if (!wordToSpeak || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(wordToSpeak);
    utterance.lang = lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US";
    utterance.onstart = () => setIsSpeaking(type);
    utterance.onend = () => setIsSpeaking(null);
    utterance.onerror = () => setIsSpeaking(null);
    speechSynthesis.speak(utterance);
  };

  const nextImage = (e: React.MouseEvent) => { e.stopPropagation(); if (images.length > 1) setCurrentImageIndex((p) => (p + 1) % images.length); };
  const prevImage = (e: React.MouseEvent) => { e.stopPropagation(); if (images.length > 1) setCurrentImageIndex((p) => (p - 1 + images.length) % images.length); };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 lg:p-8" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden relative flex flex-col w-full max-w-[1024px] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-6 right-6 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-error hover:text-white transition-colors shadow-sm">
            <X size={20} />
          </button>
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto">
            <div className="flex-1 flex flex-col p-8 md:pr-10 border-b md:border-b-0 md:border-r border-border relative">
              <div className="mb-4">
                <span className="bg-primary-100 text-primary-800 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-widest inline-flex items-center gap-1.5">{currentLang} • Original</span>
              </div>
              <h3 className="text-4xl font-extrabold text-on-surface leading-tight mb-4">{entry.word[currentLang] || "—"}</h3>
              <button onClick={() => speak(currentLang, "current")} disabled={isSpeaking !== null} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold w-fit mb-8 transition-all active:scale-95 ${isSpeaking === "current" ? "bg-primary-200 text-primary-800 animate-pulse" : "bg-surface-container text-on-surface hover:bg-surface-container-highest"}`}>
                <Volume2 size={18} /> {isSpeaking === "current" ? "Speaking..." : "Listen"}
              </button>
              <div className="space-y-6">
                {entry.definition?.[currentLang] && (
                  <div>
                    <h4 className="text-[12px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-2">Definition</h4>
                    <p className="text-base text-on-surface leading-relaxed">{entry.definition[currentLang]}</p>
                  </div>
                )}
                {entry.examples?.[currentLang]?.length > 0 && (
                  <div>
                    <h4 className="text-[12px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-2">Examples</h4>
                    <div className="space-y-3">{entry.examples[currentLang].map((ex: string, i: number) => (<div key={i} className="text-base text-on-surface-variant border-l-2 border-primary-200 pl-4 py-1">{ex}</div>))}</div>
                  </div>
                )}
                {entry.relatedConcepts?.length > 0 && (
                  <div className="pt-4 border-t border-border/50">
                    <h4 className="text-[12px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-3">Related</h4>
                    <div className="flex flex-wrap gap-2">{entry.relatedConcepts.map((id: string) => (<button key={id} onClick={() => onTermClick(id)} className="bg-surface-container-high text-on-surface-variant px-4 py-1.5 rounded-full text-sm font-medium hover:bg-primary-100 hover:text-primary-800 transition">{dictionary[id]?.word[currentLang] || id}</button>))}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col p-8 md:pl-10 relative bg-surface-container-lowest/50">
              <div className="mb-4 pr-12">
                <div className="relative inline-flex items-center bg-surface-container-high border border-border rounded-xl px-1 py-1 hover:border-primary-300 transition-colors">
                  <div className="pl-2 pr-1 text-on-surface-variant pointer-events-none"><Languages size={16} /></div>
                  <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="bg-transparent text-sm font-extrabold text-on-surface uppercase tracking-wider outline-none cursor-pointer py-1 pr-4 pl-1 appearance-none">
                    {availableLangs.filter(l => l !== currentLang).map(l => (<option key={l} value={l}>{l} • Translation</option>))}
                  </select>
                </div>
              </div>
              <h3 className="text-4xl font-extrabold text-on-surface leading-tight mb-4">{entry.word[targetLang] || "—"}</h3>
              <button onClick={() => speak(targetLang, "target")} disabled={isSpeaking !== null} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold w-fit mb-8 transition-all active:scale-95 ${isSpeaking === "target" ? "bg-primary-200 text-primary-800 animate-pulse" : "bg-surface-container text-on-surface hover:bg-surface-container-highest"}`}>
                <Volume2 size={18} /> {isSpeaking === "target" ? "Speaking..." : "Listen"}
              </button>
              <div className="space-y-6">
                {entry.definition?.[targetLang] && (
                  <div>
                    <h4 className="text-[12px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-2">Definition</h4>
                    <p className="text-base text-on-surface leading-relaxed">{entry.definition[targetLang]}</p>
                  </div>
                )}
                {entry.examples?.[targetLang]?.length > 0 && (
                  <div>
                    <h4 className="text-[12px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-2">Examples</h4>
                    <div className="space-y-3">{entry.examples[targetLang].map((ex: string, i: number) => (<div key={i} className="text-base text-on-surface-variant border-l-2 border-primary-200 pl-4 py-1">{ex}</div>))}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {images.length > 0 && (
            <div className="w-full bg-surface-container-low border-t border-border p-6 flex flex-col items-center shrink-0 max-h-[350px]">
              <div className="relative h-[250px] w-full flex items-center justify-center group cursor-pointer" onClick={() => setIsFullscreen(true)}>
                <img src={images[currentImageIndex]} alt={entry.word[currentLang]} className="max-w-full max-h-full object-contain rounded-xl shadow-md transition-transform duration-500 group-hover:scale-[1.01]" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-xl transition-colors duration-300 flex items-center justify-center">
                  <div className="bg-black/70 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 shadow-lg flex items-center gap-2">
                    <Maximize2 size={18} /> <span className="text-sm font-medium pr-1">Click to expand</span>
                  </div>
                </div>
                {images.length > 1 && (
                  <>
                    <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 bg-surface-container-lowest/90 rounded-full p-2.5 shadow-md hover:bg-surface-container-lowest text-on-surface transition-all opacity-0 group-hover:opacity-100"><ChevronLeft size={20} /></button>
                    <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 bg-surface-container-lowest/90 rounded-full p-2.5 shadow-md hover:bg-surface-container-lowest text-on-surface transition-all opacity-0 group-hover:opacity-100"><ChevronRight size={20} /></button>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 justify-center mt-4">
                  {images.map((_, idx) => (<button key={idx} onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }} className={`h-2.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? "w-8 bg-primary-600" : "w-2.5 bg-surface-container-highest hover:bg-primary-300"}`} />))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8" onClick={() => setIsFullscreen(false)}>
          <button onClick={() => setIsFullscreen(false)} className="absolute top-6 right-6 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"><X size={28} /></button>
          <img src={images[currentImageIndex]} alt="Fullscreen view" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prevImage(e); }} className="absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 bg-white/10 text-white rounded-full p-4 hover:bg-white/25 transition-colors"><ChevronLeft size={32} /></button>
              <button onClick={(e) => { e.stopPropagation(); nextImage(e); }} className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 bg-white/10 text-white rounded-full p-4 hover:bg-white/25 transition-colors"><ChevronRight size={32} /></button>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ---------- Dictionary List Modal ----------
function DictionaryListModal({ dictionary, onClose, onTermClick }: { dictionary: Dictionary; onClose: () => void; onTermClick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const entries = Object.values(dictionary).filter((entry) => Object.values(entry.word).join(" ").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <div className="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 p-2.5 rounded-2xl"><BookA size={22} /></div>
              Dictionary
            </h3>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={20} /></button>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors"><Search size={20} /></div>
            <input type="text" placeholder="Search for terms..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/60 border border-transparent rounded-2xl py-3.5 pl-12 pr-10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-base" />
            {search && <button onClick={() => setSearch("")} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={16} /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-slate-100 dark:bg-slate-800 h-16 w-16 rounded-full flex items-center justify-center text-slate-400 mb-4"><Search size={26} /></div>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1">No terms found</p>
              <p className="text-sm text-slate-400">Try searching for alternative math keywords.</p>
            </div>
          ) : (
            <div className="grid gap-3 pb-2">
              {entries.map((entry) => (
                <button key={entry.id} onClick={() => onTermClick(entry.id)} className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow transition-all active:scale-[0.995] flex gap-4 items-start group">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200/40 dark:border-slate-700/40">
                    {entry.images && entry.images[0] ? <img src={entry.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <ImageIcon size={22} className="text-slate-400 dark:text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-4 mb-1">
                      <span className="font-bold text-[17px] text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{entry.word.en || entry.word.uz || entry.word.ru}</span>
                      <div className="flex gap-1 shrink-0 pt-0.5">
                        {["en", "uz", "ru"].map((l) => entry.word[l] && <span key={l} className="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100/30 dark:border-blue-900/30">{l}</span>)}
                      </div>
                    </div>
                    <p className="text-[14px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed break-words font-medium">{entry.definition?.en || entry.definition?.uz || "No description provided."}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SyllabusSidebar({ blocks, lang, activeId, onCollapseAll }: { blocks: Block[]; lang: string; activeId: string | null; onCollapseAll: () => void }) {
  const iconMap: Record<string, React.ReactNode> = {
    learning_target: <Target className="w-3 h-3" />,
    explore_it: <Search className="w-3 h-3" />,
    lesson_concept: <BookOpen className="w-3 h-3" />,
  };
  const entries = blocks
    .filter(b => ["learning_target", "explore_it", "lesson_concept"].includes(b.type))
    .map((b, idx) => {
      let title = "";
      switch (b.type) {
        case "learning_target": title = "Learning Target"; break;
        case "explore_it": 
          title = pickLang((b as ExploreItBlock).header?.title ?? {}, lang) ?? "Explore It";
          break;
        case "lesson_concept": 
          title = pickLang((b as LessonConceptBlock).title, lang) ?? "Lesson Concept";
          break;
        default: title = b.type;
      }
      const id = b.id ? String(b.id) : `block-${idx}`;
      return { id, title, type: b.type, icon: iconMap[b.type] || null };
    });

  return (
    <aside className="w-64 shrink-0 bg-surface-container-lowest border-r border-border p-3 overflow-y-auto max-h-screen sticky top-16 hidden lg:flex lg:flex-col">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-on-surface text-xs uppercase tracking-wide">Contents</h4>
        <button onClick={onCollapseAll} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Collapse All</button>
      </div>
      <ul className="space-y-0.5 flex-1">
        {entries.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <li key={entry.id}>
              <button
                onClick={() => { const el = document.getElementById(entry.id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className={`flex items-center gap-1.5 w-full text-left py-1 px-2 rounded text-xs transition border-l-2 ${isActive ? "bg-primary-100 text-on-primary-container dark:bg-primary-900/30 dark:text-primary-300 font-semibold border-primary-600" : "text-on-surface-variant hover:text-primary-600 dark:hover:text-primary-300 border-transparent"}`}
              >
                {entry.icon && <span className="shrink-0">{entry.icon}</span>}
                <span className="truncate">{entry.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
// ---------- Main App ----------
export default function InteractiveBook() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [dictionary, setDictionary] = useState<Dictionary>({});
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [showDictionaryList, setShowDictionaryList] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [dualMode, setDualMode] = useState(false);
  const [leftLang, setLeftLang] = useState("en");
  const [rightLang, setRightLang] = useState("uz");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [globalCollapsed, setGlobalCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/data/9.1.json").then((r) => r.json()).then(setLesson);
    fetch("/data/dictionary.json").then((r) => r.json()).then(setDictionary);
  }, []);

  useEffect(() => { document.documentElement.classList.toggle("dark", darkMode); }, [darkMode]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!lesson) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let mostVisible: { id: string; ratio: number } | null = null;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            if (!mostVisible || entry.intersectionRatio > mostVisible.ratio) {
              mostVisible = { id: entry.target.id, ratio: entry.intersectionRatio };
            }
          }
        });
        if (mostVisible) setActiveId((mostVisible as { id: string; ratio: number }).id);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    const main = mainRef.current;
    if (main) {
      const blockElements = main.querySelectorAll('[id^="block-"]');
      blockElements.forEach((el) => observer.observe(el));
    }
    return () => observer.disconnect();
  }, [lesson]);

  if (!lesson) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-lg text-on-surface-variant">Loading…</p>
    </div>
  );

  const containerClass = dualMode ? "flex w-[95%] mx-auto" : "flex max-w-7xl mx-auto";

  return (
    <div className={`min-h-screen bg-surface text-on-surface transition-colors ${focusMode ? "max-w-3xl mx-auto" : ""}`}>
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-surface-container-high"><div className="h-full bg-primary-500 transition-all duration-100" style={{ width: `${scrollProgress * 100}%` }} /></div>
      <header className="sticky top-1 z-40 backdrop-blur-lg bg-surface-container-lowest/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-300 dark:to-primary-200">{lesson.title.en || lesson.title.uz || lesson.title.ru}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {[{ code: 'en', flag: '🇺🇸' }, { code: 'uz', flag: '🇺🇿' }, { code: 'ru', flag: '🇷🇺' }].map(l => (
                <button key={l.code} onClick={() => setLeftLang(l.code)} className={`text-lg px-1 py-0.5 rounded transition ${leftLang === l.code ? 'ring-2 ring-primary-500 bg-primary-100 dark:bg-primary-900/30' : 'hover:bg-surface-container-high'}`} title={l.code.toUpperCase()}>{l.flag}</button>
              ))}
            </div>
            <button onClick={() => setDualMode(!dualMode)} className={`p-2 rounded-full transition ${dualMode ? "bg-primary-600 text-white shadow-lg" : "bg-surface-container-lowest text-on-surface-variant border border-border hover:border-primary-400"}`} title="Dual View"><Columns className="w-4 h-4" /></button>
            {dualMode && (
              <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-1 rounded-xl border border-border">
                <span className="text-xs">compare</span>
                <div className="flex gap-0.5">
                  {[{ code: 'en', flag: '🇺🇸' }, { code: 'uz', flag: '🇺🇿' }, { code: 'ru', flag: '🇷🇺' }].map(l => (
                    <button key={l.code} onClick={() => setRightLang(l.code)} className={`text-lg px-1 py-0.5 rounded transition ${rightLang === l.code ? 'ring-2 ring-primary-500 bg-primary-100 dark:bg-primary-900/30' : 'hover:bg-surface-container-high'}`} title={l.code.toUpperCase()}>{l.flag}</button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setGlobalCollapsed(!globalCollapsed)} className="p-2 rounded-full bg-surface-container-lowest border border-border shadow-sm hover:shadow-md transition" title={globalCollapsed ? "Expand All" : "Collapse All"}>{globalCollapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}</button>
            <button onClick={() => setShowDictionaryList(true)} className="p-2 rounded-full bg-surface-container-lowest border border-border shadow-sm hover:shadow-md transition" title="Dictionary"><BookOpen className="w-4 h-4" /></button>
            <button onClick={() => setFocusMode(!focusMode)} className="p-2 rounded-full bg-surface-container-lowest border border-border shadow-sm hover:shadow-md transition" title="Focus Mode">{focusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-surface-container-lowest border border-border shadow-sm hover:shadow-md transition" title="Dark Mode">{darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
          </div>
        </div>
      </header>

      <div className={containerClass}>
        {!dualMode && <SyllabusSidebar blocks={lesson.blocks} lang={leftLang} activeId={activeId} onCollapseAll={() => setGlobalCollapsed(true)} />}
        <main ref={mainRef} className="flex-1 pl-1 md:pl-2 lg:pl-3 pr-3 md:pr-4 lg:pr-5 py-6 space-y-8">
          {dualMode ? (
            <div className="space-y-6">
              {lesson.blocks.map((block, idx) => (
                <div key={idx} className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <div id={block.id ? String(block.id) : `block-${idx}`} className="relative"><BlockRenderer block={block} dictionary={dictionary} onTermClick={setSelectedTermId} lang={leftLang} compact globalCollapsed={globalCollapsed} /></div>
                  <div id={block.id ? String(block.id)+'-right' : `block-${idx}-right`} className="relative"><BlockRenderer block={block} dictionary={dictionary} onTermClick={setSelectedTermId} lang={rightLang} compact globalCollapsed={globalCollapsed} /></div>
                </div>
              ))}
            </div>
          ) : (
            lesson.blocks.map((block, idx) => (
              <div key={idx} id={block.id ? String(block.id) : `block-${idx}`} className="relative"><BlockRenderer block={block} dictionary={dictionary} onTermClick={setSelectedTermId} lang={leftLang} globalCollapsed={globalCollapsed} /></div>
            ))
          )}
        </main>
      </div>

      <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-4 right-4 p-3 rounded-full bg-primary-600 text-white shadow-xl hover:bg-primary-700 transition z-50">↑</button>

      {selectedTermId && dictionary[selectedTermId] && <DictionaryModal termId={selectedTermId} dictionary={dictionary} onClose={() => setSelectedTermId(null)} onTermClick={setSelectedTermId} currentLang={leftLang} />}
      {showDictionaryList && <DictionaryListModal dictionary={dictionary} onClose={() => setShowDictionaryList(false)} onTermClick={(id) => { setSelectedTermId(id); setShowDictionaryList(false); }} />}
    </div>
  );
}