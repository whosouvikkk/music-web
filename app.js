/**
 * Aura - Premium Music Streaming App
 * Architecture: Vanilla JS, State-driven, Component-based rendering pattern
 */

// ==========================================================================
// API & Config
// ==========================================================================
const API_BASE = '/api';
let DEBOUNCE_TIMER = null;

// ==========================================================================
// Application State
// ==========================================================================
const state = {
    currentView: 'home',
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    isLooping: false,
    isShuffling: false,
    volume: 100,
    favorites: JSON.parse(localStorage.getItem('aura_favorites')) || []
};

// ==========================================================================
// DOM Elements
// ==========================================================================
const DOM = {
    audio: document.getElementById('main-audio'),
    views: document.querySelectorAll('.view'),
    navLinks: document.querySelectorAll('.sidebar .nav-links li[data-view]'),
    searchInput: document.getElementById('search-input'),
    searchContainer: document.getElementById('search-container'),
    searchGrid: document.getElementById('search-grid'),
    searchLoader: document.getElementById('search-loader'),
    trendingGrid: document.getElementById('trending-grid'),
    favoritesList: document.getElementById('favorites-list'),
    
    // Player DOM
    npCover: document.getElementById('np-cover'),
    npCoverContainer: document.getElementById('np-cover-container'),
    npTitle: document.getElementById('np-title'),
    npArtist: document.getElementById('np-artist'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    playIcon: document.getElementById('play-icon'),
    btnNext: document.getElementById('btn-next'),
    btnPrev: document.getElementById('btn-prev'),
    btnRepeat: document.getElementById('btn-repeat'),
    btnShuffle: document.getElementById('btn-shuffle'),
    btnFavorite: document.getElementById('np-favorite'),
    seekBar: document.getElementById('seek-bar'),
    timeCurrent: document.getElementById('time-current'),
    timeTotal: document.getElementById('time-total'),
    volumeBar: document.getElementById('volume-bar'),
    audioWave: document.getElementById('audio-wave'),
    volIcon: document.getElementById('vol-icon'),
    
    toastContainer: document.getElementById('toast-container')
};

// ==========================================================================
// Initialization
// ==========================================================================
function init() {
    lucide.createIcons();
    setupEventListeners();
    loadTrending();
    updateVolumeSliderCSS(state.volume);
    renderFavorites();
}

// ==========================================================================
// Event Listeners
// ==========================================================================
function setupEventListeners() {
    // Navigation
    DOM.navLinks.forEach(link => {
        link.addEventListener('click', () => switchView(link.dataset.view));
    });
    
    document.getElementById('explore-btn').addEventListener('click', () => switchView('search'));

    // Search input (Debounced)
    DOM.searchInput.addEventListener('input', (e) => {
        clearTimeout(DEBOUNCE_TIMER);
        const query = e.target.value.trim();
        
        if (query.length === 0) {
            renderEmptySearch();
            return;
        }

        DOM.searchLoader.style.display = 'block';
        DEBOUNCE_TIMER = setTimeout(() => handleSearch(query), 500);
    });

    // Player Controls
    DOM.btnPlayPause.addEventListener('click', togglePlayPause);
    DOM.btnNext.addEventListener('click', playNext);
    DOM.btnPrev.addEventListener('click', playPrev);
    
    DOM.btnRepeat.addEventListener('click', () => {
        state.isLooping = !state.isLooping;
        DOM.btnRepeat.classList.toggle('active', state.isLooping);
        DOM.audio.loop = state.isLooping;
        showToast(state.isLooping ? 'Repeat On' : 'Repeat Off', 'success', 'repeat');
    });

    DOM.btnShuffle.addEventListener('click', () => {
        state.isShuffling = !state.isShuffling;
        DOM.btnShuffle.classList.toggle('active', state.isShuffling);
        showToast(state.isShuffling ? 'Shuffle On' : 'Shuffle Off', 'success', 'shuffle');
    });

    DOM.btnFavorite.addEventListener('click', toggleFavoriteCurrent);

    // Audio Elements updates
    DOM.audio.addEventListener('timeupdate', updateTimeline);
    DOM.audio.addEventListener('ended', handleSongEnd);
    DOM.audio.addEventListener('loadedmetadata', () => {
        DOM.timeTotal.innerText = formatTime(DOM.audio.duration);
    });
    DOM.audio.addEventListener('error', () => {
        showToast('Error loading audio format.', 'error', 'alert-circle');
        DOM.audioWave.classList.remove('playing');
        DOM.npCoverContainer.classList.remove('rotating');
        state.isPlaying = false;
        updatePlayIcon();
    });

    // Seek and Volume Sliders
    DOM.seekBar.addEventListener('input', (e) => {
        const percent = e.target.value;
        const seekTime = (percent / 100) * DOM.audio.duration;
        DOM.audio.currentTime = seekTime;
        updateSliderCSS(DOM.seekBar, percent);
    });

    DOM.volumeBar.addEventListener('input', (e) => {
        const vol = e.target.value;
        state.volume = vol;
        DOM.audio.volume = vol / 100;
        updateVolumeSliderCSS(vol);
        
        if(vol == 0) DOM.volIcon.setAttribute('data-lucide', 'volume-x');
        else if(vol < 50) DOM.volIcon.setAttribute('data-lucide', 'volume-1');
        else DOM.volIcon.setAttribute('data-lucide', 'volume-2');
        lucide.createIcons();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if(document.activeElement.tagName === 'INPUT') return;

        if (e.code === 'Space') {
            e.preventDefault();
            togglePlayPause();
        } else if (e.code === 'ArrowRight') {
            playNext();
        } else if (e.code === 'ArrowLeft') {
            playPrev();
        }
    });
}

// ==========================================================================
// Navigation & Views
// ==========================================================================
function switchView(viewName) {
    state.currentView = viewName;

    // Update nav classes
    DOM.navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.view === viewName);
    });

    // Show/Hide views
    DOM.views.forEach(view => {
        view.classList.remove('active');
        if (view.id === `${viewName}-view`) {
            view.classList.add('active');
        }
    });

    // Topbar Search visibility
    DOM.searchContainer.style.display = viewName === 'search' ? 'flex' : 'none';
    if(viewName === 'search') DOM.searchInput.focus();
}

