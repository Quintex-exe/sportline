# Project Structure

```
sportline/
│
├── server.js                    # Node.js Express + Socket.IO server (primary)
├── geoMapper.js                 # Club name → lat/lng resolver using clubs.json
├── summarizer.js                # RSS feed summarizer / event formatter
├── valueTracker.js              # Player market value tracking logic
├── valueTrackerIntegration.js   # Connects valueTracker to live API endpoints
│
├── clubs.json                   # Club/league → city + coordinates database
├── feeds.example.json           # Sample RSS feed list (copy to feeds.json)
│
├── backend/                     # Python Flask server (alternative runtime)
│   └── ...
│
├── public/                      # Static frontend assets
│   └── ...                      # index.html, CSS, JS, globe assets
│
├── package.json                 # Node.js dependencies
├── requirements.txt             # Python dependencies (Flask runtime)
│
├── .env.example                 # Environment variable template — copy to .env
├── .gitignore
├── LICENSE
├── README.md
└── SECURITY.md
```

## Quick Start

### Node.js (recommended)
```bash
git clone https://github.com/Quintex-exe/sportline.git
cd sportline
cp .env.example .env          # fill in your API keys
cp feeds.example.json feeds.json
npm install
npm start
```

### Python / Flask (alternative)
```bash
pip install -r requirements.txt
cp .env.example .env
python backend/app.py
```

> **Note:** Run either Node OR Flask — not both. Both implement WebSocket servers independently.
