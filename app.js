// ==========================================
// CONFIGURATION
// ==========================================
// Change this ONE variable to your Vercel backend URL after deployment.
// Example: const API_BASE = "https://my-music-api.vercel.app/api";
const API_BASE = "https://music-api-beta-six.vercel.app/api";

// ==========================================
// STATE MANAGEMENT
// ==========================================
const state = {
    currentQueue: [],
    currentIndex: -1,
    isPlaying: false,
    isShuffle: false,
    isRepeat: false,
    audio: new Audio()
};

// ==========================================
// DOM ELEMENTS
// ==========================================
const DOM = {
    searchInput: document.getElementById('searchInput'),
    songsGrid: document.getElementById('songsGrid'),
    sectionTitle: document.getElementById('sectionTitle'),
    btnPlayPause: document.getElementById('btnPlayPause'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    btnShuffle: document.getElementById('btnShuffle'),
    btnRepeat: document.getElementById('btnRepeat'),
    progressBar: document.getElementById('progressBar'),
    volumeBar: document.getElementById('volumeBar'),
    timeCurrent: document.getElementById('timeCurrent'),
    timeTotal: document.getElementById('timeTotal'),
    playerArtwork: document.getElementById('playerArtwork'),
    playerTitle: document.getElementById('playerTitle'),
    playerArtist: document.getElementById('playerArtist'),
    toast: document.getElementById('toast'),
    greeting: document.getElementById('greeting')
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setGreeting();
    setupEventListeners();
    fetchTrending();
});

function setGreeting() {
    const hour = new Date().getHours();
    let text = 'Good evening';
    if (hour < 12) text = 'Good morning';
    else if (hour < 18) text = 'Good afternoon';
    DOM.greeting.innerText = text;
}

// ==========================================
// API CALLS
// ==========================================
async function fetchTrending() {
    renderSkeletons();
    try {
        const response = await fetch(`${API_BASE}/trending`);
        const result = await response.json();
        if (result.success) {
            state.currentQueue = result.data;
            renderGrid(result.data);
            DOM.sectionTitle.innerText = "Trending Now";
        } else {
            throw new Error('Failed to fetch data');
        }
    } catch (error) {
        showToast("Error loading trending songs. Is the backend running?");
        DOM.songsGrid.innerHTML = '';
    }
}

async function searchSongs(query) {
    if (!query.trim()) return fetchTrending();
    renderSkeletons();
    try {
        const response = await fetch(`${API_BASE}/search/songs?query=${encodeURIComponent(query)}`);
        const result = await response.json();
        if (result.success) {
            state.currentQueue = result.data;
            renderGrid(result.data);
            DOM.sectionTitle.innerText = `Search results for "${query}"`;
        }
    } catch (error) {
        showToast("Search failed.");
        DOM.songsGrid.innerHTML = '';
    }
}

async function playSongById(id) {
    try {
        // Find in queue first to avoid extra API call if possible
        let song = state.currentQueue.find(s => s.id === id);
        
        // If not in current queue or lacks URL, fetch detail
        if (!song || !song.url) {
            const response = await fetch(`${API_BASE}/songs/${id}`);
            const result = await response.json();
            if (result.success) song = result.data;
        }

        if (!song || !song.url) {
            showToast("Stream URL not found for this song.");
            return;
        }

        // Update queue index
        state.currentIndex = state.currentQueue.findIndex(s => s.id === song.id);
        
        loadAndPlay(song);
    } catch (error) {
        showToast("Error playing song.");
    }
}

// ==========================================
// PLAYER LOGIC
// ==========================================
function loadAndPlay(song) {
    state.audio.src = song.url;
    state.audio.load();
    
    // Update UI
    DOM.playerArtwork.src = song.image || 'assets/default-art.png';
    DOM.playerTitle.innerText = song.title;
    DOM.playerArtist.innerText = song.subtitle || song.primary_artists || 'Unknown Artist';
    
    togglePlay(true);
}

