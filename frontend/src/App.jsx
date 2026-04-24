import './App.css'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
const Globe = lazy(() => import('./Globe'))

const features = [
  {
    title: 'Multi-Source Aggregation',
    description:
      'Consolidate alerts from Snort, Suricata, Zeek, and Kismet into a single unified dashboard.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    title: 'Real-Time Correlation',
    description:
      'Automatically correlate events across multiple IDS engines to reduce noise and surface real threats.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    title: 'Smart Deduplication',
    description:
      'Intelligent alert deduplication eliminates redundant notifications so you focus on what matters.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
      </svg>
    ),
  },
  {
    title: 'Threat Severity Scoring',
    description:
      'Unified severity scoring normalizes threat levels across different IDS platforms for consistent prioritization.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
  },
  {
    title: 'Customizable Rules',
    description:
      'Define custom correlation rules, filters, and alert policies tailored to your network environment.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    title: 'REST API & Integrations',
    description:
      'Full REST API with webhook support. Integrate with SIEM tools, Slack, PagerDuty, and your existing stack.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
    ),
  },
]

const stats = [
  { value: '4', label: 'IDS Sources Supported' },
  { value: '<50ms', label: 'Alert Latency' },
  { value: '95%', label: 'Noise Reduction' },
  { value: '24/7', label: 'Real-Time Monitoring' },
]

