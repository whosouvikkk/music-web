/* ==========================================================================
   State & Configuration
   ========================================================================== */
const API_BASE = '/api'; // Proxied through vercel.json to bypass CORS

let currentSearchController = null; // Used to cancel rapid sequential requests

const state = {
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 0, // 0: none, 1: all, 2: one
    favorites: JSON.parse(localStorage.getItem('moonwitch_favorites')) || [], // Changed branding key
    recent: JSON.parse(localStorage.getItem('moonwitch_recent')) || [],       // Changed branding key
    currentView: 'home',
    volume: 1.0,
    isMuted: false
};

// Default queries for Home Page
const defaultQueries = ['Arijit Singh', 'The Weeknd', 'Dua Lipa', 'Imagine Dragons'];

/* ==========================================================================
   DOM Elements
   ========================================================================== */
const DOM = {
    audio: document.getElementById('audioPlayer'),
    searchInput: document.getElementById('searchInput'),
    searchSpinner: document.getElementById('searchSpinner'),
    views: document.querySelectorAll('.view'),
    navItems: document.querySelectorAll('.nav-item, .mobile-nav-item'),
    grids: {
        trending: document.getElementById('trendingGrid'),
        newReleases: document.getElementById('newReleasesGrid'),
        search: document.getElementById('searchResultsGrid'),
        favorites: document.getElementById('favoritesGrid'),
        recent: document.getElementById('recentGrid')
    },
    player: {
        title: document.getElementById('playerTitle'),
        artist: document.getElementById('playerArtist'),
        cover: document.getElementById('playerCover'),
        albumArtContainer: document.getElementById('playerAlbumArt'),
        playBtn: document.getElementById('playBtn'),
        playIcon: document.getElementById('playIcon'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        shuffleBtn: document.getElementById('shuffleBtn'),
        repeatBtn: document.getElementById('repeatBtn'),
        repeatIcon: document.getElementById('repeatIcon'),
        currentTime: document.getElementById('currentTime'),
        totalTime: document.getElementById('totalTime'),
        progressContainer: document.getElementById('progressContainer'),
        progressBar: document.getElementById('progressBar'),
        likeBtn: document.getElementById('likeBtn'),
        muteBtn: document.getElementById('muteBtn'),
        volumeIcon: document.getElementById('volumeIcon'),
        volumeContainer: document.getElementById('volumeContainer'),
        volumeBar: document.getElementById('volumeBar')
    },
    toastContainer: document.getElementById('toast-container'),
    searchEmpty: document.getElementById('search-empty-state')
};

/* ==========================================================================
   Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    renderSkeletons(DOM.grids.trending, 6);
    renderSkeletons(DOM.grids.newReleases, 6);
    
    // Load default home data
    try {
        const trendingRes = await fetchAPI(`/search/songs?query=Top Songs`);
        if(trendingRes && trendingRes.data && trendingRes.data.results) {
            renderCards(trendingRes.data.results.slice(0,6), DOM.grids.trending);
        }
        
        const newRes = await fetchAPI(`/search/songs?query=Latest Hits`);
        if(newRes && newRes.data && newRes.data.results) {
            renderCards(newRes.data.results.slice(0,6), DOM.grids.newReleases);
        }
    } catch (err) {
        showToast('Failed to load home content', 'error');
        DOM.grids.trending.innerHTML = `<p class="text-muted">Content unavailable.</p>`;
        DOM.grids.newReleases.innerHTML = `<p class="text-muted">Content unavailable.</p>`;
    }

    DOM.audio.volume = state.volume;
}

/* ==========================================================================
   API Service
   ========================================================================== */
async function fetchAPI(endpoint, signal = null) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, { signal });
        
        // Handle Rate Limiting gracefully
        if (response.status === 429) {
            throw new Error('Rate limit reached. Please wait a few seconds.');
        }

        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        // Ignore aborted requests (happens during live typing)
        if (error.name === 'AbortError') return null; 
        
        console.error('API Error:', error);
        throw error;
    }
}

