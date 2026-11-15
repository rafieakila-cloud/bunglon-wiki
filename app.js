/* Bunglon Wiki v2 — ensiklopedia terbuka, buku lapangan botanika */
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const statusEl = $('#status');
const state = { query: '', deferredPrompt: null };

const panels = {};
['beranda','artikel','gambar','video','buku','jurnal','karyaku','tentang'].forEach(k => panels[k] = $('#panel-' + k));

function setStatus(msg, loading) { statusEl.innerHTML = (loading ? '<span class="spinner"></span> ' : '') + (msg || ''); }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function stripHtml(s) { const d = document.createElement('div'); d.innerHTML = s || ''; return d.textContent || ''; }

/* ============ TAB NAVIGATION ============ */
function activateTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  Object.entries(panels).forEach(([k, el]) => el && el.classList.toggle('active', k === name));
  if (state.query) refreshTab(name);
}
$$('.tab').forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));

$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#q').value.trim();
  if (!q) return;
  state.query = q;
  const active = $('.tab.active').dataset.tab;
  const already = ['artikel','gambar','video','buku','jurnal'].includes(active) ? active : 'artikel';
  if (active === 'beranda' || active === 'karyaku' || active === 'tentang') activateTab(already);
  refreshTab(already);
});

$$('#catRow .cat-chip').forEach(chip => chip.addEventListener('click', () => {
  state.query = chip.dataset.cat;
  $('#q').value = chip.dataset.cat;
  activateTab('artikel');
  refreshTab('artikel');
}));

async function refreshTab(name) {
  const q = state.query;
  if (!q) return;
  if (name === 'artikel') return renderArtikel(q);
  if (name === 'gambar') return renderGambar(q);
  if (name === 'video') return renderVideo(q);
  if (name === 'buku') return renderBuku(q);
  if (name === 'jurnal') return renderJurnal(q);
}

function renderError(panel, msg) {
  panel.innerHTML = '<div class="errorbox">' + escapeHtml(msg) + '</div>';
}

