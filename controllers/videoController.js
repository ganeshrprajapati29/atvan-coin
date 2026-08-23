const https = require('https');
const { YOUTUBE_CHANNEL_ID, YOUTUBE_CHANNEL_URL } = require('../config/env');

const DEFAULT_CHANNEL_ID = YOUTUBE_CHANNEL_ID || '';
const DEFAULT_CHANNEL_URL = YOUTUBE_CHANNEL_URL || '';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 10000 }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`YouTube feed returned ${response.statusCode}`));
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => resolve(body));
    });

    request.on('timeout', () => {
      request.destroy(new Error('YouTube feed request timed out'));
    });
    request.on('error', reject);
  });
}

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function readTag(entry, tag) {
  const escaped = tag.replace(':', '\\:');
  const match = entry.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return decodeXml(match?.[1] || '');
}

function inferCategory(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('#short') || text.includes('shorts') || text.includes('/shorts/')) {
    return 'shorts';
  }
  return 'full';
}

function videoIdFromUrl(url) {
  const parsed = url.match(/[?&]v=([^&]+)/i) || url.match(/youtu\.be\/([^?&/]+)/i);
  return parsed?.[1] || '';
}

function parseFeed(xml) {
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  return entries.map((entry) => {
    const title = readTag(entry, 'title');
    const description = readTag(entry, 'media:description');
    const publishedAt = readTag(entry, 'published');
    const videoId = readTag(entry, 'yt:videoId') || videoIdFromUrl(readTag(entry, 'link'));
    const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
    const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

    return {
      id: videoId,
      title,
      description,
      category: inferCategory(title, description),
      publishedAt,
      thumbnail,
      url
    };
  }).filter((video) => video.id && video.title);
}

function buildFeedUrl(req) {
  const channelId = req.query.channelId || DEFAULT_CHANNEL_ID;
  if (channelId) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  }
  if (DEFAULT_CHANNEL_URL) {
    return DEFAULT_CHANNEL_URL;
  }
  return '';
}

const getVideos = async (req, res) => {
  try {
    const feedUrl = buildFeedUrl(req);
    if (!feedUrl) {
      return res.json({
        channelConfigured: false,
        categories: ['all', 'shorts', 'full'],
        videos: []
      });
    }

    const category = `${req.query.category || 'all'}`.toLowerCase();
    const xml = await fetchText(feedUrl);
    let videos = parseFeed(xml);

    if (category === 'shorts' || category === 'full') {
      videos = videos.filter((video) => video.category === category);
    }

    res.json({
      channelConfigured: true,
      categories: ['all', 'shorts', 'full'],
      videos
    });
  } catch (error) {
    console.error('YouTube videos error:', error.message);
    res.status(500).json({ message: 'Failed to load ATVAN videos' });
  }
};

module.exports = {
  getVideos
};