/* ==========================================================================
   UI Rendering
   ========================================================================== */
function renderSkeletons(container, count) {
    container.innerHTML = Array(count).fill(`
        <div class="skeleton-card">
            <div class="skeleton-cover skeleton"></div>
            <div class="skeleton-text-1 skeleton"></div>
            <div class="skeleton-text-2 skeleton"></div>
        </div>
    `).join('');
}

function createSongCard(song) {
    // Extract highest quality image
    const image = song.image && song.image.length > 0 
        ? song.image[song.image.length - 1].url 
        : 'https://via.placeholder.com/150';

    const title = decodeEntities(song.name);
    const artist = song.artists ? decodeEntities(song.artists.primary[0]?.name || 'Unknown') : 'Unknown';

    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
        <div class="cover-wrapper">
            <img loading="lazy" src="${image}" alt="${title}">
            <div class="play-overlay">
                <span class="material-symbols-rounded">play_arrow</span>
            </div>
        </div>
        <div class="song-info">
            <h4>${title}</h4>
            <p>${artist}</p>
        </div>
    `;

    // Click handler to play
    card.addEventListener('click', () => {
        handlePlayContext(song);
    });

    return card;
}

function renderCards(songs, container) {
    container.innerHTML = '';
    if (!songs || songs.length === 0) {
        container.innerHTML = `<p class="text-muted">No results found.</p>`;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    songs.forEach(song => {
        fragment.appendChild(createSongCard(song));
    });
    container.appendChild(fragment);
}

function switchView(viewId) {
    state.currentView = viewId;
    
    DOM.navItems.forEach(item => {
        if (item.dataset.target === viewId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    DOM.views.forEach(view => {
        if (view.id === `view-${viewId}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    if (viewId === 'favorites') renderCards(state.favorites, DOM.grids.favorites);
    if (viewId === 'recent') renderCards(state.recent, DOM.grids.recent);
    if (viewId === 'search') DOM.searchInput.focus();
}

/* ==========================================================================
   Player Logic
   ========================================================================== */
function getBestDownloadUrl(downloadUrlArray) {
    if (!downloadUrlArray || !Array.isArray(downloadUrlArray)) return null;
    
    let best = downloadUrlArray.find(item => item.quality === '320kbps');
    if (best) return best.url;

    return downloadUrlArray[downloadUrlArray.length - 1].url;
}

async function handlePlayContext(song) {
    try {
        showToast('Loading track...', 'info');
        
        let trackData = song;
        if (!song.downloadUrl) {
            const res = await fetchAPI(`/songs/${song.id}`);
            if (res && res.data && res.data.length > 0) {
                trackData = res.data[0];
            }
        }

        const url = getBestDownloadUrl(trackData.downloadUrl);
        if (!url) {
            showToast('Audio unavailable for this track', 'error');
            return;
        }

        state.queue = [trackData];
        state.currentIndex = 0;
        
        loadAndPlayCurrent();
        addToRecent(trackData);

    } catch (error) {
        showToast('Failed to play track', 'error');
    }
}

function loadAndPlayCurrent() {
    if (state.currentIndex < 0 || state.currentIndex >= state.queue.length) return;
    
    const track = state.queue[state.currentIndex];
    const url = getBestDownloadUrl(track.downloadUrl);
    
    DOM.audio.src = url;
    DOM.audio.load();
    
    const title = decodeEntities(track.name);
    const artist = track.artists ? decodeEntities(track.artists.primary[0]?.name || 'Unknown') : 'Unknown';
    const image = track.image ? track.image[track.image.length - 1].url : '';

    DOM.player.title.textContent = title;
    DOM.player.artist.textContent = artist;
    DOM.player.cover.src = image;
    DOM.player.cover.classList.remove('hidden');
    DOM.player.albumArtContainer.querySelector('.placeholder-icon').classList.add('hidden');
    
    DOM.player.likeBtn.classList.remove('hidden');
    updateLikeButton(track.id);

    playAudio();
}

