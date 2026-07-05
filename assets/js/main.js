const DATA_URL = 'data/site-data.json';
const RANK_URL = 'data/rankings.json';

const state = {
  site: null,
  ranks: null,
  query: '',
  filter: 'all'
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeUrl(url) {
  if (!url) return '#';
  return url;
}

function rankClass(rank) {
  const normalized = String(rank || 'N/A').toLowerCase().replace('*', '-star').replace(/[^a-z0-9-]/g, '-');
  if (normalized === 'n-a') return 'rank-na';
  return `rank-${normalized}`;
}

function typeLabel(type) {
  return {
    journal: 'Journal',
    conference: 'Conference',
    book: 'Book chapter',
    'under-review': 'Under review'
  }[type] || type;
}

function renderProfile(profile) {
  document.getElementById('profile-kicker').textContent = profile.kicker;
  document.getElementById('profile-name').textContent = profile.name;
  document.getElementById('profile-title').textContent = profile.title;
  document.getElementById('profile-summary').textContent = profile.summary;
  document.getElementById('card-name').textContent = profile.name;
  document.getElementById('card-affiliation').textContent = profile.affiliation;
  document.getElementById('about-text').textContent = profile.about;
  document.getElementById('contact-text').textContent = `Email me at ${profile.emails.join(' or ')}.`;

  const avatar = document.getElementById('profile-avatar');
  if (profile.avatar) {
    avatar.textContent = '';
    avatar.style.backgroundImage = `url('${profile.avatar}')`;
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
  } else {
    avatar.textContent = (profile.name || 'LN').split(' ').map(x => x[0]).join('').slice(0, 2);
    avatar.style.backgroundImage = '';
  }

  const links = document.getElementById('profile-links');
  const contactLinks = document.getElementById('contact-links');
  links.innerHTML = '';
  contactLinks.innerHTML = '';

  profile.links.forEach(link => {
    const a = el('a', link.primary ? 'primary-button' : 'secondary-button', link.label);
    a.href = safeUrl(link.url);
    if (!link.url.startsWith('mailto:') && !link.url.startsWith('assets/')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    links.appendChild(a);

    const c = el('a', '', '');
    c.href = safeUrl(link.url);
    if (!link.url.startsWith('mailto:') && !link.url.startsWith('assets/')) {
      c.target = '_blank';
      c.rel = 'noopener noreferrer';
    }
    c.innerHTML = `<span>${link.label}</span><span>→</span>`;
    contactLinks.appendChild(c);
  });

  const meta = document.getElementById('profile-meta');
  meta.innerHTML = '';
  [
    ['Role', profile.role || profile.kicker],
    ['Profile', profile.kicker],
    ['Location', profile.location]
  ].forEach(([label, value]) => {
    const item = el('div', 'meta-item');
    item.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    meta.appendChild(item);
  });

  const metrics = document.getElementById('quick-metrics');
  metrics.innerHTML = '';
  profile.metrics.forEach(metric => {
    const card = el('div', 'metric');
    card.innerHTML = `<strong>${metric.value}</strong><span>${metric.label}</span>`;
    metrics.appendChild(card);
  });

  const tags = document.getElementById('interest-tags');
  tags.innerHTML = '';
  profile.interests.forEach(t => tags.appendChild(el('span', 'tag', t)));
}

function renderCards(items, targetId, type = 'info') {
  const target = document.getElementById(targetId);
  target.innerHTML = '';
  items.forEach(item => {
    const card = el('article', type === 'project' ? 'project-card' : 'info-card');
    card.innerHTML = `<h3>${item.title || item.name}</h3><p>${item.description}</p>`;
    if (item.stack) {
      const stack = el('div', 'stack');
      item.stack.forEach(s => stack.appendChild(el('span', '', s)));
      card.appendChild(stack);
    }
    target.appendChild(card);
  });
}


function renderGallery(album, gallery) {
  const title = document.getElementById('gallery-title');
  const subtitle = document.getElementById('gallery-subtitle');
  const note = document.getElementById('gallery-note');
  const mainImage = document.getElementById('gallery-main-image');
  const caption = document.getElementById('gallery-caption');
  const counter = document.getElementById('gallery-counter');
  const thumbs = document.getElementById('gallery-thumbs');
  const prev = document.getElementById('gallery-prev');
  const next = document.getElementById('gallery-next');
  const thumbPrev = document.getElementById('gallery-thumb-prev');
  const thumbNext = document.getElementById('gallery-thumb-next');
  const showcase = document.getElementById('gallery-showcase');

  if (!mainImage || !thumbs) return;
  const photos = Array.isArray(gallery) ? gallery : [];

  if (album?.title) title.textContent = album.title;
  if (album?.subtitle) subtitle.textContent = album.subtitle;
  if (album?.note) note.textContent = album.note;

  if (!photos.length) {
    mainImage.removeAttribute('src');
    mainImage.alt = 'No gallery photos configured yet.';
    caption.textContent = 'No gallery photos configured yet.';
    counter.textContent = '';
    thumbs.innerHTML = '';
    return;
  }

  let current = 0;
  thumbs.innerHTML = '';

  const thumbButtons = photos.map((photo, index) => {
    const button = el('button', 'gallery-thumb', '');
    button.type = 'button';
    button.setAttribute('aria-label', `Show photo ${index + 1}`);

    const img = el('img', '', '');
    img.src = photo.src;
    img.alt = photo.alt || `Photo thumbnail ${index + 1}`;
    img.loading = 'lazy';

    button.appendChild(img);
    button.addEventListener('click', () => showPhoto(index));
    thumbs.appendChild(button);
    return button;
  });

  function showPhoto(index) {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    mainImage.src = photo.src;
    mainImage.alt = photo.alt || `Featured photo ${current + 1}`;
    caption.textContent = photo.caption || '';
    counter.textContent = `${current + 1} / ${photos.length}`;

    thumbButtons.forEach((button, i) => {
      const active = i === current;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'true' : 'false');
    });

    thumbButtons[current]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  prev?.addEventListener('click', () => showPhoto(current - 1));
  next?.addEventListener('click', () => showPhoto(current + 1));
  thumbPrev?.addEventListener('click', () => thumbs.scrollBy({ left: -220, behavior: 'smooth' }));
  thumbNext?.addEventListener('click', () => thumbs.scrollBy({ left: 220, behavior: 'smooth' }));

  showcase?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showPhoto(current - 1);
    if (event.key === 'ArrowRight') showPhoto(current + 1);
  });

  showPhoto(0);
}

