class NotificationEngine {

    constructor() {

        this.audioEnabled = true;

        this.lastEvents = new Set();

        this.requestPermission();
    }

    async requestPermission() {

        if (
            "Notification" in window &&
            Notification.permission === "default"
        ) {
            await Notification.requestPermission();
        }
    }

    notify(event) {

        const key =
            event.id ||
            event.url ||
            event.title;

        if (this.lastEvents.has(key))
            return;

        this.lastEvents.add(key);

        if (this.lastEvents.size > 1000) {

            const first =
                this.lastEvents.values().next().value;

            this.lastEvents.delete(first);
        }

        const icon =
            this.getIcon(event.type);

        const title =
            event.title || "Intel Update";

        const body =
            event.body ||
            event.description ||
            event.source ||
            "";

        if (
            "Notification" in window &&
            Notification.permission === "granted"
        ) {

            new Notification(title, {
                body,
                icon
            });
        }

        this.toast(event);
    }

    getIcon(type) {

        switch(type){

            case "transfer":
                return "/assets/icons/transfer.png";

            case "injury":
                return "/assets/icons/injury.png";

            case "signing":
                return "/assets/icons/signing.png";

            case "scout":
                return "/assets/icons/scout.png";

            default:
                return "/assets/icons/default.png";
        }
    }

    toast(event) {

        const container =
            document.getElementById(
                "notification-container"
            );

        if (!container) return;

        const toast =
            document.createElement("div");

        toast.className =
            `toast ${event.type || "default"}`;

        toast.innerHTML = `
            <div class="toast-title">
                ${event.title}
            </div>

            <div class="toast-source">
                ${event.source || ""}
            </div>
        `;

        container.prepend(toast);

        setTimeout(() => {

            toast.remove();

        }, 6000);
    }
}

window.notificationEngine =
    new NotificationEngine();