/* ============ WIKIPEDIA HELPERS ============ */
async function wikiSearch(q, limit) {
  const r = await fetch('https://id.wikipedia.org/w/api.php?action=opensearch&search=' + encodeURIComponent(q) + '&limit=' + (limit || 8) + '&namespace=0&format=json&origin=*');
  return (await r.json())[1] || [];
}
async function wikiSummary(title) {
  try { const r = await fetch('https://id.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title)); return await r.json(); } catch { return null; }
}
async function wikiRandom() {
  try { const r = await fetch('https://id.wikipedia.org/api/rest_v1/page/random/summary'); return await r.json(); } catch { return null; }
}

/* ============ BERANDA — konten default, tidak pernah kosong ============ */
async function loadTodayHero() {
  const now = new Date();
  const yyyy = now.getUTCFullYear(), mm = String(now.getUTCMonth() + 1).padStart(2, '0'), dd = String(now.getUTCDate()).padStart(2, '0');
  try {
    const r = await fetch('https://id.wikipedia.org/api/rest_v1/feed/featured/' + yyyy + '/' + mm + '/' + dd, { headers: { 'User-Agent': 'BunglonWiki/2.0' } });
    const j = await r.json();
    const img = j.image || {};
    if (img.thumbnail && img.thumbnail.source) {
      $('#todayImg').src = img.thumbnail.source;
      $('#todayImg').alt = img.title || 'Foto hari ini';
      $('#todayTitle').textContent = img.title || 'Foto hari ini';
      $('#todayCaption').textContent = stripHtml(img.extract || img.description || '').slice(0, 140);
      return;
    }
  } catch {}
  $('#todayTitle').textContent = 'Foto hari ini';
  $('#todayCaption').textContent = 'Wikimedia Commons — sumber foto hari ini belum tersedia untuk tanggal ini.';
}

async function loadFeaturedArticles() {
  const holder = $('#featuredArticles');
  holder.innerHTML = '<div class="dim">memuat…</div>';
  const picks = [];
  for (let i = 0; i < 3; i++) picks.push(wikiRandom());
  const items = (await Promise.all(picks)).filter(s => s && s.title);
  holder.innerHTML = items.map(s => `
    <a class="f-card" href="${escapeHtml((s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page) || 'https://id.wikipedia.org/wiki/' + encodeURIComponent(s.title))}" target="_blank" rel="noopener license">
      ${s.thumbnail ? '<img src="' + escapeHtml(s.thumbnail.source) + '" alt="' + escapeHtml(s.title) + '" loading="lazy" onerror="this.remove()">' : '<div style="aspect-ratio:4/3;background:var(--card-2)"></div>'}
      <div class="f-body"><h4>${escapeHtml(s.title)}</h4><span>wikipedia · CC BY-SA</span></div>
    </a>`).join('') || '<div class="dim">gagal memuat artikel acak</div>';
}
$('#moreRandom').addEventListener('click', loadFeaturedArticles);

async function loadFeaturedVideos() {
  const holder = $('#featuredVideos');
  holder.innerHTML = '<div class="dim">memuat…</div>';
  try {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:video Indonesia&gsrlimit=6&gsrnamespace=6&prop=videoinfo&viprop=url&format=json&origin=*';
    const r = await fetch(url);
    const j = await r.json();
    const pages = j && j.query && j.query.pages ? Object.values(j.query.pages) : [];
    const items = pages.map(p => ({ title: (p.title || '').replace(/^File:/, ''), url: (p.videoinfo && p.videoinfo[0] && p.videoinfo[0].url) || null })).filter(i => i.url);
    holder.innerHTML = items.map(i => `
      <div class="f-card f-video">
        <video src="${escapeHtml(i.url)}" muted playsinline preload="metadata" onclick="this.paused ? this.play() : this.pause()"></video>
        <div class="f-body"><h4>${escapeHtml(i.title)}</h4><span>wikimedia commons · cc</span></div>
      </div>`).join('') || '<div class="dim">tidak ada video ditemukan</div>';
  } catch { holder.innerHTML = '<div class="dim">gagal memuat video</div>'; }
}
$('#moreVideos').addEventListener('click', () => activateTab('video') || (state.query = 'Indonesia', refreshTab('video')));

async function loadFeaturedBooks() {
  const holder = $('#featuredBooks');
  holder.innerHTML = '<div class="dim">memuat…</div>';
  try {
    const r = await fetch('https://openlibrary.org/search.json?q=Indonesia&limit=6&sort=new&fields=key,title,author_name,cover_i,ia');
    const j = await r.json();
    holder.innerHTML = (j.docs || []).map(b => {
      const cover = b.cover_i ? 'https://covers.openlibrary.org/b/id/' + b.cover_i + '-S.jpg' : '';
      const link = (b.ia && b.ia.length) ? 'https://archive.org/details/' + encodeURIComponent(b.ia[0]) : 'https://openlibrary.org' + (b.key || '');
      return `<a class="f-card" href="${escapeHtml(link)}" target="_blank" rel="noopener">
        ${cover ? '<img src="' + escapeHtml(cover) + '" alt="' + escapeHtml(b.title) + '" loading="lazy" onerror="this.remove()">' : '<div style="aspect-ratio:3/4;background:var(--card-2)"></div>'}
        <div class="f-body"><h4>${escapeHtml(b.title)}</h4><span>${escapeHtml((b.author_name || ['?'])[0].slice(0, 28))}</span></div>
      </a>`;
    }).join('') || '<div class="dim">gagal memuat buku</div>';
  } catch { holder.innerHTML = '<div class="dim">gagal memuat buku</div>'; }
}
$('#moreBooks').addEventListener('click', () => { state.query = 'Indonesia'; $('#q').value = 'Indonesia'; activateTab('buku'); refreshTab('buku'); });

async function loadFeaturedJournals() {
  const box = $('#featuredJournals');
  box.innerHTML = '<div class="dim">memuat…</div>';
  try {
    const r = await fetch('https://api.openalex.org/works?sort=cited_by_count:desc&per_page=4&filter=from_publication_date:2023-01-01&select=id,title,publication_year,cited_by_count,primary_location,doi');
    const j = await r.json();
    box.innerHTML = (j.results || []).map(w => `
      <div class="card" style="margin-bottom:8px"><h3 style="font-size:14px">${escapeHtml(w.title)}</h3>
        <div class="chips"><span class="chip">${w.publication_year || '?'}</span><span class="chip">${w.cited_by_count || 0} kutipan</span></div>
        ${w.doi ? '<a class="link-btn" href="' + escapeHtml(w.doi) + '" target="_blank" rel="noopener">DOI →</a>' : ''}</div>`).join('');
  } catch { box.innerHTML = '<div class="dim">gagal memuat jurnal</div>'; }
}
$('#moreJournals').addEventListener('click', () => { state.query = 'Indonesia'; $('#q').value = 'Indonesia'; activateTab('jurnal'); refreshTab('jurnal'); });

async function loadBeranda() {
  await Promise.allSettled([loadTodayHero(), loadFeaturedArticles(), loadFeaturedVideos(), loadFeaturedBooks(), loadFeaturedJournals()]);
}

/* ============ ARTIKEL ============ */
async function renderArtikel(q) {
  const panel = panels.artikel;
  setStatus('Mencari artikel…', true);
  panel.innerHTML = '';
  try {
    const titles = await wikiSearch(q, 8);
    if (!titles.length) { panel.innerHTML = '<div class="empty">Tidak ada artikel untuk “' + escapeHtml(q) + '”</div>'; setStatus(''); return; }
    const summaries = await Promise.all(titles.map(t => wikiSummary(t)));
    panel.innerHTML = summaries.filter(s => s && s.title).map(s => {
      const thumb = s.thumbnail ? s.thumbnail.source : '';
      const extract = stripHtml(s.extract || '');
      const link = (s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page) || 'https://id.wikipedia.org/wiki/' + encodeURIComponent(s.title);
      return `<article class="card"><div class="card-row">
        ${thumb ? '<img class="thumb" src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(s.title) + '" loading="lazy" onerror="this.style.display=\'none\'">' : ''}
        <div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(extract.slice(0, 300))}${extract.length > 300 ? '…' : ''}</p></div>
      </div><a class="link-btn" href="${escapeHtml(link)}" target="_blank" rel="noopener license">Baca di Wikipedia →</a></article>`;
    }).join('');
    setStatus(titles.length + ' artikel');
  } catch (e) { setStatus(''); renderError(panel, 'Gagal mengambil Wikipedia: ' + e.message); }
}

/* ============ GAMBAR ============ */
async function renderGambar(q) {
  const panel = panels.gambar;
  setStatus('Mencari gambar…', true);
  panel.innerHTML = '';
  try {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:bitmap ' + encodeURIComponent(q) + '&gsrlimit=15&gsrnamespace=6&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500&format=json&origin=*';
    const r = await fetch(url);
    const j = await r.json();
    const pages = j && j.query && j.query.pages ? Object.values(j.query.pages) : [];
    const items = pages.map(p => {
      const ii = (p.imageinfo && p.imageinfo[0]) || {};
      const meta = ii.extmetadata || {};
      return {
        img: ii.thumburl || ii.url,
        artist: stripHtml(meta.Artist ? meta.Artist.value : '') || 'Wikimedia',
        license: meta.LicenseShortName ? meta.LicenseShortName.value : 'CC',
        descUrl: ii.descriptionurl || 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title || ''),
        title: p.title || ''
      };
    }).filter(i => i.img);
    if (!items.length) { panel.innerHTML = '<div class="empty">Tidak ada gambar</div>'; setStatus(''); return; }
    panel.innerHTML = '<div class="grid">' + items.map(i => `
      <a class="g-item" href="${escapeHtml(i.descUrl)}" target="_blank" rel="noopener license">
        <img src="${escapeHtml(i.img)}" alt="${escapeHtml(i.title)}" loading="lazy" onerror="this.closest('.g-item').remove()">
        <figcaption>${escapeHtml(i.artist.slice(0, 40))} · ${escapeHtml(i.license)}</figcaption>
      </a>`).join('') + '</div>';
    setStatus(items.length + ' gambar');
  } catch (e) { setStatus(''); renderError(panel, 'Gagal mengambil Commons: ' + e.message); }
}

/* ============ VIDEO ============ */
async function renderVideo(q) {
  const panel = panels.video;
  setStatus('Mencari video…', true);
  panel.innerHTML = '';
  try {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:video ' + encodeURIComponent(q) + '&gsrlimit=10&gsrnamespace=6&prop=videoinfo&viprop=url|size|extmetadata&format=json&origin=*';
    const r = await fetch(url);
    const j = await r.json();
    const pages = j && j.query && j.query.pages ? Object.values(j.query.pages) : [];
    const items = pages.map(p => {
      const vi = (p.videoinfo && p.videoinfo[0]) || {};
      const meta = vi.extmetadata || {};
      return {
        title: (p.title || '').replace(/^File:/, ''),
        url: vi.url,
        license: meta.LicenseShortName ? meta.LicenseShortName.value : 'CC',
        artist: stripHtml(meta.Artist ? meta.Artist.value : '') || 'Wikimedia',
        descUrl: vi.descriptionurl || 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title || '')
      };
    }).filter(i => i.url);
    if (!items.length) { panel.innerHTML = '<div class="empty">Tidak ada video untuk “' + escapeHtml(q) + '”. Coba “timelapse”, “nature”, “Indonesia”.</div>'; setStatus(''); return; }
    panel.innerHTML = items.map(i => `
      <div class="video-item">
        <video controls preload="metadata" src="${escapeHtml(i.url)}"></video>
        <div class="video-cap"><div class="video-title">${escapeHtml(i.title)}</div>
        <div class="video-lic">${escapeHtml(i.artist.slice(0, 80))} · ${escapeHtml(i.license)} · <a href="${escapeHtml(i.descUrl)}" target="_blank" rel="noopener license" style="color:var(--emerald-mid)">atribusi</a></div></div>
      </div>`).join('');
    setStatus(items.length + ' video');
  } catch (e) { setStatus(''); renderError(panel, 'Gagal mengambil video: ' + e.message); }
}

