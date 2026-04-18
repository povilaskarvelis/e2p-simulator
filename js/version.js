/**
 * Fetches the latest GitHub release tag and updates #version-number.
 * Hides #version-info if the request fails or the element is missing.
 */
async function fetchVersionInfo() {
    try {
        const response = await fetch('https://api.github.com/repos/povilaskarvelis/e2p-simulator/releases/latest');
        if (response.ok) {
            const data = await response.json();
            const versionNumber = data.tag_name || data.name;

            const versionElement = document.getElementById('version-number');
            if (versionElement && versionNumber) {
                versionElement.textContent = versionNumber;
                versionElement.style.color = '#0366d6';
            }
        } else {
            const versionInfo = document.getElementById('version-info');
            if (versionInfo) {
                versionInfo.style.display = 'none';
            }
        }
    } catch (error) {
        const versionInfo = document.getElementById('version-info');
        if (versionInfo) {
            versionInfo.style.display = 'none';
        }
    }
}
