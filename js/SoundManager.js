// js/SoundManager.js
class SoundManager {
    constructor() {
        this.sfx = {};
        this.musicTracks = {
            menu: [],
            game: []
        };

        // Système de canaux pour éviter les superpositions
        this.channels = {
            movement: null,  // Pour rotate
            impact: null,    // Pour lock
            combo: null,     // Pour maxCombo
            ui: null         // Pour gameover et autres UI
        };

        // Priorités des sons (plus le nombre est élevé, plus prioritaire)
        this.soundPriorities = {
            'lock': { priority: 3, channel: 'impact' },
            'maxCombo': { priority: 4, channel: 'combo' },
            'rotate': { priority: 1, channel: 'movement' },
            'gameover': { priority: 5, channel: 'ui' }
        };

        this.currentMusic = null;
        this.currentPlaylist = null;
        this.currentIndex = 0;
        this.musicMode = 'single';

        this.enabled = true;
        this.musicEnabled = true;
        this.fxEnabled = true;

        this.masterVolume = 1.0;
        this.sfxVolume = 0.5;
        this.musicVolume = 0.5;

        // Charger les réglages persistés si disponibles
        this._storageKey = 'tetrisAudioSettings';
        this.loadSettings();
    }

    loadSounds() {
        // Créer des pools d'audio pour éviter les limitations du navigateur
        this.sfx.lock = this.createAudioPool('src/audio/lock.wav', 2);
        this.sfx.maxCombo = this.createAudioPool('src/audio/max_combo.wav', 1);
        this.sfx.rotate = this.createAudioPool('src/audio/rotate.wav', 3); // Pool plus large pour rotations rapides
        this.sfx.gameover = this.createAudioPool('src/audio/gameover.wav', 1);

        // Musiques hors jeu
        const menu1 = new Audio('src/audio/start_jingle.wav');
        this.musicTracks.menu = [menu1];

        // Musiques en jeu
        const game1 = new Audio('src/audio/bgmusic.wav');
        const game2 = new Audio('src/audio/blue.mp3');
        this.musicTracks.game = [game1, game2];
        
        this.setupMusicHandlers();
        this.updateVolumes();
    }

    // Créer un pool d'instances audio
    createAudioPool(src, size = 2) {
        const pool = [];
        for (let i = 0; i < size; i++) {
            const audio = new Audio(src);
            audio.preload = 'auto';
            pool.push(audio);
        }
        return pool;
    }

    // Récupérer une instance audio disponible du pool
    getAvailableAudio(pool) {
        // Chercher une instance non en cours de lecture
        for (let audio of pool) {
            if (audio.paused || audio.ended || audio.currentTime === 0) {
                return audio;
            }
        }
        // Si toutes sont occupées, retourner la première (sera interrompue)
        return pool[0];
    }
    
    setupMusicHandlers() {
        const allTracks = [
            ...this.musicTracks.menu,
            ...this.musicTracks.game
        ];

        allTracks.forEach(track => {
            if (!track) return;
            track.loop = false;
            track.onended = () => {
                this.onTrackEnded(track);
            };
        });
    }

    updateVolumes() {
        // Effets : itérer sur les pools
        Object.values(this.sfx).forEach(poolOrAudio => {
            if (!poolOrAudio) return;

            if (Array.isArray(poolOrAudio)) {
                // C'est un pool
                poolOrAudio.forEach(audio => {
                    audio.volume = this.masterVolume * this.sfxVolume;
                    audio.muted = !this.fxEnabled || !this.enabled;
                });
            } else {
                // C'est un Audio simple (ancienne compatibilité)
                poolOrAudio.volume = this.masterVolume * this.sfxVolume;
                poolOrAudio.muted = !this.fxEnabled || !this.enabled;
            }
        });

        // Musiques
        const allTracks = [
            ...this.musicTracks.menu,
            ...this.musicTracks.game
        ];
        allTracks.forEach(audio => {
            if (!audio) return;
            audio.volume = this.masterVolume * this.musicVolume;
            audio.muted = !this.musicEnabled || !this.enabled;
        });
    }

    setMasterVolume(value) {
        this.masterVolume = this._clamp01(value);
        this.updateVolumes();
        this.saveSettings();
    }

    setSfxVolume(value) {
        this.sfxVolume = this._clamp01(value);
        this.updateVolumes();
        this.saveSettings();
    }

    setMusicVolume(value) {
        this.musicVolume = this._clamp01(value);
        this.updateVolumes();
        this.saveSettings();
    }

    toggleMusic(enabled) {
        this.musicEnabled = enabled;
        if (!enabled) {
            this.stopMusic();
        } else {
            if (!this.currentMusic && this.currentPlaylist && this.currentPlaylist.length > 0) {
                this.startCurrentTrack();
            }
        }
        this.updateVolumes();
        this.saveSettings();
    }

    toggleFx(enabled) {
        this.fxEnabled = enabled;
        if (!enabled) {
            // Arrêter tous les sons en cours
            this.stopAllSfx();
        }
        this.updateVolumes();
        this.saveSettings();
    }

