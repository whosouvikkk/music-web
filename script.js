const API="https://musicapi.x007.workers.dev";

const results=document.getElementById("results");

const btn=document.getElementById("btn");

const search=document.getElementById("search");

const cover=document.getElementById("cover");

const title=document.getElementById("title");

const audio=document.getElementById("audio");

btn.onclick=searchSongs;

search.addEventListener("keypress",e=>{

if(e.key==="Enter")searchSongs();

});

async function searchSongs(){

results.innerHTML="Searching...";

const q=search.value.trim();

const res=await fetch(`${API}/search?q=${encodeURIComponent(q)}&searchEngine=gaama`);

const data=await res.json();

results.innerHTML="";

data.response.forEach(song=>{

const card=document.createElement("div");

card.className="card";

card.innerHTML=`

<img src="${song.img}">

<h3>${song.title}</h3>

`;

card.onclick=()=>playSong(song);

results.appendChild(card);

});

}

async function playSong(song){

cover.src=song.img;

title.innerText=song.title;

const res=await fetch(`${API}/fetch?id=${song.id}`);

const data=await res.json();

audio.src=data.response;

audio.play();

}
