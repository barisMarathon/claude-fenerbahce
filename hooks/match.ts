// Fenerbahçe's match card: the live game, else a result for a few hours after it,
// else the next fixture. ESPN (no key) for Süper Lig and the European cups, with
// live score and minute; TheSportsDB's free key for the Turkish Cup, which ESPN lacks.

const FB_ESPN_ID = '436'
const FB_TSDB_ID = '133807'
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const TSDB = 'https://www.thesportsdb.com/api/v1/json/123'

const LEAGUES: ReadonlyArray<readonly [string, string]> = [
  ['tur.1', 'Süper Lig'],
  ['uefa.champions', 'UEFA Şampiyonlar Ligi'],
  ['uefa.europa', 'UEFA Avrupa Ligi'],
  ['uefa.europa.conf', 'UEFA Konferans Ligi'],
]

const HOUR = 3_600_000
const RESULT_WINDOW = 5 * HOUR // kickoff + about 2 h of play + 3 h showing the result
const LIVE_WINDOW = 3 * HOUR

export type Side = { name: string; abbr: string; color?: string; isFB: boolean; score?: string }
export type Game = {
  id: string
  league?: string
  comp: string
  kickoff: number
  state: 'pre' | 'in' | 'post'
  clock?: string
  home: Side
  away: Side
}

// What the card draws; compared as JSON to skip redraws that change nothing.
export type MatchView = {
  header: string
  middle: string
  sub?: string
  isLive: boolean
  home: Side
  away: Side
}

type Fetch = (url: string) => Promise<{ ok: boolean; text: string }>

// ESPN spells names in ASCII; these read as Turkish fans write them.
const TR_NAMES: Record<string, string> = {
  Fenerbahce: 'Fenerbahçe',
  Besiktas: 'Beşiktaş',
  Goztepe: 'Göztepe',
  Basaksehir: 'Başakşehir',
  'Istanbul Basaksehir': 'Başakşehir',
  Genclerbirligi: 'Gençlerbirliği',
  Kasimpasa: 'Kasımpaşa',
  'Caykur Rizespor': 'Çaykur Rizespor',
  'Corum FK': 'Çorum FK',
  Eyupspor: 'Eyüpspor',
  'Fatih Karagumruk': 'Karagümrük',
  'Erzurum BB': 'Erzurumspor',
  'Shakhtar Donetsk': 'Şahtar Donetsk',
}

const trName = (name: string) => TR_NAMES[name] ?? name

const fetchJson = async (fetch: Fetch, url: string): Promise<any> => {
  try {
    const response = await fetch(url)
    return response.ok ? JSON.parse(response.text) : undefined
  } catch {
    return undefined
  }
}

const scoreOf = (score: unknown): string | undefined => {
  if (typeof score === 'string') return score
  if (score && typeof score === 'object' && 'displayValue' in score) return String((score as { displayValue: unknown }).displayValue)
  return undefined
}

const fromEspn = (event: any, league: string, comp: string): Game | undefined => {
  const c = event?.competitions?.[0]
  const status = c?.status ?? event?.status
  const sides = (c?.competitors ?? []) as any[]
  const home = sides.find(x => x.homeAway === 'home')
  const away = sides.find(x => x.homeAway === 'away')
  if (!home || !away || !event.date) return undefined
  const state = status?.type?.state
  const side = (x: any): Side => ({
    name: trName(x.team?.displayName ?? x.team?.shortDisplayName ?? '?'),
    abbr: x.team?.abbreviation ?? '?',
    color: typeof x.team?.color === 'string' ? x.team.color : undefined,
    isFB: x.team?.id === FB_ESPN_ID,
    score: state === 'pre' ? undefined : scoreOf(x.score),
  })
  return {
    id: `espn:${event.id}`,
    league,
    comp,
    kickoff: Date.parse(event.date),
    state: state === 'in' || state === 'post' ? state : 'pre',
    clock: typeof status?.displayClock === 'string' ? status.displayClock : undefined,
    home: side(home),
    away: side(away),
  }
}

