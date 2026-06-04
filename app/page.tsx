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
interface KeyIdeasBoxBlock extends BlockBase { type: "key_ideas_box"; style?: string; title: MultilingualString; concepts: { subtitle: MultilingualString; matrix: { label: MultilingualString; text?: Record<string, InlineNode[]>; latex?: string; translations?: Record<string, { latex: string }> }[] }[]; }
interface VocabularyBoxBlock extends BlockBase { type: "vocabulary_box"; icon?: string; title: MultilingualString; terms: { term: MultilingualString; reference: string }[]; }
interface StudyTipBoxBlock extends BlockBase { type: "study_tip_box"; icon?: string; title: MultilingualString; text: Record<string, InlineNode[]>; }
interface MtrBadgeBlock extends BlockBase { type: "mtr_badge"; id: number; badge: string; prompt: Record<string, InlineNode[]>; }
interface ImageBlock extends BlockBase { type: "image"; src: string; style?: string; alt: MultilingualString; }
interface VideoBlock extends BlockBase { type: "video"; src: string; poster?: string; }
interface TaskBlock extends BlockBase { type: "task_block"; label?: string; level: number; instruction: Record<string, InlineNode[]>; content?: BlockBase[]; }

type Block = LearningTargetBlock | ExploreItBlock | LessonConceptBlock | ExampleBlock | SelfAssessmentBlock | ParagraphBlock | InstructionTextBlock | BulletListBlock | EquationGridBlock | QuestionGridBlock | CardTilesBlock | WorkedSolutionsBlock | KeyIdeasBoxBlock | VocabularyBoxBlock | StudyTipBoxBlock | MtrBadgeBlock | ImageBlock | VideoBlock | TaskBlock;

interface Lesson { id: string; title: MultilingualString; langs: string[]; blocks: Block[]; }
interface DictionaryEntry { id: string; word: MultilingualString; definition: MultilingualString; images: string[]; examples: Record<string, string[]>; relatedConcepts: string[]; }
type Dictionary = Record<string, DictionaryEntry>;

// ---------- Helpers ----------
function pickLang<T extends Record<string, any>>(obj: T, lang: string): T[keyof T] | undefined {
  return obj[lang] || obj["en"];
}

// ---------- TermTooltip (unchanged) ----------
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
        <div ref={tooltipRef} className="fixed z-[100] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl p-4 w-80 text-sm" style={{ top: `${pos.top}px`, left: `${pos.left}px` }}>
          {entry.images && entry.images[0] && <img src={entry.images[0]} alt={entry.word.en || entry.word.uz || entry.word.ru} className="w-full h-32 object-contain rounded-lg mb-2 bg-slate-50 dark:bg-slate-900" />}
          <p className="font-bold text-slate-800 dark:text-white">{entry.word[lang] || entry.word.en || entry.word.uz || entry.word.ru}</p>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{pickLang(entry.definition, lang) || pickLang(entry.definition, "en")}</p>
          {examples && examples.length > 0 && <p className="text-xs text-slate-500 mt-1 italic">e.g., {examples[0]}</p>}
        </div>
      )}
    </span>
  );
}

// ---------- InlineText (unchanged) ----------
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

