// This file handles user interactions, including login, fetching liked songs, and liking songs.

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // The login button (for user to log in)
    const loginButton = document.getElementById('login-button');
    const songContainer = document.getElementById('song-container');

    // Check if the user is logged in by checking for an access token (could be passed via a session or cookie)
    let accessToken = localStorage.getItem('accessToken');

    // If not logged in, show the login button
    if (!accessToken) {
        loginButton.style.display = 'block';
        songContainer.style.display = 'none'; // Hide songs section
    } else {
        loginButton.style.display = 'none'; // Hide login button after user is authenticated
        fetchLikedSongs(accessToken); // Fetch liked songs if the user is logged in
    }

    // Login button click handler
    document.getElementById('login-button').addEventListener('click', () => {
        event.preventDefault(); // Prevents default form submit or page reload
        window.location.href = '/login'; // Redirects to the /login route on the backend
    });


    // Detect the access token in the url after the redirect
    document.addEventListener('DOMContentLoaded', () => {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('access_token');

        if (accessToken) {
            console.log('Authenticated with token:', accessToken);
            document.querySelector('#login-button').style.display = 'none'; // Hide login button
            document.querySelector('#song-container').style.display = 'block'; // Show songs section

            // Fetch and display liked songs here using the accessToken
        } else {
            document.querySelector('#login-button').style.display = 'block'; // Show login button
            document.querySelector('#song-container').style.display = 'none'; // Hide songs section
        }
    });



    // Function to fetch liked songs from the backend API
    async function fetchLikedSongs(token) {
        try {
            // Make a request to the backend to get liked songs using the access token
            const response = await fetch('/api/liked-songs', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
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

    // Function to display the list of liked songs on the page
    function displaySongs(songs) {
        songContainer.innerHTML = ''; // Clear any previous songs

        songs.forEach(song => {
            const songElement = document.createElement('div');
            songElement.classList.add('song');

            const songTitle = document.createElement('h3');
            songTitle.textContent = song.track.name;

            const artist = document.createElement('p');
            artist.textContent = song.track.artists.map(artist => artist.name).join(', ');

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
            // Make a request to like a song by passing its track ID to the backend API
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