// ==========================================================================
// API Handling
// ==========================================================================
async function fetchAPI(endpoint) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('API Error:', err);
        showToast('Connection error. Please try again.', 'error', 'wifi-off');
        return null;
    }
}

async function loadTrending() {
    renderSkeletons(DOM.trendingGrid, 12);
    // Fetch some default high-quality queries to simulate trending
    const data = await fetchAPI('/search/songs?query=latest+english+songs');
    if (data && data.success && data.data.results.length > 0) {
        renderGrid(DOM.trendingGrid, data.data.results);
    } else {
        DOM.trendingGrid.innerHTML = `<p style="color:var(--text-secondary)">Failed to load trending music.</p>`;
    }
}

async function handleSearch(query) {
    const data = await fetchAPI(`/search/songs?query=${encodeURIComponent(query)}`);
    DOM.searchLoader.style.display = 'none';

    if (data && data.success && data.data.results.length > 0) {
        renderGrid(DOM.searchGrid, data.data.results, true); // True implies overriding queue on play
    } else {
        DOM.searchGrid.innerHTML = `
            <div class="empty-state">
                <i data-lucide="frown"></i>
                <p>No results found for "${query}"</p>
            </div>
        `;
        lucide.createIcons();
    }
}

async function fetchSongDetails(id) {
    const data = await fetchAPI(`/songs/${id}`);
    if (data && data.success && data.data.length > 0) {
        return data.data[0];
    }
    return null;
}

