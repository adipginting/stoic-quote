// Deterministic quote extractor for the Standard Ebooks Stoic sources.
//
// Run with: pnpm --filter @stoic-quote/api extract
// (equivalently: node scripts/extract.mjs from apps/api)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'node-html-parser';

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(API_DIR, 'data');
const OUTPUT_FILE = resolve(DATA_DIR, 'quotes.json');

const MIN_LENGTH = 100;
const MAX_LENGTH = 700;

const TAG_VOCABULARY = [
  'stoicism',
  'virtue',
  'death',
  'time',
  'nature',
  'anger',
  'fear',
  'desire',
  'friendship',
  'freedom',
  'duty',
  'reason',
  'pain',
  'wealth',
  'fame',
  'power',
  'fortune',
  'god',
];

// Keyword stems per tag. Each stem is matched case-insensitively at a word
// boundary (prefix match), so "fear" also matches "fearful"/"fears" and
// "god" matches "gods"/"goddess". Ranked by total match count.
const TAG_KEYWORDS = {
  stoicism: ['stoic', 'stoa'],
  virtue: [
    'virtue',
    'virtuous',
    'good',
    'honourable',
    'honorable',
    'justice',
    'wisdom',
    'wise',
    'courage',
    'temperance',
    'noble',
    'vice',
    'moral',
    'excellence',
  ],
  death: ['death', 'dead', 'dying', 'die', 'died', 'dies', 'mortal', 'tomb', 'grave', 'kill', 'slain', 'perish'],
  time: ['time', 'hour', 'day', 'past', 'future', 'fleeting', 'delay', 'moment', 'swift', 'age'],
  nature: ['nature', 'natural', 'universe', 'cosmos', 'world', 'earth', 'element'],
  anger: ['anger', 'angry', 'wrath', 'rage', 'provoke', 'insult', 'revenge', 'fury', 'resent', 'hate'],
  fear: ['fear', 'afraid', 'dread', 'terror', 'fright', 'alarm', 'timid'],
  desire: ['desire', 'appetite', 'longing', 'crave', 'pleasure', 'lust', 'covet'],
  friendship: ['friend', 'companion', 'brother', 'fellowship', 'kindred', 'neighbour', 'neighbor', 'society'],
  freedom: ['free', 'freedom', 'slave', 'slavery', 'master', 'liberty', 'bondage', 'enslave'],
  duty: ['duty', 'duties', 'ought', 'obligation', 'office', 'station'],
  reason: ['reason', 'rational', 'mind', 'thought', 'judgement', 'judgment', 'opinion', 'intellect', 'understanding'],
  pain: ['pain', 'grief', 'sorrow', 'suffer', 'distress', 'misery', 'anguish', 'torment', 'hurt', 'sickness'],
  wealth: ['wealth', 'rich', 'money', 'gold', 'possession', 'property', 'treasure'],
  fame: ['fame', 'reputation', 'glory', 'praise', 'honour', 'honor', 'renown', 'applause', 'disgrace'],
  power: ['power', 'king', 'emperor', 'ruler', 'command', 'authority', 'tyrant', 'dominion', 'sovereign'],
  fortune: ['fortune', 'fate', 'chance', 'luck', 'circumstance', 'providence', 'destiny', 'accident'],
  god: ['god', 'divine', 'heaven', 'deity', 'immortal'],
};

const ABBREVIATIONS = [
  'i.e.',
  'e.g.',
  'B.C.',
  'A.D.',
  'a.m.',
  'p.m.',
  'q.v.',
  'cf.',
  'viz.',
  'etc.',
  'vol.',
  'no.',
  'pp.',
  'p.',
  'ed.',
  'trans.',
  'chap.',
  'ibid.',
  'Mr.',
  'Mrs.',
  'Ms.',
  'Dr.',
  'St.',
  'Jr.',
  'Sr.',
  'Pr.',
  'vs.',
  'al.',
  'ca.',
  'tom.',
  'tit.',
];

const DOT_PLACEHOLDER = '\uE000';
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
const NON_TERMINAL_TAIL = /[)”’"'\]}]+$/;

// ---------------------------------------------------------------------------
// Source definitions
// ---------------------------------------------------------------------------

const WORK_DIRS = {
  meditations: 'marcus-aurelius_meditations_george-long',
  seneca: 'seneca_dialogues_aubrey-stewart',
  enchiridion: 'epictetus_short-works_george-long',
  discourses: 'epictetus_discourses_george-long',
};

