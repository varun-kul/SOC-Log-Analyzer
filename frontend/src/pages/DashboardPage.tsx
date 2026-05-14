import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { logsApi } from '../api'
import { LogFile } from '../types'
import { useAuth } from '../context/AuthContext'
import {
  Shield, Upload, LogOut, FileText, Trash2,
  CheckCircle, Clock, AlertCircle, Loader2
} from 'lucide-react'

const STATUS_ICON: Record<string, React.ReactNode> = {
  done:       <CheckCircle className="w-4 h-4 text-green-400" />,
  processing: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
  uploaded:   <Clock className="w-4 h-4 text-yellow-400" />,
  error:      <AlertCircle className="w-4 h-4 text-red-400" />,
}

const STATUS_LABEL: Record<string, string> = {
  done: 'text-green-400', processing: 'text-blue-400',
  uploaded: 'text-yellow-400', error: 'text-red-400'
}

function fmtSize(b: number | null) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [logs, setLogs] = useState<LogFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await logsApi.list()
      setLogs(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchLogs()
    // Poll every 3s so processing status updates automatically
    const iv = setInterval(fetchLogs, 3000)
    return () => clearInterval(iv)
  }, [fetchLogs])

  const upload = async (file: File) => {
    if (!file.name.match(/\.(log|txt|csv)$/i)) {
      setError('Only .log, .txt, or .csv files are supported')
      return
    }
    setError('')
    setUploading(true)
    try {
      await logsApi.upload(file)
      await fetchLogs()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) upload(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) upload(f)
  }

  const deleteLog = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    await logsApi.delete(id)
    setLogs(l => l.filter(x => x.id !== id))
  }

  const openAnalysis = (log: LogFile) => {
    if (log.status === 'done') nav(`/analysis/${log.id}`)
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Navbar */}
      <nav className="bg-dark-800 border-b border-dark-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-500" />
          <span className="font-bold text-white text-lg">SOC Log Analyzer</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">
            Signed in as <span className="text-white font-medium">{user?.username}</span>
          </span>
          <button onClick={logout} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition text-sm">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Upload area */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition
            ${dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-dark-500 hover:border-blue-600 hover:bg-dark-800'}`}
        >
          <input ref={fileRef} type="file" accept=".log,.txt,.csv" className="hidden" onChange={onFileChange} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-slate-300">Uploading & starting analysis...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-slate-500" />
              <p className="text-white font-medium">Drop a log file here or click to browse</p>
              <p className="text-slate-500 text-sm">.log · .txt · .csv — max 10 MB</p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Log file table */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Uploaded Logs</h2>
          {logs.length === 0 ? (
            <div className="bg-dark-800 rounded-2xl border border-dark-600 p-12 text-center text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              No log files yet. Upload one above to get started.
            </div>
          ) : (
            <div className="bg-dark-800 rounded-2xl border border-dark-600 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600 text-slate-400 text-left">
                    <th className="px-6 py-3 font-medium">File</th>
                    <th className="px-6 py-3 font-medium">Size</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Uploaded</th>
                    <th className="px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr
                      key={log.id}
                      onClick={() => openAnalysis(log)}
                      className={`border-b border-dark-600 last:border-0 transition
                        ${log.status === 'done' ? 'hover:bg-dark-700 cursor-pointer' : 'opacity-80'}`}
                    >
                      <td className="px-6 py-4 text-white font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        {log.original_filename}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{fmtSize(log.file_size)}</td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1.5 capitalize ${STATUS_LABEL[log.status]}`}>
                          {STATUS_ICON[log.status]} {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(log.uploaded_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={e => deleteLog(log.id, e)}
                          className="text-slate-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}