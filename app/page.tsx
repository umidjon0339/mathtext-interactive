"use client";

import { useEffect, useState, useRef } from "react";
import { InlineMath } from "react-katex";
import Confetti from "react-confetti";
import { evaluate } from "mathjs";
import "katex/dist/katex.min.css";

// ---------- Types (unchanged) ----------
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
interface KeyIdeasBoxBlock extends BlockBase { type: "key_ideas_box"; style?: string; title: MultilingualString; concepts: { subtitle: MultilingualString; matrix: { label: MultilingualString; text?: Record<string, InlineNode[]>; latex?: string; translations?: Record<string, { latex: string }> }[];content?: BlockBase[]; }[]; }
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

// ---------- TermTooltip ----------
function TermTooltip({ entry, lang, dictionary, onTermClick, children }: { entry: DictionaryEntry; lang: string; dictionary: Dictionary; onTermClick: (id: string) => void; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 220;
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (top + tooltipHeight > window.innerHeight - 10) top = rect.top - tooltipHeight - 8;
    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - tooltipWidth - 8;
    setPos({ top, left });
    setShow(true);
  };
  const handleMouseLeave = () => setShow(false);
  const examples = pickLang(entry.examples, lang) || pickLang(entry.examples, "en");

  return (
    <span className="relative inline" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button ref={buttonRef} onClick={() => onTermClick(entry.id)} className="font-semibold underline decoration-dotted underline-offset-2 text-primary-600 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200">
        {children}
      </button>
      {show && (
        <div ref={tooltipRef} className="fixed z-[100] bg-surface-container-lowest border border-border rounded-xl shadow-xl p-4 w-80 text-sm" style={{ top: `${pos.top}px`, left: `${pos.left}px` }}>
          {entry.images && entry.images[0] && <img src={entry.images[0]} alt={entry.word.en || entry.word.uz || entry.word.ru} className="w-full h-32 object-contain rounded-lg mb-2 bg-surface" />}
          <p className="font-bold text-on-surface">{entry.word[lang] || entry.word.en || entry.word.uz || entry.word.ru}</p>
          <p className="text-on-surface-variant mt-1">{pickLang(entry.definition, lang) || pickLang(entry.definition, "en")}</p>
          {examples && examples.length > 0 && <p className="text-xs text-outline mt-1 italic">e.g., {examples[0]}</p>}
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
            <h3 className="text-lg font-bold text-on-surface uppercase tracking-wider">
              {l(block.title) || "SELF-ASSESSMENT"}
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">How well do you understand?</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-[1200px] mx-auto">
            {block.rating_scale.map((r) => {
              const isSelected = selected === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => setSelected(r.value)}
                  className={`flex items-center w-full shadow-sm rounded overflow-hidden select-none text-left transition-all ${
                    isSelected ? "ring-2 ring-accent-500 ring-offset-2 dark:ring-offset-slate-800 scale-[1.01]" : "opacity-85 hover:opacity-100"
                  }`}
                >
                  <span className="w-7 h-7 bg-accent-500 text-white text-xs font-black flex items-center justify-center shrink-0">{r.value}</span>
                  <span className="flex-1 bg-surface-container-lowest text-on-surface text-xs font-medium px-3 py-1 border-y border-r border-accent-500/30 rounded-r whitespace-nowrap overflow-hidden text-ellipsis">
                    {l(r.text)}
                  </span>
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
                        <div className="text-on-surface font-medium">
                          <InlineMath math={item.latex} />
                        </div>
                      </div>
                      {item.expected && (
                        <div className="flex gap-2 items-center shrink-0 sm:w-48 relative">
                          <input
                            type="text"
                            value={answers[item.id] || ""}
                            onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                            className="border border-outline-variant dark:border-outline rounded-lg px-3 py-1.5 text-xs bg-surface-container-lowest w-full shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-500 pr-7"
                            placeholder="Your answer"
                          />
                          {submitted[item.id] && (
                            <span className={`absolute right-2.5 font-bold text-sm ${checkAnswer(item.id, item.expected) ? "text-accent-600" : "text-error"}`}>
                              {checkAnswer(item.id, item.expected) ? "✓" : "✗"}
                            </span>
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
            <button onClick={handleSubmit} className="bg-primary-600 hover:bg-primary-700 active:scale-95 text-white px-5 py-2 rounded-xl font-bold transition text-xs tracking-wider uppercase shadow-sm">
              Check Answers
            </button>
            {score !== null && (
              <p className="text-sm font-semibold text-on-surface">
                You got <span className="text-primary-600 dark:text-primary-400 font-bold text-base">{score}</span> / {allQuestionItems.filter(i => i.expected).length} correct
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Block Renderer (MD3 cards, consistent collapse) ----------
function BlockRenderer({ block, dictionary, onTermClick, lang, compact = false, globalCollapsed = false }: { block: Block; dictionary: Dictionary; onTermClick: (id: string) => void; lang: string; compact?: boolean; globalCollapsed?: boolean }) {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const collapsed = globalCollapsed || localCollapsed;
  const l = (obj: any) => pickLang(obj, lang);

  const CollapseToggle = () => (
    <button
      onClick={() => setLocalCollapsed(!localCollapsed)}
      className="ml-2 p-1 rounded-full hover:bg-surface-container-high transition"
      title={localCollapsed ? "Expand" : "Collapse"}
    >
      <svg className="w-4 h-4 transition-transform duration-200" style={{ transform: localCollapsed ? "rotate(0deg)" : "rotate(180deg)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  const CardWrapper = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-2xl bg-surface-container-lowest shadow-sm border border-border overflow-hidden ${className}`}>{children}</div>
  );

  if (collapsed && block.type !== "paragraph" && block.type !== "instruction_text" && block.type !== "bullet_list" && block.type !== "equation_grid" && block.type !== "question_grid" && block.type !== "card_tiles" && block.type !== "worked_solutions" && block.type !== "image" && block.type !== "video" && block.type !== "task_block") {
    const getTitle = () => {
      switch (block.type) {
        case "learning_target": return "Learning Target";
        case "explore_it": return l((block as ExploreItBlock).header?.title) || "Explore It";
        case "lesson_concept": return l((block as LessonConceptBlock).title);
        case "example_block": return `${l((block as ExampleBlock).label)}: ${l((block as ExampleBlock).title)}`;
        case "self_assessment_block": return l((block as SelfAssessmentBlock).title) || "Self Assessment";
        case "key_ideas_box": return l((block as KeyIdeasBoxBlock).title);
        case "vocabulary_box": return l((block as VocabularyBoxBlock).title);
        case "study_tip_box": return l((block as StudyTipBoxBlock).title);
        case "mtr_badge": return (block as MtrBadgeBlock).badge;
        default: return "";
      }
    };
    return (
      <CardWrapper>
        <div className="p-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-on-surface">{getTitle()}</span>
          <CollapseToggle />
        </div>
      </CardWrapper>
    );
  }

  switch (block.type) {
    case "learning_target":
      return (
        <CardWrapper>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-primary-800 dark:text-primary-200 flex items-center gap-2"><span className="text-2xl">🎯</span> Learning Target</h2>
              <CollapseToggle />
            </div>
            <div className="text-on-surface font-medium text-sm">
              <InlineText nodes={l(block.target)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
            </div>
            {block.success_criteria && (
              <div className="mt-4 bg-primary-50/50 dark:bg-primary-900/20 rounded-xl p-4">
                <h3 className="font-semibold text-on-primary-container mb-2 text-sm">✅ Success Criteria</h3>
                <ul className="space-y-2">
                  {l(block.success_criteria)?.map((crit: InlineNode[], idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-200 dark:bg-primary-800 text-on-primary-container text-xs font-bold mt-0.5">{idx + 1}</span>
                      <span className="text-on-surface text-sm"><InlineText nodes={crit} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardWrapper>
      );

    case "explore_it": {
      return (
        <div className="mb-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-border overflow-hidden">
          {block.header && (
            <div className="flex items-stretch bg-surface-alt pt-3 pb-3 px-3 border-b border-border">
              <div className="bg-surface-container-lowest border-2 border-primary-600 rounded-lg px-3 sm:px-5 py-1.5 flex items-center justify-center relative z-10 translate-x-3 shadow-sm">
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
        <CardWrapper>
          <div className="p-5 sm:p-6 border-l-[6px] border-primary-600 dark:border-primary-400 bg-surface-container-lowest shadow-sm rounded-r-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg sm:text-xl font-bold text-on-surface tracking-tight">{l(block.title)}</h3>
              <div className="flex items-center gap-3"><CollapseToggle /></div>
            </div>
            {!collapsed && block.margin_content && block.margin_content.length > 0 && (
              <div className="mb-8 bg-surface-container-high p-5 rounded-xl border border-primary-100 dark:border-primary-900/30">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-primary-100/80 dark:border-primary-900/30 select-none">
                  <span className="font-bold text-xs uppercase tracking-widest text-primary-700 dark:text-primary-400">Vocabulary</span>
                  <span className="bg-primary-700 dark:bg-primary-600 text-white text-[11px] font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-sm">Az Vocab</span>
                </div>
                <div className="space-y-0">
                  {block.margin_content.map((b, i) => {
                    if (b.type === "vocabulary_box") {
                      const vBlock = b as VocabularyBoxBlock;
                      return vBlock.terms.map((term, idx) => {
                        const vocabId = Object.keys(dictionary).find(
                          (k) => dictionary[k].word.en === term.term.en || dictionary[k].word.uz === term.term.uz || dictionary[k].word.ru === term.term.ru
                        );
                        const entry = vocabId ? dictionary[vocabId] : null;
                        const def = entry ? pickLang(entry.definition, lang) || pickLang(entry.definition, "en") : "";
                        return (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6 py-2.5 border-b border-border last:border-0 last:pb-0">
                            <button
                              onClick={() => vocabId && onTermClick(vocabId)}
                              className="w-full sm:w-48 text-left shrink-0 group"
                            >
                              <span className="font-semibold text-primary-700 dark:text-primary-400 underline decoration-dashed decoration-primary-300 dark:decoration-primary-600 underline-offset-4 group-hover:text-primary-800 group-hover:decoration-primary-500 transition-colors text-sm">
                                {l(term.term)}
                              </span>
                            </button>
                            <div className="flex-1 text-sm text-on-surface leading-[1.6]">{def}</div>
                            <span className="text-sm text-on-surface-variant italic shrink-0 sm:text-right sm:w-20">{term.reference}</span>
                          </div>
                        );
                      });
                    }
                    return <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />;
                  })}
                </div>
              </div>
            )}
            {!collapsed && (
              <div className="space-y-4 text-on-surface text-base leading-[1.75]">
                {block.body.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
              </div>
            )}
          </div>
        </CardWrapper>
      );

    case "example_block": {
      const hints = block.hints ? pickLang(block.hints, lang) : undefined;
      return (
        <CardWrapper>
          <div className="p-4">
            <div className="flex items-start md:items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <span className="inline-flex items-center px-4 py-1 rounded-lg text-xs font-bold bg-primary-800 text-white shadow-sm uppercase tracking-wide">{l(block.label)}</span>
                <h4 className="text-base font-bold text-on-surface">{l(block.title)}</h4>
              </div>
              <div className="flex items-center gap-3">
                {block.has_video && (
                  <button className="flex flex-col items-center justify-center bg-gradient-to-b from-blue-400 to-blue-600 text-white rounded-lg w-14 h-10 shadow-md hover:shadow-lg hover:scale-105 transition-all border border-blue-400">
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Watch</span>
                  </button>
                )}
                <CollapseToggle />
              </div>
            </div>
            {hints && hints.length > 0 && (
              <div className="mb-4">
                <button onClick={() => setHintIndex((hintIndex + 1) % (hints.length + 1))} className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {hintIndex === 0 ? "Need a hint?" : "Next hint"}
                </button>
                {hintIndex > 0 && hintIndex <= hints.length && (
                  <div className="mt-2 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/30 rounded-lg text-sm text-on-primary-container shadow-inner">
                    <InlineText nodes={hints[hintIndex - 1]} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
                  </div>
                )}
              </div>
            )}
            <div className="space-y-3">
              {block.body.map((b, i) => b.type === "worked_solutions" ? <CollapsibleWorkedSolution key={i} block={b as WorkedSolutionsBlock} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /> : <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
            </div>
            {block.margin_content && (
              <aside className="mt-4 pt-3 border-t border-border space-y-3">
                {block.margin_content.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
              </aside>
            )}
          </div>
        </CardWrapper>
      );
    }

    case "self_assessment_block":
      return (
        <CardWrapper>
          <div className="bg-surface-alt border-b-2 border-primary-500 rounded-t-xl p-4 transition-colors">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2">
              <div className="flex items-center justify-between xl:justify-start gap-4">
                <h3 className="text-lg font-bold text-on-surface uppercase tracking-wider">
                  {l(block.title) || "SELF-ASSESSMENT"}
                </h3>
                <div className="xl:hidden"><CollapseToggle /></div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {block.rating_scale.map((r) => (
                  <div key={r.value} className="flex items-center shadow-sm rounded-sm overflow-hidden select-none">
                    <span className="w-5 h-5 bg-accent-500 text-white text-xs font-extrabold flex items-center justify-center shrink-0">{r.value}</span>
                    <span className="bg-surface-container-lowest text-on-surface text-[11px] font-medium px-2 py-0.5 border-y border-r border-accent-500/60 rounded-r-sm whitespace-nowrap">
                      {l(r.text)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="hidden xl:block"><CollapseToggle /></div>
            </div>
            {!collapsed && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <SelfAssessmentBlockView block={block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} hideRatingScale={true} />
              </div>
            )}
          </div>
        </CardWrapper>
      );

    case "paragraph":
      return (
        <p className="text-on-surface text-base leading-[1.75] tracking-[0.01em] my-3">
          <InlineText nodes={l(block.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
        </p>
      );

    case "property_matrix":
  return (
    <div className="grid gap-2 mt-2">
      {(block as PropertyMatrixBlock).rows.map((row, j) => (
        <div key={j} className="flex flex-wrap items-baseline gap-2">
          <span className="font-bold text-primary-600 dark:text-primary-400 w-16 shrink-0 text-sm">
            {l(row.label)}
          </span>
          <div className="flex-1">
            {row.text ? (
              <InlineText nodes={l(row.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
            ) : row.translations ? (
              <InlineMath math={l(row.translations)?.latex ?? ""} />
            ) : row.latex ? (
              <InlineMath math={row.latex} />
            ) : null}
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
      <div className="relative p-4 overflow-hidden bg-surface-container-lowest">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-error rounded-r-md"></div>
        <div className="flex items-center justify-between mb-4 pl-2">
          <h5 className="text-lg font-bold text-primary-800 dark:text-primary-200 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-error-container flex items-center justify-center border border-error/20 shadow-sm shrink-0">
              <span className="text-sm drop-shadow-sm">💡</span>
            </div>
            {l(block.title)}
          </h5>
          <CollapseToggle />
        </div>
        {!collapsed && (
          <div className="space-y-6 pl-2">
            {block.concepts.map((concept, i) => (
              <div key={i} className="border-l-2 border-primary-200 dark:border-primary-800 pl-4">
                <h6 className="font-semibold text-primary-700 dark:text-primary-300 text-sm mb-2">
                  {l(concept.subtitle)}
                </h6>
                {/* Render either the new content array or the old matrix */}
                {concept.content ? (
                  <div className="space-y-3">
                    {concept.content.map((b, j) => (
                      <BlockRenderer key={j} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />
                    ))}
                  </div>
                ) : concept.matrix ? (
                  <div className="grid gap-2 mt-1">
                    {concept.matrix.map((row, j) => (
                      <div key={j} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
                        <span className="font-bold text-primary-600 dark:text-primary-400 w-16 shrink-0 text-sm">{l(row.label)}</span>
                        <div className="flex-1 min-w-0">
                          {row.text ? <InlineText nodes={l(row.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /> : row.translations ? <InlineMath math={l(row.translations)?.latex ?? ""} /> : row.latex ? <InlineMath math={row.latex} /> : null}
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
        <CardWrapper className="bg-accent-100 dark:bg-accent-900/20 border-accent-200 dark:border-accent-800">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-bold text-on-accent-container dark:text-on-accent flex items-center gap-2"><span>📖</span> {l(block.title)}</h5>
              <CollapseToggle />
            </div>
            <ul className="space-y-1">
              {block.terms.map((term, i) => (
                <li key={i} className="text-xs">
                  <button onClick={() => { const vocabId = Object.keys(dictionary).find((k) => dictionary[k].word.en === term.term.en || dictionary[k].word.uz === term.term.uz || dictionary[k].word.ru === term.term.ru); if (vocabId) onTermClick(vocabId); }} className="font-semibold underline decoration-dotted text-on-accent-container dark:text-on-accent hover:text-primary-800 dark:hover:text-primary-200">{l(term.term)}</button>
                  <span className="text-on-accent-container/70 dark:text-on-accent/70 ml-2 opacity-75">({term.reference})</span>
                </li>
              ))}
            </ul>
          </div>
        </CardWrapper>
      );

    case "study_tip_box":
      return (
        <CardWrapper className="bg-surface-container-high border-outline-variant">
          <div className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <span className="text-xl">💡</span>
                <h5 className="text-sm font-bold text-on-surface">{l(block.title)}</h5>
              </div>
              <CollapseToggle />
            </div>
            <p className="text-sm text-on-surface-variant"><InlineText nodes={l(block.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></p>
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
            <p className="text-sm mt-2 text-on-error-container"><InlineText nodes={l(block.prompt)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></p>
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
        {block.label && (
          <span className="font-extrabold text-primary-600 dark:text-primary-400 text-lg w-6 shrink-0 -ml-6 mr-1 text-right">
            {block.label}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-on-surface text-sm">
            <InlineText
              nodes={l(block.instruction)}
              dictionary={dictionary}
              onTermClick={onTermClick}
              lang={lang}
            />
          </div>
          {block.content?.map((b, i) => (
            <BlockRenderer
              key={i}
              block={b as Block}
              dictionary={dictionary}
              onTermClick={onTermClick}
              lang={lang}
              compact={compact}
            />
          ))}
        </div>
      </div>
    </div>
  );

    default:
      return <div className="text-red-500 text-sm">Unknown block type: {block.type}</div>;
  }
}

// ---------- Dictionary Modal (unchanged, but uses MD3 tokens) ----------
function DictionaryModal({ termId, dictionary, onClose, onTermClick, currentLang }: { termId: string; dictionary: Dictionary; onClose: () => void; onTermClick: (id: string) => void; currentLang: string }) {
  const entry = dictionary[termId];
  if (!entry) return null;
  const [selectedLang, setSelectedLang] = useState(currentLang || "en");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => setCurrentImageIndex(0), [termId]);

  const word = entry.word[selectedLang] || entry.word.en || entry.word.uz || entry.word.ru;
  const definition = entry.definition[selectedLang] || "";
  const examples = entry.examples?.[selectedLang] || [];
  const images = entry.images || [];
  const languages = ["en", "uz", "ru"];

  const speak = () => {
    if (!word || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = selectedLang === "uz" ? "uz-UZ" : selectedLang === "ru" ? "ru-RU" : "en-US";
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
  };

  const nextImage = () => images.length > 1 && setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => images.length > 1 && setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  const handleBackdropClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4" onClick={handleBackdropClick}>
      <div className={`bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-border relative ${images.length > 0 ? "flex flex-col md:flex-row max-w-5xl w-full max-h-[85vh]" : "max-w-xl w-full"}`} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface shadow-md transition">✕</button>
        <div className={`p-4 md:p-6 ${images.length > 0 ? "flex-1 overflow-y-auto md:border-r border-border" : ""}`}>
          <h3 className="text-xl font-extrabold text-on-surface pr-8 mb-4">{word}</h3>
          <div className="flex gap-2 mb-3">
            {languages.map((lang) => (
              <button key={lang} onClick={() => setSelectedLang(lang)} className={`px-3 py-1 rounded-full text-xs font-semibold transition ${selectedLang === lang ? "bg-primary-600 text-white shadow-md" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"}`}>{lang.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={speak} disabled={isSpeaking} className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-semibold transition mb-4 text-sm ${isSpeaking ? "bg-primary-200 text-on-primary-container cursor-wait" : "bg-primary-100 text-on-primary-container hover:bg-primary-200 dark:bg-primary-900 dark:text-on-primary dark:hover:bg-primary-800"}`}>
            {isSpeaking ? "🔊 Speaking…" : "🔊 Listen"}
          </button>
          <div className="mb-4"><h4 className="font-bold text-on-surface text-sm mb-1">Definition</h4><p className="text-on-surface-variant leading-relaxed text-sm">{definition}</p></div>
          {examples.length > 0 && <div className="mb-4"><h4 className="font-bold text-on-surface text-sm mb-1">Examples</h4><ul className="list-disc list-inside text-on-surface-variant space-y-1 text-sm">{examples.map((ex, i) => <li key={i}>{ex}</li>)}</ul></div>}
          {entry.relatedConcepts && entry.relatedConcepts.length > 0 && (
            <div><h4 className="font-bold text-on-surface text-sm mb-2">Related Concepts</h4><div className="flex flex-wrap gap-2">{entry.relatedConcepts.map((id) => <button key={id} onClick={() => onTermClick(id)} className="bg-surface-container-high text-on-surface-variant px-2 py-1 rounded-full text-xs font-medium hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900 dark:hover:text-primary-200 transition">{dictionary[id]?.word.en || id}</button>)}</div></div>
          )}
        </div>
        {images.length > 0 && (
          <div className="md:w-1/2 bg-surface-alt flex flex-col items-center justify-center p-4 border-t md:border-t-0 border-border">
            <div className="relative w-full h-48 md:h-80 flex items-center justify-center">
              <img src={images[currentImageIndex]} alt={word} className="max-w-full max-h-full object-contain rounded-lg shadow" />
              {images.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-surface-container-lowest rounded-full p-1 shadow hover:bg-surface-container-high transition">◀</button>
                  <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface-container-lowest rounded-full p-1 shadow hover:bg-surface-container-high transition">▶</button>
                </>
              )}
            </div>
            {images.length > 1 && <div className="flex gap-1 mt-2">{images.map((_, idx) => <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={`w-2 h-2 rounded-full transition ${idx === currentImageIndex ? "bg-primary-600 scale-110" : "bg-surface-container-high hover:bg-surface-container-highest"}`} />)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Dictionary List Modal (MD3 tokens) ----------
function DictionaryListModal({ dictionary, onClose, onTermClick }: { dictionary: Dictionary; onClose: () => void; onTermClick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const entries = Object.values(dictionary).filter((entry) => Object.values(entry.word).join(" ").toLowerCase().includes(search.toLowerCase()));
  const handleBackdropClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={handleBackdropClick}>
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-extrabold text-on-surface">📖 Dictionary</h3><button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-2xl leading-none">✕</button></div>
        <div className="mb-4"><input type="text" placeholder="Search terms..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border border-outline-variant dark:border-outline rounded-xl px-3 py-2 bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" /></div>
        <div className="grid gap-2">
          {entries.length === 0 ? <p className="text-on-surface-variant text-center py-6">No terms found.</p> :
            entries.map((entry) => (
              <button key={entry.id} onClick={() => onTermClick(entry.id)} className="text-left bg-surface-container-low rounded-xl p-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-border transition flex gap-3 items-start">
                {entry.images && entry.images[0] && <img src={entry.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />}
                <div className="flex-1">
                  <div className="flex items-center justify-between"><span className="font-bold text-base text-on-surface">{entry.word.en || entry.word.uz || entry.word.ru}</span><div className="flex gap-1 text-xs text-on-surface-variant">{["en", "uz", "ru"].map((l) => <span key={l} className="bg-surface-container-high px-1 py-0.5 rounded">{l.toUpperCase()}</span>)}</div></div>
                  <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{entry.definition.en?.substring(0, 120)}…</p>
                </div>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ---------- Syllabus Sidebar (MD3 tokens) ----------
function SyllabusSidebar({ blocks, lang, activeId, onCollapseAll }: { blocks: Block[]; lang: string; activeId: string | null; onCollapseAll: () => void }) {
  const entries = blocks
    .filter(b => ["learning_target", "explore_it", "lesson_concept", "example_block", "self_assessment_block", "key_ideas_box"].includes(b.type))
    .map((b, idx) => {
      let title = "";
      switch (b.type) {
        case "learning_target": title = "Learning Target"; break;
        case "explore_it": title = pickLang((b as ExploreItBlock).header?.title, lang) || "Explore It"; break;
        case "lesson_concept": title = pickLang((b as LessonConceptBlock).title, lang); break;
        case "example_block": title = pickLang((b as ExampleBlock).label, lang) + ": " + pickLang((b as ExampleBlock).title, lang); break;
        case "self_assessment_block": title = pickLang((b as SelfAssessmentBlock).title, lang) || "Self Assessment"; break;
        case "key_ideas_box": title = pickLang((b as KeyIdeasBoxBlock).title, lang); break;
        default: title = b.type;
      }
      const id = b.id ? String(b.id) : `block-${idx}`;
      return { id, title, type: b.type };
    });

  return (
    <aside className="w-48 shrink-0 bg-surface-container-lowest border-r border-border p-3 overflow-y-auto max-h-screen sticky top-16 hidden lg:flex lg:flex-col">
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
                onClick={() => {
                  const el = document.getElementById(entry.id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`block w-full text-left py-1 px-2 rounded text-xs transition ${isActive ? "bg-primary-100 text-on-primary-container dark:bg-primary-900/30 dark:text-primary-300 font-semibold" : "text-on-surface-variant hover:text-primary-600 dark:hover:text-primary-300"}`}
              >
                {entry.title}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ---------- Main App (unchanged except for MD3 tokens in header) ----------
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
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [focusMode, setFocusMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [globalCollapsed, setGlobalCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/data/9.1.json").then((r) => r.json()).then(setLesson);
    fetch("/data/dictionary.json").then((r) => r.json()).then(setDictionary);
    const saved = localStorage.getItem("bookmarks");
    if (saved) setBookmarks(new Set(JSON.parse(saved)));
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
        if (mostVisible) setActiveId(mostVisible.id);
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

  const toggleBookmark = (id: string) => {
    const next = new Set(bookmarks);
    next.has(id) ? next.delete(id) : next.add(id);
    setBookmarks(next);
    localStorage.setItem("bookmarks", JSON.stringify([...next]));
  };

  if (!lesson) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-4 text-lg text-on-surface-variant">Loading…</p></div>
  );

  const containerClass = dualMode
  ? "flex w-4/5 mx-auto"          // 80% width, centered
  : "flex max-w-7xl mx-auto";

  return (
    <div className={`min-h-screen bg-surface text-on-surface transition-colors ${focusMode ? "max-w-3xl mx-auto" : ""}`}>
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-surface-container-high"><div className="h-full bg-primary-500 transition-all duration-100" style={{ width: `${scrollProgress * 100}%` }} /></div>
      <header className="sticky top-1 z-40 backdrop-blur-lg bg-surface-container-lowest/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-300 dark:to-primary-200">{lesson.title.en || lesson.title.uz || lesson.title.ru}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={leftLang} onChange={(e) => setLeftLang(e.target.value)} className="bg-surface-container-lowest border border-border rounded-xl px-2 py-1 text-sm font-medium text-on-surface">
              <option value="en">English</option><option value="uz">O'zbek</option><option value="ru">Русский</option>
            </select>
            <button onClick={() => setDualMode(!dualMode)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${dualMode ? "bg-primary-600 text-white shadow-lg scale-105" : "bg-surface-container-lowest text-on-surface-variant border border-border hover:border-primary-400"}`}>
              {dualMode ? "🔀 Dual View" : "📖 Dual View"}
            </button>
            {dualMode && (
              <div className="flex items-center gap-1 bg-surface-container-lowest px-2 py-1 rounded-xl border border-border">
                <span className="text-xs">compare</span>
                <select value={rightLang} onChange={(e) => setRightLang(e.target.value)} className="bg-transparent text-xs font-medium text-on-surface"><option value="en">EN</option><option value="uz">UZ</option><option value="ru">RU</option></select>
              </div>
            )}
            <button onClick={() => setGlobalCollapsed(!globalCollapsed)} className="p-2 rounded-full bg-surface-container-lowest border border-border shadow-sm hover:shadow-md transition" title={globalCollapsed ? "Expand All" : "Collapse All"}>
              {globalCollapsed ? "📖" : "📕"}
            </button>
            <button onClick={() => setShowDictionaryList(true)} className="p-2 rounded-full bg-surface-container-lowest border border-border shadow-sm hover:shadow-md transition" title="Dictionary">📖</button>
            <button onClick={() => setFocusMode(!focusMode)} className="p-2 rounded-full bg-surface-container-lowest border border-border shadow-sm hover:shadow-md transition">{focusMode ? "👁️" : "👓"}</button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-surface-container-lowest border border-border shadow-sm hover:shadow-md transition">{darkMode ? "☀️" : "🌙"}</button>
          </div>
        </div>
      </header>

      <div className={containerClass}>
        {!dualMode && <SyllabusSidebar blocks={lesson.blocks} lang={leftLang} activeId={activeId} onCollapseAll={() => setGlobalCollapsed(true)} />}
        <main ref={mainRef} className="flex-1 pl-1 md:pl-2 lg:pl-3 pr-3 md:pr-4 lg:pr-5 py-6 space-y-11">
          {dualMode ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="space-y-6">
                {lesson.blocks.map((block, idx) => (
                  <div key={idx} id={block.id ? String(block.id) : `block-${idx}`} className="relative">
                    <BlockRenderer block={block} dictionary={dictionary} onTermClick={(id) => setSelectedTermId(id)} lang={leftLang} compact globalCollapsed={globalCollapsed} />
                    {block.id && <button onClick={() => toggleBookmark(String(block.id))} className="absolute top-1 right-1 text-lg" title="Bookmark">{bookmarks.has(String(block.id)) ? "🔖" : "📑"}</button>}
                  </div>
                ))}
              </div>
              <div className="space-y-6">
                {lesson.blocks.map((block, idx) => (
                  <div key={idx} id={block.id ? String(block.id) : `block-${idx}-right`} className="relative">
                    <BlockRenderer block={block} dictionary={dictionary} onTermClick={(id) => setSelectedTermId(id)} lang={rightLang} compact globalCollapsed={globalCollapsed} />
                    {block.id && <button onClick={() => toggleBookmark(String(block.id))} className="absolute top-1 right-1 text-lg">{bookmarks.has(String(block.id)) ? "🔖" : "📑"}</button>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            
            lesson.blocks.map((block, idx) => (
              <div key={idx} id={block.id ? String(block.id) : `block-${idx}`} className="relative">
                <BlockRenderer block={block} dictionary={dictionary} onTermClick={(id) => setSelectedTermId(id)} lang={leftLang} globalCollapsed={globalCollapsed} />
                {block.id && <button onClick={() => toggleBookmark(String(block.id))} className="absolute top-1 right-1 text-lg" title="Bookmark">{bookmarks.has(String(block.id)) ? "🔖" : "📑"}</button>}
              </div>
            ))
          )}
        </main>
      </div>

      {bookmarks.size > 0 && (
        <div className="fixed bottom-16 right-4 bg-surface-container-lowest rounded-xl shadow-lg p-3 max-h-48 overflow-y-auto z-50 text-sm"><h4 className="font-bold mb-1">Bookmarks</h4>{[...bookmarks].map((id) => <a key={id} href={`#${id}`} className="block text-sm text-primary-600 dark:text-primary-400 underline mb-1">Go to section</a>)}</div>
      )}
      <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-4 right-4 p-3 rounded-full bg-primary-600 text-white shadow-xl hover:bg-primary-700 transition z-50">↑</button>

      {selectedTermId && dictionary[selectedTermId] && <DictionaryModal termId={selectedTermId} dictionary={dictionary} onClose={() => setSelectedTermId(null)} onTermClick={(id) => setSelectedTermId(id)} currentLang={leftLang} />}
      {showDictionaryList && <DictionaryListModal dictionary={dictionary} onClose={() => setShowDictionaryList(false)} onTermClick={(id) => { setSelectedTermId(id); setShowDictionaryList(false); }} />}
    </div>
  );
}