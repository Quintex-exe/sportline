import feedparser
import time

CHANNELS = {

    "Sky Sports":
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCoMdktPbSTixAyNGwb-UYkQ",

    "ESPN FC":
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCVGOWi8Pj4bF6ynjEG1Y7jA",

    "CBS Sports Golazo":
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCvC4D8onUfXzvjTOM-dBfEA",

    "Tifo Football":
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCGYYNGmyhZ_kwBF_lqqXdAQ"
}


def fetch_youtube():

    events = []

    for channel, feed_url in CHANNELS.items():

        try:

            feed = feedparser.parse(feed_url)

            for item in feed.entries[:15]:

                events.append({

                    "id":
                    f"youtube_{item.yt_videoid}",

                    "title":
                    item.title,

                    "body":
                    f"New upload from {channel}",

                    "source":
                    channel,

                    "provider":
                    "youtube",

                    "type":
                    "video",

                    "url":
                    item.link,

                    "timestamp":
                    int(time.time())
                })

        except Exception as e:

            print(
                "YouTube Error:",
                e
            )

    return events
