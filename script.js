const CLIENT_ID = "3e916e6d";
const API = "https://api.jamendo.com/v3.0/tracks/";

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const results = document.getElementById("results");

const audio = document.getElementById("audio");
const cover = document.getElementById("cover");
const songTitle = document.getElementById("songTitle");
const artist = document.getElementById("artist");

let tracks = [];
let currentTrack = -1;

// Search button
searchBtn.addEventListener("click", searchSongs);

// Press Enter to search
searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        searchSongs();
    }
});

async function searchSongs() {

    const query = searchInput.value.trim();

    if (!query) return;

    results.innerHTML = "<h2>Searching...</h2>";

    try {

        const response = await fetch(

            `https://api.jamendo.com/v3.0/tracks/?client_id=${CLIENT_ID}&format=json&limit=20&audioformat=mp32&search=${encodeURIComponent(query)}`

        );

        const data = await response.json();

        console.log(data);

        tracks = data.results;

        results.innerHTML = "";

        if (!tracks || tracks.length === 0) {

            results.innerHTML = "<h2>No Songs Found</h2>";

            return;

        }

        tracks.forEach((track, index) => {

            const card = document.createElement("div");

            card.className = "card";

            card.innerHTML = `

                <img src="${track.image}" alt="">

                <h3>${track.name}</h3>

                <p>${track.artist_name}</p>

            `;

            card.onclick = () => playSong(index);

            results.appendChild(card);

        });

    } catch (err) {

        console.error(err);

        results.innerHTML = "<h2>Failed to fetch songs.</h2>";

    }

}

function playSong(index) {

    currentTrack = index;

    const track = tracks[index];

    songTitle.textContent = track.name;

    artist.textContent = track.artist_name;

    cover.src = track.image;

    // Try direct audio if available
    if (track.audio) {

        audio.src = track.audio;

    } else {

        // Fallback stream endpoint
        audio.src = `https://api.jamendo.com/v3.0/tracks/file/?client_id=${CLIENT_ID}&id=${track.id}&action=stream`;

    }

    audio.play().catch(err => {

        console.log(err);

        alert("Playback failed. Open F12 → Console and tell me the error.");

    });

    localStorage.setItem("lastTrack", JSON.stringify(track));

}

// Restore last played track
window.addEventListener("load", () => {

    const last = localStorage.getItem("lastTrack");

    if (!last) return;

    const track = JSON.parse(last);

    songTitle.textContent = track.name;

    artist.textContent = track.artist_name;

    cover.src = track.image;

});

// Auto play next song
audio.addEventListener("ended", () => {

    if (currentTrack < tracks.length - 1) {

        playSong(currentTrack + 1);

    }

});
