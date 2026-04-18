/**
 * Bidirectional sync between a range input and a number input.
 * @param {string} rangeId
 * @param {string} numberId
 * @param {object} [options]
 * @param {number} [options.decimals=2]
 * @param {'change'|'input'} [options.numberEvent='change'] - when number pushes to range
 * @param {function('range'|'number'): void} [options.onSync] - after value copied either direction
 */
function bindRangeNumberPair(rangeId, numberId, options) {
    const opts = options || {};
    const decimals = opts.decimals !== undefined ? opts.decimals : 2;
    const numberEvent = opts.numberEvent || 'change';
    const range = document.getElementById(rangeId);
    const number = document.getElementById(numberId);
    if (!range || !number) return;

    const format = function (raw) {
        const v = parseFloat(raw);
        return isNaN(v) ? '' : v.toFixed(decimals);
    };

    range.addEventListener('input', function () {
        number.value = format(range.value);
        if (opts.onSync) opts.onSync('range');
    });

    number.addEventListener(numberEvent, function () {
        range.value = number.value;
        if (opts.onSync) opts.onSync('number');
    });
}