function renderTimeline(items, targetId, isEducation = false) {
  const target = document.getElementById(targetId);
  target.innerHTML = '';
  items.forEach(item => {
    const card = el('article', 'timeline-item');
    card.innerHTML = `
      <div class="period">${item.period}</div>
      <h3>${isEducation ? item.degree : item.role}</h3>
      <p><strong>${isEducation ? item.school : item.organization}</strong> · ${item.location}</p>
      <p>${item.description}</p>
    `;
    target.appendChild(card);
  });
}

function renderSkills(skills) {
  const target = document.getElementById('skills');
  target.innerHTML = '';
  Object.entries(skills).forEach(([group, values]) => {
    const card = el('div', 'skill-group');
    const tags = values.map(v => `<span class="tag">${v}</span>`).join('');
    card.innerHTML = `<strong>${group}</strong><div>${tags}</div>`;
    target.appendChild(card);
  });
}

function getRank(pub) {
  const rankings = state.ranks?.rankings || {};
  return rankings[pub.venue_key] || { rank: 'N/A', rank_system: 'N/A', rank_year: 'N/A', note: 'No ranking record found.' };
}

function renderRankNote() {
  const note = document.getElementById('rank-note');
  const updated = state.ranks?.last_updated || 'unknown';
  note.textContent = `Ranking cache last updated: ${updated}. CORE has A*, A, B, C; this website shows D only for unranked or missing conference venues.`;
}

function publicationMatches(pub) {
  const q = state.query.trim().toLowerCase();
  const matchesFilter = state.filter === 'all' || pub.type === state.filter;
  if (!matchesFilter) return false;
  if (!q) return true;
  const text = [pub.title, pub.authors, pub.venue, pub.year, pub.doi].join(' ').toLowerCase();
  return text.includes(q);
}

