import https from 'https';
import http from 'http';

const MAX_CONTENT_LENGTH = 8000;

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const trimmed = url.length > 1500 ? url.substring(0, 1500) : url;

    const req = protocol.get(trimmed, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const html = stripHtml(buffer.toString('utf8').substring(0, MAX_CONTENT_LENGTH * 2));
          resolve(html.substring(0, MAX_CONTENT_LENGTH));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.on('error', reject);
  });
}

export async function fetchUrls(urls, concurrency = 3) {
  const results = {};
  const queue = [...urls];
  const running = [];

  while (queue.length > 0 || running.length > 0) {
    while (running.length < concurrency && queue.length > 0) {
      const url = queue.shift();
      const p = fetchUrl(url)
        .then(content => { results[url] = content; })
        .catch(() => { results[url] = ''; })
        .finally(() => {
          const idx = running.indexOf(p);
          if (idx > -1) running.splice(idx, 1);
        });
      running.push(p);
    }

    if (running.length > 0) {
      await Promise.race(running);
    }
  }

  return results;
}

export async function fetchUrlText(url) {
  try {
    return await fetchUrl(url);
  } catch (e) {
    return '';
  }
}
