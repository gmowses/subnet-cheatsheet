import { useState, useEffect, useMemo } from 'react'
import { Search, Sun, Moon, Languages, Table2, ChevronDown, ChevronUp, X } from 'lucide-react'

// ── i18n ─────────────────────────────────────────────────────────────────────
const translations = {
  en: {
    title: 'Subnet Cheatsheet',
    subtitle: 'Complete reference table for all IPv4 subnet prefixes /0 to /32. Click any row to expand details. Everything runs client-side.',
    searchPlaceholder: 'Search by prefix, mask, hosts count or use...',
    prefix: 'Prefix',
    mask: 'Subnet Mask',
    wildcard: 'Wildcard',
    hosts: 'Hosts',
    usable: 'Usable',
    commonUse: 'Common Use',
    details: 'Details',
    network: 'Network address',
    broadcast: 'Broadcast',
    firstHost: 'First usable',
    lastHost: 'Last usable',
    totalIps: 'Total IPs',
    noResults: 'No entries match your search.',
    builtBy: 'Built by',
    binaryMask: 'Binary mask',
    cidrBlock: 'Example CIDR',
    subnetBits: 'Subnet bits',
    hostBits: 'Host bits',
    subnets: 'Possible /24 subnets',
  },
  pt: {
    title: 'Cheatsheet de Sub-redes',
    subtitle: 'Tabela de referencia completa para todos os prefixos de sub-rede IPv4 /0 a /32. Clique em qualquer linha para expandir detalhes. Tudo roda no navegador.',
    searchPlaceholder: 'Buscar por prefixo, mascara, qtd de hosts ou uso...',
    prefix: 'Prefixo',
    mask: 'Mascara de Sub-rede',
    wildcard: 'Wildcard',
    hosts: 'Hosts',
    usable: 'Utilizaveis',
    commonUse: 'Uso Comum',
    details: 'Detalhes',
    network: 'Endereco de rede',
    broadcast: 'Broadcast',
    firstHost: 'Primeiro utilizavel',
    lastHost: 'Ultimo utilizavel',
    totalIps: 'Total de IPs',
    noResults: 'Nenhuma entrada encontrada para sua busca.',
    builtBy: 'Criado por',
    binaryMask: 'Mascara binaria',
    cidrBlock: 'CIDR exemplo',
    subnetBits: 'Bits de rede',
    hostBits: 'Bits de host',
    subnets: 'Sub-redes /24 possiveis',
  }
} as const

type Lang = keyof typeof translations

// ── Subnet Data ───────────────────────────────────────────────────────────────
function numToIp(num: number): string {
  return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.')
}

function prefixToMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

function prefixToWildcard(prefix: number): string {
  const mask = prefixToMask(prefix)
  return numToIp((~mask) >>> 0)
}

