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
const mainSource = fs.readFileSync(
    path.join(projectRoot, 'js', 'main.js'),
    'utf8'
);
const tutorialSource = fs.readFileSync(
    path.join(projectRoot, 'js', 'tutorial.js'),
    'utf8'
);
const exportSource = fs.readFileSync(
    path.join(projectRoot, 'js', 'export.js'),
    'utf8'
);

test('the focus-triggered tooltip runtime is not shipped', () => {
    assert.doesNotMatch(
        indexHtml,
        /accessibility\.js/
    );
    assert.equal(
        fs.existsSync(
            path.join(projectRoot, 'js', 'accessibility.js')
        ),
        false
    );
});

test('navigation focus remains visible without outlining numeric inputs', () => {
    assert.match(baseCss, /:focus-visible/);
    assert.match(
        baseCss,
        /input\[type="number"\]:focus/
    );
    assert.match(
        baseCss,
        /input\[type="number"\]:focus-visible\s*\{[^}]*outline:\s*none/s
    );
    assert.doesNotMatch(
        `${baseCss}\n${indexPatternsCss}`,
        /button[^}]*outline\s*:\s*(?:none|0)\b/s
    );
});

test('tooltips retain their original hover-only activation', () => {
    assert.match(
        baseCss,
        /\[data-tooltip\]:hover:before/
    );
    assert.doesNotMatch(baseCss, /keyboard-tooltip/);
});

test('ROC and precision-recall tooltips describe their specific quantities', () => {
    assert.equal(
        (
            indexHtml.match(
                /ROC-AUC summarizes how well scores rank positive cases above negative cases across thresholds/g
            ) || []
        ).length,
        2
    );
    assert.equal(
        (
            indexHtml.match(
                /PR-AUC summarizes precision \(PPV\) across levels of recall \(sensitivity\)/g
            ) || []
        ).length,
        2
    );
    assert.doesNotMatch(
        indexHtml,
        /AUC measures discrimination independent of base rate|base-rate–dependent predictive performance/
    );
});

test('all plot tooltips share a layer above export chrome without entering captures', () => {
    assert.match(
        indexPatternsCss,
        /\.simulator-export-region\s*\{[^}]*z-index:\s*6/s
    );
    assert.doesNotMatch(
        baseCss,
        /\.roc-pr-section\s*\{[^}]*z-index/s
    );
    assert.match(
        indexPatternsCss,
        /\.export-bar\s*\{[^}]*z-index:\s*5/s
    );
    assert.match(
        exportSource,
        /\.export-bar, \.export-button/
    );
    assert.match(
        indexPatternsCss,
        /html\.is-exporting \[data-tooltip\]:before/
    );
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
