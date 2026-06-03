from flask import Flask, jsonify, request
from flask_socketio import SocketIO
import feedparser
import threading
import time
import random

from redditEngine import fetch_reddit
from youtubeEngine import fetch_youtube

app = Flask(__name__)

socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)

feed_cache = []
seen_ids = set()

RSS_FEEDS = [
    "https://feeds.bbci.co.uk/sport/football/rss.xml",
    "https://www.espn.com/espn/rss/soccer/news",
    "https://www.goal.com/feeds/en/news"
]


def classify(title):

    title = title.lower()

    if "injury" in title:
        return "injury"

    if "transfer" in title:
        return "transfer"

    if "sign" in title:
        return "signing"

    if "scout" in title:
        return "scout"

    return "match"


def random_coordinates():

    return {
        "lat": round(random.uniform(-60, 60), 4),
        "lng": round(random.uniform(-180, 180), 4)
    }


def build_rss_event(entry, source_name):

    coords = random_coordinates()

    return {
        "id": entry.link,

        "title": entry.title,

        "body": getattr(
            entry,
            "summary",
            entry.title
        ),

        "type": classify(entry.title),

        "source": source_name,

        "provider": "rss",

        "url": entry.link,

        "lat": coords["lat"],

        "lng": coords["lng"],

        "timestamp": int(time.time()),

        "city": "LIVE",

        "club": "GLOBAL INTEL"
    }


def add_event(event):

    event_id = event.get(
        "id",
        event.get("url")
    )

    if not event_id:
        return

    if event_id in seen_ids:
        return

    seen_ids.add(event_id)

    feed_cache.append(event)

    if len(feed_cache) > 500:
        feed_cache.pop(0)

    socketio.emit(
        "intel-event",
        event
    )


def rss_fetch():

    for feed_url in RSS_FEEDS:

        try:

            feed = feedparser.parse(
                feed_url
            )

            source_name = (
                feed.feed.get(
                    "title",
                    "RSS Feed"
                )
            )

            for entry in feed.entries[:10]:

                event = build_rss_event(
                    entry,
                    source_name
                )

                add_event(event)

        except Exception as e:

            print(
                f"RSS ERROR: {e}"
            )


def realtime_worker():

    while True:

        try:

            # RSS
            rss_fetch()

            # REDDIT
            try:

                reddit_events = (
                    fetch_reddit()
                )

                for event in reddit_events:

                    if "lat" not in event:

                        coords = (
                            random_coordinates()
                        )

                        event.update(coords)

                    add_event(event)

            except Exception as e:

                print(
                    f"REDDIT ERROR: {e}"
                )

            # YOUTUBE
            try:

                youtube_events = (
                    fetch_youtube()
                )

                for event in youtube_events:

                    if "lat" not in event:

                        coords = (
                            random_coordinates()
                        )

                        event.update(coords)

                    add_event(event)

            except Exception as e:

                print(
                    f"YOUTUBE ERROR: {e}"
                )

            # SOURCE STATUS
            socketio.emit(
                "source-update",
                {
                    "rss": True,
                    "reddit": True,
                    "youtube": True,
                    "timestamp":
                    int(time.time())
                }
            )

        except Exception as e:

            print(
                f"WORKER ERROR: {e}"
            )

        # refresh every 3 min
        time.sleep(180)


@app.route("/api/gist")
def gist():

    title = request.args.get(
        "title",
        ""
    )

    return jsonify({

        "gist":
        (
            f"Football intelligence summary: "
            f"{title}. "
            f"Live monitoring detected activity "
            f"across RSS, Reddit and YouTube sources."
        )

    })


@app.route("/api/status")
def status():

    return jsonify({

        "cached_events":
        len(feed_cache),

        "sources": [
            "rss",
            "reddit",
            "youtube"
        ],

        "running": True
    })


@socketio.on("connect")
def connect():

    print(
        "Client connected"
    )

    socketio.emit(
        "initial-feed",
        feed_cache[-100:]
    )

    socketio.emit(
        "source-update",
        {
            "rss": True,
            "reddit": True,
            "youtube": True,
            "timestamp":
            int(time.time())
        }
    )


if __name__ == "__main__":

    threading.Thread(
        target=realtime_worker,
        daemon=True
    ).start()

    socketio.run(
        app,
        host="0.0.0.0",
        port=3000,
        debug=False
    )
