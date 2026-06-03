def classify(title: str) -> str:
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
