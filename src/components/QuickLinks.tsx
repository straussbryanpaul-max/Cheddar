import { useState } from 'react'
import { useStore } from '../store'
import type { QuickLink } from '../types'

function ExternalIcon() {
  return (
    <svg className="w-3 h-3 opacity-40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function LinkRow({ link, editing, onEdit, onDone }: {
  link: QuickLink
  editing: boolean
  onEdit: () => void
  onDone: () => void
}) {
  const updateQuickLink = useStore(s => s.updateQuickLink)
  const deleteQuickLink = useStore(s => s.deleteQuickLink)
  const [name, setName] = useState(link.name)
  const [url, setUrl] = useState(link.url)

  function save() {
    updateQuickLink(link.id, { name: name.trim(), url: url.trim() })
    onDone()
  }

  if (editing) {
    return (
      <div className="bg-slate-700/60 rounded-lg p-2 space-y-1.5">
        <input
          autoFocus
          className="w-full bg-slate-600 text-white text-xs rounded px-2 py-1 border border-slate-500 outline-none focus:border-blue-400"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name"
        />
        <input
          className="w-full bg-slate-600 text-white text-xs rounded px-2 py-1 border border-slate-500 outline-none focus:border-blue-400"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onDone() }}
        />
        <div className="flex gap-1 justify-end">
          <button onClick={() => { deleteQuickLink(link.id); onDone() }} className="text-xs text-red-400 hover:text-red-300 px-1">Delete</button>
          <button onClick={onDone} className="text-xs text-slate-500 hover:text-slate-300 px-1">Cancel</button>
          <button onClick={save} className="text-xs text-emerald-400 hover:text-emerald-300 px-1 font-medium">Save</button>
        </div>
      </div>
    )
  }

  const hasUrl = link.url.trim().length > 0

  return (
    <div className="group flex items-center gap-1">
      {hasUrl ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <span className="truncate">{link.name}</span>
          <ExternalIcon />
        </a>
      ) : (
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-between gap-1 px-2.5 py-2 rounded-lg text-xs text-slate-600 hover:text-slate-400 hover:bg-slate-700/50 transition-colors"
        >
          <span className="truncate">{link.name}</span>
          <span className="text-xs opacity-60">set URL</span>
        </button>
      )}
      <button
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-slate-300 transition-opacity flex-shrink-0"
        title="Edit"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
        </svg>
      </button>
    </div>
  )
}

export function QuickLinks() {
  const quickLinks = useStore(s => s.quickLinks)
  const addQuickLink = useStore(s => s.addQuickLink)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')

  function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    addQuickLink({ name: newName.trim(), url: newUrl.trim() })
    setNewName('')
    setNewUrl('')
    setAdding(false)
  }

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-700/50">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Quick Links</span>
      </div>

      <div className="p-1.5 space-y-0.5">
        {quickLinks.map(link => (
          <LinkRow
            key={link.id}
            link={link}
            editing={editingId === link.id}
            onEdit={() => setEditingId(link.id)}
            onDone={() => setEditingId(null)}
          />
        ))}

        {adding ? (
          <form onSubmit={submitAdd} className="bg-slate-700/60 rounded-lg p-2 space-y-1.5 mt-1">
            <input
              autoFocus
              className="w-full bg-slate-600 text-white text-xs rounded px-2 py-1 border border-slate-500 outline-none focus:border-blue-400"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Name"
            />
            <input
              className="w-full bg-slate-600 text-white text-xs rounded px-2 py-1 border border-slate-500 outline-none focus:border-blue-400"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://..."
            />
            <div className="flex gap-1 justify-end">
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-slate-500 hover:text-slate-300 px-1">Cancel</button>
              <button type="submit" className="text-xs text-emerald-400 hover:text-emerald-300 px-1 font-medium">Add</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-slate-600 hover:text-slate-400 hover:bg-slate-700/50 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add link
          </button>
        )}
      </div>
    </div>
  )
}
