/* test/mocks/ibus.js - Mock IBus integration for testing */

const IBus = {
    Bus: class {
        constructor() {
            this.connected = false;
        }
        connect() {
            this.connected = true;
        }
        disconnect() {
            this.connected = false;
        }
        get_global_engine() {
            return null;
        }
        set_global_engine() {}
    },
    PanelService: class {
        constructor() {
            this.started = false;
        }
        start() {
            this.started = true;
        }
        stop() {
            this.started = false;
        }
    },
    EngineDesc: class {
        constructor(name, language, author, description, layout, license, icon) {
            this.name = name;
            this.language = language;
            this.author = author;
            this.description = description;
            this.layout = layout;
            this.license = license;
            this.icon = icon;
        }
    },
};

module.exports = IBus;
