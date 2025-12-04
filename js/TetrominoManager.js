// js/TetrominoManager.js
class TetrominoManager {
    static PIECES = {
        I: {
            shape: [
                [0, 0, 0, 0],
                [1, 1, 1, 1],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ],
            color: 'I'
        },
        O: {
            shape: [
                [1, 1],
                [1, 1]
            ],
            color: 'O'
        },
        T: {
            shape: [
                [0, 1, 0],
                [1, 1, 1],
                [0, 0, 0]
            ],
            color: 'T'
        },
        S: {
            shape: [
                [0, 1, 1],
                [1, 1, 0],
                [0, 0, 0]
            ],
            color: 'S'
        },
        Z: {
            shape: [
                [1, 1, 0],
                [0, 1, 1],
                [0, 0, 0]
            ],
            color: 'Z'
        },
        J: {
            shape: [
                [1, 0, 0],
                [1, 1, 1],
                [0, 0, 0]
            ],
            color: 'J'
        },
        L: {
            shape: [
                [0, 0, 1],
                [1, 1, 1],
                [0, 0, 0]
            ],
            color: 'L'
        }
    };

    static COLORS = {
        I: '#00ffff',
        O: '#ffff00',
        T: '#ff00ff',
        S: '#00ff00',
        Z: '#ff0000',
        J: '#0000ff',
        L: '#ffa500'
    };

    // 7-bag randomizer for fair distribution of pieces
    static _bag = [];

    static refillBag() {
        const keys = Object.keys(this.PIECES);
        // Fisher-Yates shuffle
        for (let i = keys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [keys[i], keys[j]] = [keys[j], keys[i]];
        }
        this._bag.push(...keys);
    }

    static getRandomPiece() {
        if (this._bag.length === 0) this.refillBag();
        const key = this._bag.shift();
        const def = this.PIECES[key];
        return {
            shape: JSON.parse(JSON.stringify(def.shape)),
            color: def.color
        };
    }

    static getTopOffset(shape) {
        for(let r = 0; r < shape.length; r++) {
            if (shape[r].some(cell => cell)) {
                return r;
            }
        }
        return 0;
    }

    static rotateMatrix(matrix) {
        const N = matrix.length;
        const result = [];
        for (let i = 0; i < N; i++) {
            result[i] = [];
            for (let j = 0; j < N; j++) {
                result[i][j] = matrix[N - j - 1][i];
            }
        }
        return result;
    }

    static checkCollision(grid, gridSize, shape, x, y) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const newX = x + c;
                    const newY = y + r;

                    if (newX < 0 || newX >= gridSize.cols || 
                        newY >= gridSize.rows ||
                        (newY >= 0 && grid[newY][newX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

}