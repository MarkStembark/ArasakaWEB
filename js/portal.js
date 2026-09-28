// ============================================================
// PORTAL — esta página nunca recarrega. O site roda no iframe e
// o áudio vive aqui, por isso a música segue tocando ao navegar.
// ============================================================
(() => {
    const MUSIC_PAGE = 'arasakamusic.html'; // nessa página o mini player fica escondido
    const HOME_PAGE = 'index.html';

    const $ = (sel) => document.querySelector(sel);
    const audio = $('#audio');
    const frame = $('#site');
    const mini = $('#mini');
    const tracks = window.TRACKS || [];

    // ---------- Página inicial do iframe (?p=pagina.html) ----------
    // A regex só aceita caminhos relativos terminados em .html (sem "..", sem http:)
    const wanted = new URLSearchParams(location.search).get('p') || '';
    const safe = /^(?!\/|.*\.\.)[\w\-./]+\.html(\?[\w=&%\-]*)?$/i.test(wanted);
    frame.src = safe ? wanted : HOME_PAGE;

    if (!tracks.length) {
        console.warn('js/tracks.js não carregou ou está vazio.');
        return;
    }

    // ---------- Estado ----------
    let index = 0;
    let active = false;      // vira true no primeiro play; volta a false no X do mini player
    let onMusicPage = false;
    let lastVolume = 0.5;
    const listeners = new Set();

    audio.volume = 0.5;
    try {
        const saved = parseFloat(localStorage.getItem('arasaka-volume'));
        if (saved >= 0 && saved <= 1) audio.volume = saved;
    } catch (e) {}
    if (audio.volume > 0) lastVolume = audio.volume;

    const state = () => ({
        index,
        track: tracks[index],
        playing: !audio.paused,
        time: audio.currentTime || 0,
        duration: isFinite(audio.duration) ? audio.duration : 0,
        volume: audio.volume,
        muted: audio.muted,
    });

    function notify() {
        const s = state();
        listeners.forEach((fn) => { try { fn(s); } catch (e) {} });
    }

    // ---------- Comandos ----------
    function load(i, autoplay) {
        index = (i + tracks.length) % tracks.length;
        audio.src = tracks[index].src;
        if (autoplay) audio.play().catch(() => {});
        notify();
    }
    function toggle() {
        if (audio.paused) audio.play().catch(() => {});
        else audio.pause();
    }
    function next() { load(index + 1, true); }
    function prev() {
        // Depois de 3s, "voltar" reinicia a faixa (padrão dos players)
        if (audio.currentTime > 3) audio.currentTime = 0;
        else load(index - 1, true);
    }
    function seek(ratio) {
        if (!isFinite(audio.duration)) return;
        audio.currentTime = Math.min(Math.max(ratio, 0), 1) * audio.duration;
    }
    function setVolume(v) {
        audio.muted = false;
        audio.volume = Math.min(Math.max(v, 0), 1);
    }
    function toggleMute() {
        if (audio.muted || audio.volume === 0) {
            audio.muted = false;
            if (audio.volume === 0) audio.volume = lastVolume;
        } else {
            audio.muted = true;
        }
    }

    // API usada pela página da música (que roda dentro do iframe)
    window.ArasakaPlayer = {
        tracks, state, load, toggle, next, prev, seek, setVolume, toggleMute,
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    };

    // ---------- Waveform (analisador de áudio real, com plano B) ----------
    const canvas = $('#wave');
    const g = canvas.getContext('2d');
    const N = 64;
    const levels = new Float32Array(N);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ctx = null, analyser = null, freq = null, settingUp = false, raf = 0;

    async function setupAnalyser() {
        // Só em http(s): em file:// o navegador zera o áudio ao passar pelo analisador
        if (analyser || settingUp || !/^https?:$/.test(location.protocol)) return;
        settingUp = true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const c = new AC();
            if (c.state !== 'running') await c.resume();
            if (c.state !== 'running') { c.close(); return; } // sem permissão: usa barras simuladas
            const node = c.createAnalyser();
            node.fftSize = 128;
            node.smoothingTimeConstant = 0.8;
            c.createMediaElementSource(audio).connect(node);
            node.connect(c.destination);
            ctx = c; analyser = node; freq = new Uint8Array(node.frequencyBinCount);
        } catch (e) {
            /* segue com barras simuladas */
        } finally {
            settingUp = false;
        }
    }

    function paint() {
        const W = canvas.width, H = canvas.height, step = W / N;
        g.clearRect(0, 0, W, H);
        for (let i = 0; i < N; i++) {
            const x = i * step + step * 0.3, w = step * 0.4;
            g.fillStyle = 'rgba(255,255,255,.35)';   // ponto-base (linha pontilhada)
            g.fillRect(x, H - 6, w, 6);
            const h = Math.round(levels[i] * (H - 10));
            if (h > 0) {
                g.fillStyle = '#ff0000';
                g.fillRect(x, H - 6 - h, w, h);
            }
        }
    }

    function tick() {
        if (mini.hidden) { raf = 0; return; }
        const playing = !audio.paused;

        if (reduceMotion) {
            levels.fill(0);
        } else if (playing && analyser) {
            analyser.getByteFrequencyData(freq);
            for (let i = 0; i < N; i++) levels[i] = freq[Math.floor(i * 0.6)] / 255;
        } else if (playing) {
            for (let i = 0; i < N; i++) {
                const profile = 0.35 + 0.65 * Math.sin((i / N) * Math.PI);
                levels[i] = levels[i] * 0.75 + Math.random() * 0.25 * profile;
            }
        } else {
            for (let i = 0; i < N; i++) levels[i] *= 0.85;
        }

        paint();
        const settled = !playing && levels.every((v) => v < 0.01);
        raf = (settled || reduceMotion) ? 0 : requestAnimationFrame(tick);
    }

    function startViz() {
        if (!raf && !mini.hidden) raf = requestAnimationFrame(tick);
    }

    // ---------- Mini player ----------
    const miniTitle = $('#miniTitle');
    const miniFill = $('#miniFill');
    const miniKnob = $('#miniKnob');
    const miniPlay = $('#miniPlay');

    function syncMini() {
        mini.hidden = !(active && !onMusicPage);
        if (!mini.hidden) startViz();
    }

    listeners.add((s) => {
        miniTitle.textContent = s.track.title;
        mini.classList.toggle('playing', s.playing);
        miniPlay.setAttribute('aria-label', s.playing ? 'Pausar' : 'Tocar');
        const pct = s.duration ? Math.min(100, (s.time / s.duration) * 100) : 0;
        miniFill.style.width = pct + '%';
        miniKnob.style.left = pct + '%';
    });

    $('#miniPrev').addEventListener('click', prev);
    $('#miniNext').addEventListener('click', next);
    miniPlay.addEventListener('click', toggle);
    $('#miniClose').addEventListener('click', () => {
        audio.pause();
        active = false;
        syncMini();
    });
    $('#miniSeek').addEventListener('click', (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        seek((e.clientX - r.left) / r.width);
    });

    // ---------- Eventos do áudio ----------
    audio.addEventListener('play', () => {
        active = true;
        setupAnalyser();
        syncMini();
        startViz();
        notify();
    });
    audio.addEventListener('pause', () => { notify(); startViz(); });
    audio.addEventListener('ended', next);
    audio.addEventListener('timeupdate', notify);
    audio.addEventListener('loadedmetadata', notify);
    audio.addEventListener('volumechange', () => {
        if (audio.volume > 0) lastVolume = audio.volume;
        try { localStorage.setItem('arasaka-volume', audio.volume); } catch (e) {}
        notify();
    });

    // ---------- A cada página nova carregada no iframe ----------
    frame.addEventListener('load', () => {
        let rel = '';
        try {
            const loc = frame.contentWindow.location;
            if (loc.protocol === 'about:') return;
            const base = location.pathname.replace(/[^/]*$/, '');
            if (loc.pathname.startsWith(base)) rel = loc.pathname.slice(base.length) + loc.search;
            document.title = frame.contentDocument.title || 'Arasaka';
        } catch (e) { /* página externa: não dá para ler */ }

        // Mantém a barra de endereço apontando para a página atual (F5 volta para ela)
        if (rel) {
            try { history.replaceState(null, '', '?p=' + encodeURIComponent(rel)); } catch (e) {}
        }

        onMusicPage = rel.toLowerCase().startsWith(MUSIC_PAGE);
        syncMini();
    });

    load(0, false); // primeira faixa carregada; o navegador só libera o som após um clique
})();
