// AuthState Management
const AuthState = {
    isAuthenticated: false,
    accessToken: null,

    init() {
        console.log('Initializing AuthState...');
        this.accessToken = localStorage.getItem('accessToken');
        this.isAuthenticated = !!this.accessToken;
        console.log('AuthState initialized:', {
            accessToken: this.accessToken,
            isAuthenticated: this.isAuthenticated,
        });
        return this;
    },

    setAuth(token) {
        console.log('Setting authentication token:', token);
        this.accessToken = token;
        this.isAuthenticated = true;
        localStorage.setItem('accessToken', token);
    },

    setRefreshToken(token) {
        localStorage.setItem('refreshToken', token);
    },

    getRefreshToken() {
        return localStorage.getItem('refreshToken');
    },

    clearAuth() {
        console.log('Clearing authentication...');
        this.accessToken = null;
        this.isAuthenticated = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    }
};

// UI State management
const UIManager = {
    elements: {
        loginButton: null,
        songContainer: null,
        loadingSpinner: null,
        welcomeContent: null
    },

    init() {
        console.log('Initializing UIManager...');
        this.elements.loginButton = document.getElementById('login-button');
        this.elements.songContainer = document.getElementById('song-container');
        this.elements.loadingSpinner = document.getElementById('loading-spinner');
        this.elements.welcomeContent = document.getElementById('welcome-content');
        console.log('UIManager elements initialized:', this.elements);
        return this;
    },

    updateUIState(isAuthenticated) {
        console.log('Updating UI state. isAuthenticated:', isAuthenticated);
        this.elements.loginButton.classList.toggle('hidden', isAuthenticated);
        this.elements.songContainer.classList.toggle('hidden', !isAuthenticated);
        this.elements.welcomeContent.classList.toggle('hidden', isAuthenticated);
    },

    showLoading() {
        console.log('Showing loading spinner...');
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.classList.remove('hidden');
        }
    },

    hideLoading() {
        console.log('Hiding loading spinner...');
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.classList.add('hidden');
        }
    }
};