// Only the Turkish Cup comes from here: the leagues above already cover the rest.
const fromTsdb = (event: any): Game | undefined => {
  const league = String(event?.strLeague ?? '')
  if (!/cup|kupa/i.test(league) || /uefa|champions|europa|conference/i.test(league)) return undefined
  const kickoff = Date.parse(`${event.dateEvent}T${event.strTime ?? '00:00:00'}Z`)
  if (Number.isNaN(kickoff)) return undefined
  const isDone = /^(FT|AET|PEN|AP)$/i.test(String(event.strStatus ?? '')) || event.intHomeScore != null
  const side = (name: string, isHome: boolean): Side => ({
    name: trName(name),
    abbr: name.slice(0, 3).toUpperCase(),
    isFB: String(isHome ? event.idHomeTeam : event.idAwayTeam) === FB_TSDB_ID,
    score: isDone ? String((isHome ? event.intHomeScore : event.intAwayScore) ?? '') : undefined,
  })
  return {
    id: `tsdb:${event.idEvent}`,
    comp: 'Türkiye Kupası',
    kickoff,
    state: isDone ? 'post' : 'pre',
    home: side(String(event.strHomeTeam ?? '?'), true),
    away: side(String(event.strAwayTeam ?? '?'), false),
  }
}

const loadGames = async (fetch: Fetch): Promise<Game[]> => {
  const espn = LEAGUES.flatMap(([league, comp]) =>
    ['?fixture=true', ''].map(async query => {
      const json = await fetchJson(fetch, `${ESPN}/${league}/teams/${FB_ESPN_ID}/schedule${query}`)
      return ((json?.events ?? []) as any[]).map(event => fromEspn(event, league, comp))
    }),
  )
  const tsdb = ['eventsnext', 'eventslast'].map(async endpoint => {
    const json = await fetchJson(fetch, `${TSDB}/${endpoint}.php?id=${FB_TSDB_ID}`)
    return ((json?.events ?? json?.results ?? []) as any[]).map(fromTsdb)
  })
  const all = (await Promise.all([...espn, ...tsdb])).flat()
  return all.filter((game): game is Game => game !== undefined)
}

// A schedule can lag during play, so a game near its kickoff is read again from
// its league's scoreboard, which carries the live score and minute.
const refreshLive = async (fetch: Fetch, game: Game): Promise<Game> => {
  if (!game.league) return game
  const d = new Date(game.kickoff)
  const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  const json = await fetchJson(fetch, `${ESPN}/${game.league}/scoreboard?dates=${day}`)
  const event = ((json?.events ?? []) as any[]).find(e => `espn:${e.id}` === game.id)
  return (event && fromEspn(event, game.league, game.comp)) ?? game
}

export const pickGame = async (fetch: Fetch, now: number): Promise<Game | undefined> => {
  const games = await loadGames(fetch)
  const byId = new Map(games.map(game => [game.id, game]))
  const list = [...byId.values()]

  const nearKickoff = list
    .filter(g => g.state !== 'post' && g.kickoff - 15 * 60_000 <= now && now <= g.kickoff + LIVE_WINDOW)
    .sort((a, b) => b.kickoff - a.kickoff)[0]
  if (nearKickoff) {
    const fresh = await refreshLive(fetch, nearKickoff)
    if (fresh.state === 'in' || fresh.state === 'pre') return fresh
    if (now - fresh.kickoff < RESULT_WINDOW) return fresh
  }

  const live = list.find(g => g.state === 'in')
  if (live) return live

  const recent = list
    .filter(g => g.state === 'post' && now - g.kickoff < RESULT_WINDOW && now >= g.kickoff)
    .sort((a, b) => b.kickoff - a.kickoff)[0]
  if (recent) return recent

  return list.filter(g => g.state === 'pre' && g.kickoff > now).sort((a, b) => a.kickoff - b.kickoff)[0]
}

// Turkey keeps UTC+3 all year.
const TR_OFFSET = 3 * HOUR
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

