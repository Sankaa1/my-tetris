// js/EffectsManager.js
class EffectsManager {
    static init() {
        if (!this.manager) {
            this.manager = new ParticleManager();
        }
        return this.manager;
    }

    static clearCache() {
        if (this.manager) {
            this.manager.clearCache();
        }
    }

    static particle(x, y, color, options) {
        if (!this.manager) this.init();
        this.manager.createEffect(x, y, color, options);
    }

    static lineClear(row, cols, cells, color, intensity) {
        if (!this.manager) this.init();
        this.manager.createLineClearEffect(row, cols, cells, color, intensity);
    }

    static hardDrop(piece, cells, color) {
        if (!this.manager) this.init();
        this.manager.createHardDropEffect(piece, cells, color);
    }

    static cleanup() {
        if (this.manager) {
            this.manager.cleanup();
        }
    }

    static getStats() {
        return this.manager ? this.manager.getStats() : null;
    }
}