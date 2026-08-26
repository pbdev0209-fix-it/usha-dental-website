#!/usr/bin/env node
'use strict';
//
// Weekly blog post generator for the Dr. Usha Sribollineni dental site.
//
// What it does, in order:
//   1. Reads content/queue.json and picks the next topic that is due.
//   2. Asks Claude to draft the article, using content/voice-guide.md as the
//      system prompt so the style rules live in one editable place.
//   3. Runs the draft through a safety validator (no dosages, no prices,
//      no banned filler phrases, sane length).
//   4. Renders it through scripts/lib/template.js so it matches every other
//      article on the site exactly.
//   5. Writes blog/<slug>.html, marks the queue entry published, and
//      regenerates blog.html / sitemap.xml / the homepage cards.
//   6. Writes .agent/report.md, which the workflow pastes into the PR body.
//
// It never publishes on its own. The workflow opens a pull request and a
// human merges it. That gate is deliberate.
//
// Usage:
//   node scripts/generate-post.js              draft the next due topic
//   node scripts/generate-post.js --force      ignore the publishOn date
//   node scripts/generate-post.js --scaffold   build the shell with no API call
//   node scripts/generate-post.js --dry-run    print what it would do, write nothing
//
// Env:
//   ANTHROPIC_API_KEY   required unless --scaffold
//   BLOG_MODEL          optional model id override
//

const fs = require('fs');
const path = require('path');
const { article } = require('./lib/template');
const { rebuildIndexes } = require('./update-indexes');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'content', 'queue.json');
const VOICE_PATH = path.join(ROOT, 'content', 'voice-guide.md');
const BLOG_DIR = path.join(ROOT, 'blog');
const REPORT_DIR = path.join(ROOT, '.agent');

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.BLOG_MODEL || 'claude-sonnet-4-5';
const ARGS = process.argv.slice(2);
const SCAFFOLD = ARGS.includes('--scaffold');
const DRY_RUN = ARGS.includes('--dry-run');
const FORCE = ARGS.includes('--force');

// ---------------------------------------------------------------- helpers

// The practice is in Overland Park, so 'today' means today in Central time.
// Using UTC here would publish a day early for most of the evening.
function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function die(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

// ------------------------------------------------------------ queue logic

function pickNext(queueDoc) {
  const due = todayISO();
  const items = queueDoc.queue.filter(function (q) { return q.status === 'queued'; });
  if (!items.length) return null;
  if (FORCE) return items[0];
  const ready = items.filter(function (q) { return q.publishOn <= due; });
  return ready.length ? ready[0] : null;
}

// --------------------------------------------------------------- the ask

function buildSystem(voice) {
  return [
    'You are ghostwriting a blog article for Dr. Usha Sribollineni, DDS, a',
    'general dentist in Overland Park, Kansas. You are writing in her voice,',
    'as her. Follow the guide below exactly. It overrides your defaults.',
    '',
    '=== VOICE AND CONTENT GUIDE ===',
    voice,
    '=== END GUIDE ===',
    '',
    'OUTPUT FORMAT',
    'Return one JSON object and nothing else. No prose before or after, no',
    'markdown code fence. Keys:',
    '',
    '  desc       string, meta description, under 155 characters',
    '  lead       string, the opening paragraph, plain text, 2-3 sentences',
    '  takeaways  array of exactly 5 strings, each a complete sentence',
    '  body       string of HTML, 1200-1800 words of visible text',
    '  faq        array of exactly 5 arrays, each [question, answer]',
    '',
    'The body HTML may use only these tags: h2, h3, p, strong, em, ul, ol,',
    'li, table, thead, tbody, tr, th, td, a, and div with class "callout"',
    'or class "warn". Do not include an h1, the template adds it. Do not',
    'include a FAQ section in the body, it is added separately. Include at',
    'least one table or ordered list, and exactly one div class="warn"',
    'describing when the reader should stop and call someone.',
    '',
    'Internal links use relative paths like <a href="bleeding-gums.html">.',
    'Only link to slugs given to you in the brief.'
  ].join('\n');
}

function buildUser(topic, siblings) {
  return [
    'ARTICLE BRIEF',
    '',
    'Title: ' + topic.title,
    'Category: ' + topic.category,
    'Primary keyword: ' + topic.keyword,
    'Editorial angle: ' + topic.angle,
    '',
    'Existing articles you may link to (use the slug + .html):',
    siblings.map(function (s) { return '  ' + s; }).join('\n'),
    '',
    'Write the article now. Return only the JSON object.'
  ].join('\n');
}

// ------------------------------------------------------------- API access

async function callModel(model, system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 8000,
      system: system,
      messages: [{ role: 'user', content: user }]
    })
  });
  return { status: res.status, body: await res.text() };
}

