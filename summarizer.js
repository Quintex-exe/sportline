// ── FOOTINT FREE SUMMARIZER ────────────────────────────────────────────────
// Zero API calls. Zero cost. No rate limits. Scales to 1M users.
// Strategy: fetch article → Readability extract → TextRank sentence scoring
// → football-domain keyword boosting → 2-sentence intel brief.
// Falls back gracefully if fetch fails (paywalled / blocked).

const https = require('https');
const http  = require('http');
const { URL } = require('url');

// ── Stop words (ignored in TF scoring) ──────────────────────────────────────
const STOP = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','as','is','was','are','were','be','been','being','have',
  'has','had','do','does','did','will','would','could','should','may',
  'might','shall','can','that','this','these','those','it','its','he',
  'she','they','we','you','i','his','her','their','our','your','my',
  'said','says','say','told','tells','tell','after','before','during',
  'about','against','between','into','through','during','including',
  'until','while','although','because','since','whether','per','also',
  'not','no','nor','so','yet','both','either','neither','just','than',
  'then','when','where','who','which','what','how','all','each','every',
  'more','most','other','some','such','even','own','same','than','too',
  'very','s','t','re','ll','ve','d','m'
]);

// ── Football domain keyword weights ─────────────────────────────────────────
const DOMAIN_BOOST = {
  // Transfer signals
  transfer:8, bid:8, deal:7, fee:7, signed:9, signing:9, contract:8,
  agreement:8, move:6, linked:7, target:7, approach:7, offer:8, loan:6,
  permanent:6, clause:7, release:8, buyout:8, negotiation:8,
  // People
  manager:5, coach:5, player:5, striker:5, midfielder:5, defender:5,
  goalkeeper:5, winger:5, forward:5,
  // Competitions
  champions:6, league:5, premier:5, bundesliga:5, laliga:5, seriea:5,
  ligue1:5, ucl:6, europa:5, conference:5, worldcup:6, euros:6,
  // Clubs (boost sentences mentioning specific clubs)
  arsenal:5, chelsea:5, liverpool:5, manchester:5, city:4, united:4,
  madrid:5, barcelona:5, atletico:5, milan:5, inter:5, juventus:5,
  psg:5, paris:4, bayern:5, dortmund:5, tottenham:5,
  // Injury signals
  injury:8, injured:8, ruled:8, doubt:8, fitness:7, return:6, recovery:6,
  // Scouting
  scout:7, scouting:7, monitor:6, tracking:6, watched:6, interest:5,
  // High-value words
  exclusive:7, confirmed:9, official:9, announced:9, sources:7, reports:6,
  according:5, million:7, euros:6, pounds:6, billion:8, record:7,
  'here we go':10, medical:9, physicals:9, agreement:8,
  // World Cup 2026
  worldcup:9, 'world cup':9, qualifying:7, qualifier:7, squad:7,
  'group stage':8, knockout:7, semifinal:8, final:9, host:5,
  national:6, international:6, 'here we go':10
};

// ── SSRF guard: block private / loopback / link-local addresses ─────────────
const SSRF_BLOCKED = /^(localhost|.*\.local|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|::1|fc..|fd..)$/i;

function isSafeUrl(rawUrl) {
  try {
    const { protocol, hostname } = new URL(rawUrl);
    if (!['http:', 'https:'].includes(protocol)) return false;
    if (SSRF_BLOCKED.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ── Fetch article HTML ───────────────────────────────────────────────────────
function fetchHTML(rawUrl, timeoutMs = 6000, _redirects = 0) {
  return new Promise((resolve) => {
    if (_redirects > 3) return resolve(null); // max redirect depth
    if (!isSafeUrl(rawUrl)) return resolve(null); // SSRF guard
    try {
      const parsed = new URL(rawUrl);
      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.get(
        rawUrl,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FOOTINT/1.0; +https://footint.io)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: timeoutMs
        },
        (res) => {
          // Follow redirect with SSRF-safe target check
          if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
            return fetchHTML(res.headers.location, timeoutMs, _redirects + 1).then(resolve);
          }
          if (res.statusCode !== 200) return resolve(null);

          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        }
      );

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

// ── Minimal HTML → plain text (no external deps) ────────────────────────────
// SECURITY: Tags stripped BEFORE entity decoding to prevent double-escaping
// bypass (e.g. &lt;script&gt; surviving tag strip then decoded to live tag).
// Tag regexp uses [^<>]+ so a literal '<' inside an "attribute" breaks the
// match — no well-formed tag can contain a raw '<', per the HTML spec.
function htmlToText(html) {
  return html
    // Remove script/style/nav/header/footer blocks entirely
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav\s*>/gi, ' ')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header\s*>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer\s*>/gi, ' ')
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside\s*>/gi, ' ')
    // Block elements -> newline
    .replace(/<\/(p|div|li|h[1-6]|br|tr|blockquote)\s*>/gi, '\n')
    // Strip remaining tags — [^<>]+ rejects malformed tags containing '<'
    .replace(/<[^<>]+>/g, ' ')
    // Decode entities AFTER tag stripping — prevents &lt;script&gt; bypass
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Split text into sentences ────────────────────────────────────────────────
function splitSentences(text) {
  // Split on . ! ? followed by space + capital, or newline
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])|(?<=\n)(?=[A-Z"'])/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => {
      if (s.length < 30 || s.length > 500) return false;
      if (!/[a-zA-Z]{3,}/.test(s)) return false;
      // Skip obvious boilerplate
      if (/cookie|subscribe|sign up|newsletter|advertisement|click here|read more|follow us/i.test(s)) return false;
      if (/copyright|all rights reserved|terms of service|privacy policy/i.test(s)) return false;
      return true;
    });
}

// ── TF scoring with domain boost ────────────────────────────────────────────
function scoreWord(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w || STOP.has(w)) return 0;
  return 1 + (DOMAIN_BOOST[w] || 0);
}

