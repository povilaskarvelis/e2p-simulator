/**
 * Site version shown in the header/footer.
 * Kept in sync with the latest git release tag; GitHub API may override it.
 */
const SITE_VERSION = 'v1.3.0';

function setVersionDisplays(versionNumber) {
    if (!versionNumber) return;

    document.querySelectorAll('[data-version]').forEach((el) => {
        el.textContent = versionNumber;
        el.hidden = false;
        if (!el.classList.contains('site-version')) {
            el.style.color = '#0366d6';
        }
    });
}

/**
 * Fills every [data-version] element. Uses a local fallback immediately,
 * then upgrades from the latest GitHub release when available.
 */
async function fetchVersionInfo() {
    setVersionDisplays(SITE_VERSION);

    try {
        const response = await fetch('https://api.github.com/repos/povilaskarvelis/e2p-simulator/releases/latest');
        if (!response.ok) return;

        const data = await response.json();
        const versionNumber = data.tag_name || data.name;
        if (versionNumber) {
            setVersionDisplays(versionNumber);
        }
    } catch (error) {
        // Keep the local fallback already shown.
    }
}
