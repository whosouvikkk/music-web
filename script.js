// script.js
// Base JioSaavn player

const API="https://saavn.sumit.co/api";
const audio=document.getElementById("audio");
const results=document.getElementById("results");
const searchInput=document.getElementById("searchInput");
const searchBtn=document.getElementById("searchBtn");
const cover=document.getElementById("cover");
const songTitle=document.getElementById("songTitle");
const artist=document.getElementById("artist");
const playPauseBtn=document.getElementById("playPauseBtn");
const prevBtn=document.getElementById("prevBtn");
const nextBtn=document.getElementById("nextBtn");
const progress=document.getElementById("progress");
const volume=document.getElementById("volume");

let queue=[],currentIndex=-1;

function img(s){return (s.image&&s.image.at(-1)?.url)||"";}
function artists(s){return s.artists?.primary?.map(a=>a.name).join(", ")||"Unknown";}

async function searchSongs(){
 const q=searchInput.value.trim();
 if(!q) return;
 results.innerHTML="<p>Searching...</p>";
 const r=await fetch(`${API}/search/songs?query=${encodeURIComponent(q)}`);
 const j=await r.json();
 queue=j.data.results||[];
 results.innerHTML="";
 queue.forEach((s,i)=>{
   const c=document.createElement("div");
   c.className="card";
   c.innerHTML=`<img src="${img(s)}"><h3>${s.name}</h3><p>${artists(s)}</p>`;
   c.onclick=()=>loadSong(i);
   results.appendChild(c);
 });
}

async function loadSong(i){
 currentIndex=i;
 const r=await fetch(`${API}/songs/${queue[i].id}`);
 const j=await r.json();
 const s=j.data[0];
 const best=s.downloadUrl.find(x=>x.quality==="320kbps")||s.downloadUrl.at(-1);
 audio.src=best.url;
 cover.src=img(s);
 songTitle.textContent=s.name;
 artist.textContent=artists(s);
 await audio.play();
 playPauseBtn.textContent="⏸";
 cover.classList.add("playing");
}

searchBtn.onclick=searchSongs;
searchInput.onkeydown=e=>{if(e.key==="Enter")searchSongs();};

playPauseBtn.onclick=()=>{
 if(!audio.src)return;
 if(audio.paused){audio.play();playPauseBtn.textContent="⏸";cover.classList.add("playing");}
 else{audio.pause();playPauseBtn.textContent="▶";cover.classList.remove("playing");}
};

prevBtn.onclick=()=>{if(currentIndex>0)loadSong(currentIndex-1);};
nextBtn.onclick=()=>{if(currentIndex<queue.length-1)loadSong(currentIndex+1);};

audio.ontimeupdate=()=>{
 if(audio.duration)progress.value=(audio.currentTime/audio.duration)*100;
};
progress.oninput=()=>{
 if(audio.duration)audio.currentTime=(progress.value/100)*audio.duration;
};
volume.oninput=()=>audio.volume=volume.value;
audio.onended=()=>{if(currentIndex<queue.length-1)loadSong(currentIndex+1);};
