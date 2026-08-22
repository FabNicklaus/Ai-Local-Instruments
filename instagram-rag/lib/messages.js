import fs from 'fs';
import path from 'path';

const MESSAGES_PATH = 'ig_export/extracted/your_instagram_activity/messages/inbox';

/**
 * Parse all message conversations and extract data
 */
export function parseMessages() {
  if (!fs.existsSync(MESSAGES_PATH)) {
    console.log('Messages path not found:', MESSAGES_PATH);
    return [];
  }

  const folders = fs.readdirSync(MESSAGES_PATH);
  const allMessages = [];

  for (const folder of folders) {
    const messageFile = path.join(MESSAGES_PATH, folder, 'message_1.json');
    if (!fs.existsSync(messageFile)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(messageFile, 'utf8'));
      const participants = data.participants?.map(p => p.name) || [];

      // Find the other participant (not Fabio)
      const otherParticipant = participants.find(p => p !== 'Fabio') || participants[0];

      for (const msg of data.messages || []) {
        if (!msg.content && !msg.share?.link) continue;

        allMessages.push({
          conversation: otherParticipant,
          author: normalizeAuthor(otherParticipant),
          sender: msg.sender_name,
          content: msg.content || '',
          link: msg.share?.link || '',
          shareText: msg.share?.share_text || '',
          timestamp: msg.timestamp_ms ? new Date(msg.timestamp_ms).toISOString() : null,
          magicWords: data.magic_words || []
        });
      }
    } catch (e) {
      // Skip invalid files
    }
  }

  return allMessages;
}

/**
 * Normalize author name for matching with post authors
 */
export function normalizeAuthor(name) {
  if (!name) return null;
  return name.toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Get messages for a specific author
 */
export function getMessagesByAuthor(author, allMessages) {
  if (!author) return [];
  const normalized = normalizeAuthor(author);
  return allMessages.filter(m => normalizeAuthor(m.conversation) === normalized);
}

/**
 * Search messages for a query
 */
export function searchMessages(query, allMessages, limit = 10) {
  if (!query || !query.trim()) return allMessages.slice(0, limit);

  const q = query.toLowerCase();
  const results = allMessages.filter(m =>
    m.content.toLowerCase().includes(q) ||
    m.shareText.toLowerCase().includes(q) ||
    m.conversation.toLowerCase().includes(q)
  );

  return results.slice(0, limit);
}

/**
 * Link messages to posts by author and return enriched context
 */
export function linkMessagesToPosts(posts, allMessages) {
  // Group messages by normalized author
  const messagesByAuthor = new Map();
  for (const msg of allMessages) {
    const key = normalizeAuthor(msg.conversation);
    if (!messagesByAuthor.has(key)) {
      messagesByAuthor.set(key, []);
    }
    messagesByAuthor.get(key).push(msg);
  }

  // For each post, find related messages
  return posts.map(post => {
    const authorKey = normalizeAuthor(post.author);
    const relatedMessages = messagesByAuthor.get(authorKey) || [];
    return {
      ...post,
      messages: relatedMessages.slice(0, 5) // Limit to 5 most recent
    };
  });
}

// CLI test
if (import.meta.url === `file://${process.argv[1]}`) {
  const messages = parseMessages();
  console.log(`Parsed ${messages.length} messages from ${new Set(messages.map(m => m.conversation)).size} conversations`);

  // Show messages with links (likely the "magic words" triggered responses)
  const withLinks = messages.filter(m => m.link);
  console.log(`\n${withLinks.length} messages contain shared links`);

  withLinks.slice(0, 5).forEach(m => {
    console.log(`\n[${m.conversation}] ${m.timestamp}`);
    console.log(`  Link: ${m.link}`);
    if (m.content) console.log(`  Text: ${m.content.substring(0, 100)}`);
  });

  // Test author matching
  console.log('\n--- Testing author matching ---');
  const createDanielMsgs = messages.filter(m => normalizeAuthor(m.conversation) === 'create_daniel2');
  console.log(`create_daniel2 has ${createDanielMsgs.length} messages`);
}
