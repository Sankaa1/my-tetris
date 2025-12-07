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

        // Configuration FX par défaut (avant loadSettings pour ne pas être écrasée)
        this.fxConfig = {
            lock: true,
            maxCombo: true,
            rotate: true,
            gameover: true
        };

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

        // Musiques en jeu - toutes les musiques disponibles
        const game1 = new Audio('src/audio/bgmusic.wav');
        const game2 = new Audio('src/audio/blue.mp3');
        const game3 = new Audio('src/audio/arturia-acid.wav');
        const game4 = new Audio('src/audio/doctor-dreamchip.wav');
        const game5 = new Audio('src/audio/vaporwave.wav');
        const game6 = new Audio('src/audio/xd250-full-mix.wav');
        
        this.musicTracks.game = [game1, game2, game3, game4, game5, game6];
        
        // Référence nommée pour accès facile
        this.allGameMusic = {
            'bgmusic': game1,
            'blue': game2,
            'arturia-acid': game3,
            'doctor-dreamchip': game4,
            'vaporwave': game5,
            'xd250-full-mix': game6
        };
        
        // Musique sélectionnée actuellement
        this.selectedGameMusic = 'bgmusic';
        
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
        console.log('[SoundManager.toggleMusic] enabled:', enabled, 'previous:', this.musicEnabled);
        this.musicEnabled = enabled;
        if (!enabled) {
            this.stopMusic();
        } else {
            // Activation musique: si la playlist n'est pas définie, la configurer
            if (!this.currentPlaylist || this.currentPlaylist.length === 0) {
                console.log('[SoundManager.toggleMusic] Configuration de la playlist');
                this.currentPlaylist = [this.getSelectedGameMusic()];
                this.currentIndex = 0;
            }
            if (this.currentPlaylist && this.currentPlaylist.length > 0) {
                console.log('[SoundManager.toggleMusic] Démarrage musique');
                this.startCurrentTrack();
            }
        }
        this.updateVolumes();
        this.saveSettings();
    }

    toggleFx(enabled) {
        console.log('[SoundManager.toggleFx] enabled:', enabled, 'previous:', this.fxEnabled);
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
                musicVolume: this.musicVolume,
                selectedGameMusic: this.selectedGameMusic,
                musicMode: this.musicMode,
                fxConfig: this.fxConfig
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
            if (typeof obj.selectedGameMusic === 'string') this.selectedGameMusic = obj.selectedGameMusic;
            if (typeof obj.musicMode === 'string') this.musicMode = obj.musicMode;
            if (typeof obj.fxConfig === 'object') this.fxConfig = { ...this.fxConfig, ...obj.fxConfig };
        } catch (e) {
            console.warn('Impossible de charger les réglages audio:', e);
        }
    }

    _clamp01(v) {
        return Math.max(0, Math.min(1, v));
    }

    // Sélectionner une musique de jeu
    setGameMusic(trackName) {
        if (!this.allGameMusic[trackName]) {
            console.warn(`Musique "${trackName}" introuvable`);
            return;
        }
        console.log('[SoundManager.setGameMusic] Changement vers:', trackName);
        this.selectedGameMusic = trackName;
        this.saveSettings();
    }

    // Obtenir la musique actuellement sélectionnée
    getSelectedGameMusic() {
        return this.allGameMusic[this.selectedGameMusic];
    }

    // Obtenir la liste des musiques disponibles
    getAvailableGameMusic() {
        return Object.keys(this.allGameMusic);
    }

    // Activer/désactiver un effet spécifique
    toggleFxType(fxName, enabled) {
        if (this.fxConfig.hasOwnProperty(fxName)) {
            console.log('[SoundManager.toggleFxType]', fxName, ':', enabled);
            this.fxConfig[fxName] = enabled;
            this.saveSettings();
        }
    }

    // Vérifier si un effet spécifique est activé
    isFxEnabled(fxName) {
        return this.fxConfig[fxName] !== false;
    }

    // Obtenir la configuration de tous les FX
    getFxConfig() {
        return { ...this.fxConfig };
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
        
        // Vérifier si ce FX spécifique est activé
        if (!this.isFxEnabled(soundName)) return;

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
        console.log('[SoundManager.playGameMusic] Mode:', mode, 'Music enabled:', this.musicEnabled);
        
        // Configurer la playlist indépendamment de musicEnabled
        if (mode === 'playlist') {
            // Mode playlist: toutes les musiques en boucle
            console.log('[SoundManager.playGameMusic] Configuration mode PLAYLIST');
            this.stopMusic();
            this.currentPlaylist = this.musicTracks.game;
            this.currentIndex = 0;
            this.musicMode = 'playlist';
        } else {
            // Mode single: juste la musique sélectionnée
            console.log('[SoundManager.playGameMusic] Configuration mode SINGLE avec:', this.selectedGameMusic);
            const selectedTrack = this.getSelectedGameMusic();
            if (!selectedTrack) {
                console.warn('[SoundManager.playGameMusic] Piste sélectionnée non trouvée');
                return;
            }
            
            this.stopMusic();
            this.currentPlaylist = [selectedTrack];
            this.currentIndex = 0;
            this.musicMode = 'single';
        }
        
        // Démarrer la lecture si la musique est activée
        if (this.musicEnabled) {
            console.log('[SoundManager.playGameMusic] Lancement de la musique');
            this.startCurrentTrack();
        }
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