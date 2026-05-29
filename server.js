const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Parser = require('rss-parser');
const cors = require('cors');
const { detectClub } = require('./geoMapper');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const parser = new Parser();

app.use(cors());
app.use(express.static('public'));

// =========================
// FOOTINT GLOBAL FEEDS
// =========================

const FEEDS = [

  // Global
  'https://news.google.com/rss/search?q=football+transfer',
  'https://news.google.com/rss/search?q=champions+league',
  'https://news.google.com/rss/search?q=premier+league',
  'https://news.google.com/rss/search?q=football+injury',
  'https://news.google.com/rss/search?q=football+scouting',

  // England
  'https://news.google.com/rss/search?q=arsenal',
  'https://news.google.com/rss/search?q=chelsea',
  'https://news.google.com/rss/search?q=liverpool',
  'https://news.google.com/rss/search?q=manchester+city',
  'https://news.google.com/rss/search?q=manchester+united',
  'https://news.google.com/rss/search?q=tottenham',

  // Spain
  'https://news.google.com/rss/search?q=real+madrid',
  'https://news.google.com/rss/search?q=barcelona',
  'https://news.google.com/rss/search?q=atletico+madrid',
  'https://news.google.com/rss/search?q=la+liga',

  // Germany
  'https://news.google.com/rss/search?q=bayern+munich',
  'https://news.google.com/rss/search?q=borussia+dortmund',
  'https://news.google.com/rss/search?q=bundesliga',

  // Italy
  'https://news.google.com/rss/search?q=serie+a',
  'https://news.google.com/rss/search?q=ac+milan',
  'https://news.google.com/rss/search?q=inter+milan',
  'https://news.google.com/rss/search?q=juventus',

  // France
  'https://news.google.com/rss/search?q=psg',
  'https://news.google.com/rss/search?q=ligue+1',

  // South America
  'https://news.google.com/rss/search?q=libertadores',
  'https://news.google.com/rss/search?q=flamengo',
  'https://news.google.com/rss/search?q=palmeiras',
  'https://news.google.com/rss/search?q=boca+juniors',
  'https://news.google.com/rss/search?q=river+plate',

  // North America
  'https://news.google.com/rss/search?q=mls',
  'https://news.google.com/rss/search?q=inter+miami',
  'https://news.google.com/rss/search?q=lafc',
  'https://news.google.com/rss/search?q=concacaf',

  // Asia / Middle East
  'https://news.google.com/rss/search?q=saudi+pro+league',
  'https://news.google.com/rss/search?q=al+nassr',
  'https://news.google.com/rss/search?q=al+hilal',
  'https://news.google.com/rss/search?q=afc+champions+league',
  'https://news.google.com/rss/search?q=j+league',

  // Africa
  'https://news.google.com/rss/search?q=caf+champions+league',
  'https://news.google.com/rss/search?q=al+ahly',
  'https://news.google.com/rss/search?q=african+football'

];

const sent = new Set();
const feedCache = [];

function classify(title = '') {

  const t = title.toLowerCase();

  if (
    t.includes('injur') ||
    t.includes('ruled out') ||
    t.includes('doubt')
  ) return 'injury';

  if (
    t.includes('sign') ||
    t.includes('agreement') ||
    t.includes('contract')
  ) return 'signing';

  if (
    t.includes('scout') ||
    t.includes('monitor') ||
    t.includes('tracking')
  ) return 'scout';

  if (
    t.includes('transfer') ||
    t.includes('bid') ||
    t.includes('linked') ||
    t.includes('fee')
  ) return 'transfer';

  return 'match';
}

function detectRegion(text = '') {

  const t = text.toLowerCase();

  if (
    t.includes('arsenal') ||
    t.includes('chelsea') ||
    t.includes('liverpool') ||
    t.includes('madrid') ||
    t.includes('barcelona') ||
    t.includes('psg') ||
    t.includes('bayern') ||
    t.includes('uefa')
  ) return 'europe';

  if (
    t.includes('flamengo') ||
    t.includes('palmeiras') ||
    t.includes('libertadores') ||
    t.includes('river plate') ||
    t.includes('boca')
  ) return 'southamerica';

  if (
    t.includes('mls') ||
    t.includes('inter miami') ||
    t.includes('lafc') ||
    t.includes('concacaf')
  ) return 'northamerica';

  if (
    t.includes('saudi') ||
    t.includes('al nassr') ||
    t.includes('al hilal') ||
    t.includes('afc')
  ) return 'asia';

  if (
    t.includes('caf') ||
    t.includes('africa') ||
    t.includes('al ahly')
  ) return 'africa';

  return 'global';
}

async function pullFeeds() {

  console.log('Refreshing feeds...');

  for (const url of FEEDS) {

    try {

      const feed = await parser.parseURL(url);

      for (const item of feed.items.slice(0, 8)) {

        if (!item.link) continue;

        if (sent.has(item.link)) continue;

        sent.add(item.link);

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
          link: item.link,
          timestamp: Date.now()
        };

        feedCache.push(payload);

        if (feedCache.length > 100) {
          feedCache.shift();
        }

        io.emit('intel-event', payload);

        console.log('NEW:', item.title);
      }

    } catch (err) {

      console.log('FAILED:', url);

    }
  }
}

io.on('connection', socket => {

  console.log('CLIENT CONNECTED');

  socket.emit('connected', {
    status: 'LIVE'
  });

  socket.emit('initial-feed', feedCache);

});

pullFeeds();

setInterval(pullFeeds, 30000);

server.listen(3000, () => {

  console.log('FOOTINT running at http://localhost:3000');

});