function togglePlay(forcePlay = null) {
    if (!state.audio.src) return;

    if (forcePlay === true || state.audio.paused) {
        state.audio.play().then(() => {
            state.isPlaying = true;
            DOM.btnPlayPause.innerHTML = '<i class="fa-solid fa-circle-pause"></i>';
        }).catch(() => showToast("Playback failed. Click to interact first."));
    } else {
        state.audio.pause();
        state.isPlaying = false;
        DOM.btnPlayPause.innerHTML = '<i class="fa-solid fa-circle-play"></i>';
    }
}

function playNext() {
    if (state.currentQueue.length === 0) return;
    
    if (state.isShuffle) {
        state.currentIndex = Math.floor(Math.random() * state.currentQueue.length);
    } else {
        state.currentIndex = (state.currentIndex + 1) % state.currentQueue.length;
    }
    playSongById(state.currentQueue[state.currentIndex].id);
}

function playPrev() {
    if (state.currentQueue.length === 0) return;
    
    // If song played more than 3 seconds, restart it
    if (state.audio.currentTime > 3) {
        state.audio.currentTime = 0;
        return;
    }

    state.currentIndex = (state.currentIndex - 1 + state.currentQueue.length) % state.currentQueue.length;
    playSongById(state.currentQueue[state.currentIndex].id);
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    // Search with debounce
    let timeout = null;
    DOM.searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => searchSongs(e.target.value), 600);
    });

    // Player Controls
    DOM.btnPlayPause.addEventListener('click', () => togglePlay());
    DOM.btnNext.addEventListener('click', playNext);
    DOM.btnPrev.addEventListener('click', playPrev);
    
    DOM.btnShuffle.addEventListener('click', () => {
        state.isShuffle = !state.isShuffle;
        DOM.btnShuffle.classList.toggle('active', state.isShuffle);
    });

    DOM.btnRepeat.addEventListener('click', () => {
        state.isRepeat = !state.isRepeat;
        state.audio.loop = state.isRepeat;
        DOM.btnRepeat.classList.toggle('active', state.isRepeat);
    });

    // Progress bar
    state.audio.addEventListener('timeupdate', () => {
        if (!state.audio.duration) return;
        const percent = (state.audio.currentTime / state.audio.duration) * 100;
        DOM.progressBar.value = percent;
        DOM.timeCurrent.innerText = formatTime(state.audio.currentTime);
        DOM.timeTotal.innerText = formatTime(state.audio.duration);
    });

    state.audio.addEventListener('ended', () => {
        if (!state.isRepeat) playNext();
    });

    DOM.progressBar.addEventListener('input', (e) => {
        if (!state.audio.duration) return;
        const seekTo = (e.target.value / 100) * state.audio.duration;
        state.audio.currentTime = seekTo;
    });

    // Volume
    DOM.volumeBar.addEventListener('input', (e) => {
        state.audio.volume = e.target.value / 100;
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Prevent shortcuts if typing in search
        if (document.activeElement === DOM.searchInput) return;

        switch(e.code) {
            case 'Space':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowRight':
                e.preventDefault();
                playNext();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                playPrev();
                break;
        }
    });
}

// ==========================================
// UI RENDERERS
// ==========================================
function renderGrid(songs) {
    DOM.songsGrid.innerHTML = '';
    songs.forEach(song => {
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => playSongById(song.id);
        
        card.innerHTML = `
            <img src="${song.image || 'assets/default-art.png'}" alt="Cover">
            <div class="play-overlay"><i class="fa-solid fa-play"></i></div>
            <h3>${song.title}</h3>
            <p>${song.subtitle || song.primary_artists || 'Artist'}</p>
        `;
        DOM.songsGrid.appendChild(card);
    });
}

function renderSkeletons() {
    DOM.songsGrid.innerHTML = Array(10).fill(`
        <div class="card skeleton">
            <div class="skeleton-img"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-text short"></div>
        </div>
    `).join('');
}

// ==========================================
// UTILS
// ==========================================
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function showToast(message) {
    DOM.toast.innerText = message;
    DOM.toast.classList.add('show');
    setTimeout(() => DOM.toast.classList.remove('show'), 3000);
}
