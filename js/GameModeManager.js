// js/GameModeManager.js
class GameModeManager {
    static MODES = {
        marathon: {
            id: 'marathon',
            label: 'Marathon',
            description: 'Mode classique sans fin. Marquez le plus de points possible !',
            hasTimer: false,
            showRemainingLines: false,
            targetLines: null,
            calcLevel(tetris) {
                // Level = 1 + 1 tous les 10 lignes
                return Math.floor(tetris.lines / 10) + 1;
            },
            calcFallSpeed(level) {
                // Classique : accélération modérée
                return Math.max(50, 1000 - (level - 1) * 50);
            }
        },
        sprint: {
            id: 'sprint',
            label: 'Sprint',
            description: 'Complétez 40 lignes le plus rapidement possible !',
            hasTimer: true,
            showRemainingLines: true,
            targetLines: 40,
            calcLevel(tetris) {
                // Niveau fixe
                return 1;
            },
            calcFallSpeed(level) {
                // Vitesse fixe
                return 500;
            }
        },
        survival: {
            id: 'survival',
            label: 'Survie',
            description: 'La vitesse augmente toutes les 30 secondes. Tenez bon !',
            hasTimer: true,
            showRemainingLines: false,
            targetLines: null,
            calcLevel(tetris) {
                // Level basé sur le temps écoulé
                const timeInSeconds = Math.floor(tetris.elapsedTime / 1000);
                return Math.floor(timeInSeconds / 30) + 1;
            },
            calcFallSpeed(level) {
                // Accélération agressive
                return Math.max(50, 1000 - (level - 1) * 100);
            }
        }
    };

    static getConfig(modeId) {
        return this.MODES[modeId] || this.MODES.marathon;
    }

    /**
     * Appelé dans startGame()
     */
    static applyStartConfig(tetris) {
        const cfg = this.getConfig(tetris.gameMode);

        // Timer
        if (cfg.hasTimer) {
            tetris.startTime = Date.now();
            tetris.startTimer();
        } else {
            tetris.stopTimer();
            tetris.elapsedTime = 0;
        }

        // Lignes cibles (Sprint)
        if (cfg.targetLines) {
            tetris.targetLines = cfg.targetLines;
        }
    }

    /**
     * Recalcule level + fallSpeed en fonction du mode
     * Appelé depuis updateLevel() (et indirectement via timer en Survie)
     */
    static updateLevelAndSpeed(tetris) {
        const cfg = this.getConfig(tetris.gameMode);
        const newLevel = cfg.calcLevel(tetris);

        if (newLevel !== tetris.level) {
            tetris.level = newLevel;
            tetris.fallSpeed = cfg.calcFallSpeed(newLevel);

            if (tetris.gameLoop) {
                clearInterval(tetris.gameLoop);
                tetris.startGameLoop();
            }
        }
    }
}
