export interface LogFile {
  id: number
  original_filename: string
  file_size: number | null
  log_type: string
  status: 'uploaded' | 'processing' | 'done' | 'error'
  uploaded_at: string
}

export interface TimelineEvent {
  timestamp: string
  event: string
  source_ip: string | null
  destination: string | null
  action: string | null
  severity: 'info' | 'warning' | 'critical'
}

export interface AnomalyItem {
  line_number: number | null
  raw_entry: string
  reason: string
  confidence: number
  category: string
}

export interface Analysis {
  id: number
  log_file_id: number
  summary: string
  timeline: TimelineEvent[]
  anomalies: AnomalyItem[]
  total_entries: number
  anomaly_count: number
  created_at: string
}

export interface User {
  id: number
  username: string
  email: string
  created_at: string
}