function playAudio() {
    DOM.audio.play().then(() => {
        state.isPlaying = true;
        DOM.player.playIcon.textContent = 'pause';
        DOM.player.albumArtContainer.classList.add('playing');
    }).catch(err => {
        console.error("Playback blocked", err);
        showToast('Playback blocked by browser', 'error');
    });
}

function pauseAudio() {
    DOM.audio.pause();
    state.isPlaying = false;
    DOM.player.playIcon.textContent = 'play_arrow';
    DOM.player.albumArtContainer.classList.remove('playing');
}

function togglePlay() {
    if (state.queue.length === 0) return;
    state.isPlaying ? pauseAudio() : playAudio();
}

function nextTrack() {
    if (state.queue.length === 0) return;
    if (state.isShuffle) {
        state.currentIndex = Math.floor(Math.random() * state.queue.length);
    } else {
        state.currentIndex = (state.currentIndex + 1) % state.queue.length;
    }
    loadAndPlayCurrent();
}

function prevTrack() {
    if (state.queue.length === 0) return;
    if (DOM.audio.currentTime > 3) {
        DOM.audio.currentTime = 0; 
    } else {
        state.currentIndex = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
        loadAndPlayCurrent();
    }
}

/* ==========================================================================
   Audio Event Listeners
   ========================================================================== */
DOM.audio.addEventListener('timeupdate', () => {
    if(!DOM.audio.duration) return;
    const current = DOM.audio.currentTime;
    const duration = DOM.audio.duration;
    
    const progressPercent = (current / duration) * 100;
    DOM.player.progressBar.style.width = `${progressPercent}%`;
    
    DOM.player.currentTime.textContent = formatTime(current);
    DOM.player.totalTime.textContent = formatTime(duration);
});

DOM.audio.addEventListener('ended', () => {
    if (state.repeatMode === 2) {
        DOM.audio.currentTime = 0;
        playAudio();
    } else if (state.repeatMode === 1 || state.currentIndex < state.queue.length - 1) {
        nextTrack();
    } else {
        pauseAudio();
        DOM.audio.currentTime = 0;
    }
});

/* ==========================================================================
   User Interactions & Events
   ========================================================================== */
function setupEventListeners() {
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(e.currentTarget.dataset.target);
        });
    });

    DOM.searchInput.addEventListener('input', debounce(handleSearch, 600));

    DOM.player.playBtn.addEventListener('click', togglePlay);
    DOM.player.nextBtn.addEventListener('click', nextTrack);
    DOM.player.prevBtn.addEventListener('click', prevTrack);
    
    DOM.player.progressContainer.addEventListener('click', (e) => {
        if(state.queue.length === 0) return;
        const rect = DOM.player.progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        DOM.audio.currentTime = pos * DOM.audio.duration;
    });

    DOM.player.volumeContainer.addEventListener('click', (e) => {
        const rect = DOM.player.volumeContainer.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        setVolume(pos);
    });

    DOM.player.muteBtn.addEventListener('click', () => {
        state.isMuted = !state.isMuted;
        DOM.audio.muted = state.isMuted;
        DOM.player.volumeIcon.textContent = state.isMuted ? 'volume_off' : (state.volume > 0.5 ? 'volume_up' : 'volume_down');
        DOM.player.volumeBar.style.width = state.isMuted ? '0%' : `${state.volume * 100}%`;
    });

    DOM.player.shuffleBtn.addEventListener('click', () => {
        state.isShuffle = !state.isShuffle;
        DOM.player.shuffleBtn.classList.toggle('active', state.isShuffle);
    });

    DOM.player.repeatBtn.addEventListener('click', () => {
        state.repeatMode = (state.repeatMode + 1) % 3;
        DOM.player.repeatBtn.classList.toggle('active', state.repeatMode > 0);
        DOM.player.repeatIcon.textContent = state.repeatMode === 2 ? 'repeat_one' : 'repeat';
    });

    DOM.player.likeBtn.addEventListener('click', () => {
        if(state.queue.length === 0) return;
        toggleFavorite(state.queue[state.currentIndex]);
    });

    document.addEventListener('keydown', (e) => {
        if(e.target.tagName === 'INPUT') return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextTrack();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                prevTrack();
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(Math.min(1, state.volume + 0.1));
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(Math.max(0, state.volume - 0.1));
                break;
            case 'KeyM':
                e.preventDefault();
                DOM.player.muteBtn.click();
                break;
        }
    });

    document.getElementById('exploreBtn')?.addEventListener('click', () => {
        switchView('search');
    });
}

