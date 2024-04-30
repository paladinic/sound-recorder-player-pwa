const recordButton = document.getElementById('recordButton');
const soundButtonsContainer = document.getElementById('soundButtons');

let mediaRecorder = null;
let audioChunks = [];
let globalStream = null; 

const sounds = {
    kick: new Audio(),
    snare: new Audio(),
    hat: new Audio()
};

window.onbeforeunload = () => {
    if (globalStream) {
        const tracks = globalStream.getTracks();
        tracks.forEach(track => track.stop());
    }
};

document.addEventListener('DOMContentLoaded', async () => {

    try {
        globalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
        console.error("Failed to get media: ", error);
        alert("The application cannot function without microphone access.");
    }

    sounds.kick.src = './assets/sounds/kick.wav';
    sounds.snare.src = './assets/sounds/snare.wav';
    sounds.hat.src = './assets/sounds/hat.wav';

    // Ensure sounds are fully loaded before they can be played
    await Promise.all([
        new Promise(resolve => sounds.kick.oncanplaythrough = resolve),
        new Promise(resolve => sounds.snare.oncanplaythrough = resolve),
        new Promise(resolve => sounds.hat.oncanplaythrough = resolve)
    ]);
    
    // Load sounds from IndexedDB
    const db = await setupDB();
    await loadSounds(db);

    const recordButton = document.getElementById('recordButton');
    let mediaRecorder = null;
    let audioChunks = [];

    recordButton.addEventListener('click', async () => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            mediaRecorder = new MediaRecorder(globalStream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks);
                const count = await getSoundCount(db);  // Fetch the current number of sounds
                const audioName = `Sound ${count + 1}`; // Increment to get the new sound number
                const soundId = await storeSound(db, audioName, audioBlob); 
            
                const soundContainer = document.createElement('div');
                soundContainer.classList.add("sound-container");
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                const playButton = document.createElement('button');
                playButton.classList.add("playButton");
                playButton.textContent = audioName;
                playButton.addEventListener('click', () => audio.play());
            
                const renameButton = document.createElement('button');
                renameButton.textContent = 'Rename';
                renameButton.classList.add('rename-button');
                renameButton.addEventListener('click', () => renameSound(db, soundId, soundContainer, audioName));
            
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('delete-button');
                deleteButton.addEventListener('click', () => {
                    if (confirm(`Are you sure you want to delete "${audioName}"?`)) {
                        deleteSound(db, soundId);
                        soundContainer.remove();
                    }
                });
            
                soundContainer.appendChild(playButton);
                soundContainer.appendChild(renameButton);
                soundContainer.appendChild(deleteButton);
                document.getElementById('soundButtons').appendChild(soundContainer);
            };
            
            

            mediaRecorder.start();
            recordButton.textContent = "Stop";
        } else if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            recordButton.textContent = "Record";
        }
    });
});
document.querySelectorAll('.playButton').forEach(button => {
    button.addEventListener('click', () => sounds[button.getAttribute('data-sound')].play())
});

async function setupDB() {
    const db = await idb.openDB('soundDB', 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('sounds')) {
                const store = db.createObjectStore('sounds', {keyPath: 'id', autoIncrement: true});
                store.createIndex('name', 'name', {unique: false});
            }
        }
    });
    return db;
}
async function getSoundCount(db) {
    const tx = db.transaction('sounds', 'readonly');
    const store = tx.objectStore('sounds');
    const count = await store.count();
    await tx.done;
    return count;
}
async function storeSound(db, name, blob) {
    const tx = db.transaction('sounds', 'readwrite');
    const store = tx.objectStore('sounds');
    const item = {
        name: name,
        blob: blob,
        createdAt: new Date()
    };
    const soundId = await store.add(item);
    await tx.done;
    return soundId;  // Return the ID of the new sound
}
async function loadSounds(db) {
    const tx = db.transaction('sounds', 'readonly');
    const store = tx.objectStore('sounds');
    const sounds = await store.getAll();

    sounds.forEach(sound => {
        const soundContainer = document.createElement('div');
        soundContainer.classList.add("sound-container");

        const playButton = document.createElement('button');
        playButton.classList.add("playButton");
        playButton.textContent = sound.name;
        const audioUrl = URL.createObjectURL(sound.blob);
        const audio = new Audio(audioUrl);
        playButton.addEventListener('click', () => audio.play());

        const renameButton = document.createElement('button');
        renameButton.textContent = 'Rename';
        renameButton.classList.add('rename-button');
        renameButton.addEventListener('click', () => renameSound(db, sound.id, soundContainer, sound.name));

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('delete-button');
        deleteButton.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete "${sound.name}"?`)) {
                deleteSound(db, sound.id);
                soundContainer.remove();
            }
        });

        soundContainer.appendChild(playButton);
        soundContainer.appendChild(renameButton);
        soundContainer.appendChild(deleteButton);
        document.getElementById('soundButtons').appendChild(soundContainer);
    });

    await tx.done;
}
async function renameSound(db, id, container, oldName) {
    const newName = prompt("Enter new name for the sound:", oldName);
    if (newName && newName !== oldName) {
        const tx = db.transaction('sounds', 'readwrite');
        const store = tx.objectStore('sounds');
        const sound = await store.get(id);
        if (sound) {
            sound.name = newName;
            await store.put(sound);
            await tx.done;
            container.querySelector('button').textContent = newName;
        }
    }
}
async function deleteSound(db, id) {
    const tx = db.transaction('sounds', 'readwrite');
    const store = tx.objectStore('sounds');
    await store.delete(id);
    await tx.done;
}