// Model ids change over time. If the configured one is gone, ask the API
// what exists and pick the newest Sonnet rather than failing the week.
async function listModels() {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=50', {
    headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' }
  });
  if (!res.ok) return [];
  const j = JSON.parse(await res.text());
  return (j.data || []).map(function (m) { return m.id; });
}

async function draft(system, user) {
  let r = await callModel(MODEL, system, user);
  if (r.status === 404) {
    console.log('Model ' + MODEL + ' was not found. Looking up available models.');
    const ids = await listModels();
    const pick = ids.find(function (i) { return i.indexOf('sonnet') !== -1; }) || ids[0];
    if (!pick) die('The API did not return any usable models.');
    console.log('Falling back to ' + pick + '. Consider setting BLOG_MODEL to this.');
    r = await callModel(pick, system, user);
  }
  if (r.status === 401) die('The API rejected the key. Check the ANTHROPIC_API_KEY secret.');
  if (r.status === 429) die('Rate limited. Re-run the workflow manually in a few minutes.');
  if (r.status !== 200) die('API returned ' + r.status + ': ' + r.body.slice(0, 400));
  const parsed = JSON.parse(r.body);
  return (parsed.content || []).map(function (c) { return c.text || ''; }).join('');
}

function extractJSON(text) {
  let t = text.trim();
  // Strip a markdown fence if the model added one anyway.
  if (t.slice(0, 3) === '``' + '`') {
    t = t.replace(/^[`]{3}[a-z]*\s*/i, '').replace(/[`]{3}\s*$/, '').trim();
  }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) die('The model did not return JSON.');
  return JSON.parse(t.slice(start, end + 1));
}

// ------------------------------------------------------------- validation

const BANNED = [
  "in today's fast-paced world", 'when it comes to', 'it is important to note',
  'dive into', 'delve into', 'look no further', 'say goodbye to',
  'unlock the secret', 'best accessory', "we've got you covered",
  "let's face it", 'in conclusion', 'rest assured'
];

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function validate(d, siblings) {
  const issues = [];
  const text = [d.lead, stripTags(d.body), (d.takeaways || []).join(' '),
    (d.faq || []).map(function (f) { return f.join(' '); }).join(' ')].join(' ');
  const lower = text.toLowerCase();

  // Hard content rules from the voice guide.
  if (/\b\d+\s?mg\b/i.test(text)) issues.push('BLOCKER: looks like a medication dosage. The guide forbids publishing doses.');
  if (/\$\s?\d/.test(text)) issues.push('BLOCKER: contains a dollar figure. The guide forbids publishing prices.');
  if (/\b(guarantee|guaranteed|painless|completely safe)\b/i.test(text)) issues.push('WARN: contains an absolute promise. Soften to "usually" or "in most cases".');

  BANNED.forEach(function (p) {
    if (lower.indexOf(p) !== -1) issues.push('WARN: banned filler phrase: "' + p + '"');
  });

  // Structure.
  const words = stripTags(d.body).split(' ').length;
  if (words < 900) issues.push('WARN: body is only ' + words + ' words, target is 1200-1800.');
  if (words > 2600) issues.push('WARN: body is ' + words + ' words, longer than intended.');
  if (!Array.isArray(d.takeaways) || d.takeaways.length !== 5) issues.push('BLOCKER: takeaways must be exactly 5, got ' + ((d.takeaways || []).length) + '.');
  if (!Array.isArray(d.faq) || d.faq.length < 4) issues.push('BLOCKER: need at least 4 FAQ pairs, got ' + ((d.faq || []).length) + '.');
  if (d.body.indexOf('<h2') === -1) issues.push('BLOCKER: body has no h2 headings.');
  if (d.body.indexOf('<h1') !== -1) issues.push('BLOCKER: body contains an h1. The template supplies the h1.');
  if (d.body.indexOf('class="warn"') === -1) issues.push('WARN: no warn callout telling the reader when to seek help.');
  if (!d.desc || d.desc.length > 160) issues.push('WARN: meta description is missing or over 160 characters.');

  // Every internal link must resolve to a file that actually exists.
  const links = d.body.match(/href="([a-z0-9-]+)\.html"/g) || [];
  links.forEach(function (m) {
    const slug = m.replace('href="', '').replace('.html"', '');
    if (siblings.indexOf(slug) === -1) issues.push('BLOCKER: links to ' + slug + '.html, which does not exist.');
  });

  return issues;
}