// ---------- Collapsible Worked Solution (unchanged) ----------
function CollapsibleWorkedSolution({ block, dictionary, onTermClick, lang }: { block: WorkedSolutionsBlock; dictionary: Dictionary; onTermClick: (id: string) => void; lang: string }) {
  const l = (obj: any) => pickLang(obj, lang);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  return (
    <div className="space-y-4">
      {block.steps.map((step, idx) => {
        const isOpen = openSteps[idx] ?? false;
        return (
          <div key={idx} className="bg-surface-alt rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {step.label && <span className="font-bold text-primary-700 dark:text-primary-300">{step.label} </span>}
                {step.expression && <InlineMath math={step.expression} />}
              </div>
              <button onClick={() => setOpenSteps((prev) => ({ ...prev, [idx]: !isOpen }))} className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition">
                {isOpen ? "Hide Solution" : "Show Solution"}
              </button>
            </div>
            {isOpen && (
              <div className="mt-4 space-y-4">
                {step.work.map((line, j) => (
                  <div key={j} className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="sm:w-52 shrink-0 bg-white dark:bg-slate-800 p-2 rounded-lg"><InlineMath math={line.line} /></div>
                    <div className="text-base text-slate-600 dark:text-slate-400 flex-1 italic"><InlineText nodes={l(line.explanation)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></div>
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

// ---------- Self Assessment Block (unchanged) ----------
function SelfAssessmentBlockView({ block, dictionary, onTermClick, lang }: { block: SelfAssessmentBlock; dictionary: Dictionary; onTermClick: (id: string) => void; lang: string }) {
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
    if (correct === allQuestionItems.filter(i => i.expected).length) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5000); }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border border-white/20 dark:border-slate-700/50">
      {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}
      <h3 className="text-lg font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200 mb-2">{l(block.title) || "SELF-ASSESSMENT"}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">How well do you understand?</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {block.rating_scale.map((r) => {
          const isSelected = selected === r.value;
          return (
            <button key={r.value} onClick={() => setSelected(r.value)} className={`flex flex-col items-center justify-center p-5 rounded-2xl transition-all duration-300 border-2 ${isSelected ? "bg-primary-50 border-primary-600 shadow-md scale-105 dark:bg-primary-900/20 dark:border-primary-400" : "bg-white border-slate-200 shadow-sm hover:shadow-md hover:scale-[1.02] dark:bg-slate-800 dark:border-slate-600"}`}>
              <span className={`text-3xl font-extrabold mb-2 ${isSelected ? "text-primary-700 dark:text-primary-300" : "text-slate-500 dark:text-slate-400"}`}>{r.value}</span>
              <span className="text-xs text-center font-medium opacity-80">{l(r.text)}</span>
            </button>
          );
        })}
      </div>
      <div className="space-y-6 text-slate-700 dark:text-slate-200">
        {block.body.map((b, i) => {
          if (b.type === "question_grid") {
            const grid = b as QuestionGridBlock;
            return (
              <div key={i} className={`grid gap-5 ${grid.columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                {grid.items.map((item) => (
                  <div key={item.id} className="bg-surface-alt p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-primary-600 dark:text-primary-400 text-lg">{item.label}</span>
                      <InlineMath math={item.latex} />
                    </div>
                    {item.expected && (
                      <div className="flex gap-2 items-center">
                        <input type="text" value={answers[item.id] || ""} onChange={(e) => handleAnswerChange(item.id, e.target.value)} className="border border-slate-300 dark:border-slate-500 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800 w-full" placeholder="Your answer" />
                        {submitted[item.id] && (checkAnswer(item.id, item.expected) ? <span className="text-green-500">✓</span> : <span className="text-red-500">✗</span>)}
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
        <div className="mt-6 flex gap-4 items-center">
          <button onClick={handleSubmit} className="bg-primary-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-primary-700 transition">Check Answers</button>
          {score !== null && <p className="text-sm font-medium text-slate-600 dark:text-slate-400">You got {score}/{allQuestionItems.filter(i => i.expected).length} correct</p>}
        </div>
      )}
    </div>
  );
}

// ---------- Block Renderer (with collapsible wrapper and block badges) ----------
function BlockRenderer({ block, dictionary, onTermClick, lang, compact = false }: { block: Block; dictionary: Dictionary; onTermClick: (id: string) => void; lang: string; compact?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const l = (obj: any) => pickLang(obj, lang);
  const textSize = compact ? "text-base" : "text-lg";

  // Determine block badge (for info)
  let badge = "";
  switch (block.type) {
    case "learning_target": badge = "Learning Target"; break;
    case "explore_it": badge = "Explore It"; break;
    case "lesson_concept": badge = "Lesson Concept"; break;
    case "example_block": badge = "Example"; break;
    case "self_assessment_block": badge = "Self Assessment"; break;
    case "key_ideas_box": badge = "Key Ideas"; break;
    case "vocabulary_box": badge = "Vocabulary"; break;
    case "study_tip_box": badge = "Study Tip"; break;
    case "mtr_badge": badge = "MTR Badge"; break;
    default: badge = "";
  }

  const CollapseToggle = () => (
    <button
      onClick={() => setCollapsed(!collapsed)}
      className="ml-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition"
      title={collapsed ? "Expand" : "Collapse"}
    >
      <svg className="w-5 h-5 transition-transform duration-200" style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  const CardWrapper = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-3xl bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`}>{children}</div>
  );

  const renderContent = () => {
    switch (block.type) {
      case "learning_target":
        return (
          <CardWrapper>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-primary-800 dark:text-primary-200 flex items-center gap-2">
                  <span className="text-3xl">🎯</span> Learning Target
                </h2>
                <CollapseToggle />
              </div>
              {!collapsed && (
                <>
                  <div className={`text-slate-700 dark:text-slate-300 font-medium ${textSize}`}>
                    <InlineText nodes={l(block.target)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
                  </div>
                  {block.success_criteria && (
                    <div className="mt-6 bg-primary-50/50 dark:bg-primary-900/20 rounded-2xl p-5">
                      <h3 className="font-semibold text-primary-900 dark:text-primary-100 mb-3">✅ Success Criteria</h3>
                      <ul className="space-y-3">
                        {l(block.success_criteria)?.map((crit: InlineNode[], idx: number) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-200 dark:bg-primary-800 text-primary-800 dark:text-primary-200 text-sm font-bold mt-0.5">{idx + 1}</span>
                            <span className="text-slate-700 dark:text-slate-300"><InlineText nodes={crit} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardWrapper>
        );

      case "explore_it":
        return (
          <CardWrapper>
            {block.header && (
              <div className="p-6 pb-2 flex items-center justify-between">
                <h2 className={`${compact ? "text-xl" : "text-2xl"} font-extrabold text-slate-800 dark:text-white tracking-tight`}>
                  {l(block.header.title)}
                </h2>
                <CollapseToggle />
              </div>
            )}
            {!collapsed && (
              <div className="px-6 pb-6">
                <div className="lg:grid lg:grid-cols-[1fr_300px] gap-8">
                  <div className="space-y-4">
                    {block.body.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
                  </div>
                  {block.margin_content && block.margin_content.length > 0 && (
                    <aside className="space-y-4">
                      {block.margin_content.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
                    </aside>
                  )}
                </div>
              </div>
            )}
          </CardWrapper>
        );

      case "lesson_concept":
        return (
          <CardWrapper>
            <div className="p-6 border-l-4 border-primary-600 dark:border-primary-400 bg-gradient-to-r from-primary-50/10 to-transparent dark:from-primary-950/10 dark:to-transparent">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`${compact ? "text-xl" : "text-2xl"} font-bold text-slate-800 dark:text-white`}>
                  {l(block.title)}
                </h3>
                <CollapseToggle />
              </div>
              {!collapsed && (
                <div className="lg:grid lg:grid-cols-[1fr_300px] gap-8">
                  <div className="space-y-4">
                    {block.body.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
                  </div>
                  {block.margin_content && (
                    <aside className="space-y-4">
                      {block.margin_content.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
                    </aside>
                  )}
                </div>
              )}
            </div>
          </CardWrapper>
        );

     case "example_block": {
  const hints = block.hints ? pickLang(block.hints, lang) : undefined;
  const [hintIndex, setHintIndex] = useState(0);

  return (
    <CardWrapper>
      <div className="p-6 md:p-8">
        {/* --- STYLED HEADER --- */}
        <div className="flex items-start md:items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Dark Blue Pill like the image */}
            <span className="inline-flex items-center px-5 py-1.5 rounded-lg text-sm sm:text-base font-bold bg-[#2154a4] text-white shadow-sm uppercase tracking-wide">
              {l(block.label)}
            </span>
            <h4 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
              {l(block.title)}
            </h4>
          </div>

          <div className="flex items-center gap-4">
            {/* The "WATCH" Button styled like the book's icon */}
            {block.has_video && (
              <button className="flex flex-col items-center justify-center bg-gradient-to-b from-[#56bbf1] to-[#2591d9] text-white rounded-xl w-16 h-12 shadow-md hover:shadow-lg hover:scale-105 transition-all border border-blue-400">
                <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
                  Watch
                </span>
              </button>
            )}
            <CollapseToggle />
          </div>
        </div>

        {!collapsed && (
          <div className="animate-fade-in">
            {/* Hints Section */}
            {hints && hints.length > 0 && (
              <div className="mb-6">
                <button 
                  onClick={() => setHintIndex((hintIndex + 1) % (hints.length + 1))} 
                  className="text-sm font-semibold text-[#2154a4] dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {hintIndex === 0 ? "Need a hint?" : "Next hint"}
                </button>
                {hintIndex > 0 && hintIndex <= hints.length && (
                  <div className="mt-3 p-4 bg-blue-50 dark:bg-slate-800/50 border border-blue-100 dark:border-blue-900 rounded-xl text-sm text-slate-700 dark:text-slate-300 shadow-inner">
                    <InlineText nodes={hints[hintIndex - 1]} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
                  </div>
                )}
              </div>
            )}

            {/* Body Blocks */}
            <div className="space-y-6">
              {block.body.map((b, i) => 
                b.type === "worked_solutions" ? (
                  <CollapsibleWorkedSolution key={i} block={b as WorkedSolutionsBlock} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />
                ) : (
                  <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />
                )
              )}
            </div>

            {/* Margin Content / Study Tips */}
            {block.margin_content && (
              <aside className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4 flex flex-col md:flex-row gap-4">
                {block.margin_content.map((b, i) => 
                  <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />
                )}
              </aside>
            )}
          </div>
        )}
      </div>
    </CardWrapper>
  );
}

      case "self_assessment_block":
        return <SelfAssessmentBlockView block={block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />;

      case "paragraph":
        return <p className={`text-slate-700 dark:text-slate-300 leading-relaxed ${textSize}`}><InlineText nodes={l(block.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></p>;

      case "instruction_text":
        return <p className={`italic font-medium text-slate-600 dark:text-slate-400 leading-relaxed ${textSize}`}><InlineText nodes={l(block.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></p>;

      case "bullet_list":
        return <ul className={`list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ${textSize}`}>{block.items.map((item, i) => <li key={i}><InlineText nodes={l(item)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></li>)}</ul>;

      case "equation_grid":
        return <div className={`grid gap-4 ${block.columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"} ${block.align === "center" ? "justify-items-center" : ""}`}>{block.items.map((item) => <div key={item.id} className="flex items-start gap-3 p-3 bg-surface-alt rounded-xl"><InlineMath math={item.latex} /></div>)}</div>;

      case "question_grid":
        return <div className={`grid gap-5 ${block.columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>{block.items.map((item) => <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm"><div className="flex items-center gap-3"><span className="font-bold text-primary-600 dark:text-primary-400 text-lg">{item.label}</span><InlineMath math={item.latex} /></div>{item.expected && <div className="mt-2"><input type="text" placeholder="Your answer" className="w-full border border-slate-300 dark:border-slate-500 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800" /></div>}</div>)}</div>;

      case "card_tiles":
        return <div className="flex flex-wrap gap-3">{block.tiles.map((tile) => <div key={tile.id} className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow border border-slate-100 dark:border-slate-700"><InlineMath math={tile.latex} /></div>)}</div>;

      case "worked_solutions":
        return <CollapsibleWorkedSolution block={block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} />;

      case "key_ideas_box":
        return (
          <CardWrapper>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h5 className="text-xl font-bold text-primary-800 dark:text-primary-200 flex items-center gap-2"><span>💡</span> {l(block.title)}</h5>
                <CollapseToggle />
              </div>
              {!collapsed && (
                <div className="space-y-4">
                  {block.concepts.map((concept, i) => (
                    <div key={i} className="mb-4">
                      <h6 className="font-semibold text-primary-700 dark:text-primary-300 text-lg">{l(concept.subtitle)}</h6>
                      <div className="grid gap-3 mt-2">
                        {concept.matrix.map((row, j) => (
                          <div key={j} className="flex flex-wrap items-baseline gap-2">
                            <span className="font-bold text-primary-600 dark:text-primary-400 w-20">{l(row.label)}</span>
                            <div className="flex-1">
                              {row.text ? <InlineText nodes={l(row.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /> : row.translations ? <InlineMath math={l(row.translations)?.latex ?? ""} /> : row.latex ? <InlineMath math={row.latex} /> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardWrapper>
        );

      case "vocabulary_box":
        return (
          <CardWrapper className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2"><span>📖</span> {l(block.title)}</h5>
                <CollapseToggle />
              </div>
              {!collapsed && (
                <ul className="space-y-2">
                  {block.terms.map((term, i) => (
                    <li key={i} className="text-sm">
                      <button onClick={() => { const vocabId = Object.keys(dictionary).find((k) => dictionary[k].word.en === term.term.en || dictionary[k].word.uz === term.term.uz || dictionary[k].word.ru === term.term.ru); if (vocabId) onTermClick(vocabId); }} className="font-semibold underline decoration-dotted text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100">{l(term.term)}</button>
                      <span className="text-amber-600 dark:text-amber-400 ml-2 opacity-75">({term.reference})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardWrapper>
        );

      case "study_tip_box":
        return (
          <CardWrapper className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800">
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💡</span>
                  <h5 className="text-lg font-bold text-cyan-800 dark:text-cyan-200">{l(block.title)}</h5>
                </div>
                <CollapseToggle />
              </div>
              {!collapsed && (
                <p className="text-base text-cyan-700 dark:text-cyan-300"><InlineText nodes={l(block.text)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></p>
              )}
            </div>
          </CardWrapper>
        );

      case "mtr_badge":
        return (
          <CardWrapper className="bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span className="inline-block bg-rose-500 text-white px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider">{block.badge}</span>
                <CollapseToggle />
              </div>
              {!collapsed && (
                <p className="text-base mt-3 text-rose-800 dark:text-rose-300"><InlineText nodes={l(block.prompt)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></p>
              )}
            </div>
          </CardWrapper>
        );

      case "image":
        return <img src={block.src} alt={l(block.alt)} className="max-w-full h-auto rounded-2xl shadow-md" />;

      case "video":
        return <video controls poster={block.poster} className="w-full rounded-2xl shadow-lg" />;

      case "task_block":
        const marginLeft = block.level <= 1 ? "ml-0" : block.level === 2 ? "ml-6" : "ml-10";
        return (
          <div className={`${marginLeft} mb-3`}>
            <div className="flex gap-2">
              {block.label && <span className="font-extrabold text-primary-600 dark:text-primary-400 text-xl">{block.label}</span>}
              <div className={`text-slate-700 dark:text-slate-300 ${textSize}`}><InlineText nodes={l(block.instruction)} dictionary={dictionary} onTermClick={onTermClick} lang={lang} /></div>
            </div>
            {block.content?.map((b, i) => <BlockRenderer key={i} block={b as Block} dictionary={dictionary} onTermClick={onTermClick} lang={lang} compact={compact} />)}
          </div>
        );

      default:
        return <div className="text-red-500">Unknown block type: {block.type}</div>;
    }
  };

  return renderContent();
}

// ---------- Dictionary Modal (unchanged) ----------
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
      <div className={`bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-white/20 relative ${images.length > 0 ? "flex flex-col md:flex-row max-w-5xl w-full max-h-[85vh]" : "max-w-xl w-full"}`} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 shadow-md transition">✕</button>
        <div className={`p-6 md:p-8 ${images.length > 0 ? "flex-1 overflow-y-auto md:border-r border-slate-200 dark:border-slate-700" : ""}`}>
          <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white pr-10 mb-6">{word}</h3>
          <div className="flex gap-2 mb-4">
            {languages.map((lang) => (
              <button key={lang} onClick={() => setSelectedLang(lang)} className={`px-4 py-2 rounded-full text-sm font-semibold transition ${selectedLang === lang ? "bg-primary-600 text-white shadow-md" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"}`}>{lang.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={speak} disabled={isSpeaking} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold transition mb-6 ${isSpeaking ? "bg-primary-200 text-primary-800 cursor-wait" : "bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 hover:bg-primary-200 dark:hover:bg-primary-800"}`}>
            {isSpeaking ? "🔊 Speaking…" : "🔊 Listen"}
          </button>
          <div className="mb-6"><h4 className="font-bold text-slate-700 dark:text-slate-200 text-lg mb-2">Definition</h4><p className="text-slate-600 dark:text-slate-400 leading-relaxed">{definition}</p></div>
          {examples.length > 0 && <div className="mb-6"><h4 className="font-bold text-slate-700 dark:text-slate-200 text-lg mb-2">Examples</h4><ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1">{examples.map((ex, i) => <li key={i}>{ex}</li>)}</ul></div>}
          {entry.relatedConcepts && entry.relatedConcepts.length > 0 && (
            <div><h4 className="font-bold text-slate-700 dark:text-slate-200 text-lg mb-2">Related Concepts</h4><div className="flex flex-wrap gap-2">{entry.relatedConcepts.map((id) => <button key={id} onClick={() => onTermClick(id)} className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-full text-sm font-medium hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900 dark:hover:text-primary-200 transition">{dictionary[id]?.word.en || id}</button>)}</div></div>
          )}
        </div>
        {images.length > 0 && (
          <div className="md:w-1/2 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 border-t md:border-t-0 border-slate-200 dark:border-slate-700">
            <div className="relative w-full h-64 md:h-96 flex items-center justify-center">
              <img src={images[currentImageIndex]} alt={word} className="max-w-full max-h-full object-contain rounded-xl shadow-lg" />
              {images.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-800/90 rounded-full p-2 shadow hover:bg-white dark:hover:bg-slate-700 transition">◀</button>
                  <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-800/90 rounded-full p-2 shadow hover:bg-white dark:hover:bg-slate-700 transition">▶</button>
                </>
              )}
            </div>
            {images.length > 1 && <div className="flex gap-2 mt-4">{images.map((_, idx) => <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={`w-3 h-3 rounded-full transition ${idx === currentImageIndex ? "bg-primary-600 scale-110" : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400"}`} />)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Dictionary List Modal ----------
function DictionaryListModal({ dictionary, onClose, onTermClick }: { dictionary: Dictionary; onClose: () => void; onTermClick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const entries = Object.values(dictionary).filter((entry) => Object.values(entry.word).join(" ").toLowerCase().includes(search.toLowerCase()));
  const handleBackdropClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-extrabold text-slate-800 dark:text-white">📖 Dictionary</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none">✕</button></div>
        <div className="mb-6"><input type="text" placeholder="Search terms..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
        <div className="grid gap-3">
          {entries.length === 0 ? <p className="text-slate-500 dark:text-slate-400 text-center py-8">No terms found.</p> :
            entries.map((entry) => (
              <button key={entry.id} onClick={() => onTermClick(entry.id)} className="text-left bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-slate-200 dark:border-slate-600 transition flex gap-4 items-start">
                {entry.images && entry.images[0] && <img src={entry.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                <div className="flex-1">
                  <div className="flex items-center justify-between"><span className="font-bold text-lg text-slate-800 dark:text-white">{entry.word.en || entry.word.uz || entry.word.ru}</span><div className="flex gap-1 text-xs text-slate-500">{["en", "uz", "ru"].map((l) => <span key={l} className="bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">{l.toUpperCase()}</span>)}</div></div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{entry.definition.en?.substring(0, 150)}…</p>
                </div>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ---------- Syllabus Sidebar (with active state) ----------
function SyllabusSidebar({ blocks, lang, activeId }: { blocks: Block[]; lang: string; activeId: string | null }) {
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
      return { id, title };
    });

  return (
    <aside className="w-56 shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 overflow-y-auto max-h-screen sticky top-16 hidden lg:block">
      <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 text-sm">Contents</h4>
      <ul className="space-y-1">
        {entries.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <li key={entry.id}>
              <button
                onClick={() => {
                  const el = document.getElementById(entry.id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`block w-full text-left py-1 px-2 rounded text-sm transition ${
                  isActive
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-300"
                }`}
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
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [focusMode, setFocusMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface"><div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-4 text-xl text-slate-500 dark:text-slate-400">Loading…</p></div>
  );

  return (
    <div className={`min-h-screen bg-surface text-slate-800 dark:text-slate-100 transition-colors ${focusMode ? "max-w-3xl mx-auto" : ""}`}>
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-slate-200 dark:bg-slate-700"><div className="h-full bg-primary-500 transition-all duration-100" style={{ width: `${scrollProgress * 100}%` }} /></div>
      <header className="sticky top-1 z-40 backdrop-blur-lg bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-300 dark:to-primary-200">{lesson.title.en || lesson.title.uz || lesson.title.ru}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <select value={leftLang} onChange={(e) => setLeftLang(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-medium">
              <option value="en">English</option><option value="uz">O'zbek</option><option value="ru">Русский</option>
            </select>
            <button onClick={() => setDualMode(!dualMode)} className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${dualMode ? "bg-primary-600 text-white shadow-lg scale-105" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:border-primary-400"}`}>
              {dualMode ? "🔀 Dual View" : "📖 Dual View"}
            </button>
            {dualMode && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-sm">compare with</span>
                <select value={rightLang} onChange={(e) => setRightLang(e.target.value)} className="bg-transparent text-sm font-medium"><option value="en">EN</option><option value="uz">UZ</option><option value="ru">RU</option></select>
              </div>
            )}
            <button onClick={() => setShowDictionaryList(true)} className="p-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition" title="Dictionary">📖</button>
            <button onClick={() => setFocusMode(!focusMode)} className="p-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition">{focusMode ? "👁️" : "👓"}</button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition">{darkMode ? "☀️" : "🌙"}</button>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {!dualMode && <SyllabusSidebar blocks={lesson.blocks} lang={leftLang} activeId={activeId} />}
        {/* Reduced side padding & vertical spacing */}
        <main ref={mainRef} className="flex-1 pl-2 md:pl-3 lg:pl-4 pr-4 md:pr-5 lg:pr-6 py-8 space-y-8">
          {dualMode ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-8">
                {lesson.blocks.map((block, idx) => (
                  <div key={idx} id={block.id ? String(block.id) : `block-${idx}`} className="relative">
                    <BlockRenderer block={block} dictionary={dictionary} onTermClick={(id) => setSelectedTermId(id)} lang={leftLang} compact />
                    {block.id && <button onClick={() => toggleBookmark(String(block.id))} className="absolute top-2 right-2 text-xl" title="Bookmark">{bookmarks.has(String(block.id)) ? "🔖" : "📑"}</button>}
                  </div>
                ))}
              </div>
              <div className="space-y-8">
                {lesson.blocks.map((block, idx) => (
                  <div key={idx} id={block.id ? String(block.id) : `block-${idx}-right`} className="relative">
                    <BlockRenderer block={block} dictionary={dictionary} onTermClick={(id) => setSelectedTermId(id)} lang={rightLang} compact />
                    {block.id && <button onClick={() => toggleBookmark(String(block.id))} className="absolute top-2 right-2 text-xl">{bookmarks.has(String(block.id)) ? "🔖" : "📑"}</button>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            lesson.blocks.map((block, idx) => (
              <div key={idx} id={block.id ? String(block.id) : `block-${idx}`} className="relative">
                <BlockRenderer block={block} dictionary={dictionary} onTermClick={(id) => setSelectedTermId(id)} lang={leftLang} />
                {block.id && <button onClick={() => toggleBookmark(String(block.id))} className="absolute top-2 right-2 text-xl" title="Bookmark">{bookmarks.has(String(block.id)) ? "🔖" : "📑"}</button>}
              </div>
            ))
          )}
        </main>
      </div>

      {bookmarks.size > 0 && (
        <div className="fixed bottom-20 right-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 max-h-64 overflow-y-auto z-50"><h4 className="font-bold mb-2">Bookmarks</h4>{[...bookmarks].map((id) => <a key={id} href={`#${id}`} className="block text-sm text-primary-600 dark:text-primary-400 underline mb-1">Go to section</a>)}</div>
      )}
      <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 p-4 rounded-full bg-primary-600 text-white shadow-xl hover:bg-primary-700 transition z-50">↑</button>

      {selectedTermId && dictionary[selectedTermId] && <DictionaryModal termId={selectedTermId} dictionary={dictionary} onClose={() => setSelectedTermId(null)} onTermClick={(id) => setSelectedTermId(id)} currentLang={leftLang} />}
      {showDictionaryList && <DictionaryListModal dictionary={dictionary} onClose={() => setShowDictionaryList(false)} onTermClick={(id) => { setSelectedTermId(id); setShowDictionaryList(false); }} />}
    </div>
  );
}