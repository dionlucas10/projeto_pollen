// Smooth scrolling for in-page anchor links with header offset and accessibility focus
(function () {
  document.addEventListener('click', function (e) {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // allow default for external or other protocols
    // handle only same-page hash links
    if (!href.startsWith('#')) return;

    e.preventDefault();

    // scroll to top when href is "#" or "#top"
    if (href === '#' || href === '#top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const target = document.querySelector(href);
    if (!target) return;

    // compute offset if header is fixed
    const header = document.querySelector('header');
    const headerOffset = (header && getComputedStyle(header).position === 'fixed') ? header.offsetHeight : 0;
    const extraGap = 10; // small gap so element isn't flush with top

    const y = target.getBoundingClientRect().top + window.pageYOffset - headerOffset - extraGap;

    window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });

    // accessibility: move focus to target after scrolling
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
})();