// ==========================================================================
// Rendering
// ==========================================================================
function renderSkeletons(container, count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="song-card skeleton-card">
                <div class="skeleton skeleton-img"></div>
                <div class="skeleton skeleton-text-1"></div>
                <div class="skeleton skeleton-text-2"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderGrid(container, songs, isSearch = false) {
    container.innerHTML = '';
    songs.forEach((song, index) => {
        const title = decodeEntities(song.name || song.title);
        const artist = decodeEntities(song.primaryArtists || song.singers || 'Unknown Artist');
        const imgUrl = getBestImage(song.image);

        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${imgUrl}" alt="${title}" loading="lazy">
                <div class="play-overlay">
                    <i data-lucide="play" style="width:20px;height:20px;margin-left:2px;"></i>
                </div>
            </div>
            <div class="song-title">${title}</div>
            <div class="song-artist">${artist}</div>
        `;

        card.addEventListener('click', () => {
            if (isSearch) {
                // If clicked from search, make the search results the new queue
                state.queue = songs;
                state.currentIndex = index;
            } else {
                // If trending, append to queue or set as queue
                state.queue = songs;
                state.currentIndex = index;
            }
            playSong(song);
        });

        container.appendChild(card);
    });
    lucide.createIcons();
}

function renderEmptySearch() {
    DOM.searchGrid.innerHTML = `
        <div class="empty-state">
            <i data-lucide="search"></i>
            <p>Search for songs, artists, or albums</p>
        </div>
    `;
    lucide.createIcons();
}

function renderFavorites() {
    DOM.favoritesList.innerHTML = '';
    if (state.favorites.length === 0) {
        DOM.favoritesList.innerHTML = `
            <div class="empty-state">
                <i data-lucide="heart"></i>
                <p>No favorites yet. Like some songs!</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    state.favorites.forEach(song => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <img src="${getBestImage(song.image)}" alt="Cover">
            <div class="list-info">
                <div class="song-title">${decodeEntities(song.name)}</div>
                <div class="song-artist">${decodeEntities(song.primaryArtists)}</div>
            </div>
            <button class="icon-btn" style="color:var(--accent)"><i data-lucide="heart"></i></button>
        `;
        
        // Play on click
        item.addEventListener('click', (e) => {
            if(e.target.closest('button')) return; // Ignore if clicking heart
            state.queue = state.favorites;
            state.currentIndex = state.favorites.findIndex(s => s.id === song.id);
            playSong(song);
        });

        // Remove favorite
        item.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(song);
            renderFavorites();
        });

        DOM.favoritesList.appendChild(item);
    });
    lucide.createIcons();
}

// ==========================================================================
// Player Logic
// ==========================================================================
async function playSong(minimalSongObj) {
    try {
        // Show loading state
        DOM.npTitle.innerText = "Loading...";
        
        // Fetch full details to get 320kbps URL
        const fullSong = await fetchSongDetails(minimalSongObj.id);
        if (!fullSong) throw new Error("Could not fetch song details");

        const downloadUrls = fullSong.downloadUrl;
        if (!downloadUrls || downloadUrls.length === 0) throw new Error("No audio source available");

        // Prefer 320kbps, fallback to last available
        let audioUrl = downloadUrls[downloadUrls.length - 1].url;
        const kbps320 = downloadUrls.find(d => d.quality === '320kbps');
        if (kbps320) audioUrl = kbps320.url;

        // Update UI
        const title = decodeEntities(fullSong.name);
        const artist = decodeEntities(fullSong.primaryArtists || fullSong.singers);
        const img = getBestImage(fullSong.image);

        DOM.npTitle.innerText = title;
        DOM.npArtist.innerText = artist;
        DOM.npCover.src = img;
        
        // Set Audio
        DOM.audio.src = audioUrl;
        DOM.audio.play();
        
        state.isPlaying = true;
        updatePlayIcon();
        checkFavoriteStatus(fullSong.id);
        
        // Visuals
        DOM.audioWave.classList.add('playing');
        DOM.npCoverContainer.classList.add('rotating');
        
        // Save current full song for favorites logic
        state.currentSong = fullSong;
        
        showToast(`Playing: ${title}`, 'success', 'music');

    } catch (err) {
        console.error(err);
        showToast('Playback failed. Skipping...', 'error', 'alert-circle');
        setTimeout(playNext, 2000);
    }
}

function togglePlayPause() {
    if (!DOM.audio.src || state.currentIndex === -1) return;

    if (state.isPlaying) {
        DOM.audio.pause();
        DOM.audioWave.classList.remove('playing');
        DOM.npCoverContainer.style.animationPlayState = 'paused';
    } else {
        DOM.audio.play();
        DOM.audioWave.classList.add('playing');
        DOM.npCoverContainer.style.animationPlayState = 'running';
    }
    state.isPlaying = !state.isPlaying;
    updatePlayIcon();
}

function playNext() {
    if (state.queue.length === 0) return;
    
    if (state.isShuffling) {
        state.currentIndex = Math.floor(Math.random() * state.queue.length);
    } else {
        state.currentIndex = (state.currentIndex + 1) % state.queue.length;
    }
    
    playSong(state.queue[state.currentIndex]);
}

function playPrev() {
    if (state.queue.length === 0) return;
    
    if (DOM.audio.currentTime > 3) {
        DOM.audio.currentTime = 0; // Restart if playing for a bit
        return;
    }
    
    state.currentIndex = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
    playSong(state.queue[state.currentIndex]);
}

function handleSongEnd() {
    if (!state.isLooping) {
        playNext();
    }
}

function updateTimeline() {
    if (isNaN(DOM.audio.duration)) return;
    
    const curr = DOM.audio.currentTime;
    const total = DOM.audio.duration;
    const percent = (curr / total) * 100;
    
    DOM.timeCurrent.innerText = formatTime(curr);
    DOM.seekBar.value = percent;
    updateSliderCSS(DOM.seekBar, percent);
}

// ==========================================================================
// Favorites & LocalStorage
// ==========================================================================
function checkFavoriteStatus(songId) {
    const isFav = state.favorites.some(s => s.id === songId);
    DOM.btnFavorite.classList.toggle('active', isFav);
    DOM.btnFavorite.innerHTML = `<i data-lucide="heart" ${isFav ? 'fill="var(--accent)" color="var(--accent)"' : ''}></i>`;
    lucide.createIcons();
}

function toggleFavoriteCurrent() {
    if (!state.currentSong) return;
    toggleFavorite(state.currentSong);
    checkFavoriteStatus(state.currentSong.id);
    if(state.currentView === 'library') renderFavorites();
}

function toggleFavorite(song) {
    const index = state.favorites.findIndex(s => s.id === song.id);
    if (index > -1) {
        state.favorites.splice(index, 1);
        showToast('Removed from favorites', 'success', 'heart-crack');
    } else {
        // Clean object before saving
        const minSong = {
            id: song.id,
            name: song.name,
            primaryArtists: song.primaryArtists,
            image: song.image
        };
        state.favorites.push(minSong);
        showToast('Added to favorites', 'success', 'heart');
    }
    localStorage.setItem('aura_favorites', JSON.stringify(state.favorites));
}

// ==========================================================================
// Utilities
// ==========================================================================
function updatePlayIcon() {
    DOM.btnPlayPause.classList.toggle('playing', state.isPlaying);
    DOM.playIcon.setAttribute('data-lucide', state.isPlaying ? 'pause' : 'play');
    lucide.createIcons();
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function getBestImage(imageArr) {
    if (!imageArr) return 'https://via.placeholder.com/500?text=No+Cover';
    if (typeof imageArr === 'string') return imageArr;
    if (Array.isArray(imageArr)) {
        return imageArr[imageArr.length - 1].url; // Highest res usually last
    }
    return imageArr;
}

function decodeEntities(encodedString) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = encodedString;
    return textarea.value;
}

function updateSliderCSS(slider, value) {
    slider.style.background = `linear-gradient(to right, var(--text-primary) 0%, var(--text-primary) ${value}%, rgba(255,255,255,0.1) ${value}%, rgba(255,255,255,0.1) 100%)`;
}

function updateVolumeSliderCSS(value) {
    DOM.volumeBar.value = value;
    DOM.volumeBar.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${value}%, rgba(255,255,255,0.1) ${value}%, rgba(255,255,255,0.1) 100%)`;
}

function showToast(message, type = 'success', icon = 'check-circle') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i data-lucide="${icon}"></i>
        <span>${message}</span>
    `;
    
    DOM.toastContainer.appendChild(toast);
    lucide.createIcons();
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); // Wait for transition
    }, 3000);
}

// Bootstrap App
window.addEventListener('DOMContentLoaded', init);