const whenLabel = (kickoff: number, now: number) => {
  const k = new Date(kickoff + TR_OFFSET)
  const n = new Date(now + TR_OFFSET)
  const time = `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`
  const dayIndex = (d: Date) => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / (24 * HOUR))
  const diff = dayIndex(k) - dayIndex(n)
  if (diff === 0) return `Bugün, ${time}`
  if (diff === 1) return `Yarın, ${time}`
  if (diff === -1) return `Dün, ${time}`
  return `${k.getUTCDate()} ${MONTHS[k.getUTCMonth()]} ${DAYS[k.getUTCDay()]}, ${time}`
}

export const toView = (game: Game, now: number): MatchView => {
  const header = `${game.comp} · ${whenLabel(game.kickoff, now)}`
  const score = `${game.home.score ?? 0} - ${game.away.score ?? 0}`
  if (game.state === 'in') {
    return { header, middle: score, sub: `Canlı · ${game.clock ?? ''}`.trim(), isLive: true, home: game.home, away: game.away }
  }
  if (game.state === 'post') {
    return { header, middle: score, sub: 'Maç sonu', isLive: false, home: game.home, away: game.away }
  }
  return { header, middle: '-', isLive: false, home: game.home, away: game.away }
}

// How soon to look again: every minute around a game, else every half hour.
export const nextPollMs = (game: Game | undefined, now: number) => {
  if (!game) return 30 * 60_000
  const isAround = game.kickoff - 20 * 60_000 <= now && now <= game.kickoff + LIVE_WINDOW
  if (game.state === 'in' || (game.state === 'pre' && isAround)) return 60_000
  if (game.state === 'pre' && game.kickoff - now < 2 * HOUR) return Math.max(60_000, game.kickoff - now - 15 * 60_000)
  return 30 * 60_000
}

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

// Windows, macOS, then the usual Linux desktop fonts before the generic fallback.
const FONT = 'Segoe UI, -apple-system, Roboto, Ubuntu, Noto Sans, Cantarell, DejaVu Sans, Helvetica, Arial, sans-serif'

const textOn = (hex: string) => {
  const n = parseInt(hex, 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#0a1226' : '#ffffff'
}

// The crest for Fenerbahçe when the user supplied one (the scene's #crest symbol);
// otherwise, and for every other team, a colored disc with the short name, since
// the backdrop takes no pictures.
const badge = (side: Side, cx: number, cy: number, hasCrest: boolean) => {
  if (side.isFB && hasCrest) return `<use href="#crest" x="${cx - 36}" y="${cy - 36}" width="72" height="72"/>`
  const color = side.color && /^[0-9a-f]{6}$/i.test(side.color) ? side.color : '3a4668'
  return `<circle cx="${cx}" cy="${cy}" r="34" fill="#${color}" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>
<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="700" fill="${textOn(color)}">${esc(short(side.abbr, 4))}</text>`
}

// The card, 480 by 220, in its own coordinates.
export const card = (v: MatchView, hasCrest: boolean) => `<g class="match">
<rect width="480" height="220" rx="18" fill="#0d1631" fill-opacity="0.9" stroke="#f6c400" stroke-opacity="0.2" stroke-width="1.5"/>
<text x="24" y="40" font-family="${FONT}" font-size="17" fill="#a1abc4">${esc(short(v.header, 44))}</text>
${badge(v.home, 96, 100, hasCrest)}
${badge(v.away, 384, 100, hasCrest)}
<text x="96" y="172" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="600" fill="#eef1f8">${esc(short(v.home.name, 17))}</text>
<text x="384" y="172" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="600" fill="#eef1f8">${esc(short(v.away.name, 17))}</text>
<text x="240" y="${v.sub ? 112 : 116}" text-anchor="middle" font-family="${FONT}" font-size="${v.middle === '-' ? 28 : 40}" font-weight="700" fill="#eef1f8">${esc(v.middle)}</text>
${v.sub ? `${v.isLive ? '<circle class="livedot" cx="196" cy="140" r="5" fill="#e0483e"/>' : ''}<text x="${v.isLive ? 248 : 240}" y="146" text-anchor="middle" font-family="${FONT}" font-size="16" fill="${v.isLive ? '#ff8a80' : '#a1abc4'}">${esc(v.sub)}</text>` : ''}
</g>`
