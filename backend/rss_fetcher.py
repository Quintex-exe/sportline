import feedparser

RSS_SOURCES = [
    "https://feeds.bbci.co.uk/sport/football/rss.xml",
    "https://www.espn.com/espn/rss/soccer/news"
]

def fetch_news():
    articles = []

    for url in RSS_SOURCES:
        feed = feedparser.parse(url)

        for item in feed.entries[:10]:
            articles.append({
                "title": item.title,
                "link": item.link
            })

    return articles
