const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const getStartedHtml = fs.readFileSync(path.join(projectRoot, 'get-started.html'), 'utf8');
const sampleSizeBinarySource = fs.readFileSync(
    path.join(projectRoot, 'js', 'sample-size-binary.js'),
    'utf8'
);

function inputAttributes(id) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tag = indexHtml.match(new RegExp(`<input\\b[^>]*\\bid="${escapedId}"[^>]*>`))?.[0];
    assert.ok(tag, `Expected input #${id}`);

    return Object.fromEntries(
        ['min', 'max', 'step'].map((attribute) => [
            attribute,
            tag.match(new RegExp(`\\b${attribute}="([^"]+)"`))?.[1]
        ])
    );
}

test('sample-size range and number controls use identical constraints', () => {
    const pairs = [
        ['ssb-p-slider', 'ssb-p'],
        ['ssb-prevalence-slider', 'ssb-prevalence'],
        ['ssb-epv-slider', 'ssb-epv'],
        ['ssb-risk-margin-slider', 'ssb-risk-margin'],
        ['ssb-mape-slider', 'ssb-mape'],
        ['ssb-r2cs-slider', 'ssb-r2cs'],
        ['ssb-shrinkage-slider', 'ssb-shrinkage'],
        ['ssb-r2-difference-slider', 'ssb-r2-difference'],
        ['ssc-p-slider', 'ssc-p'],
        ['ssc-r2-slider', 'ssc-r2'],
        ['ssc-shrinkage-slider', 'ssc-shrinkage'],
        ['ssc-delta-slider', 'ssc-delta']
    ];

    pairs.forEach(([rangeId, numberId]) => {
        assert.deepEqual(
            inputAttributes(numberId),
            inputAttributes(rangeId),
            `#${numberId} should match #${rangeId}`
        );
    });
});

test('odds-ratio tooltips use Group 2 as the positive group', () => {
    assert.doesNotMatch(indexHtml, /odds of being in group 1 vs group 2/i);
    assert.equal(
        (indexHtml.match(/odds of being in group 2 vs group 1/gi) || []).length,
        2
    );
});

test('user-facing statistical terminology and punctuation remain consistent', () => {
    const copy = `${indexHtml}\n${getStartedHtml}\n${sampleSizeBinarySource}`;

    assert.doesNotMatch(indexHtml, /desired level predictive performance/);
    assert.doesNotMatch(copy, /R²(?:cs|CS)|R²<sub>(?:cs|CS)<\/sub>|Cox-Snell/);
    assert.doesNotMatch(copy, /ln\(P\)/);
    assert.doesNotMatch(getStartedHtml, /grouping reliability|e\.g\.,<a/);
    assert.match(copy, /Cox–Snell R²/);
});
