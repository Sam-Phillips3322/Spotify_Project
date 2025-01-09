
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


    if (auth.isAuthenticated) {
        try {
            ui.showLoading();
            function loadNextCard() {
                currentSongIndex++;
                if (currentSongIndex < allSongs.length) {
                    const newCard = card.renderSong(allSongs[currentSongIndex]);
                    newCard.style.zIndex = 1;
                    document.getElementById('card-stack').appendChild(newCard);
                    initializeSwipe(newCard);
                } else {
                    console.log('No more songs to show.');
                    const cardStack = document.getElementById('card-stack');
                    if (cardStack) {
                        cardStack.innerHTML = '<p>No more songs available!</p>';
                    }
                }
            }

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

    clearAuth() {
        console.log('Clearing authentication...');
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
        this.elements.loginButton.style.display = isAuthenticated ? 'none' : 'block';
        this.elements.songContainer.style.display = isAuthenticated ? 'block' : 'none';
        this.elements.welcomeContent.style.display = isAuthenticated ? 'none' : 'block';
    },

    showLoading() {
        console.log('Showing loading spinner...');
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.style.display = 'block';
        }
    },

    hideLoading() {
        console.log('Hiding loading spinner...');
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.style.display = 'none';
        }
    }
};

// API Service
const SpotifyAPI = {
    async fetchLikedSongs(token) {
        console.log('Fetching liked songs with token:', token);
        const response = await fetch('/api/liked-songs', {
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });
        if (!response.ok) throw new Error('Failed to fetch liked songs');
        return response.json();
    },

    async likeSong(accessToken, trackId) {
        const response = await fetch(`/api/like-song/${trackId}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error('Failed to like song');
    },

    async removeLikedSong(accessToken, trackId) {
        const response = await fetch(`/api/remove-liked-song/${trackId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error('Failed to remove song');
    },
};

// Song renderer
const card = {
    renderSong(song) {
        const card = document.createElement('div');
        card.classList.add('song');
        card.dataset.trackId = song.track.id;

        card.innerHTML = `
            <img src="${song.track.album.images[0].url}" alt="${song.track.name} album cover" class="song-image">
            <div class="song-info">
                <h3 class="song-title">${song.track.name}</h3>
                <p class="song-artist">${song.track.artists.map(artist => artist.name).join(', ')}</p>
            </div>
        `;

        return card;
    },


    renderSongList(songs, container) {
        songs.slice(0, 5).forEach((song, index) => {
            const card = this.renderSong(song);
            card.style.zIndex = songs.length - index;
            container.appendChild(card);
        });
    }

};


// Swipe handling functions
function initializeSwipe(element) {
    console.log('Initializing swipe for element:', element);
    let startX;
    let currentX;

    // Mouse events for swipe
    element.addEventListener('mousedown', startSwipe);
    element.addEventListener('touchstart', startSwipe);

    // Keyboard events for swipe
    document.addEventListener('keydown', handleKeyboardSwipe);

    function startSwipe(e) {
        console.log('Swipe started');
        startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        document.addEventListener('mousemove', swipeMove);
        document.addEventListener('touchmove', swipeMove);
        document.addEventListener('mouseup', swipeEnd);
        document.addEventListener('touchend', swipeEnd);
    }

    function swipeMove(e) {
        currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const deltaX = currentX - startX;
        console.log('Swipe move. DeltaX:', deltaX);
        element.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.1}deg)`;  // Visual swipe effect
    }

    function swipeEnd() {
        console.log('Swipe ended');
        const deltaX = currentX - startX;
        if (Math.abs(deltaX) > 100) {
            if (deltaX > 0) {
                console.log('Right swipe detected');
                handleRightSwipe(element);  // Handle right swipe (skip song)
            } else {
                console.log('Left swipe detected');
                handleLeftSwipe(element);  // Handle left swipe (remove from liked)
            }
        } else {
            console.log('Swipe below threshold. Resetting position.');
            element.style.transform = '';  // Reset position if swipe is not significant
        }

        cleanup();
    }

    function cleanup() {
        console.log('Cleaning up swipe listeners...');
        document.removeEventListener('mousemove', swipeMove);
        document.removeEventListener('touchmove', swipeMove);
        document.removeEventListener('mouseup', swipeEnd);
        document.removeEventListener('touchend', swipeEnd);
    }

    async function handleLeftSwipe(card) {
        console.log('Handling left swipe for card:', card);
        const trackId = card.dataset.trackId;
        try {
            await SpotifyAPI.removeLikedSong(AuthState.accessToken, trackId);  // API call to remove liked song
            removeCard(card);  // Remove the card from UI
        } catch (error) {
            console.error('Failed to remove song:', error);
            card.style.transform = '';  // Reset transformation if error occurs
        }
    }

    function removeCard(card) {
        console.log('Removing card:', card);
        card.style.transform = 'translateX(100vw)';
        setTimeout(() => {
            card.remove();  // Remove the card from DOM
            console.log('Card removed. Loading next card...');
            loadNextCard();  // Load the next song in the playlist
        }, 300);
    }

    function loadNextCard() {
        console.log('Loading next card...');
        currentSongIndex++;
        if (currentSongIndex < allSongs.length) {
            const newCard = card.renderSong(allSongs[currentSongIndex]);  // Render the next song card
            newCard.style.zIndex = 1;
            document.getElementById('card-stack').appendChild(newCard);
            initializeSwipe(newCard);  // Initialize swipe for the new card
        } else {
            console.log('No more songs to show.');
            const cardStack = document.getElementById('card-stack');
            if (cardStack) {
                cardStack.innerHTML = '<p>No more songs available!</p>';  // Show "No more songs" message
            }
        }
    }

    // Keyboard swipe handling
    function handleKeyboardSwipe(e) {
        if (e.key === 'ArrowLeft') {
            console.log('Left arrow key pressed. Simulating left swipe.');
            handleLeftSwipe(element);
        } else if (e.key === 'ArrowRight') {
            console.log('Right arrow key pressed. Simulating right swipe.');
            handleRightSwipe(element);  // Simulate right swipe (skip song)
        }
    }
}


// 401 error handling 
async function handleApiError(error) {
    console.error('API Error encountered:', error);
    if (error.message.includes('401')) {
        console.log('401 Unauthorized error detected. Clearing AuthState...');
        AuthState.clearAuth();
        UIManager.updateUIState(false);
        alert('Session expired. Please log in again.');
        window.location.href = '/login';
    } else {
        alert('An error occurred. Please try again later.');
    }
}
