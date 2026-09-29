// ============================================================
// VÍDEOS/GIFS LATERAIS — inclua <script src="js/side-videos.js"></script>
// no <head> de qualquer página que tenha:
//   <td class="lateral lateral-esquerda"></td>
//   <td class="lateral lateral-direita"></td>
// Troque o caminho abaixo (aceita .mp4/.webm OU .gif/.png/.jpg) e ele
// vale para TODAS as páginas de uma vez.
// ============================================================
(function () {
    const SRC = 'img/cyberredcolor.mp4';
    const isVideo = /\.(mp4|webm)$/i.test(SRC);

    function preencher(el) {
        if (!el || el.firstElementChild) return; // célula não existe ou já tem conteúdo

        if (isVideo) {
            const video = document.createElement('video');
            video.autoplay = true;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;

            const source = document.createElement('source');
            source.src = SRC;
            source.type = 'video/' + SRC.split('.').pop();

            video.appendChild(source);
            el.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = SRC;
            img.alt = '';
            el.appendChild(img);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        preencher(document.querySelector('.lateral-esquerda'));
        preencher(document.querySelector('.lateral-direita'));
    });
})();