/* ============ BUKU ============ */
async function renderBuku(q) {
  const panel = panels.buku;
  setStatus('Mencari buku…', true);
  panel.innerHTML = '';
  try {
    const r = await fetch('https://openlibrary.org/search.json?q=' + encodeURIComponent(q) + '&limit=10&fields=key,title,author_name,first_publish_year,cover_i,ia');
    const j = await r.json();
    if (!j.docs || !j.docs.length) { panel.innerHTML = '<div class="empty">Buku tidak ditemukan</div>'; setStatus(''); return; }
    panel.innerHTML = j.docs.map(b => {
      const cover = b.cover_i ? 'https://covers.openlibrary.org/b/id/' + b.cover_i + '-M.jpg' : '';
      const link = (b.ia && b.ia.length) ? 'https://archive.org/details/' + encodeURIComponent(b.ia[0]) : 'https://openlibrary.org' + (b.key || '');
      return `<div class="card book-row">
        ${cover ? '<img class="book-cover" src="' + escapeHtml(cover) + '" alt="Sampul" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '<div class="book-cover"></div>'}
        <div><h3>${escapeHtml(b.title || 'Tanpa judul')}</h3>
          <p>${escapeHtml((b.author_name || ['Penulis tidak diketahui']).slice(0, 3).join(', '))}</p>
          <div class="chips">${b.first_publish_year ? '<span class="chip">' + b.first_publish_year + '</span>' : ''}<span class="chip">Open Library</span></div>
          <a class="link-btn" href="${escapeHtml(link)}" target="_blank" rel="noopener">Baca / pinjam gratis →</a>
        </div></div>`;
    }).join('');
    setStatus(j.docs.length + ' buku');
  } catch (e) { setStatus(''); renderError(panel, 'Gagal mengambil Open Library: ' + e.message); }
}

