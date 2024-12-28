// State management for authentication
const AuthState = {
    isAuthenticated: false,
    accessToken: null,

    init() {
        this.accessToken = localStorage.getItem('accessToken');
        this.isAuthenticated = !!this.accessToken;
        return this;
    },

    setAuth(token) {
        this.accessToken = token;
        this.isAuthenticated = true;
        localStorage.setItem('accessToken', token);
    },

    clearAuth() {
        this.accessToken = null;
        this.isAuthenticated = false;
        localStorage.removeItem('accessToken');
    }
};

// UI State management
const UIManager = {
    elements: {
        loginButton: null,
        songContainer: null,
        loadingSpinner: null
        welcomeContent: null
    },

    init() {
        this.elements.loginButton = document.getElementById('login-button');
        this.elements.songContainer = document.getElementById('song-container');
        this.elements.loadingSpinner = document.getElementById('loading-spinner');
        this.elements.welcomeContent = document.getElementById('welcome-content');
        return this;
    },

    updateUIState(isAuthenticated) {
        this.elements.loginButton.style.display = isAuthenticated ? 'none' : 'block';
        this.elements.songContainer.style.display = isAuthenticated ? 'block' : 'none';
        this.elements.welcomeContent.style.display = isAuthenticated ? 'none' : 'block';
    },

    showLoading() {
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.style.display = 'block';
        }
    },

    hideLoading() {
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.style.display = 'none';
        }
    }
};

// API Service
const SpotifyAPI = {
    async fetchLikedSongs(token) {
        try {
            const response = await fetch('/api/liked-songs', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.items;
        } catch (error) {
            console.error('Error fetching liked songs:', error);
            throw error;
        }
    },

    async likeSong(trackId, token) {
        try {
            const response = await fetch(`/api/like-song/${trackId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error liking song:', error);
            throw error;
        }
    }
};

// Song renderer
const SongRenderer = {
    renderSong(song) {
        const songElement = document.createElement('div');
        songElement.classList.add('song');

        songElement.innerHTML = `
            <img src="${song.track.album.images[1].url}" alt="${song.track.name} album cover" class="song-image">
            <div class="song-info">
                <h3 class="song-title">${song.track.name}</h3>
                <p class="song-artist">${song.track.artists.map(artist => artist.name).join(', ')}</p>
                <button class="like-button" data-track-id="${song.track.id}">Like</button>
            </div>
        `;

        return songElement;
    },

    renderSongList(songs, container) {
        container.innerHTML = '';
        songs.forEach(song => {
            const songElement = this.renderSong(song);
            container.appendChild(songElement);
        });
    }
};

// Main app initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize state managers
    const auth = AuthState.init();
    const ui = UIManager.init();

    // Check for access token in URL
    const params = new URLSearchParams(window.location.search);
    if (params.has('access_token')) {
        const newToken = params.get('access_token');
        auth.setAuth(newToken);
        window.history.replaceState({}, document.title, '/');
    }

    // Update UI based on authentication state
    ui.updateUIState(auth.isAuthenticated);

    // Setup event listeners
    ui.elements.loginButton.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = '/login';
    });

    ui.elements.songContainer.addEventListener('click', async (event) => {
        if (event.target.classList.contains('like-button')) {
            const trackId = event.target.dataset.trackId;
            try {
                await SpotifyAPI.likeSong(trackId, auth.accessToken);
                event.target.textContent = 'Liked!';
                event.target.disabled = true;
            } catch (error) {
                alert('Failed to like song. Please try again.');
            }
        }
    });

    // Fetch and display songs if authenticated
    if (auth.isAuthenticated) {
        try {
            ui.showLoading();
            const songs = await SpotifyAPI.fetchLikedSongs(auth.accessToken);
            SongRenderer.renderSongList(songs, ui.elements.songContainer);
        } catch (error) {
            if (error.message.includes('401')) {
                auth.clearAuth();
                ui.updateUIState(false);
                alert('Session expired. Please log in again.');
            } else {
                alert('Failed to load songs. Please try again.');
            }
        } finally {
            ui.hideLoading();
        }
    }
});