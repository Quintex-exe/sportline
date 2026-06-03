class SourceStatusManager {
    constructor(containerId = "source-status-list") {
        this.container = document.getElementById(containerId);
        this.sources = new Map();
        this.timeout = 300000; // 5 min
    }

    update(event) {
        const source =
            event.source ||
            event.provider ||
            event.feed ||
            event.domain ||
            "Unknown";

        this.sources.set(source, {
            lastSeen: Date.now(),
            count: (this.sources.get(source)?.count || 0) + 1
        });

        this.render();
    }

    render() {
        if (!this.container) return;

        const now = Date.now();

        this.container.innerHTML = "";

        [...this.sources.entries()]
            .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
            .forEach(([name, data]) => {

                const online =
                    now - data.lastSeen < this.timeout;

                const row = document.createElement("div");

                row.className = "source-row";

                row.innerHTML = `
                    <span>${name}</span>
                    <span class="${online ? "online" : "offline"}">
                        ${online ? "ONLINE" : "OFFLINE"}
                    </span>
                `;

                this.container.appendChild(row);
            });
    }
}

window.sourceStatus = new SourceStatusManager();