/* ============ JURNAL ============ */
function reconstructAbstract(inv) {
  if (!inv) return '';
  const words = [];
  for (const [word, positions] of Object.entries(inv)) for (const pos of positions) words[pos] = word;
  return words.join(' ').slice(0, 420);
}
async function renderJurnal(q) {
  const panel = panels.jurnal;
  setStatus('Mencari jurnal…', true);
  panel.innerHTML = '';
  try {
    const r = await fetch('https://api.openalex.org/works?search=' + encodeURIComponent(q) + '&per_page=8');
    const j = await r.json();
    if (!j.results || !j.results.length) { panel.innerHTML = '<div class="empty">Jurnal tidak ditemukan</div>'; setStatus(''); return; }
    panel.innerHTML = j.results.map(w => {
      const authors = (w.authorships || []).slice(0, 3).map(a => a.author && a.author.display_name).filter(Boolean).join(', ');
      const abstract = reconstructAbstract(w.abstract_inverted_index);
      const doi = w.doi || (w.primary_location && w.primary_location.landing_page_url) || '';
      const venue = w.primary_location && w.primary_location.source ? w.primary_location.source.display_name : '';
      return `<article class="card"><h3>${escapeHtml(w.title || 'Tanpa judul')}</h3>
        <p class="dim">${escapeHtml(authors)}${venue ? ' · ' + escapeHtml(venue) : ''}</p>
        <div class="chips"><span class="chip">${w.publication_year || '?'}</span><span class="chip">${w.cited_by_count || 0} kutipan</span>${w.open_access && w.open_access.is_oa ? '<span class="chip">Open Access</span>' : ''}</div>
        ${abstract ? '<p class="abstract">' + escapeHtml(abstract) + '</p>' : ''}
        ${doi ? '<a class="link-btn" href="' + escapeHtml(doi) + '" target="_blank" rel="noopener">Baca artikel →</a>' : ''}
      </article>`;
    }).join('');
    setStatus(j.results.length + ' jurnal');
  } catch (e) { setStatus(''); renderError(panel, 'Gagal mengambil OpenAlex: ' + e.message); }
}