function App() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 font-sans antialiased">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="size-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">DurianDetector</span>
            </div>
            <div className="hidden md:flex items-center gap-1">
              <a href="#ids-sources" className="text-sm text-slate-400 hover:text-white px-3 py-2 rounded-md hover:bg-white/5 transition-all">Integrations</a>
              <a href="#features" className="text-sm text-slate-400 hover:text-white px-3 py-2 rounded-md hover:bg-white/5 transition-all">Features</a>
              <a href="#pricing" className="text-sm text-slate-400 hover:text-white px-3 py-2 rounded-md hover:bg-white/5 transition-all">Pricing</a>
              <div className="w-px h-5 bg-white/10 mx-2" />
              <Link to="/login" className="text-sm text-slate-400 hover:text-white px-3 py-2 rounded-md hover:bg-white/5 transition-all">
                Sign In
              </Link>
              <Link to="/signup" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all ml-1">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero with Globe */}
      <section className="relative overflow-hidden min-h-[85vh] flex items-center">
        {/* 3D Globe background */}
        <div className="absolute inset-0 pointer-events-none">
          <Suspense fallback={null}>
            <Globe className="absolute inset-0 w-full h-full" />
          </Suspense>
        </div>

        {/* Radial gradient overlay for edge fade */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#0a0e1a_75%)] pointer-events-none" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-32 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/15 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-xs font-medium tracking-wide uppercase text-blue-300/90">Live Threat Monitoring</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-3xl mx-auto leading-[1.1]">
            One dashboard for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-300">
              all your IDS alerts
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Aggregate, correlate, and prioritize alerts from every intrusion detection system in your network. Cut through the noise.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#cta"
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-medium px-7 py-3 rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
            >
              Start Detecting
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 ml-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-medium px-7 py-3 rounded-lg transition-all hover:bg-white/5"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="relative border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold tracking-tight text-blue-400">{stat.value}</div>
                <div className="mt-1.5 text-sm text-slate-500 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IDS Sources */}
      <section id="ids-sources" className="py-28">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-medium tracking-wide uppercase text-blue-400 mb-3">Integrations</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">4 IDS Sources, One Platform</h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">
              Ingest alerts from every major intrusion detection system — normalized into a unified schema automatically.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Suricata */}
            <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-orange-500/30 hover:bg-white/[0.05] transition-all group text-center">
              <div className="w-14 h-14 mx-auto bg-orange-500/10 border border-orange-400/15 rounded-2xl flex items-center justify-center text-orange-400 group-hover:bg-orange-500/20 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">Suricata</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Full EVE JSON log parsing with signature-based and protocol anomaly detection support.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300/80 border border-orange-400/10">EVE JSON</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300/80 border border-orange-400/10">Rules Export</span>
              </div>
            </div>

            {/* Zeek */}
            <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all group text-center">
              <div className="w-14 h-14 mx-auto bg-cyan-500/10 border border-cyan-400/15 rounded-2xl flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">Zeek</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Network traffic analysis with notice log ingestion and Intel framework export.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300/80 border border-cyan-400/10">Notice Logs</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300/80 border border-cyan-400/10">Intel Export</span>
              </div>
            </div>

            {/* Snort */}
            <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-red-500/30 hover:bg-white/[0.05] transition-all group text-center">
              <div className="w-14 h-14 mx-auto bg-red-500/10 border border-red-400/15 rounded-2xl flex items-center justify-center text-red-400 group-hover:bg-red-500/20 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">Snort</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Classic signature-based IDS with alert parsing and reputation list export.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-300/80 border border-red-400/10">Alerts</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-300/80 border border-red-400/10">Rep List Export</span>
              </div>
            </div>

            {/* Kismet */}
            <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-purple-500/30 hover:bg-white/[0.05] transition-all group text-center">
              <div className="w-14 h-14 mx-auto bg-purple-500/10 border border-purple-400/15 rounded-2xl flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">Kismet</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Wireless IDS for detecting rogue access points, deauth attacks, and Wi-Fi threats.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300/80 border border-purple-400/10">Wireless</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300/80 border border-purple-400/10">Rogue AP</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-medium tracking-wide uppercase text-blue-400 mb-3">Capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Built for Security Teams</h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">
              Everything you need to stay ahead of threats across your entire detection infrastructure.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:border-blue-500/20 hover:bg-white/[0.05] transition-all group"
              >
                <div className="w-10 h-10 bg-blue-500/10 border border-blue-400/10 rounded-lg flex items-center justify-center text-blue-400 group-hover:bg-blue-500/15 transition-all">
                  {feature.icon}
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-28 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-medium tracking-wide uppercase text-blue-400 mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Choose Your Plan</h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">
              From individual researchers to enterprise SOC teams — pick the tier that fits your operation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 items-start">
            {/* Free */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 hover:border-white/10 transition-all">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Free</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">$0</span>
                <span className="text-slate-500 text-sm">/month</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">Get started with core IDS monitoring at no cost.</p>

              <ul className="mt-8 space-y-3">
                {[
                  'Real-time alert feed (7-day history)',
                  'SOC dashboard & analytics',
                  'Quarantine & Threat Intel',
                  'GeoIP attack map',
                  'Rules, Blacklist & Whitelist',
                  'Incident management',
                  'AI Chatbot (read-only)',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 mt-0.5 text-slate-500 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>

              <Link to="/signup?tier=free" className="block mt-8 w-full border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-medium py-2.5 rounded-lg transition-all hover:bg-white/5 text-sm text-center">
                Get Started
              </Link>
            </div>

            {/* Premium */}
            <div className="relative bg-blue-500/[0.06] border border-blue-500/20 rounded-xl p-8 hover:border-blue-500/30 transition-all">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
              </div>

              <p className="text-sm font-medium text-blue-400 uppercase tracking-wide">Premium</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">$49</span>
                <span className="text-slate-500 text-sm">/month</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">Full platform access for serious security operations.</p>

              <ul className="mt-8 space-y-3">
                {[
                  'Everything in Free, plus:',
                  'Full alert history (no time limit)',
                  'Ingestion Logs & file upload',
                  'Engine Comparison',
                  'ML model configuration',
                  'Analytics PDF exports',
                  'AI Chatbot (full access)',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 mt-0.5 text-blue-400 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>

              <Link to="/signup?tier=premium" className="block mt-8 w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 text-sm text-center">
                Upgrade to Premium
              </Link>
            </div>

            {/* Exclusive */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 hover:border-white/10 transition-all">
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Exclusive</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">$199</span>
                <span className="text-slate-500 text-sm">/month</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">Enterprise SOC collaboration with dedicated support.</p>

              <ul className="mt-8 space-y-3">
                {[
                  'Everything in Premium, plus:',
                  'Team workspace (up to 5 members)',
                  'Alert assignment & team activity',
                  'Dedicated support',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 mt-0.5 text-slate-500 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>

              <Link to="/signup?tier=exclusive" className="block mt-8 w-full border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-medium py-2.5 rounded-lg transition-all hover:bg-white/5 text-sm text-center">
                Upgrade to Exclusive
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-28">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-950/60 via-[#0f1629] to-[#0a0e1a] border border-blue-500/10 rounded-2xl p-12 sm:p-16 text-center">
            {/* Subtle background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Ready to tame the alert storm?</h2>
              <p className="mt-4 text-slate-400 max-w-lg mx-auto">
                Deploy DurianDetector in minutes and start seeing your IDS alerts in a whole new way.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/signup" className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-medium px-7 py-3 rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 cursor-pointer">
                  Get Started Free
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4 ml-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="size-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-white">DurianDetector</span>
            </div>
            <p className="text-xs text-slate-600">&copy; 2026 DurianDetector. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
