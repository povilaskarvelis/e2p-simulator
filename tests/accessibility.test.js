const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(
    path.join(projectRoot, 'index.html'),
    'utf8'
);
const baseCss = fs.readFileSync(
    path.join(projectRoot, 'css', 'base.css'),
    'utf8'
);
const indexPatternsCss = fs.readFileSync(
    path.join(projectRoot, 'css', 'index-patterns.css'),
    'utf8'
);
const accessibilitySource = fs.readFileSync(
    path.join(projectRoot, 'js', 'accessibility.js'),
    'utf8'
);
const mainSource = fs.readFileSync(
    path.join(projectRoot, 'js', 'main.js'),
    'utf8'
);
const tutorialSource = fs.readFileSync(
    path.join(projectRoot, 'js', 'tutorial.js'),
    'utf8'
);

test('the focused keyboard-usability layer is loaded by the simulator', () => {
    assert.match(
        indexHtml,
        /<script defer src="js\/accessibility\.js"><\/script>/
    );
});

test('focus outlines are visible and no stylesheet suppresses them', () => {
    assert.match(baseCss, /:focus-visible/);
    assert.doesNotMatch(
        `${baseCss}\n${indexPatternsCss}`,
        /outline\s*:\s*(?:none|0)\b/
    );
});

test('control tooltips are visible on keyboard focus and dismissible', () => {
    assert.match(
        baseCss,
        /\.keyboard-tooltip-active/
    );
    assert.match(accessibilitySource, /addEventListener\('focus'/);
    assert.match(accessibilitySource, /event\.key !== 'Escape'/);
    assert.doesNotMatch(accessibilitySource, /setAttribute\('tabindex'/);
});

test('show-more controls expose their expanded state', () => {
    assert.match(mainSource, /aria-expanded/);
    assert.match(mainSource, /aria-controls/);
});

test('the tutorial retains its high-value keyboard behavior', () => {
    assert.match(tutorialSource, /role="dialog"/);
    assert.match(tutorialSource, /e\.key === 'Tab'/);
    assert.match(tutorialSource, /e\.key === 'Escape'/);
    assert.match(tutorialSource, /closeTour\(false\)/);
    assert.match(tutorialSource, /returnTarget\.focus/);
    assert.doesNotMatch(tutorialSource, /setBackgroundInert/);
    assert.doesNotMatch(tutorialSource, /aria-live/);
});

test('the screen-reader-specific chart runtime is not shipped', () => {
    assert.doesNotMatch(
        indexHtml,
        /chart-accessibility\.js/
    );
    assert.equal(
        fs.existsSync(
            path.join(
                projectRoot,
                'js',
                'chart-accessibility.js'
            )
        ),
        false
    );
});
