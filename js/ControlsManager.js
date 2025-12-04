// js/ControlsManager.js
class ControlsManager {
    // Configuration pour l'input (DAS/ARR, etc.)
    static config = {
        das: 150, // délai avant auto-repeat (ms)
        arr: 50,  // intervalle auto-repeat (ms)
        softDropInterval: 50 // intervalle pour soft-drop
    };

    // Etat interne pour timers / touches
    static _state = {
        keysPressed: {},
        leftTimer: null,
        rightTimer: null,
        leftInterval: null,
        rightInterval: null,
        softDropIntervalId: null
    };

    // Keydown handler: commence actions, démarre timers pour DAS/ARR
    static handleKeyDown(game, e) {
        const code = e.code;

        // Toujours laisser P gérer pause même si jeu pas en cours
        if (code === 'KeyP') {
            if (game.gameState === 'playing' || game.gameState === 'paused') {
                game.togglePause();
            }
            return;
        }

        // Les autres touches ne sont traitées que si le jeu est en cours.
        if (game.gameState !== 'playing') return;

        // Eviter répétition native pour certains contrôles ; on gère nous-mêmes
        // On garde un drapeau par touche pour savoir si on a déjà traité l'appui
        if (this._state.keysPressed[code]) return;
        this._state.keysPressed[code] = true;

        switch (code) {
            case 'ArrowLeft':
                e.preventDefault();
                // Cancel opposite direction
                this._clearRight();
                game.movePiece(-1, 0);
                // Démarrer DAS puis ARR
                this._state.leftTimer = setTimeout(() => {
                    this._state.leftInterval = setInterval(() => {
                        game.movePiece(-1, 0);
                    }, this.config.arr);
                }, this.config.das);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this._clearLeft();
                game.movePiece(1, 0);
                this._state.rightTimer = setTimeout(() => {
                    this._state.rightInterval = setInterval(() => {
                        game.movePiece(1, 0);
                    }, this.config.arr);
                }, this.config.das);
                break;
            case 'ArrowDown':
                e.preventDefault();
                // Soft drop: répéter movePiece(0,1)
                game.movePiece(0, 1);
                this._state.softDropIntervalId = setInterval(() => {
                    game.movePiece(0, 1);
                }, this.config.softDropInterval);
                break;
            case 'ArrowUp':
                e.preventDefault();
                game.rotatePiece();
                break;
            case 'Space':
                e.preventDefault();
                game.hardDrop();
                break;
            case 'KeyC':
                e.preventDefault();
                game.holdPieceAction();
                break;
        }
    }

    // Keyup handler: stoppe timers et reset drapeaux
    static handleKeyUp(game, e) {
        const code = e.code;

        // Clear pressed flag
        this._state.keysPressed[code] = false;

        switch (code) {
            case 'ArrowLeft':
                this._clearLeft();
                break;
            case 'ArrowRight':
                this._clearRight();
                break;
            case 'ArrowDown':
                if (this._state.softDropIntervalId) {
                    clearInterval(this._state.softDropIntervalId);
                    this._state.softDropIntervalId = null;
                }
                break;
            default:
                break;
        }
    }

    static _clearLeft() {
        if (this._state.leftTimer) {
            clearTimeout(this._state.leftTimer);
            this._state.leftTimer = null;
        }
        if (this._state.leftInterval) {
            clearInterval(this._state.leftInterval);
            this._state.leftInterval = null;
        }
    }

    static _clearRight() {
        if (this._state.rightTimer) {
            clearTimeout(this._state.rightTimer);
            this._state.rightTimer = null;
        }
        if (this._state.rightInterval) {
            clearInterval(this._state.rightInterval);
            this._state.rightInterval = null;
        }
    }
}