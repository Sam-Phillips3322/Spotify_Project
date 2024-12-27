const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (HTML, CSS, JS) from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Spotify API credentials from the .env file
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = 'http://localhost:3000/callback'; // Your redirect URI

let accessToken = ''; // Store the access token

// Spotify authentication endpoint
app.get('/login', (req, res) => {
    const authUrl = `https://accounts.spotify.com/authorize?${querystring.stringify({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'user-library-read user-library-modify', // Permissions to read and modify liked songs
    })}`;
    console.log("Redirecting to Spotify auth URL:", authUrl); // Debugging log
    res.redirect(authUrl);
});

// Spotify callback endpoint (to handle the authorization code)
app.get('/callback', async (req, res) => {
    const code = req.query.code; // Get the code from the callback URL
    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
            }),
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        const accessToken = response.data.access_token;
        // Redirect user back to the frontend with access_token in the query
        res.redirect(`/?access_token=${accessToken}`);
    } catch (error) {
        console.error('Error exchanging code for access token:', error.message);
        res.send('Authentication failed.');
    }
});

// Endpoint to fetch liked songs
app.get('/api/liked-songs', async (req, res) => {
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/tracks', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        res.json(response.data); // Return liked songs to the frontend
    } catch (error) {
        console.error('Error fetching liked songs:', error.message);
        res.status(500).send('Failed to fetch liked songs.');
    }
});

// Endpoint to save a song to liked songs
app.post('/api/like-song/:id', async (req, res) => {
    const trackId = req.params.id; // Song ID from the request
    try {
        await axios.put(
            `https://api.spotify.com/v1/me/tracks?ids=${trackId}`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );
        res.send('Song liked successfully!');
    } catch (error) {
        console.error('Error liking the song:', error.message);
        res.status(500).send('Failed to like the song.');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