// -------------------------------------------------------- scaffold mode

// Produces a real, valid page with the research framed but the prose left to
// a human. Used to test the pipeline before an API key exists, and as a
// fallback if the API is unreachable on a given week.
function scaffold(topic, siblings) {
  const links = siblings.slice(0, 3);
  return {
    desc: topic.title + ' - general dental education from Dr. Usha Sribollineni, DDS in Overland Park, Kansas.',
    lead: 'DRAFT PLACEHOLDER. This page was generated by the weekly agent in scaffold mode, so the structure is in place but the writing is not. Editorial angle for whoever finishes it: ' + topic.angle,
    takeaways: [
      'This article is an unfinished scaffold and should not be merged as-is.',
      'Primary keyword to work in naturally: ' + topic.keyword + '.',
      'Editorial angle: ' + topic.angle,
      'Replace all five of these takeaways with real one-sentence answers.',
      'Delete this notice before publishing.'
    ],
    body: [
      '<div class="warn"><strong>Unfinished draft.</strong> The weekly agent ran in scaffold mode, so this page has the correct structure but placeholder text. Do not merge until the prose is written and reviewed.</div>',
      '<h2>What the reader is actually worried about</h2>',
      '<p>Open by describing their situation back to them in two or three sentences. Angle: ' + topic.angle + '</p>',
      '<h2>Why this happens</h2>',
      '<p>Plain-language mechanism first, clinical term in parentheses after.</p>',
      '<h2>What you can do at home</h2>',
      '<ol><li>First step.</li><li>Second step.</li><li>Third step.</li></ol>',
      '<h2>When it needs a dentist</h2>',
      '<p>Be specific about the dividing line between wait and call.</p>',
      '<h2>Related reading</h2>',
      '<ul>' + links.map(function (s) { return '<li><a href="' + s + '.html">' + s.replace(/-/g, ' ') + '</a></li>'; }).join('') + '</ul>'
    ].join(''),
    faq: [
      ['Placeholder question one?', 'Placeholder answer.'],
      ['Placeholder question two?', 'Placeholder answer.'],
      ['Placeholder question three?', 'Placeholder answer.'],
      ['Placeholder question four?', 'Placeholder answer.'],
      ['Placeholder question five?', 'Placeholder answer.']
    ]
  };
}

// ------------------------------------------------------------------ main

