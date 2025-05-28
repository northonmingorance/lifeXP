const functions = require("firebase-functions");
const fetch = require("node-fetch");
const cors = require("cors")({ origin: true }); // Allows all origins for simplicity in dev

// --- YouTube API Functions ---

/**
 * Searches YouTube videos.
 * Expects a 'q' query parameter for the search query.
 * e.g., /youtubeSearch?q=your_search_term
 */
exports.youtubeSearch = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const query = request.query.q;
        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

        if (!YOUTUBE_API_KEY) {
            console.error("YouTube API Key not configured in Firebase Functions environment.");
            response.status(500).send({ error: "Server configuration error for YouTube API." });
            return;
        }

        if (!query) {
            response.status(400).send({ error: "Search query 'q' is required." });
            return;
        }

        const maxResults = 10;
        const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=<span class="math-inline">\{encodeURIComponent\(query\)\}&type\=video&key\=</span>{YOUTUBE_API_KEY}&maxResults=${maxResults}`;

        try {
            const apiResponse = await fetch(apiUrl);
            const data = await apiResponse.json();

            if (!apiResponse.ok) {
                console.error("YouTube API Error:", data);
                response.status(apiResponse.status).send({ 
                    error: "Error from YouTube API.", 
                    details: data.error?.message || "Unknown error" 
                });
                return;
            }
            response.status(200).send(data);
        } catch (error) {
            console.error("Error calling Youtube API:", error);
            response.status(500).send({ error: "Failed to fetch data from YouTube." });
        }
    });
});

/**
 * Fetches details for a specific YouTube video.
 * Expects a 'videoId' query parameter.
 * e.g., /youtubeVideoDetails?videoId=your_video_id
 */
exports.youtubeVideoDetails = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        const videoId = request.query.videoId;
        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

        if (!YOUTUBE_API_KEY) {
            console.error("YouTube API Key not configured in Firebase Functions environment.");
            response.status(500).send({ error: "Server configuration error for YouTube API." });
            return;
        }

        if (!videoId) {
            response.status(400).send({ error: "Query parameter 'videoId' is required." });
            return;
        }

        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=<span class="math-inline">\{videoId\}&key\=</span>{YOUTUBE_API_KEY}`;

        try {
            const apiResponse = await fetch(apiUrl);
            const data = await apiResponse.json();

            if (!apiResponse.ok) {
                console.error("YouTube API Error (Video Details):", data);
                response.status(apiResponse.status).send({ 
                    error: "Error from YouTube API.", 
                    details: data.error?.message || "Unknown error"
                });
                return;
            }
            response.status(200).send(data);
        } catch (error) {
            console.error("Error calling YouTube Videos API:", error);
            response.status(500).send({ error: "Failed to fetch video details from YouTube." });
        }
    });
});


// --- Gemini API Function ---

/**
 * Sends a prompt to the Gemini API.
 * Expects a JSON body with a 'prompt' field.
 * e.g., POST to /geminiChat with { "prompt": "Hello Gemini!" }
 */
exports.geminiChat = functions.https.onRequest((request, response) => {
    cors(request, response, async () => {
        if (request.method !== "POST") {
            response.status(405).send({ error: "Method Not Allowed. Please use POST."});
            return;
        }

        const userPrompt = request.body.prompt;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        // Use a stable or your preferred Gemini model
        const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20"; 

        if (!GEMINI_API_KEY) {
            console.error("Gemini API Key not configured in Firebase Functions environment.");
            response.status(500).send({ error: "Server configuration error for Gemini API." });
            return;
        }

        if (!userPrompt) {
            response.status(400).send({ error: "Request body must include a 'prompt' field." });
            return;
        }

        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/<span class="math-inline">\{GEMINI\_MODEL\}\:generateContent?key\=</span>{GEMINI_API_KEY}`;
        const requestBody = {
            contents: [{ parts: [{ text: userPrompt }] }],
            // Optional: Add safetySettings or generationConfig if needed
            // safetySettings: [
            //   { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            //   // ... other categories
            // ],
            // generationConfig: {
            //   temperature: 0.7,
            //   maxOutputTokens: 1000,
            // }
        };

        try {
            const apiResponse = await fetch(geminiApiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });
            const data = await apiResponse.json();

            if (!apiResponse.ok) {
                console.error("Gemini API Error:", data);
                response.status(apiResponse.status).send({ 
                    error: "Error from Gemini API.", 
                    details: data.error?.message || (data.promptFeedback ? `Blocked: ${data.promptFeedback.blockReason}` : "Unknown error")
                });
                return;
            }

            let textOutput = "No content found in Gemini response.";
            if (data.candidates && data.candidates.length > 0 &&
                data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                textOutput = data.candidates[0].content.parts[0].text;
            } else if (data.promptFeedback && data.promptFeedback.blockReason) {
                textOutput = `Blocked: ${data.promptFeedback.blockReason}. ${data.promptFeedback.blockReasonMessage || ''}`;
                // It might be better to send a different status code for blocked content
                response.status(403).send({ geminiResponse: textOutput, isError: true, blocked: true });
                return;
            }
            response.status(200).send({ geminiResponse: textOutput });

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            response.status(500).send({ error: "Failed to fetch data from Gemini." });
        }
    });
});