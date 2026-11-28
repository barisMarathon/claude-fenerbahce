import type { EngineInterface, Register, ThemeSetArgs, Timer } from 'claude-code'

import { makeColors } from './make-colors.js'
import { card, nextPollMs, pickGame, toView } from './match'
import type { MatchView } from './match'

const SCENE = 'sari-lacivert'
const YELLOW = '#f6c400'

// Navy surfaces, yellow accent. Dark mode only.
const { theme, problems } = makeColors({
  label: 'Sarı Lacivert',
  only: 'dark',
  roles: { accent: YELLOW, danger: '#e0483e', success: '#3fb96b', warning: '#f08a24', pro: '#8f86e0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a1226',
        'surface-1': '#0e1830',
        'surface-2': '#121d38',
        'surface-3': '#162241',
        'text-primary': '#eef1f8',
        'text-secondary': '#c8cfe0',
        'text-muted': '#a1abc4',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  overrideColorScheme: 'dark',
  backdrop: { scene: SCENE, glass: { blur: 6, tint: '#0a1226', opacity: 0.6 } },
}

// The crest is the user's own vector file, assets/crest.svg, kept out of git.
// Its inner markup becomes the scene's #crest symbol; without it the scene draws
// the sky, stars and card alone.
type Crest = { viewBox: string; body: string }
let crest: Crest | undefined

// What the backdrop refuses (pictures, scripts, links, entities); a crest holding
// any of it is skipped rather than blanking the whole scene.
const UNSAFE = /<(image|script|style|foreignObject|feImage)\b|href|url\(|<!DOCTYPE|<!ENTITY|<\?|CDATA|&#|\\/i

const parseCrest = (svg: string): Crest | undefined => {
  const open = svg.match(/<svg\b[^>]*>/i)
  if (!open || open.index === undefined) return undefined
  const viewBox = open[0].match(/viewBox="([^"]+)"/i)?.[1] ?? '0 0 100 100'
  const body = svg
    .slice(open.index + open[0].length)
    .replace(/<\/svg>\s*$/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  if (UNSAFE.test(body) || body.length > 110_000) return undefined
  return { viewBox, body }
}

const loadCrest = async ($: EngineInterface): Promise<Crest | undefined> => {
  const path = `${$.plugin.root}/assets/crest.svg`
  if (!(await $.fs.exists(path))) return undefined
  const parsed = parseCrest(String(await $.fs.read(path)))
  if (parsed === undefined) {
    $.ui.toast('assets/crest.svg kullanılamadı: yalnızca vektör çizim olmalı (resim, yazı tipi, bağlantı olmadan).')
  }
  return parsed
}

// No local crest: fetch Wikipedia's file at run time and keep a copy in assets/
// (git-ignored), so the repository never ships it and later starts need no network.
const CREST_URL = 'https://upload.wikimedia.org/wikipedia/en/3/39/Fenerbah%C3%A7e.svg'

const fetchCrest = async ($: EngineInterface): Promise<Crest | undefined> => {
  const response = await $.http.fetch(CREST_URL, { headers: FETCH_HEADERS })
  if (!response.ok) return undefined
  const parsed = parseCrest(response.text)
  if (parsed !== undefined) {
    await $.fs.write(`${$.plugin.root}/assets/crest.svg`, response.text).catch(() => undefined)
  }
  return parsed
}

// Context fill, 0 to 100; undefined until the first reading, so the crest draws at once
// and the stars join it when the figure arrives.
let fill: number | undefined

// 0 percent: no star; 1 to 20: one; ... 81 to 100: five.
const starCount = (percent: number) => (percent <= 0 ? 0 : Math.min(5, Math.ceil(percent / 20)))

const starPath = (r: number) => {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.42
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push(`${(radius * Math.cos(angle)).toFixed(1)} ${(radius * Math.sin(angle)).toFixed(1)}`)
  }
  return `M${points.join(' L')} Z`
}

const STAR = starPath(34)

// Five stars on an arc above the crest, in the crest group's coordinates (crest is 0..600 wide).
const stars = (count: number) =>
  [0, 1, 2, 3, 4]
    .map(i => {
      const x = 100 + i * 100
      const y = 70 - Math.round(28 * Math.sin((i / 4) * Math.PI))
      const isOn = i < count
      const isNewest = isOn && i === count - 1
      const shape = isOn
        ? `<path d="${STAR}" fill="${YELLOW}" stroke="#fff3b0" stroke-width="2"/>`
        : `<path d="${STAR}" fill="none" stroke="${YELLOW}" stroke-width="3" opacity="0.35"/>`
      return `<g transform="translate(${x} ${y})"><g class="${isNewest ? 'twinkle' : ''}">${isOn ? `<circle r="46" fill="url(#starglow)"/>` : ''}${shape}</g></g>`
    })
    .join('')

const scene = (percent: number | undefined, match: MatchView | undefined) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.beam { animation: beam 14s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 0%; opacity: 0.10; }
.beam2 { animation-delay: -7s; }
.halo { animation: halo 6s ease-in-out infinite; opacity: 0.55; }
.twinkle { animation: twinkle 3.5s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; }
.crest { transform: translate(900px, 150px) scale(1); }
@media (max-aspect-ratio: 3/2) { .crest { transform: translate(780px, 170px) scale(0.92); } }
@media (max-aspect-ratio: 1/1) { .crest { transform: translate(590px, 110px) scale(0.7); } }
/* The chat column sits in the middle, about 700 points wide: the card stays left of it. */
.match { transform: translate(20px, 400px) scale(0.78); }
@media (max-width: 1699px) { .match { transform: translate(16px, 410px) scale(0.72); } }
@media (max-width: 1399px) { .match { transform: translate(12px, 420px) scale(0.66); } }
@media (max-aspect-ratio: 3/2) { .match { transform: translate(70px, 420px) scale(0.68); } }
@media (max-aspect-ratio: 1/1) { .match { transform: translate(590px, 600px) scale(0.86); } }
.livedot { animation: livedot 2s ease-in-out infinite; }
@keyframes livedot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes beam { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
@keyframes halo { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.7; } }
@keyframes twinkle { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
</style>
<defs>
${crest === undefined ? '' : `<symbol id="crest" viewBox="${crest.viewBox}">${crest.body}</symbol>`}
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0c1630"/>
<stop offset="1" stop-color="#060c1c"/>
</linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="${YELLOW}" stop-opacity="0.22"/>
<stop offset="1" stop-color="${YELLOW}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="starglow" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="${YELLOW}" stop-opacity="0.45"/>
<stop offset="1" stop-color="${YELLOW}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="beamfill" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#fff6cc" stop-opacity="1"/>
<stop offset="1" stop-color="#fff6cc" stop-opacity="0"/>
</linearGradient>
</defs>
<!-- night sky -->
<rect width="1600" height="1000" fill="url(#sky)"/>
<!-- kit stripes -->
<g opacity="0.07" fill="${YELLOW}">
<rect x="80" width="70" height="1000"/><rect x="300" width="70" height="1000"/><rect x="520" width="70" height="1000"/>
<rect x="740" width="70" height="1000"/><rect x="960" width="70" height="1000"/><rect x="1180" width="70" height="1000"/><rect x="1400" width="70" height="1000"/>
</g>
<!-- floodlight beams -->
<path class="beam" d="M180 -20 L 60 1000 L 420 1000 Z" fill="url(#beamfill)"/>
<path class="beam beam2" d="M1420 -20 L 1180 1000 L 1540 1000 Z" fill="url(#beamfill)"/>
<!-- crest with stars -->
<g class="crest" transform="translate(900 150)">
<circle class="halo" cx="300" cy="420" r="380" fill="url(#glow)"/>
${percent === undefined ? '' : stars(starCount(percent))}
${crest === undefined ? '' : '<use href="#crest" x="0" y="120" width="600" height="600"/>'}
</g>
<!-- match card -->
${match === undefined ? '' : card(match, crest !== undefined)}
</svg>`

// The march plays while a reply is on its way, looped, and stops when the turn ends.
// It also exits by itself once the Claude process (CLAUDE_PID) is gone, so a crash
// never leaves it playing.
const PLAYER_PS = [
  'Add-Type -AssemblyName PresentationCore',
  '$owner = 0; [void][int]::TryParse($env:OWNER_PID, [ref]$owner)',
  '$p = New-Object System.Windows.Media.MediaPlayer',
  '$p.Open([Uri]$env:MARS_PATH)',
  '$p.Volume = 0.5',
  '$p.Play()',
  'while ($true) {',
  '  Start-Sleep -Milliseconds 500',
  '  if ($owner -gt 0 -and -not (Get-Process -Id $owner -ErrorAction SilentlyContinue)) { $p.Close(); exit 0 }',
  '  if ($p.NaturalDuration.HasTimeSpan -and $p.Position -ge $p.NaturalDuration.TimeSpan) { $p.Position = [TimeSpan]::Zero; $p.Play() }',
  '  [Console]::Out.WriteLine(".")',
  '}',
].join('\n')

// What the Linux player writes when neither ffplay nor mpv is installed.
const NO_PLAYER = 'sari-lacivert: no ffplay or mpv found'

// Linux has no player the engine can use, so the march goes to ffplay (part of
// ffmpeg) or mpv, whichever is installed. The shell becomes the player through
// `exec`, so stopping the child stops the sound. A small watchdog beside it
// prints a dot every half second, so a stop is seen within that, and ends the
// player once the Claude process (OWNER_PID) or the pipe to it is gone.
const PLAYER_SH = [
  'if command -v ffplay >/dev/null 2>&1; then',
  '  set -- ffplay -nodisp -loop 0 -volume 50 -loglevel quiet "$MARS_PATH"',
  'elif command -v mpv >/dev/null 2>&1; then',
  '  set -- mpv --no-video --loop-file=inf --volume=50 --really-quiet "$MARS_PATH"',
  'else',
  `  echo '${NO_PLAYER}' >&2`,
  '  exit 127',
  'fi',
  'me=$$',
  '(',
  "  trap '' PIPE",
  '  while kill -0 "$me" 2>/dev/null; do',
  '    if [ -n "$OWNER_PID" ] && ! kill -0 "$OWNER_PID" 2>/dev/null; then break; fi',
  '    echo . || break',
  '    sleep 0.5',
  '  done',
  '  kill "$me" 2>/dev/null',
  ') 2>/dev/null &',
  'exec "$@"',
].join('\n')

// One player at a time. `done` settles once its process has really ended, so the
// next turn waits for it and two marches never overlap.
type Player = { stop: () => void; isStopping: boolean; done: Promise<void> }
let player: Player | undefined

// /mars toggles this; it resets when the app restarts.
let isMuted = false

// Asked once, then reused every turn.
type Host = { sysname: string; env: Record<string, string> }
let host: Promise<Host> | undefined

let hasWarned = false

const stopPlayer = () => {
  player?.stop()
}

// The match card on the left: polled every half hour, every minute around a game.
let match: MatchView | undefined
let pollTimer: Timer | undefined

const FETCH_HEADERS = { 'User-Agent': 'sari-lacivert-theme/1.0', Accept: 'application/json' }

const pollMatch = async ($: EngineInterface) => {
  let delay = 30 * 60_000
  try {
    const now = await $.clock.now()
    // ESPN answers 403 to the engine's default User-Agent; an explicit one gets through.
    const game = await pickGame(url => $.http.fetch(url, { headers: FETCH_HEADERS }), now)
    const view = game === undefined ? undefined : toView(game, now)
    if (JSON.stringify(view) !== JSON.stringify(match)) {
      match = view
      $.ui.invalidate('ui.render')
    }
    delay = nextPollMs(game, now)
  } catch (error) {
    $.ui.log(`sari-lacivert: maç bilgisi alınamadı: ${String(error)}`, { to: 'debug' })
  }
  pollTimer?.cancel()
  pollTimer = $.clock.after(delay, () => {
    void pollMatch($)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    // The crest is a quick local read; then the theme, which must not wait on the
    // context reading.
    try {
      crest = await loadCrest($)
    } catch {
      crest = undefined
    }
    if (crest === undefined) {
      // First start without a local file: the theme draws now, the crest joins it.
      void fetchCrest($)
        .then(fetched => {
          if (fetched !== undefined && crest === undefined) {
            crest = fetched
            $.ui.invalidate('ui.render')
          }
        })
        .catch(() => undefined)
    }
    const set = await $.theme.set(LOOK)
    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }
    // Stars later, in the background; a session.measure that lands first wins.
    void $.session
      .usage()
      .then(usage => {
        if (fill === undefined) {
          fill = usage.context.percent ?? 0
          $.ui.invalidate('ui.render')
        }
      })
      .catch(() => undefined)
    void $.command
      .register({ name: 'mars', description: 'Cevap beklerken çalan marşı kapatır ya da açar' })
      .catch(() => undefined)
    // Match card, in the background like the stars.
    pollTimer?.cancel()
    void pollMatch($)
    return next(e)
  })

  on('session.measure', ($, e, next) => {
    const percent = e.context.percent
    if (percent !== undefined && percent !== fill) {
      // Redraw only when a star turns on or off, not for every percent.
      const isNewStarCount = fill === undefined || starCount(percent) !== starCount(fill)
      fill = percent
      if (isNewStarCount) {
        $.ui.invalidate('ui.render')
      }
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined || isMuted || (player !== undefined && !player.isStopping)) {
      return next(e)
    }
    // A player still shutting down from the last turn: start after it has ended.
    const previous = player?.done
    let stopNow = () => {}
    let settle = () => {}
    const own: Player = {
      isStopping: false,
      done: new Promise<void>(resolve => {
        settle = resolve
      }),
      stop: () => {
        own.isStopping = true
        stopNow()
      },
    }
    player = own

    void (async () => {
      try {
        await previous
        if (own.isStopping) return
        host ??= Promise.all([$.session.machine(), $.process.hookEnv()]).then(([machine, env]) => ({
          sysname: machine.sysname,
          env,
        }))
        const { sysname, env } = await host
        if (own.isStopping) return

        // The march is the user's own file, assets/mars.mp3; without it nothing plays.
        if (!(await $.fs.exists(`${$.plugin.root}/assets/mars.mp3`)) || own.isStopping) return

        // Windows and Linux: a player process of our own, which prints a dot every
        // half second, so a stop is seen within that.
        const argv =
          sysname === 'Windows_NT'
            ? ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', PLAYER_PS]
            : sysname === 'Linux'
              ? ['/bin/sh', '-c', PLAYER_SH]
              : undefined
        if (argv !== undefined) {
          const separator = sysname === 'Windows_NT' ? '\\' : '/'
          const child = $.process.spawn({
            argv,
            env: {
              MARS_PATH: [env.CLAUDE_PLUGIN_ROOT, 'assets', 'mars.mp3'].join(separator),
              OWNER_PID: env.CLAUDE_PID ?? '',
            },
          })
          stopNow = () => {
            void child.return(undefined as never).catch(() => undefined)
          }
          let errors = ''
          let isLeft = false
          for await (const piece of child) {
            if (own.isStopping) {
              isLeft = true
              break
            }
            if (piece.stream === 'stderr') errors += piece.text
          }
          // The player ended by itself: a missing player or a file it can't open.
          if (!isLeft && !own.isStopping) {
            const { code } = await child.result
            if (errors.includes(NO_PLAYER) && !hasWarned) {
              hasWarned = true
              $.ui.toast("Marş için ffplay (ffmpeg paketi) ya da mpv kurulu olmalı: örneğin 'sudo apt install ffmpeg'.")
            }
            if (code !== 0 && code !== null) throw new Error(errors.trim() || `player exited with code ${code}`)
          }
        } else {
          // macOS: the engine plays it itself (afplay).
          const controller = new AbortController()
          stopNow = () => controller.abort()
          await $.audio.play({ asset: 'assets/mars.mp3' }, { shouldLoop: true, gain: 0.6, signal: controller.signal })
        }
      } catch (error) {
        $.ui.log(`sari-lacivert: marş çalınamadı: ${String(error)}`, { to: 'debug' })
        if (!hasWarned) {
          hasWarned = true
          $.ui.toast('Marş çalınamadı; ayrıntı debug logunda.')
        }
      } finally {
        if (player === own) player = undefined
        settle()
      }
    })()

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      stopPlayer()
    }
    return next(e)
  })

  // Esc or Stop: the reply is cut off, so the march stops too.
  on('session.stop', ($, e, next) => {
    stopPlayer()
    return next(e)
  })

  on('session.end', ($, e, next) => {
    stopPlayer()
    return next(e)
  })

  on('command.run', { command: 'mars' }, async () => {
    isMuted = !isMuted
    if (isMuted) {
      stopPlayer()
    }
    return { text: isMuted ? 'Marş kapatıldı. Açmak için tekrar /mars yaz.' : 'Marş açıldı; bir sonraki cevapta çalacak.' }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.scene !== SCENE || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const crest =
      fill === undefined
        ? 'Lacivert gece ve kulüp arması'
        : `Lacivert gece, kulüp arması ve üstünde ${starCount(fill)} dolu yıldız`
    const game =
      match === undefined
        ? ''
        : `; maç: ${match.home.name} ${match.middle} ${match.away.name}, ${match.header}${match.sub ? `, ${match.sub}` : ''}`

    return <Svg source={scene(fill, match)} alt={crest + game} isInteractive />
  })
}
