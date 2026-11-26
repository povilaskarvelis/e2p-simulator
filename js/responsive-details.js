// Show the full reference material on desktop and remember phone choices across rotation.
const compactLayout = window.matchMedia('(max-width: 900px)');
document.querySelectorAll('details.responsive-details').forEach(details => {
    let openOnPhone = false;
    details.open = !compactLayout.matches;
    compactLayout.addEventListener('change', ({ matches }) => {
        if (!matches) openOnPhone = details.open;
        details.open = matches ? openOnPhone : true;
    });
});