const WORKS = [
  {
    slug: 'meditations',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    translation: 'George Long',
    dir: WORK_DIRS.meditations,
    files: (names) => names.filter((n) => /^book-\d+\.xhtml$/.test(n)),
    sectionFor: (file) => `Book ${Number(basename(file, '.xhtml').replace('book-', ''))}`,
    bookFor: (file) => basename(file, '.xhtml').replace('book-', ''),
    idFor: ({ book, paragraphIndex, sentenceIndex }) =>
      `meditations-${book}-${paragraphIndex}-${sentenceIndex}`,
  },
  {
    slug: 'seneca',
    author: 'Seneca',
    work: 'Dialogues',
    translation: 'Aubrey Stewart',
    dir: WORK_DIRS.seneca,
    files: (names) => names.filter((n) => /^(on|to)-.*\.xhtml$/.test(n)),
    sectionFromTitle: true,
    bookFor: (file) => basename(file, '.xhtml'),
    idFor: ({ book, paragraphIndex, sentenceIndex }) => `seneca-${book}-${paragraphIndex}-${sentenceIndex}`,
  },
  {
    slug: 'enchiridion',
    author: 'Epictetus',
    work: 'The Enchiridion',
    translation: 'George Long',
    dir: WORK_DIRS.enchiridion,
    files: () => ['the-enchiridion.xhtml'],
    sectionFor: () => null,
    bookFor: () => null,
    idFor: ({ paragraphIndex, sentenceIndex }) => `enchiridion-${paragraphIndex}-${sentenceIndex}`,
  },
  {
    slug: 'discourses',
    author: 'Epictetus',
    work: 'Discourses',
    translation: 'George Long',
    dir: WORK_DIRS.discourses,
    files: (names) => names.filter((n) => /^book-\d+\.xhtml$/.test(n)),
    sectionFor: (file) => `Book ${Number(basename(file, '.xhtml').replace('book-', ''))}`,
    bookFor: (file) => basename(file, '.xhtml').replace('book-', ''),
    idFor: ({ book, paragraphIndex, sentenceIndex }) =>
      `discourses-${book}-${paragraphIndex}-${sentenceIndex}`,
  },
];

const SKIP_PARAGRAPH_TYPES = new Set(['title', 'subtitle', 'bridgehead']);

// ---------------------------------------------------------------------------
// Text cleaning
// ---------------------------------------------------------------------------