function fmtHosts(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

function maskToBinary(prefix: number): string {
  const mask = prefixToMask(prefix)
  const bin = mask.toString(2).padStart(32, '0')
  return `${bin.slice(0, 8)}.${bin.slice(8, 16)}.${bin.slice(16, 24)}.${bin.slice(24, 32)}`
}

const USES: { en: string; pt: string; prefixes: number[] }[] = [
  { en: 'Internet (all addresses)', pt: 'Internet (todos os enderecos)', prefixes: [0] },
  { en: 'Large network block', pt: 'Bloco de rede grande', prefixes: [1, 2, 3, 4, 5, 6, 7] },
  { en: 'Class A network (10.x.x.x)', pt: 'Rede Classe A (10.x.x.x)', prefixes: [8] },
  { en: 'Large ISP block', pt: 'Bloco grande de ISP', prefixes: [9, 10, 11] },
  { en: 'Class B network (172.16.x.x)', pt: 'Rede Classe B (172.16.x.x)', prefixes: [12] },
  { en: 'Medium ISP block', pt: 'Bloco medio de ISP', prefixes: [13, 14, 15] },
  { en: 'Class C block (192.168.x.x)', pt: 'Bloco Classe C (192.168.x.x)', prefixes: [16] },
  { en: 'Campus network', pt: 'Rede de campus', prefixes: [17, 18, 19] },
  { en: 'Large office network', pt: 'Rede de escritorio grande', prefixes: [20, 21, 22] },
  { en: 'Common enterprise network', pt: 'Rede corporativa comum', prefixes: [23] },
  { en: 'Small office (256 IPs)', pt: 'Escritorio pequeno (256 IPs)', prefixes: [24] },
  { en: 'Small department (128 IPs)', pt: 'Departamento pequeno (128 IPs)', prefixes: [25] },
  { en: 'Small team (64 IPs)', pt: 'Equipe pequena (64 IPs)', prefixes: [26] },
  { en: 'Very small team (32 IPs)', pt: 'Equipe muito pequena (32 IPs)', prefixes: [27] },
  { en: 'IoT / VLAN segment (16 IPs)', pt: 'IoT / segmento VLAN (16 IPs)', prefixes: [28] },
  { en: 'Tiny VLAN (8 IPs)', pt: 'VLAN muito pequena (8 IPs)', prefixes: [29] },
  { en: 'Very small segment (4 IPs)', pt: 'Segmento muito pequeno (4 IPs)', prefixes: [30] },
  { en: 'Point-to-point link (2 IPs)', pt: 'Link ponto-a-ponto (2 IPs)', prefixes: [31] },
  { en: 'Single host / loopback', pt: 'Host unico / loopback', prefixes: [32] },
]


interface SubnetRow {
  prefix: number
  mask: string
  maskNum: number
  wildcard: string
  totalHosts: number
  usableHosts: number
  binaryMask: string
  use: { en: string; pt: string }
  exampleCidr: string
  subnetBits: number
  hostBits: number
}

const SUBNET_TABLE: SubnetRow[] = Array.from({ length: 33 }, (_, prefix) => {
  const maskNum = prefixToMask(prefix)
  const mask = numToIp(maskNum)
  const wildcard = prefixToWildcard(prefix)
  const totalHosts = Math.pow(2, 32 - prefix)
  const usableHosts = prefix >= 31 ? totalHosts : Math.max(0, totalHosts - 2)
  const binaryMask = maskToBinary(prefix)
  const use = USES.find(u => u.prefixes.includes(prefix)) ?? USES[1]
  const exampleCidr = `10.0.0.0/${prefix}`
  return {
    prefix, mask, maskNum, wildcard,
    totalHosts, usableHosts,
    binaryMask,
    use,
    exampleCidr,
    subnetBits: prefix,
    hostBits: 32 - prefix,
  }
})

const ACCENT = '#14b8a6'

// ── Component ─────────────────────────────────────────────────────────────────
export default function SubnetCheatsheet() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language.startsWith('pt') ? 'pt' : 'en'))
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const t = translations[lang]

  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().replace(/^\//, '')
    if (!q) return SUBNET_TABLE
    return SUBNET_TABLE.filter(row =>
      `/${row.prefix}`.includes(q) ||
      String(row.prefix).includes(q) ||
      row.mask.includes(q) ||
      row.wildcard.includes(q) ||
      row.use[lang].toLowerCase().includes(q) ||
      fmtHosts(row.usableHosts).toLowerCase().includes(q) ||
      String(row.totalHosts).includes(q)
    )
  }, [search, lang])

  const toggleExpand = (prefix: number) => setExpanded(e => e === prefix ? null : prefix)

  // Color gradient based on prefix size
  const getPrefixColor = (prefix: number) => {
    if (prefix <= 8) return '#ef4444'
    if (prefix <= 16) return '#f97316'
    if (prefix <= 24) return ACCENT
    return '#6366f1'
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
              <Table2 size={18} className="text-white" />
            </div>
            <span className="font-semibold">Subnet Cheatsheet</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(l => l === 'en' ? 'pt' : 'en')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Languages size={14} />{lang.toUpperCase()}
            </button>
            <button onClick={() => setDark(d => !d)} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a href="https://github.com/gmowses/subnet-cheatsheet" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{t.title}</h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">{t.subtitle}</p>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 transition-colors"
              style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <Table2 size={32} className="mx-auto mb-3 opacity-30" />
              <p>{t.noResults}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-900 text-[10px] uppercase tracking-wide text-zinc-400 font-medium border-b border-zinc-200 dark:border-zinc-800">
                <div className="col-span-1">{t.prefix}</div>
                <div className="col-span-3">{t.mask}</div>
                <div className="col-span-2">{t.wildcard}</div>
                <div className="col-span-2">{t.hosts}</div>
                <div className="col-span-4">{t.commonUse}</div>
              </div>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.map(row => {
                  const isExpanded = expanded === row.prefix
                  const color = getPrefixColor(row.prefix)
                  return (
                    <div key={row.prefix}>
                      <button
                        onClick={() => toggleExpand(row.prefix)}
                        className="w-full grid grid-cols-12 gap-2 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-sm items-center"
                      >
                        <div className="col-span-1">
                          <span className="font-mono font-bold" style={{ color }}>{`/${row.prefix}`}</span>
                        </div>
                        <div className="col-span-3 font-mono text-xs">{row.mask}</div>
                        <div className="col-span-2 font-mono text-xs text-zinc-400">{row.wildcard}</div>
                        <div className="col-span-2">
                          <span className="font-mono text-xs font-medium">{fmtHosts(row.usableHosts)}</span>
                        </div>
                        <div className="col-span-3 text-xs text-zinc-500 dark:text-zinc-400 truncate">{row.use[lang]}</div>
                        <div className="col-span-1 flex justify-end">
                          {isExpanded ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                          <div className="grid sm:grid-cols-3 gap-3">
                            {[
                              { label: t.subnetBits, value: String(row.subnetBits) },
                              { label: t.hostBits, value: String(row.hostBits) },
                              { label: t.totalIps, value: fmtHosts(row.totalHosts) },
                              { label: t.usable, value: fmtHosts(row.usableHosts) },
                              { label: t.cidrBlock, value: row.exampleCidr },
                              ...(row.prefix <= 24 ? [{ label: t.subnets, value: fmtHosts(Math.pow(2, Math.max(0, row.prefix - 8))) }] : []),
                            ].map(item => (
                              <div key={item.label} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-0.5">{item.label}</p>
                                <p className="text-sm font-mono font-medium">{item.value}</p>
                              </div>
                            ))}
                          </div>

                          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">{t.binaryMask}</p>
                            <p className="text-xs font-mono break-all" style={{ color }}>{row.binaryMask}</p>
                          </div>

                          <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: `${color}10`, borderLeft: `3px solid ${color}` }}>
                            <p className="text-zinc-600 dark:text-zinc-300">{row.use[lang]}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-zinc-400">
          <span>{t.builtBy} <a href="https://github.com/gmowses" className="text-zinc-600 dark:text-zinc-300 hover:underline transition-colors">Gabriel Mowses</a></span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  )
}
