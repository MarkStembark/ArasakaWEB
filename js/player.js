// ============================================================
// Página Arasaka Music (roda dentro do portal).
// O áudio e a lista de músicas vivem em portal.js / tracks.js;
// aqui fica só a interface, que comanda o motor do portal.
// ============================================================
(() => {
    let P = null;
    try { P = window.parent.ArasakaPlayer; } catch (e) {}

    if (!P) {
        // Aberta fora do portal: volta pelo portal, para a música seguir entre páginas
        location.replace('portal.html?p=' + encodeURIComponent(location.pathname.split('/').pop()));
        return;
    }

    const $ = (sel) => document.querySelector(sel);
    const list = $('#tracklist');
    const titleEl = $('#title');
    const discTitle = $('#discTitle');
    const seek = $('#seek');
    const fill = $('#fill');
    const toggleBtn = $('#toggle');
    const volSlider = $('#volume');
    const volBtn = $('#mute');
    const tracks = P.tracks;
    const FALLBACK_COVER = 'img/arasakalogo4.png';
    const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

    let liked = new Set();
    try { liked = new Set(JSON.parse(localStorage.getItem('arasaka-liked') || '[]')); } catch (e) {}
    const saveLiked = () => {
        try { localStorage.setItem('arasaka-liked', JSON.stringify([...liked])); } catch (e) {}
    };

    // ---------- Monta a lista na tela ----------
    $('#count').textContent = tracks.length + ' faixas';

    const rows = tracks.map((t, i) => {
        const li = document.createElement('li');
        li.className = 'track';
        li.innerHTML =
            '<button class="pick" type="button">' +
                '<img class="cover" alt="">' +
                '<span class="meta"><strong class="name"></strong><em class="artist"></em></span>' +
            '</button>' +
            '<button class="like" type="button" aria-label="Curtir">' +
                '<svg viewBox="0 0 24 24"><path d="' + HEART + '"/></svg>' +
            '</button>';

        // textContent evita problemas com caracteres especiais nos títulos
        li.querySelector('.cover').src = t.cover || FALLBACK_COVER;
        li.querySelector('.name').textContent = t.title;
        li.querySelector('.artist').textContent = t.artist;

        const like = li.querySelector('.like');
        like.setAttribute('aria-pressed', liked.has(i));
        like.addEventListener('click', () => {
            liked.has(i) ? liked.delete(i) : liked.add(i);
            like.setAttribute('aria-pressed', liked.has(i));
            saveLiked();
        });

        li.querySelector('.pick').addEventListener('click', () => {
            i === P.state().index ? P.toggle() : P.load(i, true);
        });

        list.appendChild(li);
        return li;
    });

    // ---------- Desenha a tela a partir do estado do motor ----------
    let shownIndex = -1;

    function render(s) {
        if (s.index !== shownIndex) {
            titleEl.textContent = s.track.title;
            titleEl.title = s.track.title;
            const short = s.track.title.length > 24 ? s.track.title.slice(0, 23) + '…' : s.track.title;
            discTitle.textContent = short.toUpperCase();
            rows.forEach((li, k) => li.classList.toggle('current', k === s.index));
            if (shownIndex !== -1) rows[s.index].scrollIntoView({ block: 'nearest' });
            shownIndex = s.index;
        }

        document.body.classList.toggle('playing', s.playing);
        toggleBtn.setAttribute('aria-label', s.playing ? 'Pausar' : 'Tocar');
        fill.style.width = (s.duration ? Math.min(100, (s.time / s.duration) * 100) : 0) + '%';

        if (volSlider && volBtn) {
            const v = s.muted ? 0 : s.volume;
            volSlider.value = Math.round(v * 100);
            volSlider.style.setProperty('--v', Math.round(v * 100) + '%');
            volBtn.classList.toggle('muted', v === 0);
            volBtn.setAttribute('aria-label', v === 0 ? 'Ativar som' : 'Silenciar');
        }
    }

    // ---------- Botões ----------
    $('#next').addEventListener('click', () => P.next());
    $('#prev').addEventListener('click', () => P.prev());
    toggleBtn.addEventListener('click', () => P.toggle());

    seek.addEventListener('click', (e) => {
        const r = seek.getBoundingClientRect();
        P.seek((e.clientX - r.left) / r.width);
    });

    if (volSlider && volBtn) {
        volSlider.addEventListener('input', () => P.setVolume(volSlider.value / 100));
        volBtn.addEventListener('click', () => P.toggleMute());
    }

    // ---------- Liga na fonte de estado (e desliga ao sair da página) ----------
    const unsubscribe = P.subscribe(render);
    window.addEventListener('pagehide', unsubscribe);
    render(P.state());
})();
