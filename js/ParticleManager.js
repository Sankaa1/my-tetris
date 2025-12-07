// js/ParticleManager.js
class ParticleManager {
    constructor() {
        this.pool = [];
        this.poolSize = 150; // Augmenté pour éviter les dynamiques
        this.activeParticles = [];
        this.container = null;
        this.rafId = null;
        this.cellCache = new Map(); // Cache des positions des cellules

        this.init();
    }

    init() {
        this.container = document.createElement('div');
        this.container.className = 'particles-container';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.container);

        this.createPool();
        this.addParticleStyles();
        this.startRenderLoop();
    }

    createPool() {
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < this.poolSize; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                border-radius: 50%;
                pointer-events: none;
                will-change: transform;
                opacity: 0;
            `;

            fragment.appendChild(particle);

            this.pool.push({
                element: particle,
                active: false,
                x: 0,
                y: 0,
                targetX: 0,
                targetY: 0,
                startX: 0,
                startY: 0,
                color: '',
                size: 4,
                startTime: 0,
                duration: 1000,
                opacity: 1
            });
        }

        this.container.appendChild(fragment);
    }

    // Boucle de rendu centralisée (UNE SEULE RAF pour toutes les particules)
    startRenderLoop() {
        const render = () => {
            this.rafId = requestAnimationFrame(render);

            if (this.activeParticles.length === 0) return;

            const now = Date.now();

            // Batch des mises à jour DOM
            for (let i = this.activeParticles.length - 1; i >= 0; i--) {
                const particle = this.activeParticles[i];
                const elapsed = now - particle.startTime;
                const progress = Math.min(elapsed / particle.duration, 1);

                if (progress >= 1) {
                    this.releaseParticle(particle);
                    continue;
                }

                // Easing quadratique
                const ease = 1 - Math.pow(1 - progress, 2);
                const currentX = particle.startX + (particle.targetX - particle.startX) * ease;
                const currentY = particle.startY + (particle.targetY - particle.startY) * ease;
                const scale = 1 - (progress * 0.8);
                const opacity = 1 - Math.pow(progress, 2);

                // UNE SEULE écriture CSS via transform (GPU accelerated)
                particle.element.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
                particle.element.style.opacity = opacity;
            }
        };

        this.rafId = requestAnimationFrame(render);
    }

    getParticle() {
        for (let i = 0; i < this.pool.length; i++) {
            if (!this.pool[i].active) {
                this.pool[i].active = true;
                this.activeParticles.push(this.pool[i]);
                return this.pool[i];
            }
        }

        // Plus de création dynamique - on réutilise la plus ancienne
        if (this.activeParticles.length > 0) {
            return this.activeParticles[0];
        }

        return null;
    }

    releaseParticle(particle) {
        particle.active = false;
        particle.element.style.opacity = '0';
        particle.element.style.transform = 'translate(0,0) scale(0)';

        const index = this.activeParticles.indexOf(particle);
        if (index > -1) {
            this.activeParticles.splice(index, 1);
        }
    }

    // Cache des positions de cellules pour éviter les reflows
    getCellPosition(row, col, gridCells) {
        const key = `${row}-${col}`;

        if (!this.cellCache.has(key)) {
            const cell = gridCells[row][col];
            const el = cell[0] || cell;
            const rect = el.getBoundingClientRect();

            this.cellCache.set(key, {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            });
        }

        return this.cellCache.get(key);
    }

    // Vider le cache quand la grille change (resize, etc.)
    clearCache() {
        this.cellCache.clear();
    }

    createEffect(x, y, color, options = {}) {
        const {
            count = 5,
            size = 4,
            speed = 1.0,
            spread = 100,
            life = 1.0
        } = options;

        const now = Date.now();

        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) continue;

            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * spread;
            const duration = (500 + Math.random() * 500) * life;

            particle.startX = x;
            particle.startY = y;
            particle.targetX = x + Math.cos(angle) * distance;
            particle.targetY = y + Math.sin(angle) * distance;
            particle.color = color;
            particle.size = size;
            particle.startTime = now;
            particle.duration = duration;

            // Initialisation visuelle immédiate (hors boucle RAF)
            particle.element.style.backgroundColor = color;
            particle.element.style.width = size + 'px';
            particle.element.style.height = size + 'px';
            particle.element.style.opacity = '1';
        }
    }

    // Dans ParticleManager.js, remplacer createLineClearEffect par :

    createLineClearEffect(row, cols, gridCells, color, intensity = 1) {
        // Progression exponentielle de la densité selon l'intensité
        const baseParticles = 5;
        const burstMultiplier = Math.pow(intensity, 1.5); // 1, 2.8, 5.2, 8 pour 1-4 lignes
        const totalBursts = Math.floor(3 * burstMultiplier);

        // Particules par burst augmente aussi
        const particlesPerBurst = Math.floor(baseParticles * (1 + intensity * 0.5));

        // Spread plus large pour les gros combos
        const spreadBase = 60;
        const spread = spreadBase * (1 + intensity * 0.3);

        // Taille des particules augmente légèrement
        const particleSize = 4 + intensity;

        // Durée de vie plus longue pour les gros combos
        const lifeMultiplier = 1 + (intensity * 0.15);

        for (let i = 0; i < totalBursts; i++) {
            const col = Math.floor(Math.random() * cols);
            const pos = this.getCellPosition(row, col, gridCells);

            // Variation de couleur pour les gros combos (effet arc-en-ciel)
            let burstColor = color;
            if (intensity >= 3) {
                // Légère variation de teinte pour créer un effet multicolore
                const hueShift = (i / totalBursts) * 30 - 15; // ±15° de variation
                burstColor = this.shiftHue(color, hueShift);
            }

            this.createEffect(pos.x, pos.y, burstColor, {
                count: particlesPerBurst,
                spread: spread,
                size: particleSize,
                life: lifeMultiplier,
                speed: 1.0 + (intensity * 0.2) // Vitesse augmente avec l'intensité
            });
        }

        // Bonus : effet "onde de choc" pour les Tetris (4 lignes)
        if (intensity === 4) {
            this.createShockwave(row, cols, gridCells, color);
        }
    }

    // Nouvelle méthode pour l'effet onde de choc (Tetris uniquement)
    createShockwave(row, cols, gridCells, color) {
        // Créer une vague de particules qui part du centre
        const centerCol = Math.floor(cols / 2);
        const centerPos = this.getCellPosition(row, centerCol, gridCells);

        // 20 particules en cercle
        const shockwaveParticles = 20;
        const now = Date.now();

        for (let i = 0; i < shockwaveParticles; i++) {
            const particle = this.getParticle();
            if (!particle) continue;

            const angle = (i / shockwaveParticles) * Math.PI * 2;
            const distance = 150; // Distance de l'onde

            particle.startX = centerPos.x;
            particle.startY = centerPos.y;
            particle.targetX = centerPos.x + Math.cos(angle) * distance;
            particle.targetY = centerPos.y + Math.sin(angle) * distance;
            particle.color = color;
            particle.size = 8; // Plus grosses particules
            particle.startTime = now;
            particle.duration = 800;

            particle.element.style.backgroundColor = color;
            particle.element.style.width = '8px';
            particle.element.style.height = '8px';
            particle.element.style.opacity = '1';
            particle.element.style.boxShadow = `0 0 10px ${color}`;
        }
    }

    // Utilitaire pour varier la teinte (optionnel, pour effet arc-en-ciel)
    shiftHue(hexColor, degrees) {
        // Conversion hex -> HSL -> modification -> hex
        const rgb = this.hexToRgb(hexColor);
        if (!rgb) return hexColor;

        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        hsl.h = (hsl.h + degrees) % 360;
        if (hsl.h < 0) hsl.h += 360;

        const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
        return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: h * 360, s, l };
    }

    hslToRgb(h, s, l) {
        h /= 360;
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    createHardDropEffect(piece, gridCells, color) {
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[r].length; c++) {
                if (piece.shape[r][c]) {
                    const gridY = piece.position.y + r;
                    const gridX = piece.position.x + c;

                    if (gridY >= 0 && gridY < gridCells.length &&
                        gridX >= 0 && gridX < gridCells[0].length) {

                        const pos = this.getCellPosition(gridY, gridX, gridCells);

                        this.createEffect(pos.x, pos.y, color, {
                            count: 3,
                            spread: 40,
                            size: 4,
                            life: 0.8
                        });
                    }
                }
            }
        }
    }

    cleanup() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        this.activeParticles.forEach(particle => {
            this.releaseParticle(particle);
        });

        this.clearCache();

        // Redémarrer la boucle de rendu après cleanup
        this.startRenderLoop();
    }

    addParticleStyles() {
        if (!document.getElementById('particle-styles')) {
            const style = document.createElement('style');
            style.id = 'particle-styles';
            style.textContent = `
                    .particles-container {
                        pointer-events: none;
                    }

                    .particle {
                        transition: none;
                        will-change: transform;
                        transform-origin: center;
                    }
                `;
            document.head.appendChild(style);
        }
    }

    getStats() {
        return {
            totalPool: this.pool.length,
            activeParticles: this.activeParticles.length,
            availableParticles: this.pool.filter(p => !p.active).length,
            cacheSize: this.cellCache.size
        };
    }
}