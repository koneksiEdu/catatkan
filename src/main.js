import { openDB } from 'idb'

const db = await openDB('notes-db', 1, {
  upgrade(db) {
    db.createObjectStore('notes', { keyPath: 'id' })
  }
})

const noteEl = document.getElementById('note')
const listEl = document.getElementById('list')
const saveBtn = document.getElementById('save')
const charCount = document.getElementById('char-count')
const modal = document.getElementById('modal-overlay')
const editTextarea = document.getElementById('edit-textarea')
const toast = document.getElementById('toast')
const toastMsg = document.getElementById('toast-msg')
const countBadge = document.getElementById('note-count-badge')

let editingId = null
let deletedNote = null
let toastTimer = null

// Char counter
noteEl.addEventListener('input', () => {
  const len = noteEl.value.length
  charCount.textContent = `${len} / 500`
  saveBtn.disabled = len === 0
})

// Format relative time
function formatTime(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'Baru saja'
  if (m < 60) return `${m} menit lalu`
  if (h < 24) return `${h} jam lalu`
  if (d < 7) return `${d} hari lalu`
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function load() {
  listEl.innerHTML = ''
  const notes = await db.getAll('notes')
  notes.sort((a, b) => b.createdAt - a.createdAt)

  // Update badge
  countBadge.innerHTML = notes.length > 0
    ? `<span class="count-badge">${notes.length}</span>`
    : ''

  if (notes.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗒️</div>
        <div class="empty-title">Belum ada catatan</div>
        <div class="empty-desc">Tulis sesuatu di atas untuk memulai</div>
      </div>`
    return
  }

  notes.forEach(n => {
    const item = document.createElement('div')
    item.className = 'note-item'
    item.dataset.id = n.id
    item.innerHTML = `
      <div class="note-body">
        <div class="note-text">${escapeHtml(n.text)}</div>
        <div class="note-meta">
          <span>🕐</span>
          <span>${formatTime(n.createdAt)}</span>
        </div>
      </div>
      <div class="note-actions">
        <button class="btn-edit" data-id="${n.id}">✏️ Edit</button>
        <button class="btn-delete" data-id="${n.id}">🗑️ Hapus</button>
      </div>
    `
    listEl.appendChild(item)
  })
}

// Delegated event listeners for edit and delete buttons
listEl.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('.btn-edit')
  const deleteBtn = e.target.closest('.btn-delete')

  if (editBtn) {
    const id = editBtn.dataset.id
    const note = await db.get('notes', id)
    openEdit(note.id, note.text)
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id
    await deleteNote(id)
  }
})

// Save
saveBtn.addEventListener('click', async () => {
  const text = noteEl.value.trim()
  if (!text) return
  await db.put('notes', { id: crypto.randomUUID(), text, createdAt: Date.now() })
  noteEl.value = ''
  charCount.textContent = '0 / 500'
  saveBtn.disabled = true
  load()
})

// Edit modal
function openEdit(id, text) {
  editingId = id
  editTextarea.value = text
  modal.classList.add('open')
  setTimeout(() => editTextarea.focus(), 300)
}

modal.addEventListener('click', e => {
  if (e.target === modal) closeModal()
})

document.getElementById('cancel-edit').addEventListener('click', closeModal)

document.getElementById('confirm-edit').addEventListener('click', async () => {
  const newText = editTextarea.value.trim()
  if (!newText || !editingId) return
  const note = await db.get('notes', editingId)
  await db.put('notes', { ...note, text: newText })
  closeModal()
  load()
  showToast('✅ Catatan diperbarui', false)
})

function closeModal() {
  modal.classList.remove('open')
  editingId = null
}

// Delete with undo
async function deleteNote(id) {
  deletedNote = await db.get('notes', id)
  await db.delete('notes', id)
  load()
  showToast('🗑️ Catatan dihapus', true)
}

function showToast(msg, withUndo) {
  clearTimeout(toastTimer)
  toastMsg.textContent = msg
  document.getElementById('toast-undo').style.display = withUndo ? '' : 'none'
  toast.classList.add('show')
  toastTimer = setTimeout(() => {
    toast.classList.remove('show')
    deletedNote = null
  }, 3500)
}

document.getElementById('toast-undo').addEventListener('click', async () => {
  if (deletedNote) {
    await db.put('notes', deletedNote)
    deletedNote = null
    toast.classList.remove('show')
    load()
  }
})

load()