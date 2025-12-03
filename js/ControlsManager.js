// js/ControlsManager.js
class ControlsManager {
    static handleKeyPress(game, e) {

        const code = e.code;

        if (code === 'KeyP') {
            // Toggle pause que si le jeu est en cours ou en pause.
            if (game.gameState === 'playing' || game.gameState === 'paused') {
                game.togglePause();
            }
            return; // Aucun traitement des autres touches dans ce cas.
        }

        // Les autres touches ne sont traitées que si le jeu est en cours.
        if(game.gameState !== 'playing') return;

        switch(code) {
            case 'ArrowLeft':
                game.movePiece(-1, 0);
                break;
            case 'ArrowRight': // Droite
                game.movePiece(1, 0);
                break;
            case 'ArrowDown': // Bas
                game.movePiece(0, 1);
                break;
            case 'ArrowUp': // Haut
                game.rotatePiece();
                break;
            case 'Space': // Espace
                game.hardDrop();
                break;
            case 'KeyC': // C
                game.holdPieceAction();
                break;
        }
    }
}