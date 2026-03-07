import { openDB } from 'idb'

const db = await openDB('todo-db', 1, {
  upgrade(db) {
    db.createObjectStore('todos', { keyPath: 'id' })
  }
})

const inputEl = document.getElementById('todo-input')
const listEl = document.getElementById('list')
const saveBtn = document.getElementById('save')
const modal = document.getElementById('modal-overlay')
const editInput = document.getElementById('edit-input')
const toast = document.getElementById('toast')
const toastMsg = document.getElementById('toast-msg')
const countBadge = document.getElementById('todo-count-badge')
const progressFill = document.getElementById('progress-fill')
const progressLabel = document.getElementById('progress-label')
const sectionTitle = document.getElementById('section-title')
const prioritySelect = document.getElementById('priority-select')

let editingId = null
let editingPriority = 'medium'
let deletedTodo = null
let toastTimer = null
let currentFilter = 'all'

// Enable save on input
inputEl.addEventListener('input', () => {
  saveBtn.disabled = inputEl.value.trim().length === 0
})

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !saveBtn.disabled) saveTodo()
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

const priorityLabel = { high: 'Tinggi', medium: 'Sedang', low: 'Rendah' }
const priorityIcon = { high: '🔴', medium: '🟡', low: '🟢' }

async function load() {
  listEl.innerHTML = ''
  const allTodos = await db.getAll('todos')
  allTodos.sort((a, b) => b.createdAt - a.createdAt)

  const total = allTodos.length
  const doneCount = allTodos.filter(t => t.done).length
  const activeCount = total - doneCount

  // Update badge
  countBadge.innerHTML = total > 0
    ? `<span class="count-badge">${activeCount} aktif</span>`
    : ''

  // Update progress
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100)
  progressFill.style.width = pct + '%'
  progressLabel.textContent = `${doneCount} / ${total} selesai`

  // Filter
  let todos = allTodos
  if (currentFilter === 'active') {
    todos = allTodos.filter(t => !t.done)
    sectionTitle.textContent = 'Tugas Aktif'
  } else if (currentFilter === 'done') {
    todos = allTodos.filter(t => t.done)
    sectionTitle.textContent = 'Tugas Selesai'
  } else {
    sectionTitle.textContent = 'Semua Tugas'
  }

  if (todos.length === 0) {
    const emptyMessages = {
      all: { icon: '📋', title: 'Belum ada tugas', desc: 'Tambahkan tugas baru di atas' },
      active: { icon: '🎉', title: 'Semua selesai!', desc: 'Tidak ada tugas yang tersisa' },
      done: { icon: '📭', title: 'Belum ada yang selesai', desc: 'Selesaikan tugas aktifmu dulu' },
    }
    const msg = emptyMessages[currentFilter]
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${msg.icon}</div>
        <div class="empty-title">${msg.title}</div>
        <div class="empty-desc">${msg.desc}</div>
      </div>`
    return
  }

  todos.forEach(t => {
    const item = document.createElement('div')
    item.className = 'todo-item' + (t.done ? ' done' : '')
    item.dataset.id = t.id
    item.innerHTML = `
      <div class="todo-check ${t.done ? 'checked' : ''}" data-check="${t.id}">
        ${t.done ? '✓' : ''}
      </div>
      <div class="priority-dot ${t.priority || 'medium'}"></div>
      <div class="todo-body">
        <div class="todo-text">${escapeHtml(t.text)}</div>
        <div class="todo-meta">
          <span>${priorityIcon[t.priority || 'medium']}</span>
          <span>${priorityLabel[t.priority || 'medium']}</span>
          <span>·</span>
          <span>🕐 ${formatTime(t.createdAt)}</span>
        </div>
      </div>
      <div class="todo-actions">
        ${!t.done ? `<button class="btn-edit" data-id="${t.id}">✏️</button>` : ''}
        <button class="btn-delete" data-id="${t.id}">🗑️</button>
      </div>
    `
    listEl.appendChild(item)
  })
}

// Delegated events
listEl.addEventListener('click', async (e) => {
  const checkEl = e.target.closest('[data-check]')
  const editBtn = e.target.closest('.btn-edit')
  const deleteBtn = e.target.closest('.btn-delete')

  if (checkEl) {
    const id = checkEl.dataset.check
    const todo = await db.get('todos', id)
    await db.put('todos', { ...todo, done: !todo.done })
    load()
    showToast(todo.done ? '↩️ Ditandai aktif' : '✅ Tugas selesai!', false)
  }

  if (editBtn) {
    const id = editBtn.dataset.id
    const todo = await db.get('todos', id)
    openEdit(todo)
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id
    await deleteTodo(id)
  }
})

// Filter tabs
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentFilter = tab.dataset.filter
    load()
  })
})

// Save
saveBtn.addEventListener('click', saveTodo)

async function saveTodo() {
  const text = inputEl.value.trim()
  if (!text) return
  const priority = prioritySelect.value
  await db.put('todos', {
    id: crypto.randomUUID(),
    text,
    priority,
    done: false,
    createdAt: Date.now()
  })
  inputEl.value = ''
  saveBtn.disabled = true
  prioritySelect.value = 'medium'
  load()
  showToast('➕ Tugas ditambahkan', false)
}

// Edit modal
function openEdit(todo) {
  editingId = todo.id
  editingPriority = todo.priority || 'medium'
  editInput.value = todo.text
  updatePriorityBtns()
  modal.classList.add('open')
  setTimeout(() => editInput.focus(), 300)
}

function updatePriorityBtns() {
  ['high', 'medium', 'low'].forEach(p => {
    const btn = document.getElementById(`p-${p}`)
    btn.className = 'priority-btn'
    if (p === editingPriority) btn.classList.add(`selected-${p}`)
  })
}

document.querySelectorAll('.priority-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    editingPriority = btn.dataset.p
    updatePriorityBtns()
  })
})

modal.addEventListener('click', e => {
  if (e.target === modal) closeModal()
})

document.getElementById('cancel-edit').addEventListener('click', closeModal)

document.getElementById('confirm-edit').addEventListener('click', async () => {
  const newText = editInput.value.trim()
  if (!newText || !editingId) return
  const todo = await db.get('todos', editingId)
  await db.put('todos', { ...todo, text: newText, priority: editingPriority })
  closeModal()
  load()
  showToast('✅ Tugas diperbarui', false)
})

function closeModal() {
  modal.classList.remove('open')
  editingId = null
}

// Delete with undo
async function deleteTodo(id) {
  deletedTodo = await db.get('todos', id)
  await db.delete('todos', id)
  load()
  showToast('🗑️ Tugas dihapus', true)
}

function showToast(msg, withUndo) {
  clearTimeout(toastTimer)
  toastMsg.textContent = msg
  document.getElementById('toast-undo').style.display = withUndo ? '' : 'none'
  toast.classList.add('show')
  toastTimer = setTimeout(() => {
    toast.classList.remove('show')
    deletedTodo = null
  }, 3500)
}

document.getElementById('toast-undo').addEventListener('click', async () => {
  if (deletedTodo) {
    await db.put('todos', deletedTodo)
    deletedTodo = null
    toast.classList.remove('show')
    load()
  }
})

load()