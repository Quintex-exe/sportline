const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Parser = require('rss-parser');
const cors = require('cors');

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

const FEEDS = [
'https://news.google.com/rss/search?q=football+transfer',
'https://news.google.com/rss/search?q=champions+league',
'https://news.google.com/rss/search?q=premier+league'
];

const sent = new Set();

function classify(title){

  const t = title.toLowerCase();

  if(t.includes('transfer')) return 'transfer';
  if(t.includes('injury')) return 'injury';
  if(t.includes('sign')) return 'signing';

  return 'event';
}

async function pullFeeds(){

  console.log('Refreshing feeds...');

  for(const url of FEEDS){

    try{

      const feed = await parser.parseURL(url);

      for(const item of feed.items.slice(0,5)){

        if(sent.has(item.link)) continue;

        sent.add(item.link);

        io.emit('intel-event', {
          title:item.title,
          source:feed.title || 'Feed',
          type:classify(item.title),
          link:item.link
        });

        console.log('NEW:', item.title);

      }

    }catch(err){
      console.log('FAILED:', url);
    }

  }

}

io.on('connection', socket => {
  console.log('CLIENT CONNECTED');

  socket.emit('connected', {
    status:'LIVE'
  });
});

pullFeeds();
setInterval(pullFeeds, 30000);

server.listen(3000, ()=>{
  console.log('FOOTINT running at http://localhost:3000');
});
