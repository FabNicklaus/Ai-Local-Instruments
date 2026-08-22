import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = 'data/instagram_rag.db';

let db = null;

export async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT NOT NULL,
      post_id TEXT UNIQUE,
      caption TEXT,
      media_url TEXT,
      hashtags TEXT,
      like_count INTEGER,
      comment_count INTEGER,
      timestamp TEXT,
      url_contents TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_collection ON posts(collection)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_caption ON posts(caption)`);

  // Migrations
  try {
    db.run(`ALTER TABLE posts ADD COLUMN url_contents TEXT`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE posts ADD COLUMN author TEXT`);
  } catch (e) {}

  saveDb();
  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
}

export function insertPost(post) {
  const { collection, post_id, caption, media_url, hashtags, like_count, comment_count, timestamp, author } = post;

  db.run(`
    INSERT OR REPLACE INTO posts (collection, post_id, caption, media_url, hashtags, like_count, comment_count, timestamp, author)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [collection, post_id, caption, media_url, hashtags, like_count, comment_count, timestamp, author || null]);

  saveDb();
}

export function getCollections() {
  const result = db.exec(`SELECT DISTINCT collection FROM posts ORDER BY collection`);
  if (!result.length) return [];
  return result[0].values.map(r => r[0]);
}

export function getPostCount(collection = null) {
  let sql = `SELECT COUNT(*) FROM posts`;
  const params = [];
  if (collection) {
    sql += ` WHERE collection = ?`;
    params.push(collection);
  }
  const result = db.exec(sql, params);
  return result.length ? result[0].values[0][0] : 0;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with',
  'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'i', 'me', 'my',
  'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this',
  'that', 'these', 'those', 'am', 'io', 'tu', 'noi', 'voi', 'loro', 'essere', 'avere', 'fare'
]);

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

function computeBm25(query, documents) {
  const k1 = 1.5;
  const b = 0.75;
  const N = documents.length;
  const avgdl = documents.reduce((sum, d) => sum + d.text.length, 0) / N;

  const termFreqs = documents.map(d => {
    const tf = {};
    d.tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);
    return tf;
  });

  const docLens = documents.map(d => d.text.length);
  const queryTerms = tokenize(query);

  queryTerms.forEach(term => {
    const df = termFreqs.filter(tf => tf[term]).length;
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

    documents.forEach((doc, i) => {
      const ft = termFreqs[i][term] || 0;
      const dl = docLens[i];
      const score = idf * (ft * (k1 + 1)) / (ft + k1 * (1 - b + b * dl / avgdl));
      doc.score = (doc.score || 0) + score;
    });
  });

  return documents.sort((a, b) => b.score - a.score);
}

export function searchDb(query, collection = null, limit = 10) {
  if (!query || !query.trim()) {
    let sql = `SELECT * FROM posts`;
    const params = [];
    if (collection) {
      sql += ` WHERE collection = ?`;
      params.push(collection);
    }
    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);
    const result = db.exec(sql, params);
    if (!result.length) return { columns: [], values: [] };
    return result[0];
  }

  const tokens = tokenize(query);
  const searchTerms = tokens.length > 0 ? tokens : query.toLowerCase().split(/\s+/).slice(0, 5);

  let sql = `SELECT * FROM posts WHERE 1=1`;
  const params = [];
  if (collection) {
    sql += ` AND collection = ?`;
    params.push(collection);
  }

  const conditions = searchTerms.map(() => `(caption LIKE ? OR hashtags LIKE ? OR url_contents LIKE ?)`);
  sql += ` AND (${conditions.join(' OR ')})`;
  searchTerms.forEach(t => {
    params.push(`%${t}%`, `%${t}%`, `%${t}%`);
  });

  sql += ` LIMIT 200`;
  const result = db.exec(sql, params);
  if (!result.length) return { columns: [], values: [] };

  const { columns } = result[0];
  const rows = result[0].values;

  const documents = rows.map(row => {
    const idx = columns.indexOf('caption');
    const hIdx = columns.indexOf('hashtags');
    const uIdx = columns.indexOf('url_contents');
    const text = [row[idx], row[hIdx], row[uIdx]].filter(Boolean).join(' ');
    return { row, tokens: tokenize(text), text, score: 0 };
  });

  const ranked = computeBm25(query, documents);

  const limited = ranked.slice(0, limit);
  return {
    columns,
    values: limited.map(d => d.row)
  };
}

export function updateUrlContents(postId, urlContents) {
  db.run(`UPDATE posts SET url_contents = ? WHERE post_id = ?`, [JSON.stringify(urlContents), postId]);
  saveDb();
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

// Message integration - lazy loaded
let _messages = null;

export function getMessages() {
  if (!_messages) {
    // Dynamic import to avoid circular deps
    import('./messages.js').then(m => {
      _messages = m.parseMessages();
    });
  }
  return _messages || [];
}

export async function searchPostsWithMessages(query, collection = null, limit = 10) {
  const postsResult = searchDb(query, collection, limit * 2);
  const messages = await getMessages();

  if (!postsResult.values.length) {
    return { columns: postsResult.columns, values: [], messages: [] };
  }

  // Import message linker dynamically
  const { normalizeAuthor, linkMessagesToPosts } = await import('./messages.js');

  // Get unique authors from posts
  const authorIdx = postsResult.columns.indexOf('author');
  const authorsInPosts = new Set(postsResult.values.map(r => r[authorIdx]).filter(Boolean));

  // Find all messages from these authors
  const relevantMessages = messages.filter(m => {
    const msgAuthor = normalizeAuthor(m.conversation);
    return [...authorsInPosts].some(pa => normalizeAuthor(pa) === msgAuthor);
  });

  // Convert posts to enriched format with messages
  const enrichedPosts = linkMessagesToPosts(
    postsResult.values.map(row => {
      const obj = {};
      postsResult.columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }),
    messages
  );

  // Apply limit
  const limitedPosts = enrichedPosts.slice(0, limit);

  // Add columns for messages
  const enrichedColumns = [...postsResult.columns, 'messages'];

  return {
    columns: enrichedColumns,
    values: limitedPosts.map(p => {
      const row = postsResult.columns.map(col => p[col]);
      row.push(p.messages);
      return row;
    }),
    messages: relevantMessages
  };
}
