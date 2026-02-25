import { openDB } from 'idb'

const db = await openDB('notes-db', 1, {
  upgrade(db) {
    db.createObjectStore('notes', { keyPath: 'id' })
  }
})

const note = document.getElementById('note')
const list = document.getElementById('list')

async function load() {
  list.innerHTML = ''
  const notes = await db.getAll('notes')
  notes.forEach(n => {
    const li = document.createElement('li')
    li.textContent = n.text
    list.appendChild(li)
  })
}

document.getElementById('save').onclick = async () => {
  await db.put('notes', {
    id: crypto.randomUUID(),
    text: note.value,
    createdAt: Date.now()
  })
  note.value = ''
  load()
}

load()