    // Persist audio settings to localStorage
    saveSettings() {
        try {
            const payload = {
                enabled: this.enabled,
                musicEnabled: this.musicEnabled,
                fxEnabled: this.fxEnabled,
                masterVolume: this.masterVolume,
                sfxVolume: this.sfxVolume,
                musicVolume: this.musicVolume
            };
            localStorage.setItem(this._storageKey, JSON.stringify(payload));
        } catch (e) {
            console.warn('Impossible de sauvegarder les réglages audio:', e);
        }
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem(this._storageKey);
            if (!raw) return;
            const obj = JSON.parse(raw);
            if (typeof obj.enabled === 'boolean') this.enabled = obj.enabled;
            if (typeof obj.musicEnabled === 'boolean') this.musicEnabled = obj.musicEnabled;
            if (typeof obj.fxEnabled === 'boolean') this.fxEnabled = obj.fxEnabled;
            if (typeof obj.masterVolume === 'number') this.masterVolume = this._clamp01(obj.masterVolume);
            if (typeof obj.sfxVolume === 'number') this.sfxVolume = this._clamp01(obj.sfxVolume);
            if (typeof obj.musicVolume === 'number') this.musicVolume = this._clamp01(obj.musicVolume);
        } catch (e) {
            console.warn('Impossible de charger les réglages audio:', e);
        }
    }

    _clamp01(v) {
        return Math.max(0, Math.min(1, v));
    }

    // Arrêter tous les effets sonores
    stopAllSfx() {
        Object.values(this.channels).forEach(audio => {
            if (audio && !audio.paused) {
                audio.pause();
                audio.currentTime = 0;
            }
        });

        // Réinitialiser les canaux
        for (let key in this.channels) {
            this.channels[key] = null;
        }
    }

    // Refonte complète du système de lecture
    play(soundName) {
        if (!this.enabled || !this.fxEnabled) return;

        const pool = this.sfx[soundName];
        if (!pool) {
            console.warn(`Son "${soundName}" introuvable`);
            return;
        }

        const config = this.soundPriorities[soundName];
        if (!config) {
            console.warn(`Pas de configuration pour "${soundName}"`);
            return;
        }

        const channelName = config.channel;
        const priority = config.priority;
        const currentAudio = this.channels[channelName];

        // Vérifier si on doit interrompre le son en cours
        if (currentAudio && !currentAudio.paused) {
            const currentSound = this.getAudioName(currentAudio);
            const currentPriority = this.soundPriorities[currentSound]?.priority || 0;

            // Si le nouveau son est plus prioritaire, interrompre l'ancien
            if (priority >= currentPriority) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            } else {
                // Le son en cours est plus important, ignorer le nouveau
                return;
            }
        }

        // Récupérer une instance audio disponible du pool
        const audio = this.getAvailableAudio(pool);

        // Stocker dans le canal
        this.channels[channelName] = audio;

        // Jouer le son
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.warn(`Erreur lecture "${soundName}":`, err);
        });

        // Nettoyer le canal quand le son est terminé
        audio.onended = () => {
            if (this.channels[channelName] === audio) {
                this.channels[channelName] = null;
            }
        };
    }

    // Utilitaire : retrouver le nom d'un son à partir de son objet Audio
    getAudioName(audioObj) {
        for (let [name, pool] of Object.entries(this.sfx)) {
            if (Array.isArray(pool) && pool.includes(audioObj)) {
                return name;
            } else if (pool === audioObj) {
                return name;
            }
        }
        return null;
    }

    // Musique (inchangé)
    playMenuMusic(mode = 'single') {
        if (!this.enabled || !this.musicEnabled) return;
        this.playPlaylist('menu', mode);
    }

    playGameMusic(mode = 'single') {
        if (!this.enabled || !this.musicEnabled) return;
        this.playPlaylist('game', mode);
    }

    playPlaylist(name, mode = 'single') {
        if (!this.enabled || !this.musicEnabled) return;
        const playlist = this.musicTracks[name];
        if (!playlist || playlist.length === 0) return;

        this.stopMusic();
        this.currentPlaylist = playlist;
        this.currentIndex = 0;
        this.musicMode = mode;
        this.startCurrentTrack();
    }

    startCurrentTrack() {
        if (!this.enabled || !this.musicEnabled || !this.currentPlaylist || this.currentPlaylist.length === 0) return;

        const track = this.currentPlaylist[this.currentIndex];
        if (!track) return;
        
        this.currentMusic = track;
        this.updateVolumes();
        track.currentTime = 0;
        track.play().catch(err => {
            console.warn('Erreur lecture musique:', err);
        });
    }

    onTrackEnded(track) {
        if (!this.enabled || !this.musicEnabled) return;
        if (!this.currentPlaylist || this.currentPlaylist.length === 0) return;

        if (this.musicMode === 'single') {
            track.currentTime = 0;
            track.play();
        } else if (this.musicMode === 'playlist') {
            this.currentIndex = (this.currentIndex + 1) % this.currentPlaylist.length;
            this.startCurrentTrack();
        }
    }

    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
        }
        this.currentMusic = null;
    }

    // Méthode de debug
    getChannelStatus() {
        const status = {};
        for (let [name, audio] of Object.entries(this.channels)) {
            status[name] = audio ? {
                sound: this.getAudioName(audio),
                playing: !audio.paused,
                time: audio.currentTime
            } : 'empty';
        }
        return status;
    }
}