async function main() {
  const queueDoc = readJSON(QUEUE_PATH);
  const voice = fs.readFileSync(VOICE_PATH, 'utf8');

  const topic = pickNext(queueDoc);
  if (!topic) {
    console.log('Nothing is due today (' + todayISO() + ') and nothing is overdue. Exiting cleanly.');
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, 'skip'), 'nothing-due');
    return;
  }
  console.log('Topic: ' + topic.title + '  (week ' + topic.week + ', slug ' + topic.slug + ')');

  const outPath = path.join(BLOG_DIR, topic.slug + '.html');
  if (fs.existsSync(outPath)) die('blog/' + topic.slug + '.html already exists. Fix the queue.');

  // Existing articles, used both for internal linking and link validation.
  const siblings = fs.readdirSync(BLOG_DIR)
    .filter(function (f) { return f.endsWith('.html'); })
    .map(function (f) { return f.replace('.html', ''); });

  let d, mode;
  if (SCAFFOLD) {
    mode = 'scaffold';
    d = scaffold(topic, siblings);
  } else {
    if (!API_KEY) die('ANTHROPIC_API_KEY is not set. Add it as a repository secret, or run with --scaffold.');
    mode = 'claude';
    d = extractJSON(await draft(buildSystem(voice), buildUser(topic, siblings)));
  }

  // Fields the model never gets to choose, so they can never drift.
  d.slug = topic.slug;
  d.title = topic.title;
  d.category = topic.category;
  d.date = topic.dateLabel;
  d.iso = topic.publishOn;
  d.img = topic.img;
  d.alt = topic.alt;
  d.keywords = topic.keyword + ', dentist Overland Park, Dr. Usha Sribollineni';
  d.related = siblings.filter(function (s) { return s !== topic.slug; }).slice(-3);

  const issues = SCAFFOLD ? ['NOTE: scaffold mode, prose is placeholder text.'] : validate(d, siblings);
  const blockers = issues.filter(function (i) { return i.indexOf('BLOCKER') === 0; });
  const html = article(d);

  if (DRY_RUN) {
    console.log('--dry-run, writing nothing. Would create blog/' + topic.slug + '.html (' + html.length + ' bytes).');
    console.log(issues.length ? issues.join('\n') : 'No validation issues.');
    return;
  }

  fs.writeFileSync(outPath, html);
  console.log('Wrote blog/' + topic.slug + '.html (' + html.length + ' bytes)');

  // Mark it done so next week moves on, even if this PR sits unmerged for a
  // while. If the PR is closed without merging, reset status to 'queued'.
  topic.status = 'published';
  topic.generatedAt = new Date().toISOString();
  topic.generatedBy = mode;
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queueDoc, null, 2) + '\n');

  rebuildIndexes();

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = [
    '## ' + topic.title,
    '',
    '| Field | Value |',
    '|---|---|',
    '| Slug | `blog/' + topic.slug + '.html` |',
    '| Category | ' + topic.category + ' |',
    '| Keyword | ' + topic.keyword + ' |',
    '| Queue week | ' + topic.week + ' of ' + queueDoc.queue.length + ' |',
    '| Written by | ' + mode + ' |',
    '| Words | ' + stripTags(d.body).split(' ').length + ' |',
    '',
    '### Automated checks',
    '',
    issues.length
      ? issues.map(function (i) { return '- ' + i; }).join('\n')
      : 'All checks passed: no dosages, no prices, no banned phrases, length in range, all internal links resolve.',
    '',
    blockers.length ? '**' + blockers.length + ' blocker(s) found. Do not merge until these are fixed.**' : '',
    '',
    '### Before you merge',
    '',
    '- [ ] Dr. Usha has read the article end to end',
    '- [ ] Nothing in it contradicts how she actually practises',
    '- [ ] The warn callout describes a genuine reason to seek care',
    '- [ ] No dosages, no prices',
    '',
    'Live URL once merged: https://pbdev0209-fix-it.github.io/usha-dental-website/blog/' + topic.slug + '.html'
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), report);
  fs.writeFileSync(path.join(REPORT_DIR, 'title'), topic.title);
  fs.writeFileSync(path.join(REPORT_DIR, 'slug'), topic.slug);

  console.log(issues.length ? issues.join('\n') : 'No validation issues.');
  if (blockers.length) console.log('NOTE: ' + blockers.length + ' blocker(s). The PR will be labelled needs-work.');
}

main().catch(function (e) { die(e && e.stack ? e.stack : String(e)); });
