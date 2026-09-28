// Coloque este script no <head> de TODAS as páginas do site:
//   <script src="js/frame-guard.js"></script>
// Se a página for aberta direto (fora do portal), ele redireciona para
// portal.html, que carrega a mesma página dentro do iframe. Assim a
// música continua tocando não importa por onde a pessoa entre.
(function () {
    if (window.self !== window.top) return; // já está dentro do portal

    document.documentElement.style.visibility = 'hidden'; // evita "piscar" antes do redirect
    var page = location.pathname.split('/').pop() + location.search;
    location.replace('portal.html?p=' + encodeURIComponent(page));
})();