function renderPublications() {
  const target = document.getElementById('publication-list');
  target.innerHTML = '';
  renderRankNote();

  const pubs = state.site.publications.filter(publicationMatches);
  if (!pubs.length) {
    target.appendChild(el('p', '', 'No publications match the current filter.'));
    return;
  }

  pubs.forEach(pub => {
    const rank = getRank(pub);
    const card = el('article', 'publication-card');
    const links = (pub.links || []).map(link => `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>`).join('');
    const doi = pub.doi ? `<a href="https://doi.org/${pub.doi}" target="_blank" rel="noopener noreferrer">DOI: ${pub.doi}</a>` : '';
    const source = rank.source_url ? `<a href="${rank.source_url}" target="_blank" rel="noopener noreferrer">${rank.rank_system || 'Ranking source'}</a>` : (rank.rank_system || 'N/A');
    card.innerHTML = `
      <div class="publication-meta">
        <span class="type-badge">${typeLabel(pub.type)}</span>
        <span class="rank-badge ${rankClass(rank.rank)}">${rank.rank}</span>
        <span class="type-badge">${rank.rank_system || 'N/A'} ${rank.rank_year ? '· ' + rank.rank_year : ''}</span>
      </div>
      <div class="publication-title">${pub.title}</div>
      <div class="publication-authors">${pub.authors}</div>
      <div><strong>${pub.venue}</strong>, ${pub.year}.</div>
      ${pub.note ? `<div class="rank-note">${pub.note}</div>` : ''}
      <div class="publication-links">${doi} ${links} ${rank.source_url ? source : ''}</div>
    `;
    target.appendChild(card);
  });
}

function renderSchema(profile, publications) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.full_name,
    alternateName: profile.name,
    jobTitle: profile.role || profile.kicker,
    description: profile.summary,
    affiliation: {
      '@type': 'Organization',
      name: 'University of Insubria'
    },
    email: profile.emails.map(e => `mailto:${e}`),
    sameAs: profile.links
      .filter(l => l.url && !l.url.startsWith('mailto:') && !l.url.startsWith('assets/'))
      .map(l => l.url),
    knowsAbout: profile.interests,
    mainEntityOfPage: window.location.href,
    publication: publications.map(pub => ({
      '@type': pub.type === 'book' ? 'Chapter' : 'ScholarlyArticle',
      name: pub.title,
      datePublished: String(pub.year),
      isPartOf: pub.venue,
      identifier: pub.doi ? `https://doi.org/${pub.doi}` : undefined
    }))
  };
  document.getElementById('schema-person').textContent = JSON.stringify(schema, null, 2);
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

async function init() {
  document.getElementById('year').textContent = new Date().getFullYear();
  try {
    const [site, ranks] = await Promise.all([loadJson(DATA_URL), loadJson(RANK_URL)]);
    state.site = site;
    state.ranks = ranks;

    renderProfile(site.profile);
    renderCards(site.research, 'research-grid');
    renderGallery(site.album, site.gallery);
    renderCards(site.projects, 'project-grid', 'project');
    renderTimeline(site.experience, 'experience-timeline');
    renderTimeline(site.education, 'education-timeline', true);
    renderSkills(site.skills);
    renderPublications();
    renderSchema(site.profile, site.publications);
  } catch (err) {
    console.error(err);
    document.getElementById('publication-list').textContent = 'Could not load site data. Run a local server instead of opening index.html directly.';
  }
}

const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');
navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

Array.from(navLinks.querySelectorAll('a')).forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

document.getElementById('pub-search').addEventListener('input', (event) => {
  state.query = event.target.value;
  renderPublications();
});

document.getElementById('pub-filter').addEventListener('change', (event) => {
  state.filter = event.target.value;
  renderPublications();
});

document.getElementById('refresh-ranks').addEventListener('click', async () => {
  try {
    state.ranks = await loadJson(`${RANK_URL}?t=${Date.now()}`);
    renderPublications();
  } catch (err) {
    alert('Could not reload rankings. Check data/rankings.json.');
  }
});

init();
