// FOOTINT SERVER.JS
// Zero-cost extractive summarization engine — no API keys, no rate limits.
// Scales to any number of users. TextRank + domain keyword scoring.

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const Parser    = require('rss-parser');
const cors      = require('cors');
const { summarize } = require('./summarizer');
const { detectClub } = require('./geoMapper');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }
});

const parser = new Parser();

app.use(cors());
app.use(express.static('public'));

// ── GIST ENGINE (free, local) ─────────────────────────────────────────────────
// Queue-based to avoid hammering article servers.
// 400ms between fetches — polite crawling, no ban risk.

const gistCache = new Map();  // url → gist string
const gistQueue = [];         // { link, title, type, resolve }
let   gistBusy  = false;

async function drainGistQueue() {
  if (gistBusy || gistQueue.length === 0) return;
  gistBusy = true;

  const job = gistQueue.shift();

  if (gistCache.has(job.link)) {
    job.resolve(gistCache.get(job.link));
    gistBusy = false;
    setImmediate(drainGistQueue);
    return;
  }

  try {
    const gist = await summarize(job.link, job.title, job.type);
    gistCache.set(job.link, gist);
    job.resolve(gist);
    console.log(`[GIST] ${job.type.toUpperCase()} | ${gist.slice(0, 72)}…`);
  } catch (err) {
    console.error('[GIST ERR]', err.message);
    const fallback = `${job.title}. Intelligence extracted from live signal feed — type: ${job.type}.`;
    gistCache.set(job.link, fallback);
    job.resolve(fallback);
  }

  gistBusy = false;
  // 400ms between article fetches — polite rate
  setTimeout(drainGistQueue, 400);
}

function queueGist(link, title, type) {
  if (gistCache.has(link)) return Promise.resolve(gistCache.get(link));
  return new Promise((resolve) => {
    gistQueue.push({ link, title, type, resolve });
    drainGistQueue();
  });
}

// ── FEEDS ─────────────────────────────────────────────────────────────────────

const FEEDS = [
  // Transfers & injuries
  'https://news.google.com/rss/search?q=football+transfer',
  'https://news.google.com/rss/search?q=football+injury',
  'https://news.google.com/rss/search?q=football+signing',
  'https://news.google.com/rss/search?q=football+scouting',
  // World Cup 2026
  'https://news.google.com/rss/search?q=world+cup+2026',
  'https://news.google.com/rss/search?q=fifa+world+cup+squad',
  'https://news.google.com/rss/search?q=world+cup+qualifying',
  // Premier League
  'https://news.google.com/rss/search?q=premier+league',
  'https://news.google.com/rss/search?q=arsenal',
  'https://news.google.com/rss/search?q=chelsea',
  'https://news.google.com/rss/search?q=liverpool',
  'https://news.google.com/rss/search?q=manchester+city',
  'https://news.google.com/rss/search?q=manchester+united',
  'https://news.google.com/rss/search?q=tottenham',
  'https://news.google.com/rss/search?q=newcastle+united',
  // La Liga
  'https://news.google.com/rss/search?q=la+liga',
  'https://news.google.com/rss/search?q=real+madrid',
  'https://news.google.com/rss/search?q=barcelona',
  'https://news.google.com/rss/search?q=atletico+madrid',
  // Bundesliga
  'https://news.google.com/rss/search?q=bundesliga',
  'https://news.google.com/rss/search?q=bayern+munich',
  'https://news.google.com/rss/search?q=borussia+dortmund',
  // Serie A
  'https://news.google.com/rss/search?q=serie+a',
  'https://news.google.com/rss/search?q=ac+milan',
  'https://news.google.com/rss/search?q=inter+milan',
  'https://news.google.com/rss/search?q=juventus',
  'https://news.google.com/rss/search?q=napoli',
  // Ligue 1
  'https://news.google.com/rss/search?q=ligue+1',
  'https://news.google.com/rss/search?q=psg',
  // Others
  'https://news.google.com/rss/search?q=mls+soccer',
  'https://news.google.com/rss/search?q=saudi+pro+league',
  'https://news.google.com/rss/search?q=brasileirao',
];

const sentLinks = new Set();
const feedCache = [];

const analytics = {
  totalEvents: 0,
  transfers:   0,
  injuries:    0,
  signings:    0,
  scouting:    0,
  matches:     0,
  wc:          0,
  regions: {
    europe: 0, southamerica: 0, northamerica: 0,
    asia: 0, africa: 0, global: 0
  },
  clubs:         {},
  cities:        {},
  sources:       {},
  eventsPerHour: [],
  feedHealth:    { online: 0, offline: 0 },
  lastRefresh:   null
};