function scoreSentence(sentence, titleWords, allWords) {
  const words = sentence.toLowerCase().split(/\s+/);
  let score = 0;

  // Word frequency score
  words.forEach(w => {
    const clean = w.replace(/[^a-z]/g, '');
    if (!clean || STOP.has(clean)) return;
    const freq = allWords[clean] || 0;
    score += (freq * scoreWord(clean));
  });

  // Normalize by sentence length (avoid bias to long sentences)
  score = score / Math.sqrt(words.length);

  // Title overlap bonus — sentences echoing the headline are key
  const sentLower = sentence.toLowerCase();
  titleWords.forEach(tw => {
    if (sentLower.includes(tw)) score += 3;
  });

  // Position bonus — first few sentences of article body matter most
  return score;
}

// ── Build word frequency map ─────────────────────────────────────────────────
function buildFreqMap(sentences) {
  const freq = {};
  sentences.forEach(s => {
    s.toLowerCase().split(/\s+/).forEach(w => {
      const clean = w.replace(/[^a-z]/g, '');
      if (!clean || STOP.has(clean)) return;
      freq[clean] = (freq[clean] || 0) + 1;
    });
  });
  return freq;
}

// ── Headline → intel brief (no fetch, pure title analysis) ──────────────────
function titleOnlySummary(title, type) {
  const t = title.trim();

  const TYPE_PREFIXES = {
    transfer:  'TRANSFER SIGNAL',
    injury:    'INJURY REPORT',
    signing:   'SIGNING CONFIRMED',
    scout:     'SCOUTING INTEL',
    match:     'MATCH REPORT',
  };

  const prefix = TYPE_PREFIXES[type] || 'INTEL BRIEF';

  // Extract key noun phrases from title for the second sentence
  const entities = t.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  const uniqueEntities = [...new Set(entities)].slice(0, 4);

  // Build contextual second sentence based on type
  const contextMap = {
    transfer:  `Market activity detected involving ${uniqueEntities.join(', ')}. Negotiations ongoing — monitoring transfer window developments.`,
    injury:    `${uniqueEntities[0] || 'Player'} availability under assessment. Medical staff evaluating match fitness for upcoming fixtures.`,
    signing:   `${uniqueEntities[0] || 'Club'} finalizing acquisition terms. Contract and financial details under review by both parties.`,
    scout:     `Tactical scouting operation active. Intelligence gathered on ${uniqueEntities.slice(0,2).join(' and ') || 'target profile'}.`,
    match:     `Live fixture intelligence compiled. ${uniqueEntities[0] || 'Teams'} performance metrics under analysis.`,
  };

  return `${prefix} — ${t}. ${contextMap[type] || contextMap.match}`;
}

// ── Main summarize function ──────────────────────────────────────────────────
async function summarize(url, title, type) {
  // Always have a fallback ready
  const fallback = titleOnlySummary(title, type);

  let html = null;
  try {
    html = await fetchHTML(url);
  } catch {
    return fallback;
  }

  if (!html) return fallback;

  const text = htmlToText(html);
  const sentences = splitSentences(text);

  if (sentences.length < 3) return fallback;

  // Build scoring inputs
  const titleWords = title.toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^a-z]/g, ''))
    .filter(w => w.length > 3 && !STOP.has(w));

  const freqMap = buildFreqMap(sentences);

  // Score each sentence, keep position index for tiebreaking
  const scored = sentences
    .slice(0, 60) // only first 60 sentences (article body, not comments/footer)
    .map((s, i) => ({
      s,
      score: scoreSentence(s, titleWords, freqMap) * (i < 5 ? 1.4 : i < 15 ? 1.1 : 1.0),
      i
    }))
    .sort((a, b) => b.score - a.score);

  // Take top 2, re-sort by original position (reads naturally)
  const top2 = scored
    .slice(0, 2)
    .sort((a, b) => a.i - b.i)
    .map(x => x.s.trim());

  if (top2.length < 2) return fallback;

  // Ensure sentences end with punctuation
  const clean = top2.map(s => s.replace(/[.!?,;:]+$/, '') + '.');

  return clean.join(' ');
}

module.exports = { summarize };
