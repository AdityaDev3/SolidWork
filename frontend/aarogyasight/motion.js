// Motion animations stub for AarogyaSight UI transitions
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.panel, .stat-card').forEach((el, i) => {
      el.style.animationDelay = `${i * 0.05}s`;
      el.classList.add('animate-fade-in');
    });
  });
})();
