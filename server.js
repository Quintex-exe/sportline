// FOOTINT FINALIZED SERVER.JS
// Data-driven analytics backend

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Parser = require('rss-parser');
const cors = require('cors');
const { detectClub } = require('./geoMapper');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const parser = new Parser();

app.use(cors());
app.use(express.static('public'));

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

function classify(title='') {
  const t = title.toLowerCase();

  if (t.includes('injur') || t.includes('ruled out') || t.includes('doubt')) return 'injury';
  if (t.includes('sign') || t.includes('agreement') || t.includes('contract')) return 'signing';
  if (t.includes('scout') || t.includes('monitor') || t.includes('tracking')) return 'scout';
  if (t.includes('transfer') || t.includes('bid') || t.includes('linked') || t.includes('fee')) return 'transfer';

  return 'match';
}

function detectRegion(text='') {
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

  switch(payload.type) {
    case 'transfer': analytics.transfers++; break;
    case 'injury': analytics.injuries++; break;
    case 'signing': analytics.signings++; break;
    case 'scout': analytics.scouting++; break;
    default: analytics.matches++;
  }

  analytics.regions[payload.region] =
    (analytics.regions[payload.region] || 0) + 1;

  if (payload.club)
    analytics.clubs[payload.club] =
      (analytics.clubs[payload.club] || 0) + 1;

  if (payload.city)
    analytics.cities[payload.city] =
      (analytics.cities[payload.city] || 0) + 1;

  if (payload.source)
    analytics.sources[payload.source] =
      (analytics.sources[payload.source] || 0) + 1;

  analytics.eventsPerHour.push(Date.now());

  analytics.eventsPerHour =
    analytics.eventsPerHour.filter(
      t => Date.now() - t < 3600000
    );
}

function broadcastAnalytics() {
  io.emit('analytics', {
    ...analytics,
    eventsLastHour: analytics.eventsPerHour.length
  });
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

      const payload = {
        title: item.title,
        body: item.title,
        source: feed.title || 'Feed',
        type: classify(item.title),
        club: clubData?.club || null,
        city: clubData?.city || null,
        lat: clubData?.lat || null,
        lng: clubData?.lng || null,
        region: clubData?.region || detectRegion(item.title),
        url: item.link,
        timestamp: Date.now()
      };

      updateAnalytics(payload);

      feedCache.push(payload);

      if (feedCache.length > 300)
        feedCache.shift();

      io.emit('intel-event', payload);
      broadcastAnalytics();
    }

  } catch {
    analytics.feedHealth.offline++;
  }
}

async function pullFeeds() {
  analytics.feedHealth.online = 0;
  analytics.feedHealth.offline = 0;

  await Promise.allSettled(
    FEEDS.map(processFeed)
  );

  analytics.lastRefresh = Date.now();

  broadcastAnalytics();
}

app.get('/api/feed', (req, res) => {
  res.json(feedCache);
});

app.get('/api/stats', (req, res) => {
  res.json({
    analytics,
    cacheSize: feedCache.length,
    eventsLastHour: analytics.eventsPerHour.length
  });
});

io.on('connection', socket => {
  socket.emit('connected', { status: 'LIVE' });
  socket.emit('initial-feed', feedCache);
  socket.emit('analytics', analytics);
});

pullFeeds();
setInterval(pullFeeds, 30000);

server.listen(3000, () => {
  console.log('FOOTINT running on port 3000');
});
