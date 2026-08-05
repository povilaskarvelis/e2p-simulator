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

test('suicide prediction example uses the external women cohort inputs and results', () => {
    const example = getStartedHtml.match(
        /<h3>Example 4\. Risk Prediction: Suicide Attempts<\/h3>[\s\S]*?(?=<h3>Example 5\.)/
    )?.[0];

    assert.ok(example, 'Expected the suicide prediction example');
    assert.match(example, /base rate to 4\.8%/);
    assert.match(example, /PR-AUC = 0\.12/);
    assert.match(example, /Sensitivity = 0\.85, Specificity = 0\.40, PPV = 0\.07, and ΔNB = 0\.004/);
    assert.match(example, /ΔNB = 0\.023/);
    assert.match(example, /baseRate=0\.048/);
    assert.match(example, /label1=Psychiatric%20controls[\s\S]*label2=Suicide%20attempters/);
    assert.doesNotMatch(example, /base rate to 3\.9%|PR-AUC = 0\.10|ΔNB = 0\.025/);
});

test('depression example uses official 12-month prevalence sources', () => {
    const example = getStartedHtml.match(
        /<h3>Example 2\. Diagnostic Prediction: Depression<\/h3>[\s\S]*?(?=<h3>Example 3\.)/
    )?.[0];

    assert.ok(example, 'Expected the depression prediction example');
    assert.match(example, /12-month prevalence of major depressive episodes/);
    assert.match(example, /www\.nimh\.nih\.gov\/health\/statistics\/major-depression/);
    assert.match(example, /www150\.statcan\.gc\.ca\/n1\/pub\/11-627-m\/11-627-m2023053-eng\.htm/);
    assert.match(
        example,
        /multiTargetRocAuc=0\.965[\s\S]*multiEffectSize=0\.8[\s\S]*multiCollinearity=0\.05[\s\S]*multiPredictors=20/
    );
    assert.doesNotMatch(getStartedHtml, /Shorey et al\., 2022|10\.1111\/bjc\.12333/);
});

test('treatment response example uses the revised reliability and response assumptions', () => {
    const example = getStartedHtml.match(
        /<h3>Example 3\. Treatment Response Prediction: Antidepressants<\/h3>[\s\S]*?(?=<h3>Example 4\.)/
    )?.[0];

    assert.ok(example, 'Expected the antidepressant treatment response example');
    assert.match(example, /Set base rate to 46%/);
    assert.match(example, /Set outcome reliability to 0\.95/);
    assert.match(example, /ROC-AUC = 0\.71 and PR-AUC = 0\.66/);
    assert.match(example, /Sensitivity = 0\.98, PPV = 0\.48, and ΔNB = 0\.005/);
    assert.match(example, /ROC-AUC = 0\.85 and PR-AUC = 0\.83/);
    assert.match(example, /Sensitivity = 0\.95, PPV = 0\.59, and ΔNB = 0\.035/);
    assert.match(example, /target R² to 0\.47/);
    assert.match(example, /r = 0\.30[\s\S]*20 predictors are needed/);
    assert.match(example, /r = 0\.25[\s\S]*target cannot be reached/);
    assert.doesNotMatch(example, /r = 0\.40 for each predictor/);
    assert.match(example, /outcomeReliability=0\.95[\s\S]*baseRate=0\.46/);
    assert.match(example, /xaxisLabel=Multivariable%20task-fMRI%20prediction%20score/);
    assert.match(
        example,
        /multiTargetR2=0\.47[\s\S]*multiPredictorCorrelation=0\.3[\s\S]*multiCollinearity=0\.15[\s\S]*multiPredictors=20/
    );
    assert.doesNotMatch(getStartedHtml, /Furukawa et al\., 2016|Trajković et al\., 2011/);
});
