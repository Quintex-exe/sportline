// FOOTINT FINALIZED SERVER.JS
// Data-driven analytics backend — with persistent server-side AI Gist engine

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Parser = require('rss-parser');
const cors = require('cors');
const https = require('https');
const { detectClub } = require('./geoMapper');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const parser = new Parser();

app.use(cors());
app.use(express.static('public'));

// ── ANTHROPIC GIST ENGINE ─────────────────────────────────────────────────────
// Persistent queue — every new article gets an AI gist generated server-side.
// Rate-limited to 1 req / 800ms so the queue drains continuously without throttle.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const gistCache = new Map();   // link → gist string
const gistQueue = [];          // { link, title, type, resolve }
let gistBusy = false;

async function anthropicRequest(title, type) {
  return new Promise((resolve) => {
    if (!ANTHROPIC_API_KEY) {
      return resolve('ANTHROPIC_API_KEY not set — add it to your environment.');
    }

    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 120,
      system: 'You are FOOTINT, a football intelligence terminal AI. Given a headline, write a punchy 2-sentence intel brief. No intro phrases. No markdown. Plain text only.',
      messages: [{ role: 'user', content: `Headline: "${title}"\nType: ${type}\nWrite the FOOTINT intel brief.` }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const text = data?.content?.[0]?.text?.trim() || '';
          resolve(text || 'SIGNAL ANALYSIS UNAVAILABLE.');
        } catch {
          resolve('PARSE ERROR — RAW SIGNAL UNREADABLE.');
        }
      });
    });

    req.on('error', () => resolve('UPLINK INTERRUPTED — INTELLIGENCE FEED OFFLINE.'));
    req.setTimeout(8000, () => { req.destroy(); resolve('REQUEST TIMED OUT — RETRYING ON NEXT CYCLE.'); });
    req.write(body);
    req.end();
  });
}

async function drainGistQueue() {
  if (gistBusy || gistQueue.length === 0) return;
  gistBusy = true;

  const job = gistQueue.shift();

  // Already cached (e.g. duplicate link queued before first resolved)
  if (gistCache.has(job.link)) {
    job.resolve(gistCache.get(job.link));
    gistBusy = false;
    setImmediate(drainGistQueue);
    return;
  }

  try {
    const gist = await anthropicRequest(job.title, job.type);
    gistCache.set(job.link, gist);
    job.resolve(gist);
    console.log(`[GIST OK] ${job.type.toUpperCase()} | ${gist.slice(0, 70)}…`);
  } catch (err) {
    console.error('[GIST ERR]', err.message);
    job.resolve('INTELLIGENCE GENERATION FAILED.');
  }

  gistBusy = false;
  // 800ms between API calls — continuous drain, never floods
  setTimeout(drainGistQueue, 800);
}

function queueGist(link, title, type) {
  // Return cached result immediately if already generated
  if (gistCache.has(link)) return Promise.resolve(gistCache.get(link));
  return new Promise((resolve) => {
    gistQueue.push({ link, title, type, resolve });
    drainGistQueue();
  });
}

// ─────────────────────────────────────────────────────────────────────────────

const FEEDS = [
  'https://news.google.com/rss/search?q=football+transfer',
  'https://news.google.com/rss/search?q=champions+league',
  'https://news.google.com/rss/search?q=premier+league',
  'https://news.google.com/rss/search?q=football+injury',
  'https://news.google.com/rss/search?q=football+scouting',
  'https://news.google.com/rss/search?q=arsenal',
  'https://news.google.com/rss/search?q=chelsea',
  'https://news.google.com/rss/search?q=liverpool',
  'https://news.google.com/rss/search?q=manchester+city',
  'https://news.google.com/rss/search?q=manchester+united',
  'https://news.google.com/rss/search?q=tottenham',
  'https://news.google.com/rss/search?q=real+madrid',
  'https://news.google.com/rss/search?q=barcelona',
  'https://news.google.com/rss/search?q=atletico+madrid',
  'https://news.google.com/rss/search?q=la+liga',
  'https://news.google.com/rss/search?q=bayern+munich',
  'https://news.google.com/rss/search?q=borussia+dortmund',
  'https://news.google.com/rss/search?q=bundesliga',
  'https://news.google.com/rss/search?q=serie+a',
  'https://news.google.com/rss/search?q=ac+milan',
  'https://news.google.com/rss/search?q=inter+milan',
  'https://news.google.com/rss/search?q=juventus',
  'https://news.google.com/rss/search?q=psg',
  'https://news.google.com/rss/search?q=ligue+1'
];

const sentLinks = new Set();
const feedCache = [];

const analytics = {
  totalEvents: 0,
  transfers: 0,
  injuries: 0,
  signings: 0,
  scouting: 0,
  matches: 0,
  regions: {
    europe: 0,
    southamerica: 0,
    northamerica: 0,
    asia: 0,
    africa: 0,
    global: 0
  },
  clubs: {},
  cities: {},
  sources: {},
  eventsPerHour: [],
  feedHealth: {
    online: 0,
    offline: 0
  },
  lastRefresh: null
};

