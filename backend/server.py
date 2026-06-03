from flask import Flask, jsonify, request
from flask_socketio import SocketIO
import feedparser
import threading
import time
import random

app = Flask(__name__)

socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)

feed_cache = []

RSS_FEEDS = [
    "https://feeds.bbci.co.uk/sport/football/rss.xml",
    "https://www.espn.com/espn/rss/soccer/news",
    "https://www.goal.com/feeds/en/news",
]

TYPES = [
    "transfer",
    "injury",
    "signing",
    "scout",
    "match"
]


def classify(title):

    t = title.lower()

    if "injury" in t:
        return "injury"

    if "transfer" in t:
        return "transfer"

    if "sign" in t:
        return "signing"

    if "scout" in t:
        return "scout"

    return "match"


def build_event(entry):

    return {
        "title": entry.title,
        "url": entry.link,
        "body": entry.title,
        "type": classify(entry.title),

        "lat": random.uniform(-60, 60),
        "lng": random.uniform(-180, 180),

        "city": "LIVE",
        "club": "GLOBAL INTEL"
    }


def rss_worker():

    while True:

        try:

            for feed_url in RSS_FEEDS:

                feed = feedparser.parse(feed_url)

                for entry in feed.entries[:3]:

                    event = build_event(entry)

                    feed_cache.append(event)

                    if len(feed_cache) > 100:
                        feed_cache.pop(0)

                    socketio.emit(
                        "intel-event",
                        event
                    )

        except Exception as e:
            print(e)

        time.sleep(300)


@app.route("/api/gist")
def gist():

    title = request.args.get("title", "")

    response = {
        "gist":
        f"Football intelligence summary: {title}. "
        f"Market activity detected and classified by Sportline."
    }

    return jsonify(response)


@socketio.on("connect")
def connect():

    socketio.emit(
        "initial-feed",
        feed_cache[-40:]
    )


if __name__ == "__main__":

    threading.Thread(
        target=rss_worker,
        daemon=True
    ).start()

    socketio.run(
        app,
        host="0.0.0.0",
        port=3000
    )