function cleanParagraph(p) {
  // Strip footnote references and superscripts before reading the text.
  for (const a of p.querySelectorAll('a')) {
    if (a.getAttribute('epub:type') === 'noteref') a.remove();
  }
  for (const sup of p.querySelectorAll('sup')) sup.remove();

  let text = p.textContent;
  text = text.replace(/\u00A0/g, ' ');
  text = text.replace(ZERO_WIDTH, '');
  // Drop bracketed editorial insertions such as "[as I would choose]".
  text = text.replace(/\[[^\]]*\]/g, ' ');
  // Collapse all whitespace.
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function protectAbbreviations(text) {
  let out = text;
  const ordered = [...ABBREVIATIONS].sort((a, b) => b.length - a.length);
  for (const abbr of ordered) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}`, 'gi');
    out = out.replace(re, (match) => match.replace(/\./g, DOT_PLACEHOLDER));
  }
  // Initials: "C. Marcius", "D. E." etc.
  out = out.replace(/\b([A-Z])\.(?=\s+[A-Z])/g, `$1${DOT_PLACEHOLDER}`);
  // Decimal points.
  out = out.replace(/(\d)\.(\d)/g, `$1${DOT_PLACEHOLDER}$2`);
  return out;
}

function splitSentences(text) {
  const protectedText = protectAbbreviations(text);
  const matches = protectedText.match(/[^.!?…]+[.!?…]+[)”’"'\]]*|[^.!?…]+$/g) || [];
  return matches
    .map((s) => s.replace(/\uE000/g, '.').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0);
}

function hasTerminalPunctuation(text) {
  return /[.!?]$/.test(text.replace(NON_TERMINAL_TAIL, ''));
}

function normalizeForDedup(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// ---------------------------------------------------------------------------
// Tagging
// ---------------------------------------------------------------------------

function tagsFor(text) {
  const lower = text.toLowerCase();
  const scored = [];
  for (let i = 0; i < TAG_VOCABULARY.length; i += 1) {
    const tag = TAG_VOCABULARY[i];
    let count = 0;
    for (const stem of TAG_KEYWORDS[tag]) {
      const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = lower.match(new RegExp(`\\b${escaped}`, 'g'));
      if (matches) count += matches.length;
    }
    if (count > 0) scored.push({ tag, count, order: i });
  }
  if (scored.length === 0) return ['stoicism'];
  scored.sort((a, b) => b.count - a.count || a.order - b.order);
  return scored.slice(0, 3).map((s) => s.tag);
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

function readDirNames(dir) {
  return readdirSync(dir);
}

function gitHead(dir) {
  return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function extractWork(work) {
  const dir = resolve(API_DIR, work.dir);
  const textDir = resolve(dir, 'src', 'epub', 'text');
  const names = readDirNames(textDir).filter((n) => n.endsWith('.xhtml'));
  const files = work.files(names).sort();
  const quotes = [];

  for (const file of files) {
    const raw = readFileSync(resolve(textDir, file), 'utf8');
    const root = parse(raw);

    let section = work.sectionFor ? work.sectionFor(file) : null;
    if (work.sectionFromTitle) {
      const titleNode = root.querySelector('h2[epub\\:type="title"]');
      section = titleNode ? titleNode.textContent.replace(/\s+/g, ' ').trim() : null;
    }

    const paragraphs = root.querySelectorAll('p');
    paragraphs.forEach((p, idx) => {
      const paragraphIndex = idx + 1;
      const pType = p.getAttribute('epub:type');
      if (pType && SKIP_PARAGRAPH_TYPES.has(pType)) return;
      // Verse quotations embedded from other authors are not the author's words.
      let inBlockquote = false;
      for (let parent = p.parentNode; parent; parent = parent.parentNode) {
        if (parent.tagName === 'BLOCKQUOTE') {
          inBlockquote = true;
          break;
        }
      }
      if (inBlockquote) return;

      const cleaned = cleanParagraph(p);
      if (!cleaned) return;

      const sentences = splitSentences(cleaned);
      sentences.forEach((sentence, sIdx) => {
        const sentenceIndex = sIdx + 1;
        if (sentence.length < MIN_LENGTH || sentence.length > MAX_LENGTH) return;
        if (!hasTerminalPunctuation(sentence)) return;
        if (!/[a-z]/.test(sentence)) return;
        quotes.push({
          id: work.idFor({
            book: work.bookFor ? work.bookFor(file) : null,
            paragraphIndex,
            sentenceIndex,
          }),
          text: sentence,
          section,
        });
      });
    });
  }

  return quotes;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(quotes) {
  const errors = [];
  const seenIds = new Set();
  const seenText = new Set();

  for (const q of quotes) {
    if (seenIds.has(q.id)) errors.push(`duplicate id: ${q.id}`);
    seenIds.add(q.id);

    if (q.text.length < MIN_LENGTH || q.text.length > MAX_LENGTH) {
      errors.push(`length ${q.text.length} out of bounds for ${q.id}`);
    }
    for (const tag of q.tags) {
      if (!TAG_VOCABULARY.includes(tag)) errors.push(`unknown tag "${tag}" for ${q.id}`);
    }
  }

  return errors;
}

function dedupe(quotes) {
  const seen = new Set();
  const out = [];
  for (const q of quotes) {
    const key = normalizeForDedup(q.text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const allQuotes = [];
  const sources = {};

  for (const work of WORKS) {
    const dir = resolve(API_DIR, work.dir);
    sources[work.dir] = gitHead(dir);
    allQuotes.push(
      ...extractWork(work).map((q) => ({
        id: q.id,
        text: q.text,
        author: work.author,
        work: work.work,
        workSlug: work.slug,
        section: q.section,
        translation: work.translation,
        tags: tagsFor(q.text),
      })),
    );
  }

  const deduped = dedupe(allQuotes);
  deduped.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const counts = {};
  for (const work of WORKS) {
    counts[work.slug] = deduped.filter((q) => q.workSlug === work.slug).length;
  }

  const errors = validate(deduped);
  if (errors.length > 0) {
    console.error('Validation failed:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const payload = {
    minLength: MIN_LENGTH,
    maxLength: MAX_LENGTH,
    sources,
    counts,
    quotes: deduped,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  // ---- summary ----
  console.log(`Wrote ${OUTPUT_FILE}`);
  console.log(`Total quotes: ${deduped.length}`);
  console.log('Per work:');
  for (const [slug, n] of Object.entries(counts)) console.log(`  ${slug}: ${n}`);

  const tagCounts = new Map();
  for (const q of deduped) {
    for (const tag of q.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  console.log('Tag distribution:');
  for (const [tag, n] of [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`  ${tag}: ${n}`);
  }

  console.log('Random samples:');
  for (let i = 0; i < 20 && i < deduped.length; i += 1) {
    const q = deduped[Math.floor(Math.random() * deduped.length)];
    console.log(`  [${q.id}] ${q.text.slice(0, 140)}${q.text.length > 140 ? '…' : ''}`);
  }
}

main();
