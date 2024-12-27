// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // References to DOM elements
    const loginButton = document.getElementById('login-button');
    const songContainer = document.getElementById('song-container');

    // Retrieve the access token from localStorage
    let accessToken = localStorage.getItem('accessToken');

    // Detect access token in the URL after redirection
    const params = new URLSearchParams(window.location.search);
    if (params.has('access_token')) {
        accessToken = params.get('access_token');
        localStorage.setItem('accessToken', accessToken); // Save token for future use
        console.log('Access token saved:', accessToken);

        // Clear the query string from the URL
        window.history.replaceState({}, document.title, '/');
    }

    // Show/hide elements based on login state
    if (accessToken) {
        loginButton.style.display = 'none'; // Hide login button
        fetchLikedSongs(accessToken); // Fetch liked songs
    } else {
        loginButton.style.display = 'block'; // Show login button
        songContainer.style.display = 'none'; // Hide songs section
    }

    // Login button click handler
    loginButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default action
        window.location.href = '/login'; // Redirect to Spotify login
    });

    // Function to fetch liked songs from the backend
    async function fetchLikedSongs(token) {
        try {
            const response = await fetch('/api/liked-songs', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch liked songs');
            }

            const data = await response.json();
            displaySongs(data.items); // Display songs on the page
        } catch (error) {
            console.error('Error fetching liked songs:', error.message);
        }
    }

    // Function to display the list of liked songs
    function displaySongs(songs) {
        songContainer.innerHTML = ''; // Clear any previous songs

        songs.forEach((song) => {
            const songElement = document.createElement('div');
            songElement.classList.add('song');

            const songTitle = document.createElement('h3');
            songTitle.textContent = song.track.name;

            const artist = document.createElement('p');
            artist.textContent = song.track.artists
                .map((artist) => artist.name)
                .join(', ');

            const songImage = document.createElement('img');
            songImage.src = song.track.album.images[1].url;
            songImage.alt = `${song.track.name} album cover`;

            // Add Like Button for each song
            const songLikeButton = document.createElement('button');
            songLikeButton.textContent = 'Like';
            songLikeButton.addEventListener('click', () => {
                likeSong(song.track.id); // Like the song when button is clicked
            });

            songElement.appendChild(songImage);
            songElement.appendChild(songTitle);
            songElement.appendChild(artist);
            songElement.appendChild(songLikeButton);

            songContainer.appendChild(songElement); // Add song to the container
        });

        songContainer.style.display = 'block'; // Show songs section once data is fetched
    }

    // Function to like a song
    async function likeSong(trackId) {
        try {
            const response = await fetch(`/api/like-song/${trackId}`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to like song');
            }

            alert('Song liked successfully!');
        } catch (error) {
            console.error('Error liking the song:', error.message);
        }
    }
});
