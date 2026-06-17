// Client-side RSS aggregator: fetches multiple feeds via a public CORS proxy,
// extracts items, deduplicates and shows top 5 headlines.
(() => {
  const feeds = [
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC' },
    { url: 'https://www.reutersagency.com/feed/?best-topics=world', source: 'Reuters' }, // fallback RSS
    { url: 'http://rss.cnn.com/rss/edition_world.rss', source: 'CNN' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NYTimes' }
  ];

  const CORS_PROXY = 'https://api.allorigins.win/raw?url='; // public CORS proxy

  const statusEl = document.getElementById('status');
  const container = document.getElementById('headlines');

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function formatDate(d) {
    if (!d || isNaN(d.getTime())) return '';
    return d.toLocaleString();
  }

  function render(headlines) {
    container.innerHTML = '';
    if (!headlines.length) {
      setStatus('No headlines found.');
      return;
    }
    setStatus('');
    headlines.forEach(h => {
      const article = document.createElement('article');
      article.className = 'headline';
      const title = document.createElement('h2');
      const a = document.createElement('a');
      a.href = h.link || '#';
      a.textContent = h.title;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      title.appendChild(a);
      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = `${h.source}${h.pub ? ' — ' + formatDate(new Date(h.pub)) : ''}`;
      article.appendChild(title);
      article.appendChild(meta);
      container.appendChild(article);
    });
  }

  function parseFeed(xmlText, source) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'application/xml');
    const items = xml.querySelectorAll('item');
    const out = [];
    items.forEach(item => {
      const title = item.querySelector('title')?.textContent?.trim() || '';
      let link = item.querySelector('link')?.textContent?.trim() || '';
      // Some RSS provide link as <guid> with isPermaLink or as <link> element text node
      if (!link) link = item.querySelector('guid')?.textContent?.trim() || '';
      const pub = item.querySelector('pubDate')?.textContent?.trim() || '';
      if (title) out.push({ title, link, source, pub });
    });
    return out;
  }

  async function fetchFeed(feed) {
    try {
      const url = CORS_PROXY + encodeURIComponent(feed.url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const text = await res.text();
      return parseFeed(text, feed.source);
    } catch (err) {
      console.warn('Feed fetch error', feed.url, err);
      return [];
    }
  }

  async function loadHeadlines() {
    setStatus('Loading headlines...');
    try {
      const promises = feeds.map(f => fetchFeed(f));
      const results = await Promise.all(promises);
      let headlines = results.flat();

      // dedupe by title (case-insensitive)
      const seen = new Set();
      headlines = headlines.filter(h => {
        const key = (h.title || '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // sort by pubDate (newest first). fallback: keep original order if no dates
      headlines.sort((a, b) => {
        const da = a.pub ? new Date(a.pub).getTime() : 0;
        const db = b.pub ? new Date(b.pub).getTime() : 0;
        return db - da;
      });

      // take top 5
      headlines = headlines.slice(0, 5);
      render(headlines);
      if (!headlines.length) setStatus('Could not load headlines from the feeds (CORS proxy may be blocked).');
    } catch (err) {
      console.error(err);
      setStatus('Error loading headlines.');
    }
  }

  // Start
  document.addEventListener('DOMContentLoaded', loadHeadlines);
})();
