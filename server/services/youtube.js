import { google } from "googleapis";
import { HttpError } from "../validation/request.js";

export function createYoutubeService({
  youtube = google.youtube("v3"),
  getApiKey = () => process.env.YOUTUBE_API_KEY,
  now = Date.now,
} = {}) {
  const cache = new Map();

  async function cached(key, lifetime, fetchValue) {
    const entry = cache.get(key);
    if (entry && entry.expires > now()) return entry.value;
    const value = await fetchValue();
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: now() + lifetime });
    return value;
  }

  async function request(resource, params) {
    const apiKey = getApiKey();
    if (!apiKey)
      throw new HttpError(
        503,
        "YouTube search is not configured. Please try again later.",
      );
    try {
      const response = await resource.list(
        { auth: apiKey, ...params },
        { timeout: 10000 },
      );
      return response.data;
    } catch (error) {
      const status = Number(error.response?.status || error.code);
      if (status === 403 || status === 429) {
        throw new HttpError(
          503,
          "YouTube is temporarily unavailable or its request limit has been reached. Please try again later.",
        );
      }
      if (status === 404)
        throw new HttpError(404, "This YouTube channel is unavailable.");
      throw new HttpError(
        502,
        "Could not load information from YouTube. Please try again.",
      );
    }
  }

  return {
    search(query, pageToken) {
      return cached(
        JSON.stringify(["search", query, pageToken]),
        60000,
        async () => {
          const data = await request(youtube.search, {
            part: "snippet",
            q: query,
            type: "channel",
            maxResults: 10,
            ...(pageToken ? { pageToken } : {}),
          });
          return { items: data.items || [], nextPageToken: data.nextPageToken };
        },
      );
    },

    videos(channelId, pageToken) {
      return cached(
        JSON.stringify(["videos", channelId, pageToken]),
        30000,
        async () => {
          const playlistId = await cached(
            JSON.stringify(["uploads", channelId]),
            3600000,
            async () => {
              const channel = await request(youtube.channels, {
                id: channelId,
                part: "contentDetails",
                maxResults: 1,
              });
              const playlistId =
                channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
              if (!playlistId)
                throw new HttpError(
                  404,
                  "This YouTube channel has no available uploads.",
                );
              return playlistId;
            },
          );
          const data = await request(youtube.playlistItems, {
            playlistId,
            part: "snippet,contentDetails",
            maxResults: 10,
            ...(pageToken ? { pageToken } : {}),
          });
          return { items: data.items || [], nextPageToken: data.nextPageToken };
        },
      );
    },
  };
}