// API Service
const SpotifyAPI = {
    async fetchLikedSongs(token, offset = 0, limit = 20) {
        console.log(`Fetching liked songs with token and offset: ${offset}, limit ${limit}`, token);
        const response = await fetch(`/api/liked-songs?offset=${offset}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });
        if (!response.ok) throw new Error('Failed to fetch liked songs');
        return response.json();
    },

    async removeLikedSong(accessToken, trackId) {
        const response = await fetch(`/api/remove-liked-song/${trackId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error('Failed to remove song');
        return response.json();
    }
};

class SwipeManager {
    constructor(cardStackElement, initialSongs, onEmpty) {
        this.cardStack = cardStackElement;
        this.onEmpty = () => {
            const template = document.getElementById('no-more-songs-template');

            this.cardStack.innerHTML = '';

            this.cardStack.appendChild(template.content.cloneNode(true));

            if (onEmpty) onEmpty();
        };
        this.processedSongs = new Set();
        this.availableSongs = [...initialSongs.items];
        this.isLoading = false;

        this.currentOffset = 20;
        this.totalSongs = initialSongs.total;
        this.minimumSongsThreshold = 5;
        this.batchSize = 20;

        this.loadingScreen = this.cardStack.querySelector('#loading-screen')

        this.initializeCards();
        this.setupKeyboardControls();
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            const currentCard = this.getCurrentCard();
            if (!currentCard) return;

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.animateAndHandleSwipe(currentCard, 'left');
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.animateAndHandleSwipe(currentCard, 'right');
                    break;
                case 'Escape':
                    if (currentCard.style.transform) {
                        currentCard.style.transform = '';
                        currentCard.classList.remove('swiping-left', 'swiping-right');
                    }
                    break;
            }
        });
    }

    updateLoadingProgress() {
        const processedCount = this.loadingScreen.querySelector('.processed-count');
        const totalCount = this.loadingScreen.querySelector('.total-count');
        if (processedCount && totalCount) {
            processedCount.textContent = this.processedSongs.size;
            totalCount.textContent = this.totalSongs;
        }
    }

    showLoadingScreen() {
        this.loadingScreen.classList.remove('hidden');
        this.updateLoadingProgress();
    }

    hideLoadingScreen() {
        this.loadingScreen.classList.add('hidden');
    }

    async loadMoreSongs() {
        if (this.isLoading) return;

        if (this.currentOffset >= this.totalSongs) return;

        try {
            this.isLoading = true;
            this.showLoadingScreen();
            const response = await SpotifyAPI.fetchLikedSongs(
                AuthState.accessToken,
                this.currentOffset,
                this.batchSize
            );

            this.availableSongs.push(...response.items);
            this.currentOffset += response.items.length;

            console.log(`Loaded more songs. Total available: ${this.availableSongs.length}`);
        } catch (error) {
            console.error('Error loading more songs:', error);
        } finally {
            this.isLoading = false;
            this.hideLoadingScreen();
        }
    }

    async checkAndLoadMoreSongs() {
        if (this.availableSongs.length <= this.minimumSongsThreshold &&
            this.currentOffset < this.totalSongs) {
            await this.loadMoreSongs();
        }
    }

    getCurrentCard() {
        const cards = this.cardStack.querySelectorAll('.song-card');
        if (cards.length === 0) return null;
        return Array.from(cards).reduce((highest, current) => {
            const currentZ = parseInt(current.style.zIndex) || 0;
            const highestZ = parseInt(highest.style.zIndex) || 0;
            return currentZ > highestZ ? current : highest;
        });
    }

    initializeCards() {
        this.cardStack.innerHTML = '';
        const initialCards = this.availableSongs.slice(0, 3);
        initialCards.forEach((song, index) => {
            const card = this.createCard(song);
            card.style.zIndex = initialCards.length - index;
            this.cardStack.appendChild(card);
            this.initializeSwipe(card);
        });
    }

    createCard(song) {
        const template = document.getElementById('song-card-template');
        const card = template.content.cloneNode(true).querySelector('.song-card');

        card.dataset.trackId = song.track.id;
        card.setAttribute('aria-label', `${song.track.name} by ${song.track.artists.map(artist => artist.name).join(', ')}. Use arrow keys to navigate.`);

        const image = card.querySelector('.song-image');
        image.src = song.track.album.images[0].url;
        image.alt = `${song.track.name} album cover`;

        card.querySelector('.song-title').textContent = song.track.name;
        card.querySelector('.song-artist').textContent = song.track.artists.map(artist => artist.name).join(', ');
        card.querySelector('.song-album').textContent = song.track.album.name;

        return card;
    }

    initializeSwipe(element) {
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;
        let isDragging = false;
        let initialRotation = 0;

        const handleStart = (e) => {
            if (e.type === 'touchstart') e.preventDefault();
            isDragging = true;
            startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
            startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
            element.style.transition = 'none';

            const transform = element.style.transform;
            initialRotation = transform ? parseFloat(transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0) : 0;
        };

        const handleMove = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
            currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;

            const deltaX = currentX - startX;
            const deltaY = currentY - startY;
            const rotation = initialRotation + (deltaX * 0.1);

            element.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;
            this.updateSwipeIndicators(element, deltaX);
        };

        const handleEnd = async () => {
            if (!isDragging) return;
            isDragging = false;

            const deltaX = currentX - startX;
            element.style.transition = 'transform 0.3s ease-out';

            if (Math.abs(deltaX) > 100) {
                const swipeDirection = deltaX > 0 ? 'right' : 'left';
                await this.animateAndHandleSwipe(element, swipeDirection);
            } else {
                element.style.transform = '';
            }

            element.classList.remove('swiping-left', 'swiping-right');
        };

        element.addEventListener('mousedown', handleStart);
        element.addEventListener('touchstart', handleStart, { passive: false });
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchend', handleEnd);
    }

    updateSwipeIndicators(element, deltaX) {
        const opacity = Math.min(Math.abs(deltaX) / 100, 1);

        if (deltaX > 50) {
            element.classList.add('swiping-right');
            element.classList.remove('swiping-left');
            element.querySelector('.swipe-right').style.opacity = opacity;
        } else if (deltaX < -50) {
            element.classList.add('swiping-left');
            element.classList.remove('swiping-right');
            element.querySelector('.swipe-left').style.opacity = opacity;
        } else {
            element.classList.remove('swiping-left', 'swiping-right');
            element.querySelectorAll('.swipe-left, .swipe-right')
                .forEach(el => el.style.opacity = 0);
        }
    }

    async animateAndHandleSwipe(card, direction) {
        const swipeOutDistance = direction === 'right' ? window.innerWidth : -window.innerWidth;
        card.classList.add(`swiping-${direction}`);
        card.style.transition = 'transform 0.3s ease-out';
        card.style.transform = `translateX(${swipeOutDistance}px) rotate(${direction === 'right' ? 30 : -30}deg)`;

        try {
            const trackId = card.dataset.trackId;
            this.processedSongs.add(trackId);
            if (direction === 'left') {
                await SpotifyAPI.removeLikedSong(AuthState.accessToken, trackId);
            }

            this.availableSongs = this.availableSongs.filter(song => song.track.id !== trackId);

            await this.checkAndLoadMoreSongs();

            setTimeout(() => {
                card.remove();
                this.loadNextCard();
            }, 300);
        } catch (error) {
            console.error('Swipe action failed:', error);
            card.style.transform = '';
            card.classList.remove(`swiping-${direction}`);
            alert('Action failed. Please try again.');
        }
    }

    loadNextCard() {
        if (this.availableSongs.length === 0) {
            if (this.currentOffset >= this.totalSongs) {
                if (this.onEmpty) this.onEmpty();
                return;
            }
            this.loadMoreSongs().then(() => {
                if (this.availableSongs.length > 0) {
                    this.hideLoadingScreen();
                    this.createAndAddCard();
                } else if (this.onEmpty) {
                    this.onEmpty();
                }
            });
            return;
        }

        this.createAndAddCard();
    }

    createAndAddCard() {
        const nextSong = this.availableSongs[0];
        if (!nextSong) return;

        const newCard = this.createCard(nextSong);
        newCard.style.zIndex = 1;
        this.cardStack.appendChild(newCard);
        this.initializeSwipe(newCard);

        Array.from(this.cardStack.children).forEach((card, index, array) => {
            card.style.zIndex = array.length - index;
        });
    }
}

