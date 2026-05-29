import { useEffect, useMemo, useState } from 'react'
import { getConfig, putConfig } from '../../api/client'

export default function Settings() {
  const [config, setConfig] = useState(null)
  const [defaultProvider, setDefaultProvider] = useState('')
  const [drafts, setDrafts] = useState({})
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getConfig()
      .then((data) => {
        setConfig(data)
        setDefaultProvider(data.defaultProvider || '')
        const next = {}
        for (const p of data.providers || []) {
          next[p.name] = { apiKey: '', baseURL: p.baseURL || '', model: p.model || '' }
        }
        setDrafts(next)
      })
      .catch((err) => setError(err.message || 'Không tải được cấu hình.'))
  }, [])

  const providers = config?.providers || []
  const selected = useMemo(() => providers.find((p) => p.name === defaultProvider) || providers[0], [providers, defaultProvider])

  const updateDraft = (name, key, value) => {
    setDrafts((prev) => ({ ...prev, [name]: { ...(prev[name] || {}), [key]: value } }))
  }

  const save = async () => {
    setSaving(true)
    setStatus('')
    setError('')
    try {
      const providersPayload = {}
      for (const p of providers) {
        const d = drafts[p.name] || {}
        providersPayload[p.name] = {
          apiKey: d.apiKey || '',
          baseURL: d.baseURL ?? '',
          model: d.model ?? '',
        }
      }
      const next = await putConfig({ defaultProvider, providers: providersPayload })
      setConfig(next)
      setDefaultProvider(next.defaultProvider || defaultProvider)
      const fresh = {}
      for (const p of next.providers || []) fresh[p.name] = { apiKey: '', baseURL: p.baseURL || '', model: p.model || '' }
      setDrafts(fresh)
      setStatus('Đã lưu cấu hình vào .env local. API key mới đã được áp dụng cho backend đang chạy.')
    } catch (err) {
      setError(err.message || 'Lưu cấu hình thất bại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="glow-accent text-2xl font-bold tracking-[0.18em] sm:text-3xl">CẤU HÌNH AI</h1>
            <p className="hud-label mt-2 flex items-center gap-2 text-dim">
              <span className="status-dot inline-block h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
              API KEY LƯU LOCAL TRONG BACKEND
            </p>
          </div>
          <div className="panel hud-corners px-5 py-3">
            <span className="hud-label text-dim">MẶC ĐỊNH </span>
            <span className="glow-neon text-lg font-bold">{selected?.name || '--'}</span>
          </div>
        </header>

        {error && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{error}</div>}
        {status && <div className="panel px-4 py-3 text-sm text-neon/80">{status}</div>}

        <section className="panel hud-corners space-y-4 px-5 py-5">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <label className="hud-label text-dim">NHÀ CUNG CẤP MẶC ĐỊNH</label>
            <select
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
              className="min-w-[12rem] bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
            >
              {providers.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <p className="text-sm leading-relaxed text-dim">
            API key không được hiển thị lại sau khi lưu. Để giữ key cũ, hãy để ô API key trống và chỉ chỉnh model/base URL nếu cần.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {providers.map((p) => {
            const draft = drafts[p.name] || {}
            return (
              <div key={p.name} className={`panel hud-corners space-y-4 px-5 py-5 ${p.name === defaultProvider ? 'panel-accent' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="glow-neon text-lg font-bold uppercase tracking-wider">{p.name}</p>
                    <p className="hud-label mt-1 text-dim">{p.configured ? 'ĐÃ CÓ API KEY' : 'CHƯA CÓ API KEY'}</p>
                  </div>
                  {p.name === defaultProvider && <span className="hud-label text-accent">MẶC ĐỊNH</span>}
                </div>

                <label className="block space-y-1">
                  <span className="hud-label text-dim">API KEY</span>
                  <input
                    type="password"
                    value={draft.apiKey || ''}
                    onChange={(e) => updateDraft(p.name, 'apiKey', e.target.value)}
                    placeholder={p.configured ? 'Để trống để giữ key hiện tại' : `Nhập ${p.keyEnv}`}
                    className="w-full bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="hud-label text-dim">MODEL</span>
                  <input
                    value={draft.model || ''}
                    onChange={(e) => updateDraft(p.name, 'model', e.target.value)}
                    placeholder={p.defaultModel}
                    className="w-full bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="hud-label text-dim">BASE URL</span>
                  <input
                    value={draft.baseURL || ''}
                    onChange={(e) => updateDraft(p.name, 'baseURL', e.target.value)}
                    placeholder={p.defaultBaseURL}
                    className="w-full bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
                  />
                </label>
              </div>
            )
          })}
        </section>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={save}
            disabled={saving || !config}
            className="glow-neon border border-neon/60 px-5 py-2 text-sm tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'ĐANG LƯU…' : 'LƯU CẤU HÌNH ▸'}
          </button>
        </div>
      </div>
    </div>
  )
}