/* ============ KARYAKU — upload lokal via IndexedDB ============ */
const DB_NAME = 'bunglon-karya', STORE = 'files';
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbAdd(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(record);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}
async function dbAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function dbDelete(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}

async function renderKaryaku() {
  const holder = $('#karyaList');
  setStatus('Memuat karyamu…', true);
  try {
    const items = await dbAll();
    setStatus(items.length + ' karya tersimpan');
    holder.innerHTML = items.map(k => {
      const url = URL.createObjectURL(k.blob);
      const isVideo = (k.type || '').startsWith('video');
      return `<div class="k-item">
        <button class="k-del" data-id="${k.id}" title="Hapus">×</button>
        ${isVideo ? '<video src="' + url + '" muted loop playsinline onclick="this.paused ? this.play() : this.pause()"></video>' : '<img src="' + url + '" alt="' + escapeHtml(k.name) + '" loading="lazy">'}
        <div class="k-name">${escapeHtml(k.name)}</div>
      </div>`;
    }).join('') || '<div class="empty">Belum ada karya — unggah foto/videomu di atas</div>';
    holder.querySelectorAll('.k-del').forEach(btn => btn.addEventListener('click', async () => {
      if (confirm('Hapus karya ini dari perangkat?')) { await dbDelete(+btn.dataset.id); renderKaryaku(); }
    }));
  } catch (e) { setStatus(''); holder.innerHTML = '<div class="errorbox">Gagal membuka penyimpanan lokal: ' + escapeHtml(e.message) + '</div>'; }
}

$('#uploadInput').addEventListener('change', async (e) => {
  setStatus('Menyimpan…', true);
  for (const file of e.target.files) {
    await dbAdd({ name: file.name, type: file.type, size: file.size, date: Date.now(), blob: file });
  }
  e.target.value = '';
  renderKaryaku();
});

/* ============ INIT & PWA ============ */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredPrompt = e;
  $('#installBtn').classList.remove('hidden');
});
$('#installBtn').addEventListener('click', async () => {
  if (!state.deferredPrompt) return;
  state.deferredPrompt.prompt();
  state.deferredPrompt = null;
  $('#installBtn').classList.add('hidden');
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

renderKaryaku();
loadBeranda();
setStatus('selamat datang di buku lapangan terbuka');