function classify(title = '') {
  const t = title.toLowerCase();
  if (t.includes('injur') || t.includes('ruled out') || t.includes('doubt')) return 'injury';
  if (t.includes('sign') || t.includes('agreement') || t.includes('contract')) return 'signing';
  if (t.includes('scout') || t.includes('monitor') || t.includes('tracking')) return 'scout';
  if (t.includes('transfer') || t.includes('bid') || t.includes('linked') || t.includes('fee')) return 'transfer';
  return 'match';
}

function detectRegion(text = '') {
  const t = text.toLowerCase();
  if (t.includes('arsenal') || t.includes('chelsea') || t.includes('madrid')) return 'europe';
  if (t.includes('flamengo') || t.includes('libertadores')) return 'southamerica';
  if (t.includes('mls') || t.includes('inter miami')) return 'northamerica';
  if (t.includes('saudi') || t.includes('al nassr')) return 'asia';
  if (t.includes('caf') || t.includes('al ahly')) return 'africa';
  return 'global';
}

function updateAnalytics(payload) {
  analytics.totalEvents++;
  switch (payload.type) {
    case 'transfer': analytics.transfers++; break;
    case 'injury':   analytics.injuries++;  break;
    case 'signing':  analytics.signings++;  break;
    case 'scout':    analytics.scouting++;  break;
    default:         analytics.matches++;
  }
  analytics.regions[payload.region] = (analytics.regions[payload.region] || 0) + 1;
  if (payload.club)   analytics.clubs[payload.club]   = (analytics.clubs[payload.club]   || 0) + 1;
  if (payload.city)   analytics.cities[payload.city]  = (analytics.cities[payload.city]  || 0) + 1;
  if (payload.source) analytics.sources[payload.source] = (analytics.sources[payload.source] || 0) + 1;
  analytics.eventsPerHour.push(Date.now());
  analytics.eventsPerHour = analytics.eventsPerHour.filter(t => Date.now() - t < 3600000);
}

function broadcastAnalytics() {
  io.emit('analytics', { ...analytics, eventsLastHour: analytics.eventsPerHour.length });
}

async function processFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    analytics.feedHealth.online++;

    for (const item of feed.items.slice(0, 10)) {
      if (!item.link) continue;
      if (sentLinks.has(item.link)) continue;
      sentLinks.add(item.link);

      const clubData = detectClub(item.title);
      const type     = classify(item.title);

      const payload = {
        title:     item.title,
        body:      item.title,
        source:    feed.title || 'Feed',
        type,
        club:      clubData?.club   || null,
        city:      clubData?.city   || null,
        lat:       clubData?.lat    || null,
        lng:       clubData?.lng    || null,
        region:    clubData?.region || detectRegion(item.title),
        url:       item.link,
        timestamp: Date.now(),
        gist:      null   // populated below
      };

      updateAnalytics(payload);

      // Emit immediately so the feed item appears right away
      io.emit('intel-event', payload);
      broadcastAnalytics();

      // Queue gist — when ready, emit a patch event to all clients
      queueGist(item.link, item.title, type).then(gist => {
        payload.gist = gist;
        // Push gist update so the detail panel receives it live
        io.emit('intel-gist', { url: item.link, gist });
        console.log(`[GIST BROADCAST] ${item.link.slice(0, 50)}`);
      });

      feedCache.push(payload);
      if (feedCache.length > 300) feedCache.shift();
    }

  } catch {
    analytics.feedHealth.offline++;
  }
}

async function pullFeeds() {
  analytics.feedHealth.online  = 0;
  analytics.feedHealth.offline = 0;
  await Promise.allSettled(FEEDS.map(processFeed));
  analytics.lastRefresh = Date.now();
  broadcastAnalytics();
}

// ── REST endpoints ────────────────────────────────────────────────────────────

app.get('/api/feed', (req, res) => {
  res.json(feedCache);
});

app.get('/api/stats', (req, res) => {
  res.json({ analytics, cacheSize: feedCache.length, eventsLastHour: analytics.eventsPerHour.length });
});

// On-demand gist endpoint — for when the client opens the detail panel
// and the gist hasn't arrived via socket yet.
app.get('/api/gist', async (req, res) => {
  const { url, title, type } = req.query;
  if (!url || !title) return res.status(400).json({ error: 'url and title required' });

  const gist = await queueGist(url, title, type || 'match');
  res.json({ url, gist });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', socket => {
  socket.emit('connected', { status: 'LIVE' });
  // Send cache with any already-generated gists attached
  socket.emit('initial-feed', feedCache);
  socket.emit('analytics', analytics);
});

// ── Boot ──────────────────────────────────────────────────────────────────────

pullFeeds();
setInterval(pullFeeds, 30000);

server.listen(3000, () => {
  console.log('FOOTINT running on port 3000');
  if (!ANTHROPIC_API_KEY) {
    console.warn('[WARN] ANTHROPIC_API_KEY not set — gist generation disabled. Set it with: export ANTHROPIC_API_KEY=sk-...');
  } else {
    console.log('[GIST ENGINE] Active — queue draining at 800ms intervals');
  }
});
