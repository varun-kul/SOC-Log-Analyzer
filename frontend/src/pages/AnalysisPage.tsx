import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analysisApi } from '../api'
import { Analysis, AnomalyItem, TimelineEvent } from '../types'
import {
  Shield, ArrowLeft, AlertTriangle, Clock,
  Activity, FileSearch, ChevronDown, ChevronUp
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const SEV_COLOR = { info: '#3b82f6', warning: '#f59e0b', critical: '#ef4444' }
const SEV_BG = { info: 'bg-blue-500/10 text-blue-400 border-blue-500/30', warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', critical: 'bg-red-500/10 text-red-400 border-red-500/30' }
const CAT_LABEL: Record<string, string> = {
  high_request_volume: 'High Request Volume',
  suspicious_url: 'Suspicious URL',
  data_exfiltration: 'Data Exfiltration',
  unusual_hours: 'Unusual Hours',
  malware_indicator: 'Malware Indicator',
  policy_violation: 'Policy Violation',
  other: 'Other',
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-dark-600 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  )
}

function AnomalyRow({ a, idx }: { a: AnomalyItem; idx: number }) {
  const [open, setOpen] = useState(false)
  const pct = Math.round(a.confidence * 100)
  const border = pct >= 80 ? 'border-red-500/40' : pct >= 60 ? 'border-yellow-500/40' : 'border-blue-500/40'
  return (
    <div className={`bg-dark-700 border ${border} rounded-xl overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-dark-600 transition"
      >
        <span className="text-slate-500 text-xs w-5">{idx + 1}</span>
        <span className="flex-1 text-white text-sm font-medium truncate">{a.reason}</span>
        <span className="text-xs bg-dark-600 text-slate-300 px-2 py-0.5 rounded-full shrink-0">
          {CAT_LABEL[a.category] ?? a.category}
        </span>
        <div className="w-24 shrink-0"><ConfidenceBar value={a.confidence} /></div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-dark-600">
          <p className="text-xs text-slate-400 mt-3 mb-1">Raw log entry {a.line_number ? `(line ${a.line_number})` : ''}</p>
          <pre className="bg-dark-900 rounded-lg px-4 py-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
            {a.raw_entry}
          </pre>
        </div>
      )}
    </div>
  )
}

function TimelineRow({ e }: { e: TimelineEvent }) {
  const sev = e.severity as keyof typeof SEV_BG
  return (
    <div className="flex gap-4 items-start">
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0`} style={{ background: SEV_COLOR[sev] }} />
        <div className="w-px flex-1 bg-dark-600 mt-1" />
      </div>
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs text-slate-500 font-mono">{e.timestamp}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SEV_BG[sev]}`}>
            {e.severity}
          </span>
          {e.action && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-dark-600 text-slate-400 capitalize">
              {e.action}
            </span>
          )}
        </div>
        <p className="text-sm text-white">{e.event}</p>
        {(e.source_ip || e.destination) && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {e.source_ip && <span>src: {e.source_ip}</span>}
            {e.source_ip && e.destination && ' → '}
            {e.destination && <span>{e.destination}</span>}
          </p>
        )}
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    analysisApi.get(Number(id))
      .then(r => setAnalysis(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Failed to load analysis'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )

  if (error || !analysis) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-white font-medium">{error || 'Analysis not found'}</p>
        <button onClick={() => nav('/')} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">← Back to dashboard</button>
      </div>
    </div>
  )

  // Build category chart data
  const catCounts: Record<string, number> = {}
  analysis.anomalies.forEach(a => {
    catCounts[a.category] = (catCounts[a.category] || 0) + 1
  })
  const chartData = Object.entries(catCounts).map(([k, v]) => ({ name: CAT_LABEL[k] ?? k, count: v }))

  const critical = analysis.anomalies.filter(a => a.confidence >= 0.8).length
  const warnings = analysis.anomalies.filter(a => a.confidence >= 0.6 && a.confidence < 0.8).length

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Navbar */}
      <nav className="bg-dark-800 border-b border-dark-600 px-6 py-4 flex items-center gap-4">
        <button onClick={() => nav('/')} className="text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Shield className="w-5 h-5 text-blue-500" />
        <span className="font-bold text-white">Analysis Results</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Entries', value: analysis.total_entries, icon: <FileSearch className="w-5 h-5 text-blue-400" />, color: 'text-blue-400' },
            { label: 'Anomalies', value: analysis.anomaly_count, icon: <Activity className="w-5 h-5 text-yellow-400" />, color: 'text-yellow-400' },
            { label: 'Critical', value: critical, icon: <AlertTriangle className="w-5 h-5 text-red-400" />, color: 'text-red-400' },
            { label: 'Warnings', value: warnings, icon: <Clock className="w-5 h-5 text-orange-400" />, color: 'text-orange-400' },
          ].map(s => (
            <div key={s.label} className="bg-dark-800 border border-dark-600 rounded-xl p-5 flex items-center gap-4">
              <div className="bg-dark-700 p-2.5 rounded-lg">{s.icon}</div>
              <div>
                <p className="text-slate-400 text-xs">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" /> AI Summary
          </h2>
          <p className="text-slate-300 leading-relaxed">{analysis.summary}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Anomaly chart */}
          {chartData.length > 0 && (
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Anomalies by Category</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0f1629', border: '1px solid #1e2a47', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Bar dataKey="count" radius={4}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316'][i % 6]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" /> Event Timeline
            </h2>
            <div className="max-h-64 overflow-y-auto pr-1">
              {analysis.timeline.length === 0
                ? <p className="text-slate-500 text-sm">No significant events detected.</p>
                : analysis.timeline.map((e, i) => <TimelineRow key={i} e={e} />)
              }
            </div>
          </div>
        </div>

        {/* Anomalies list */}
        <div>
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Detected Anomalies
            <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
              {analysis.anomalies.length}
            </span>
          </h2>
          {analysis.anomalies.length === 0
            ? <p className="text-slate-500 text-sm">No anomalies detected.</p>
            : (
              <div className="space-y-3">
                {analysis.anomalies
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((a, i) => <AnomalyRow key={i} a={a} idx={i} />)
                }
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}