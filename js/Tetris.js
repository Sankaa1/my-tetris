class Tetris {
    static PREVIEW_SHAPES = {
        I:  [   [0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],    // toujours horizontale
        O:  [   [1,1],     
                [1,1]],                                         // toujours carré
        T: [    [0,1,0],   
                [1,1,1],  
                [0,0,0]],                                       // pointe en haut
        S: [    [0,1,1],   
                [1,1,0],   
                [0,0,0]],                                       // On se démerde...
        Z: [    [1,1,0],   
                [0,1,1],   
                [0,0,0]],
        J: [    [1,0,0],
                [1,1,1],   
                [0,0,0]],
        L: [    [0,0,1],   
                [1,1,1],   
                [0,0,0]]
    };
    constructor(options = {}) {
        this.grid = null;
        this.currentPiece = null;
        this.nextPiece = null;
        this.holdPiece = null;
        this.canHold = true;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameState = 'menu';    // menu, playing, paused, gameover, victory
        this.gameMode = 'marathon';
        this.gridSize = { rows: 20, cols: 10 };
        this.fallSpeed = 1000;
        this.gameLoop = null;
        this.isDropping = false;
        this.lockDelay = 400;       // Délai avant le lock final
        this.lockTimeout = null;    // id du setTimeout en cours
        this.isLockPending = false; // Savoir si la pièce est en attente de lock (dy > 0)

        // Variables spécifiques aux modes
        this.startTime = null;
        this.elapsedTime = 0;
        this.timerInterval = null;
        this.targetLines = 40;      // Pour le mode Sprint
        this.survivalSpeedIncrease = 0; // Pour le mode Survie

        this.pieces = TetrominoManager.PIECES;

        this.pieceColors = TetrominoManager.COLORS;

        EffectsManager.init();

        this.sound = options.soundManager || null;

        this.init();
    }

    init() {
        this.createGrid();
        this.bindEvents();
        this.updateDisplay();
        this.loadHighScores();

        // S'assurer que l'overlay de démarrage est visible
        $('#start-overlay').addClass('active');

        // Afficher la description du mode par défaut
        $('.mode-desc').hide();
        $('#marathon-desc').show();

        if (this.sound) {
            this.sound.stopMusic?.();
            this.sound.playMenuMusic?.('single');
        }
    }

    createGrid() {
        this.grid = [];
        this.cells = [];

        const $grid = $('#grid');
        $grid.empty();

        for (let r = 0; r < this.gridSize.rows; r++) {
            this.grid[r] = [];
            this.cells[r] = [];
            for (let c = 0; c < this.gridSize.cols; c++) {
                this.grid[r][c] = null;

                const $cell = $('<div class="cell"></div>')
                    .attr('data-row', r)
                    .attr('data-col', c);
                this.cells[r][c] = $cell;
                $grid.append($cell);
            }
        }

        this.renderGrid();
    }

    bindEvents() {
        // Contrôles clavier (keydown + keyup pour DAS/ARR)
        $(document).on('keydown', (e) => ControlsManager.handleKeyDown(this, e));
        $(document).on('keyup', (e) => ControlsManager.handleKeyUp(this, e));

        // Boutons de contrôle
        $('#start-btn').on('click', () => {
            $('#start-overlay').addClass('active');
        });
        $('#pause-btn').on('click', () => this.togglePause());
        $('#reset-btn').on('click', () => this.resetGame());
        $('#start-game-btn').on('click', () => this.startGame());
        $('#resume-btn').on('click', () => this.togglePause());
        $('#restart-btn').on('click', () => this.resetGame());
        $('#hold-btn').on('click', () => this.holdPieceAction());

        // Gestion des modes (overlay départ + UI en jeu)
        const handleModeClick = (e) => {
            e.preventDefault();

            const $btn = $(e.currentTarget);

            // Récupération du mode (data-mode OU id type "marathon-btn")
            const newMode =
                $btn.data('mode') ||
                ($btn.attr('id') ? $btn.attr('id').replace('-btn', '') : null);

            if (!newMode) return;

            // Met à jour l'état visuel des boutons
            $('.mode-btn').removeClass('active');
            $(`.mode-btn[data-mode="${newMode}"], #${newMode}-btn`).addClass('active');

            const wasPlaying = this.gameState === 'playing';

            if (wasPlaying && newMode !== this.gameMode) {
                this.showModeChangeNotification(newMode);
                this.gameMode = newMode;
                this.resetGame();
                setTimeout(() => {
                    this.startGame();
                }, 1000);
            } else {
                this.gameMode = newMode;
            }

            // Description détaillée (les 3 blocs dans l’overlay)
            $('.mode-desc').hide();
            $(`#${newMode}-desc`).show();

            // Petit texte de mode si tu as un texte compact ailleurs
            const descriptions = {
                marathon: "Mode classique sans fin. Marquez le plus de points possible !",
                sprint: "Complétez 40 lignes le plus rapidement possible !",
                survival: "La vitesse augmente toutes les 30 secondes. Tenez bon !"
            };
            //$('.mode-text').text(descriptions[newMode]);
            $(document).on('click', '.mode-btn', handleModeClick);

            // Met à jour l’UI (label LIGNES/RESTANTES + timer + compteur de lignes)
            this.updateModeDisplay();
            this.updateDisplay();
        };

        // Un seul handler pour tous les boutons de mode (menus + overlay)
        $(document).on('click', '.mode-btn', handleModeClick);

        // Initialisation UI mode actuel
        this.updateModeDisplay();
        this.updateDisplay();
    }

    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.holdPiece = null;
        this.canHold = true;
        this.nextPiece = null;
        this.elapsedTime = 0;
        
        GameModeManager.applyStartConfig(this);

        this.createGrid();
        this.spawnPiece();

        GameModeManager.updateLevelAndSpeed(this);
        
        this.updateHoldPieceDisplay();
        this.updateModeDisplay();

        $('#start-overlay').removeClass('active');
        $('#pause-overlay').removeClass('active');
        $('#game-over-overlay').removeClass('active');

        if (this.sound) {
            this.sound.stopMusic?.();
            this.sound.playGameMusic?.('playlist');
        }

        this.startGameLoop();
    }

    spawnPiece() {
        this.cancelLockDelay();
        // Si pas encore de nextPiece en générer une
        if (!this.nextPiece) {
            this.nextPiece = TetrominoManager.getRandomPiece();
        }

        const piece = this.nextPiece;

        // Calcul de l'offset de la première ligne non vide (matrix)
        const topOffset = TetrominoManager.getTopOffset(piece.shape); 

        // Pièce courante qui peut commencer au-dessus de la grille.
        this.currentPiece = {
            shape: JSON.parse(JSON.stringify(piece.shape)),
            color: piece.color,
            position: { x: 3, y: -topOffset }
        };

        this.nextPiece = TetrominoManager.getRandomPiece();
        this.canHold = true;

        // Update de nextPiece
        this.updateNextPieceDisplay();
        // Calcul position ghost
        this.updateGhostPiece();

        // Game over ?
        if (TetrominoManager.checkCollision(
                this.grid,
                this.gridSize,
                this.currentPiece.shape,
                this.currentPiece.position.x, 
                this.currentPiece.position.y
        )) {
            this.gameOver();
            return;
        }

        // Re dessin de la grille
        this.renderGrid();
    }

    scheduleLock() {
        if (this.isLockPending || !this.currentPiece) return;

        this.isLockPending = true;
        this.lockTimeout = setTimeout(() => {
            this.lockTimeout = null;
            this.isLockPending = false;

            if (this.currentPiece && this.gameState === 'playing') {
                this.lockPiece();
            }
        }, this.lockDelay);
    }

    cancelLockDelay() {
        if (this.lockTimeout) {
            clearTimeout(this.lockTimeout);
            this.lockTimeout = null;
        }
        this.isLockPending = false;
    }

    movePiece(dx, dy) {
        if (!this.currentPiece) return;

        const newX = this.currentPiece.position.x + dx;
        const newY = this.currentPiece.position.y + dy;

        //if (!TetrominoManager.checkCollision(newX, newY, this.currentPiece.shape)) {
        if (!TetrominoManager.checkCollision(this.grid, this.gridSize, this.currentPiece.shape, newX, newY)) {
            this.currentPiece.position.x = newX;
            this.currentPiece.position.y = newY;

            // Pièce bougée, annulation du lock en attente
            this.cancelLockDelay();

            this.updateGhostPiece();
            this.renderGrid();

            // Si c'est un mouvement vers le bas manuel, réinitialiser le timer
            if (dy > 0) {
                this.resetDropTimer();
            }
            return true;
        }

        // Si le mouvement vers le bas échoue, verrouiller la pièce
        if (dy > 0) {
            //this.lockPiece();
            this.scheduleLock();
        }
        return false;
    }

    rotatePiece() {
        if (!this.currentPiece) return;

        const newShape = TetrominoManager.rotateMatrix(this.currentPiece.shape);

        for (let offset of [0, -1, 1, -2, 2]) {
            const testX = this.currentPiece.position.x + offset;
            const testY = this.currentPiece.position.y;

            if (!TetrominoManager.checkCollision(
                this.grid,
                this.gridSize,
                newShape,
                testX,
                testY
            )) {
                if (this.sound) {
                    this.sound.play('rotate');
                }
                this.currentPiece.shape = newShape;
                this.currentPiece.position.x = testX;
                this.cancelLockDelay();
                this.updateGhostPiece();
                this.renderGrid();
                return;
            }
        }
    }

    lockPiece() {
        if (!this.currentPiece) return;

        if (this.sound) {
            this.sound.play('lock');
        }


        // Effet visuel spécial pour hard drop
        if (this.isDropping) {
            const colorHex = this.pieceColors[this.currentPiece.color] || '#ffffff';
            EffectsManager.hardDrop(
                this.currentPiece,
                this.cells,
                colorHex
            );
        }

        // Marquer les cellules occupées dans la grille
        for (let r = 0; r < this.currentPiece.shape.length; r++) {
            for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
                if (this.currentPiece.shape[r][c]) {
                    const gridY = this.currentPiece.position.y + r;
                    const gridX = this.currentPiece.position.x + c;

                    if (gridY >= 0) {
                        this.grid[gridY][gridX] = this.currentPiece.color;
                    }
                }
            }
        }

        // La pièce n'existe plus en tant que "pièce active"
        this.currentPiece = null;
        this.ghostPosition = null;

        this.cancelLockDelay(); // Au cas où

        // On synchronise le DOM avec la grille mise à jour
        this.renderGrid();

        // Vérifier les lignes complètes
        const linesCleared = this.checkLines();

        // S'il n'y a aucune ligne à effacer, on spawn tout de suite
        if (linesCleared === 0) {
            this.spawnPiece();
        }
    }

    checkLines() {
        let linesCleared = 0;
        const clearedRows = [];

        // Identifier les lignes complètes
        for (let r = this.gridSize.rows - 1; r >= 0; r--) {
            if (this.grid[r].every(cell => cell !== null)) {
                clearedRows.push(r);
                linesCleared++;
            }
        }

        if (linesCleared > 0) {
            // Animation avant de supprimer
            this.animateLineClear(clearedRows, linesCleared);

            // Durée de l'animation par rapport au combo
            const delayMap = { 1: 100, 2: 130, 3: 160, 4: 200 };
            const delay = delayMap[linesCleared] || 130;

            // Attendre la fin de l'animation avant de supprimer
            setTimeout(() => {
                // Supprimer les lignes de haut en bas pour éviter les problèmes d'index
                clearedRows.sort((a, b) => a - b);
                for (let row of clearedRows) {
                    this.grid.splice(row, 1);
                    this.grid.unshift(Array(this.gridSize.cols).fill(null));
                }

                this.lines += linesCleared;
                if (linesCleared === 4) {
                    if (this.sound) {
                        this.sound.play?.('maxCombo');
                    }
                }
                this.updateScore(linesCleared);
                //console.log(linesCleared);
                this.updateLevel();

                // Vérifier la victoire en mode Sprint

                const cfg = GameModeManager.getConfig(this.gameMode);

                if (cfg.id === 'sprint' && cfg.targetLines && this.lines >= cfg.targetLines ) {
                    this.renderGrid();
                    this.winGame();
                } else {
                    this.spawnPiece();
                }
            }, delay);
        }

        return linesCleared;
    }

    updateScore(linesCleared) {
        const points = [0, 40, 100, 300, 1200]; // Points pour 0, 1, 2, 3, 4 lignes
        let linePoints = points[linesCleared] * this.level;

        // Bonus pour soft drop et hard drop
        if (this.isDropping) {
            linePoints += linesCleared * 2;
        }

        this.score += linePoints;
        this.updateDisplay();
    }
        
    updateLevel() {
        GameModeManager.updateLevelAndSpeed(this);
    }

    hardDrop() {
        if (!this.currentPiece || this.gameState !== 'playing') return;

        this.isDropping = true;
        let dropDistance = 0;

        while (this.movePiece(0, 1)) {
            dropDistance++;
        }

        // Lock sans délai
        this.lockPiece();

        this.score += dropDistance * 2;
        this.updateDisplay();
        this.isDropping = false;
    }

    /* holdPieceAction() {
        if (!this.canHold || !this.currentPiece) return;

        if (this.holdPiece) {
            
            // Echange avec la pièce en réserve
            const temp = {
                shape: JSON.parse(JSON.stringify(this.currentPiece.shape)),
                color: this.currentPiece.color
            };

            const newShape = JSON.parse(JSON.stringify(this.holdPiece.shape));
            const topOffset = TetrominoManager.getTopOffset(newShape);

            this.currentPiece = {
                shape: newShape,
                color: this.holdPiece.color,
                position: { x: 3, y: -topOffset }
            };

            this.holdPiece = temp;

            // Vérifier si la nouvelle pièce peut être placée
            if (TetrominoManager.checkCollision(
                this.grid,
                this.gridSize,
                this.currentPiece.shape,
                this.currentPiece.position.x, 
                this.currentPiece.position.y
            )) {
                this.gameOver();
                return;
            }
        } else {
            // Première utilisation de la réserve
            this.holdPiece = {
                shape: JSON.parse(JSON.stringify(this.currentPiece.shape)),
                color: this.currentPiece.color
            };
            this.spawnPiece();
        }

        this.canHold = false;
        this.updateHoldPieceDisplay();
        this.updateGhostPiece();
        this.renderGrid();
    } */

        holdPieceAction() {
        if (!this.canHold || !this.currentPiece) return;

        if (this.holdPiece) {
            // ÉCHANGE INTELLIGENT : on garde la rotation exacte des deux pièces
            const tempShape = JSON.parse(JSON.stringify(this.currentPiece.shape));
            const tempColor = this.currentPiece.color;

            // On remet la pièce tenue avec sa rotation sauvegardée
            this.currentPiece.shape = JSON.parse(JSON.stringify(this.holdPiece.shape));
            this.currentPiece.color = this.holdPiece.color;

            // On sauvegarde l'ancienne pièce courante (avec sa rotation actuelle)
            this.holdPiece = {
                shape: tempShape,
                color: tempColor
            };

            // Repositionnement au spawn (avec offset propre)
            const topOffset = TetrominoManager.getTopOffset(this.currentPiece.shape);
            this.currentPiece.position = { x: 3, y: -topOffset };

            // Vérif collision immédiate → game over si bloqué
            if (TetrominoManager.checkCollision(
                this.grid,
                this.gridSize,
                this.currentPiece.shape,
                this.currentPiece.position.x,
                this.currentPiece.position.y
            )) {
                this.gameOver();
                return;
            }

        } else {
            // Premier hold : on sauvegarde la pièce courante telle quelle
            this.holdPiece = {
                shape: JSON.parse(JSON.stringify(this.currentPiece.shape)),
                color: this.currentPiece.color
            };
            this.spawnPiece(); // spawn la next
        }

        this.canHold = false;
        this.updateHoldPieceDisplay();
        this.updateGhostPiece();
        this.renderGrid();
    }

    updateGhostPiece() {
        if (!this.currentPiece) return;

        this.ghostPosition = { ...this.currentPiece.position };

        // Faire tomber le fantôme jusqu'à la position la plus basse possible
        //while (!TetrominoManager.checkCollision(this.ghostPosition.x, this.ghostPosition.y + 1, this.currentPiece.shape)) {
        while (!TetrominoManager.checkCollision(
            this.grid,
            this.gridSize,
            this.currentPiece.shape,
            this.ghostPosition.x,
            this.ghostPosition.y + 1
        )) {
            this.ghostPosition.y++;
        }
    }

    startGameLoop() {
        this.gameLoop = setInterval(() => {
            if (this.gameState === 'playing') {
                this.movePiece(0, 1);
            }
        }, this.fallSpeed);
    }

    resetDropTimer() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.startGameLoop();
        }
    }

    animateLineClear(clearedRows, linesCleared) {
        const intensity = Math.min(linesCleared, 4);

        // 1. On marque les cellules comme "clearing" (écriture DOM)
        clearedRows.forEach(row => {
            for (let c = 0; c < this.gridSize.cols; c++) {
                const $cell = this.cells[row][c];
                $cell.attr('class', 'cell clearing');
            }
        });

        EffectsManager.clearCache();

        // 2. On laisse le navigateur appliquer ces changements,
        // puis on calcule les particules dans la frame suivante.
        requestAnimationFrame(() => {
            clearedRows.forEach(row => {
                const pieceType = this.grid[row][0];
                const colorHex = this.pieceColors[pieceType] || '#00ffff';

                EffectsManager.lineClear(
                    row,
                    this.gridSize.cols,
                    this.cells,
                    colorHex,
                    intensity
                );
            });
        });
    }

    gameOver() {
        this.gameState = 'gameover';
        clearInterval(this.gameLoop);
        this.stopTimer();

        if (this.sound) {
            this.sound.stopMusic();
            this.sound.play('gameover');
        }

        $('#game-over-title').text('GAME OVER');

        $('#final-score').text(this.score);

        // Afficher le temps en mode Sprint et Survie
        if (this.gameMode === 'sprint' || this.gameMode === 'survival') {
            const timeText = this.formatTime(this.elapsedTime);
            $('#final-time').text(timeText);
            $('#time-info').show();
        } else {
            $('#time-info').hide();
        }

        $('#game-over-overlay').addClass('active');
        
        this.saveHighScore();
    }

    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            clearInterval(this.gameLoop);
            this.stopTimer();
            $('#pause-overlay').addClass('active');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.startGameLoop();
            if (this.gameMode === 'sprint' || this.gameMode === 'survival') {
                this.startTimer();
            }
            $('#pause-overlay').removeClass('active');
        }
    }

    resetGame() {
        clearInterval(this.gameLoop);
        this.stopTimer();
        this.cancelLockDelay();
        this.gameState = 'menu';
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.currentPiece = null;
        this.nextPiece = null;
        this.holdPiece = null;
        this.canHold = true;
        this.elapsedTime = 0;

        $('#start-overlay').addClass('active');
        $('#pause-overlay').removeClass('active');
        $('#game-over-overlay').removeClass('active');

        this.createGrid();
        this.updateDisplay();
        this.updateHoldPieceDisplay();

        EffectsManager.cleanup();
    }

    renderGrid() {
        // Réinitialiser toutes les cellules
        for (let r = 0; r < this.gridSize.rows; r++) {
            for (let c = 0; c < this.gridSize.cols; c++) {
                const $cell = this.cells[r][c];
                $cell.attr('class', 'cell'); // reset des class
                const color = this.grid[r][c];
                if (color) {
                    $cell.addClass('filled ' + color);
                }
            }
        }

        // Dessiner le ghost piece
        if (this.currentPiece && this.ghostPosition) {
            for (let r = 0; r < this.currentPiece.shape.length; r++) {
                for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
                    if (this.currentPiece.shape[r][c]) {
                        const gridY = this.ghostPosition.y + r;
                        const gridX = this.ghostPosition.x + c;

                        if (gridY >= 0 && gridY < this.gridSize.rows) {
                            this.cells[gridY][gridX]
                                .addClass('ghost ' + this.currentPiece.color);
                        }
                    }
                }
            }
        }

        // Dessiner la pièce courante par-dessus
        if (this.currentPiece) {
            for (let r = 0; r < this.currentPiece.shape.length; r++) {
                for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
                    if (this.currentPiece.shape[r][c]) {
                        const gridY = this.currentPiece.position.y + r;
                        const gridX = this.currentPiece.position.x + c;

                        if (gridY >= 0 && gridY < this.gridSize.rows) {
                            this.cells[gridY][gridX]
                                .removeClass('ghost')
                                .addClass('filled ' + this.currentPiece.color);
                        }                        
                    }
                }
            }
        }
    }

    /* updateNextPieceDisplay() {
        const $nextPiece = $('#next-piece');
        $nextPiece.empty();

        if (!this.nextPiece) return;

        // Centrer la pièce dans l'affichage de prévisualisation
        const piece = this.nextPiece;
        const size = piece.shape.length;
        const offset = Math.floor((4 - size) / 2);

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const $cell = $('<div class="cell"></div>');

                const pieceR = r - offset;
                const pieceC = c - offset;

                if (pieceR >= 0 && pieceR < size && pieceC >= 0 && pieceC < size && 
                    piece.shape[pieceR][pieceC]) {
                    $cell.addClass('filled ' + piece.color);
                }

                $nextPiece.append($cell);
            }
        }
    }

    updateHoldPieceDisplay() {
        const $holdPiece = $('#hold-piece');
        $holdPiece.empty();

        if (!this.holdPiece) {
            // Afficher une grille vide
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    const $cell = $('<div class="cell"></div>');
                    $holdPiece.append($cell);
                }
            }
            return;
        }

        const piece = this.holdPiece;
        const size = piece.shape.length;
        const offset = Math.floor((4 - size) / 2);

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const $cell = $('<div class="cell"></div>');

                const pieceR = r - offset;
                const pieceC = c - offset;

                if (pieceR >= 0 && pieceR < size && pieceC >= 0 && pieceC < size && 
                    piece.shape[pieceR][pieceC]) {
                    $cell.addClass('filled ' + piece.color);
                }

                $holdPiece.append($cell);
            }
        }
    } */

    /* renderPreview(piece, container) {
        if (!container) return;
        container.empty();

        if (!piece) {
            // Grille vide 4x4 grise (quand hold est vide)
            for (let i = 0; i < 16; i++) {
                container.append('<div class="cell"></div>');
            }
            return;
        }

        // Détection auto du type pour un affichage optimal
        const isIO = piece.color === 'I' || piece.color === 'O';
        const gridSize = isIO ? 2 : 4;
        const cellCount = gridSize * gridSize;

        // On applique la classe CSS intelligente
        container.removeClass('default large').addClass(isIO ? 'large' : 'default');

        // Normalisation de la shape → toujours 4x4 sauf O
        let shape = piece.shape;
        if (piece.color !== 'O') {
            // Force 4x4
            while (shape.length < 4) shape.push([0,0,0,0]);
            shape = shape.map(row => {
                while (row.length < 4) row.push(0);
                return row.slice(0, 4);
            });
        }

        // Création des cellules
        for (let i = 0; i < cellCount; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';

            const r = Math.floor(i / gridSize);
            const c = i % gridSize;

            if (shape[r] && shape[r][c]) {
                cell.classList.add('filled', piece.color);
            }

            container[0].appendChild(cell);
        }
    } */

    /* renderPreview(piece, container) {
        if (!container) return;
        container.empty();

        // Grille vide quand rien
        if (!piece) {
            for (let i = 0; i < 16; i++) {
                container.append('<div class="cell"></div>');
            }
            return;
        }

        const canonical = Tetris.PREVIEW_SHAPES[piece.color];
        const isIO = piece.color === 'I' || piece.color === 'O';
        const gridSize = isIO ? 2 : 4;

        container.removeClass('default large').addClass(isIO ? 'large' : 'default');

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';

                if (canonical[r] && canonical[r][c] === 1) {
                    cell.classList.add('filled', piece.color);
                }
                container[0].appendChild(cell);
            }
        }
    } */

    renderPreview(piece, container) {
        if (!container) return;
        container.empty();

        if (!piece) {
            for (let i = 0; i < 16; i++) {
                container.append('<div class="cell"></div>');
            }
            return;
        }

        const canonical = Tetris.PREVIEW_SHAPES[piece.color];

        // I et O = affichage spécial, mais I = 4x4 (pas 2x2 !)
        const isO = piece.color === 'O';
        const isI = piece.color === 'I';
        const gridSize = isO ? 2 : 4;  // I passe en 4x4, pas en 2x2

        container.removeClass('default large').addClass(isO ? 'large' : 'default');

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';

                if (canonical[r] && canonical[r][c] === 1) {
                    cell.classList.add('filled', piece.color);
                }
                container[0].appendChild(cell);
            }
        }
    }

    // Remplacement des anciennes fonctions
    updateNextPieceDisplay() {
        this.renderPreview(this.nextPiece, $('#next-piece'));
    }

    updateHoldPieceDisplay() {
        this.renderPreview(this.holdPiece, $('#hold-piece'));
    }

    updateDisplay() {
        const cfg = GameModeManager.getConfig(this.gameMode);

        $('#score').text(this.score.toString().padStart(6, '0'));

        if (cfg.showRemainingLines && cfg.targetLines) {
            const remaining = Math.max(0, cfg.targetLines - this.lines);
            $('#lines').text(remaining.toString().padStart(3, '0'));
        } else {
            $('#lines').text(this.lines.toString().padStart(3, '0'));
        }

        $('#level').text(this.level.toString().padStart(2, '0'));
    }

    startTimer() {
        this.startTime = Date.now() - this.elapsedTime;
        this.timerInterval = setInterval(() => {
            this.elapsedTime = Date.now() - this.startTime;
            this.updateTimerDisplay();

            // En mode survie, accélérer progressivement
            if (this.gameMode === 'survival') {
                this.updateLevel();
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        const timeText = this.formatTime(this.elapsedTime);
        $('#timer').text(timeText);
    }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    updateModeDisplay() {
        const cfg = GameModeManager.getConfig(this.gameMode);

        // Label LIGNES / RESTANTES
        if (cfg.showRemainingLines) {
            $('.info-box .label').each(function () {
                if ($(this).text().trim() === 'LIGNES' || $(this).text().trim() === 'RESTANTES') {
                    $(this).text('RESTANTES');
                }
            });
        } else {
            $('.info-box .label').each(function () {
                if ($(this).text().trim() === 'RESTANTES') {
                    $(this).text('LIGNES');
                }
            });
        }

        if (cfg.hasTimer) {
            $('#timer-container').show();
        } else {
            $('#timer-container').hide();
        }
    }

    showModeChangeNotification(newMode) {
        const modeNames = {
            'marathon': '🏃 MARATHON',
            'sprint': '⚡ SPRINT',
            'survival': '💀 SURVIE'
        };

        const $notification = $('<div class="mode-change-notification"></div>')
            .text(`Changement de mode : ${modeNames[newMode]}`)
            .appendTo('body');

        setTimeout(() => {
            $notification.addClass('show');
        }, 10);

        setTimeout(() => {
            $notification.removeClass('show');
            setTimeout(() => {
                $notification.remove();
            }, 500);
        }, 2000);
    }

    winGame() {
        this.gameState = 'victory';
        clearInterval(this.gameLoop);
        this.stopTimer();

        $('#final-score').text(this.score);
        $('#final-time').text(this.formatTime(this.elapsedTime));
        $('#time-info').show();
        $('#game-over-title').text('VICTOIRE !');
        $('#game-over-overlay').addClass('active');

        this.saveHighScore();
    }

    saveHighScore() {
        const highScores = this.loadHighScores();
        const gameMode = this.gameMode;

        if (!highScores[gameMode]) {
            highScores[gameMode] = [];
        }

        const scoreEntry = {
            score: this.score,
            lines: this.lines,
            level: this.level,
            date: new Date().toISOString()
        };

        // Ajouter le temps pour Sprint et Survie
        if (this.gameMode === 'sprint' || this.gameMode === 'survival') {
            scoreEntry.time = this.elapsedTime;
        }

        highScores[gameMode].push(scoreEntry);

        // Trier selon le mode
        if (this.gameMode === 'sprint') {
            // En Sprint, le meilleur temps gagne
            highScores[gameMode].sort((a, b) => a.time - b.time);    
        } else {
            // En Marathon et Survie, le meilleur score gagne
            highScores[gameMode].sort((a, b) => b.score - a.score);
        }

        highScores[gameMode] = highScores[gameMode].slice(0, 10);

        localStorage.setItem('tetrisHighScores', JSON.stringify(highScores));
        this.displayHighScores(highScores);
    }

    loadHighScores() {
        try {
            const saved = localStorage.getItem('tetrisHighScores');
            const highScores = saved ? JSON.parse(saved) : {};
            this.displayHighScores(highScores);
            return highScores;
        } catch (e) {
            console.error('Erreur lors du chargement des scores:', e);
            return {};
        }
    }

    displayHighScores(highScores) {
        const $highScores = $('#high-scores');
        $highScores.empty();

        if (Object.keys(highScores).length === 0) {
            $highScores.html('<p class="no-scores">Aucun score enregistré</p>');
            return;
        }

        Object.keys(highScores).forEach(mode => {
            const $modeSection = $(`<div class="mode-section"></div>`);
            $modeSection.append(`<h4>${mode.toUpperCase()}</h4>`);

            highScores[mode].forEach((score, index) => {
                const $scoreItem = $('<div class="score-item"></div>');

                if (mode === 'sprint' && score.time !== undefined) {
                    // Pour Sprint, afficher le temps
                    $scoreItem.html(`
                        <span class="rank">#${index + 1}</span>
                        <span class="score-value">${this.formatTime(score.time)}</span>
                        <span class="score-lines">${score.score}pts</span>
                    `);
                } else if (mode === 'survival' && score.time !== undefined) {
                    // Pour Survie, afficher score et temps
                    $scoreItem.html(`
                        <span class="rank">#${index + 1}</span>
                        <span class="score-value">${score.score}</span>
                        <span class="score-lines">${this.formatTime(score.time)}</span>
                    `);
                } else {
                    // Pour Marathon, afficher score et lignes
                    $scoreItem.html(`
                        <span class="rank">#${index + 1}</span>
                        <span class="score-value">${score.score}</span>
                        <span class="score-lines">L${score.lines}</span>
                    `);
                }
                
                $modeSection.append($scoreItem);
            });
            
            $highScores.append($modeSection);
        });
    }
}

// Initialisation du jeu quand la page est chargée
$(document).ready(() => {
    const sound = new SoundManager();
    sound.loadSounds();
    
    window.tetris = new Tetris({ soundManager: sound });

    // Toggles audio
    $('.music-toggle').prop('checked', sound.musicEnabled);
    $('.fx-toggle').prop('checked', sound.fxEnabled);

    // Bascule on - off
    $('.music-toggle').on('change', function () {
        const checked = this.checked;

        $('.music-toggle').prop('checked', checked);

        sound.toggleMusic(checked);
    });

    $('.fx-toggle').on('change', function() {
        const checked = this.checked;

        $('.fx-toggle').prop('checked', checked);
        sound.toggleFx(checked);
    });

    // Gestion volume des sons
    $('.music-volume')
        // valeur initiale dans tous les sliders
        .val(sound.musicVolume * 100)
        // synchronisation
        .on('input', function () {
            const value = this.value;

            // Mettre tous les sliders "musique à cette valeur"
            $('.music-volume').val(value);

            // Mise à jour SoundManager
            sound.setMusicVolume(value / 100);
        });

    // Effets
    $('.fx-volume')
        .val(sound.sfxVolume * 100)
        .on('input', function () {
            const value = this.value;

            $('.fx-volume').val(value);
            sound.setSfxVolume(value / 100);
        });
        //console.log(sound.musicVolume);
        //console.log(sound.sfxVolume);
   
    document.addEventListener('keydown', function(e) {
        const codesToPrevent = ['Space', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
        if (codesToPrevent.includes(e.code)) {
            e.preventDefault();
        }
    }, false);
});