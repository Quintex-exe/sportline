import requests
import time

HEADERS = {
    "User-Agent": "SportlineIntel/1.0"
}

SUBREDDITS = [
    "soccer",
    "PremierLeague",
    "Championship",
    "Bundesliga",
    "LaLiga",
    "seriea",
    "MLS"
]


def fetch_reddit():

    events = []

    for subreddit in SUBREDDITS:

        try:

            url = (
                f"https://www.reddit.com/r/"
                f"{subreddit}/new.json?limit=25"
            )

            response = requests.get(
                url,
                headers=HEADERS,
                timeout=10
            )

            posts = response.json()["data"]["children"]

            for post in posts:

                data = post["data"]

                events.append({
                    "id": f"reddit_{data['id']}",
                    "title": data["title"],
                    "body": data.get("selftext", ""),
                    "source": f"Reddit/r/{subreddit}",
                    "provider": "reddit",
                    "type": "community",
                    "url": (
                        "https://reddit.com" +
                        data["permalink"]
                    ),
                    "timestamp": int(time.time())
                })

        except Exception as e:
            print("Reddit Error:", e)

    return events