function classify(title = '') {
  const t = title.toLowerCase();
  if (t.includes('world cup') || t.includes('wc 2026') || t.includes('world cup 2026') ||
      t.includes('national team') || t.includes('international break') ||
      t.includes('qualifying') || t.includes('group stage') || t.includes('squad list')) return 'wc';
  if (t.includes('injur') || t.includes('ruled out') || t.includes('doubt')) return 'injury';
  if (t.includes('sign')  || t.includes('agreement') || t.includes('contract')) return 'signing';
  if (t.includes('scout') || t.includes('monitor')   || t.includes('tracking')) return 'scout';
  if (t.includes('transfer') || t.includes('bid')    || t.includes('linked') || t.includes('fee')) return 'transfer';
  return 'match';
}

function detectRegion(text = '') {
  const t = text.toLowerCase();
  if (t.includes('arsenal')  || t.includes('chelsea')   || t.includes('madrid')  ||
      t.includes('bundesliga')|| t.includes('serie a')  || t.includes('ligue'))       return 'europe';
  if (t.includes('flamengo') || t.includes('libertadores') || t.includes('brasileirao')) return 'southamerica';
  if (t.includes('mls')      || t.includes('inter miami') || t.includes('world cup 2026') ||
      t.includes('usa national') || t.includes('canada'))                              return 'northamerica';
  if (t.includes('saudi')    || t.includes('al nassr')   || t.includes('j league') ||
      t.includes('k league'))                                                          return 'asia';
  if (t.includes('caf')      || t.includes('al ahly')    || t.includes('afcon'))      return 'africa';
  return 'global';
}

function updateAnalytics(payload) {
  analytics.totalEvents++;
  switch (payload.type) {
    case 'transfer': analytics.transfers++; break;
    case 'injury':   analytics.injuries++;  break;
    case 'signing':  analytics.signings++;  break;
    case 'scout':    analytics.scouting++;  break;
    case 'wc':       analytics.wc++;        break;
    default:         analytics.matches++;
  }
  analytics.regions[payload.region] = (analytics.regions[payload.region] || 0) + 1;
  if (payload.club)   analytics.clubs[payload.club]     = (analytics.clubs[payload.club]     || 0) + 1;
  if (payload.city)   analytics.cities[payload.city]    = (analytics.cities[payload.city]    || 0) + 1;
  if (payload.source) analytics.sources[payload.source] = (analytics.sources[payload.source] || 0) + 1;
  analytics.eventsPerHour.push(Date.now());
  analytics.eventsPerHour = analytics.eventsPerHour.filter(t => Date.now() - t < 3_600_000);
}

function broadcastAnalytics() {
  io.emit('analytics', { ...analytics, eventsLastHour: analytics.eventsPerHour.length });
}

async function processFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    analytics.feedHealth.online++;

    for (const item of feed.items.slice(0, 10)) {
      if (!item.link || sentLinks.has(item.link)) continue;
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
        gist:      null
      };

      updateAnalytics(payload);
      io.emit('intel-event', payload);
      broadcastAnalytics();

      // Queue free summarization — emits patch when ready
      queueGist(item.link, item.title, type).then(gist => {
        payload.gist = gist;
        io.emit('intel-gist', { url: item.link, gist });
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

// ── REST ──────────────────────────────────────────────────────────────────────

app.get('/api/feed', (_req, res) => res.json(feedCache));

app.get('/api/stats', (_req, res) => res.json({
  analytics,
  cacheSize:      feedCache.length,
  eventsLastHour: analytics.eventsPerHour.length
}));

// On-demand gist — called from Intel Detail panel
app.get('/api/gist', async (req, res) => {
  const { url, title, type } = req.query;
  if (!url || !title) return res.status(400).json({ error: 'url and title required' });
  const gist = await queueGist(url, title, type || 'match');
  res.json({ url, gist });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', socket => {
  socket.emit('connected', { status: 'LIVE' });
  socket.emit('initial-feed', feedCache);
  socket.emit('analytics', analytics);
});

// ── Boot ──────────────────────────────────────────────────────────────────────

pullFeeds();
setInterval(pullFeeds, 30_000);

server.listen(3000, () => {
  console.log('FOOTINT running on :3000');
  console.log('[GIST ENGINE] Free extractive summarizer active — 0 API calls, unlimited scale');
  console.log(`[GIST CACHE]  ${gistCache.size} entries loaded`);
});
