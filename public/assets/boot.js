/* Runs before first paint: theme, language, intro and lite mode, so nothing flashes. */
(function () {
  var d = document.documentElement, t = 'dark', l = 'pt', s = false;
  d.className = d.className.replace('no-js', 'js');
  try { t = localStorage.getItem('cdo-theme') || 'dark'; l = localStorage.getItem('cdo-lang') || 'pt'; } catch (e) { /* private mode */ }
  try { s = sessionStorage.getItem('cdo-intro') === '1'; } catch (e) { /* private mode */ }
  try { t = JSON.parse(t); } catch (e) { /* stored raw */ }
  try { l = JSON.parse(l); } catch (e) { /* stored raw */ }
  d.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  d.setAttribute('data-lang', l === 'en' ? 'en' : 'pt');
  d.lang = l === 'en' ? 'en' : 'pt-BR';
  if (!s) d.classList.add('intro-on');
  if (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4) d.classList.add('lite');
})();