// Function to refresh the access token
async function refreshAccessToken() {
    const refreshToken = AuthState.getRefreshToken();
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
        throw new Error('Failed to refresh access token');
    }

    const data = await response.json();
    AuthState.setAuth(data.accessToken);
    return data.accessToken;
}

// 401 Error Handling with Token Refresh
async function handleApiError(error) {
    console.error('API Error encountered:', error);

    if (error.message.includes('401')) {
        console.log('401 Unauthorized error detected. Attempting token refresh...');
        try {
            const newAccessToken = await refreshAccessToken();
            alert('Session refreshed. Please try again.');
            return newAccessToken;
        } catch (refreshError) {
            console.error('Token refresh failed:', refreshError.message);
            alert('Session expired. Please log in again.');
            AuthState.clearAuth();
            UIManager.updateUIState(false);
            window.location.href = '/login';
        }
    } else {
        alert('An error occurred. Please try again later.');
    }
}

// Main app initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded and parsed.');
    const auth = AuthState.init();
    const ui = UIManager.init();

    const params = new URLSearchParams(window.location.search);
    if (params.has('access_token')) {
        const newToken = params.get('access_token');
        console.log('Access token found in URL. Setting auth token...');
        auth.setAuth(newToken);
        window.history.replaceState({}, document.title, '/');
    }

    console.log('Updating UI state...');
    ui.updateUIState(auth.isAuthenticated);

    ui.elements.loginButton.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = '/login';
    });

    if (auth.isAuthenticated) {
        try {
            ui.showLoading();
            // Fetch the songs first
            const response = await SpotifyAPI.fetchLikedSongs(auth.accessToken, 0, 20);
            const cardStack = document.getElementById('card-stack');

            if (!cardStack) {
                throw new error('Card stack container not found');
            }

            new SwipeManager(
                cardStack,
                response,
                () => {
                    console.log('All songs processed');
                }
            );
        } catch (error) {
            console.error('Error loading songs:', error);
            await handleApiError(error);
        } finally {
            ui.hideLoading();
        }
    }
})