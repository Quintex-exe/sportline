from redditEngine import fetch_reddit
from youtubeEngine import fetch_youtube

from rssEngine import fetch_rss

from geoMapper import locate


def aggregate():

    combined = []

    try:

        combined.extend(
            fetch_rss()
        )

    except Exception as e:

        print(e)

    try:

        combined.extend(
            fetch_reddit()
        )

    except Exception as e:

        print(e)

    try:

        combined.extend(
            fetch_youtube()
        )

    except Exception as e:

        print(e)

    for event in combined:

        coords = locate(
            event["title"]
        )

        event.update(coords)

    return combined