/* ==========================================================================
   Helper Functions
   ========================================================================== */
async function handleSearch(e) {
    const query = e.target.value.trim();
    
    if (currentSearchController) {
        currentSearchController.abort();
    }

    if (!query) {
        DOM.searchEmpty.style.display = 'flex';
        DOM.grids.search.innerHTML = '';
        return;
    }

    currentSearchController = new AbortController();

    DOM.searchEmpty.style.display = 'none';
    DOM.searchSpinner.style.display = 'block';
    renderSkeletons(DOM.grids.search, 8);

    try {
        const res = await fetchAPI(
            `/search/songs?query=${encodeURIComponent(query)}`, 
            currentSearchController.signal
        );

        if (res && res.data && res.data.results) {
            renderCards(res.data.results, DOM.grids.search);
        } else if (res) {
            DOM.grids.search.innerHTML = `<p class="text-muted">No results found for "${query}"</p>`;
        }
    } catch (error) {
        if (error && error.name !== 'AbortError') {
            showToast(error.message || 'Search failed', 'error');
            DOM.grids.search.innerHTML = `<p class="text-muted">${error.message}</p>`;
        }
    } finally {
        if (currentSearchController && !currentSearchController.signal.aborted) {
            DOM.searchSpinner.style.display = 'none';
        }
    }
}

function setVolume(level) {
    state.volume = level;
    DOM.audio.volume = level;
    state.isMuted = false;
    DOM.audio.muted = false;
    DOM.player.volumeBar.style.width = `${level * 100}%`;
    DOM.player.volumeIcon.textContent = level > 0.5 ? 'volume_up' : (level > 0 ? 'volume_down' : 'volume_mute');
}

function addToRecent(song) {
    state.recent = state.recent.filter(s => s.id !== song.id);
    state.recent.unshift(song);
    if(state.recent.length > 20) state.recent.pop();
    
    localStorage.setItem('moonwitch_recent', JSON.stringify(state.recent));
    
    if (state.currentView === 'recent') renderCards(state.recent, DOM.grids.recent);
}

function toggleFavorite(song) {
    const existsIndex = state.favorites.findIndex(s => s.id === song.id);
    
    if (existsIndex >= 0) {
        state.favorites.splice(existsIndex, 1);
        showToast('Removed from favorites', 'info');
    } else {
        state.favorites.unshift(song);
        showToast('Added to favorites', 'success');
    }
    
    localStorage.setItem('moonwitch_favorites', JSON.stringify(state.favorites));
    updateLikeButton(song.id);
    
    if (state.currentView === 'favorites') renderCards(state.favorites, DOM.grids.favorites);
}

function updateLikeButton(songId) {
    const isFav = state.favorites.some(s => s.id === songId);
    if(isFav) {
        DOM.player.likeBtn.querySelector('span').style.fontVariationSettings = "'FILL' 1";
        DOM.player.likeBtn.classList.add('active');
    } else {
        DOM.player.likeBtn.querySelector('span').style.fontVariationSettings = "'FILL' 0";
        DOM.player.likeBtn.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = 'info';
    if (type === 'error') icon = 'error';
    if (type === 'success') icon = 'check_circle';
    
    toast.innerHTML = `<span class="material-symbols-rounded">${icon}</span> ${message}`;
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if(toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function decodeEntities(encodedString) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = encodedString || '';
    return textArea.value;
}
