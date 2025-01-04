const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const dotenv = require('dotenv');
const path = require('path');

// Middleware for handling async errors
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Configuration and setup
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Spotify API configuration
const SPOTIFY_CONFIG = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/callback',
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    apiUrl: 'https://api.spotify.com/v1'
};

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal server error',
            status: err.status || 500
        }
    });
});

// Spotify API service
const SpotifyService = {
    getAuthUrl() {
        return `${SPOTIFY_CONFIG.authUrl}?${querystring.stringify({
            client_id: SPOTIFY_CONFIG.clientId,
            response_type: 'code',
            redirect_uri: SPOTIFY_CONFIG.redirectUri,
            scope: 'user-library-read user-library-modify',
            show_dialog: true
        })}`;
    },

    async getAccessToken(code) {
        const response = await axios.post(
            SPOTIFY_CONFIG.tokenUrl,
            querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: SPOTIFY_CONFIG.redirectUri,
            }),
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(
                        `${SPOTIFY_CONFIG.clientId}:${SPOTIFY_CONFIG.clientSecret}`
                    ).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        return response.data;
    },

    async getNewAccessToken(refreshToken) {
        const response = await axios.post(
            SPOTIFY_CONFIG.tokenUrl,
            querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(
                        `${SPOTIFY_CONFIG.clientId}:${SPOTIFY_CONFIG.clientSecret}`
                    ).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        return response.data.access_token;
    },


    async getLikedSongs(accessToken, limit = 20, offset = 0) {
        const response = await axios.get(
            `${SPOTIFY_CONFIG.apiUrl}/me/tracks`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { limit, offset }
            }
        );
        return response.data;
    },

    async likeSong(accessToken, trackId) {
        await axios.put(
            `${SPOTIFY_CONFIG.apiUrl}/me/tracks`,
            { ids: [trackId] },
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );
    },

    async removeFromLiked(trackId, token) {
        try {
            const response = await axios.delete(
                `${SPOTIFY_CONFIG.apiUrl}/me/tracks`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    data: { ids: [trackId] },
                }
            );

            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('Error removing liked song:', error.response.data);
            } else {
                console.error('Error removing liked song:', error.message);
            }

            throw error;
        }
    }

}


// Routes
app.get('/login', (req, res) => {
    const authUrl = SpotifyService.getAuthUrl();
    console.log('Redirecting to Spotify auth URL:', authUrl);
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;

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

        console.log('Token received:', response.data.access_token);

        const accessToken = response.data.access_token;
        res.redirect(`/?access_token=${accessToken}`);
    } catch (error) {
        console.error('Error in callback:', error.response?.data || error.message);
        res.status(500).send('Authentication failed');
    }
});

app.get('/api/liked-songs', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.split(' ')[1];

        const response = await axios.get('https://api.spotify.com/v1/me/tracks', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching liked songs:', error.message);

        if (error.response && error.response.status === 401) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch liked songs',
            details: error.message
        });
    }
});

app.post('/api/like-song/:id', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'No authorization header' });
        return;
    }

    const token = authHeader.split(' ')[1];
    const trackId = req.params.id;

    await SpotifyService.likeSong(token, trackId);
    res.json({ message: 'Song liked successfully' });
}));

app.delete('/remove-liked-song/:trackId', asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.split(' ')[1];
    const trackId = req.params.trackId;

    await SpotifyService.removeFromLiked(trackId, token);
    res.json({ message: 'Song removed successfully' });
}));



// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export for testing
module.exports = app;