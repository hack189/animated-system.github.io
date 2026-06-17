// Progressive client-side RSS fetch and renderer.
// - Fetch a set of RSS feeds via a CORS-friendly proxy (replace with server-side proxy in production).
// - Parse feeds, collect items, sort by date, and render top 5 into #headlines-list as <li>.
// - Update #status (role=status) for screen readers and handle errors gracefully.

const STATUS = document.getElementById('status');
const LIST = document.getElementById('headlines-list');

// Feeds to include. Replace or remove as desired.
const FEEDS = [
  {url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC'},
  {url: 'https://www.reuters.com/world/rss.xml', source: 'Reuters'},
  {url: 'http://rss.cnn.com/rss/edition_world.rss', source: 'CNN'},
  {url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera'},
  {url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NYTimes'}
];

// CORS proxy for demo purposes. Use your own server-side proxy for production.
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

function setStatus(text) {
  if (STATUS) STATUS.textContent = text;
}

function sanitizeText(node) {
  if (!node) return '';
  return (node.textContent || node.innerText || '').trim();
}

async function fetchFeed(url) {
  const res = await fetch(CORS_PROXY + encodeURIComponent(url), {cache: 'no-cache'});
  if (!res.ok) throw new Error('Network response was not ok');
  return res.text();
}

function parseRss(rssText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rssText, 'application/xml');
  const parsererror = doc.querySelector('parsererror');
  if (parsererror) throw new Error('Error parsing feed XML');
  const items = Array.from(doc.querySelectorAll('item')).map(item => {
    const title = sanitizeText(item.querySelector('title'));
    // Some feeds put link as a node value, others as <link>text</link>
    let link = '';
    const linkNode = item.querySelector('link');
    if (linkNode) link = sanitizeText(linkNode);
    const guidNode = item.querySelector('guid');
    if (!link && guidNode) link = sanitizeText(guidNode);
    const pubDateNode = item.querySelector('pubDate');
    const pubDate = pubDateNode ? new Date(sanitizeText(pubDateNode)) : null;
    return {title, link: link || '#', pubDate};
  });
  return items;
}

function renderItems(items) {
  if (!LIST) return;
  LIST.innerHTML = '';
  if (items.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No headlines available right now.';
    LIST.appendChild(li);
    return;
  }
  items.forEach(it => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = it.link;
    a.textContent = it.title || 'Untitled';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    li.appendChild(a);
    if (it.pubDate) {
      const date = document.createElement('div');
      date.className = 'meta';
      try {
        date.textContent = it.pubDate.toLocaleString();
      } catch (e) {
        date.textContent = '';
      }
      li.appendChild(date);
    }
    LIST.appendChild(li);
  });
}

async function loadHeadlines() {
  try {
    setStatus('Fetching feeds...');
    const feedPromises = FEEDS.map(f => fetchFeed(f.url).then(parseRss).catch(err => {
      console.warn('Feed failed', f.url, err);
      return [];
    }));
    const results = await Promise.all(feedPromises);
    const allItems = results.flat().filter(Boolean);
    allItems.sort((a, b) => {
      if (!a.pubDate) return 1;
      if (!b.pubDate) return -1;
      return b.pubDate - a.pubDate;
    });
    const top = allItems.slice(0, 5);
    renderItems(top);
    setStatus(`Showing ${top.length} headlines (updated ${new Date().toLocaleTimeString()})`);
  } catch (err) {
    console.error(err);
    setStatus('Failed to load headlines. Please try again later.');
    if (LIST) LIST.innerHTML = '<li>Unable to load headlines.</li>';
  }
}

// Run on DOM ready (deferred script already)
document.addEventListener('DOMContentLoaded', () => {
  if (!LIST || !STATUS) return;
  loadHeadlines();
  // Refresh every 5 minutes
  setInterval(loadHeadlines, 5 * 60 * 1000);
});
