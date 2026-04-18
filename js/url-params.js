/**
 * Parse the current page query string into a plain object.
 * Uses URLSearchParams so decoding matches across binary, continuous, and main.
 */
function parseURLParams() {
    const params = {};
    const urlParams = new URLSearchParams(window.location.search);
    for (const [key, value] of urlParams.entries()) {
        params[key] = value;
    }
    return params;
}
