const test = require('node:test');
const assert = require('node:assert/strict');

const {
    binaryNagelkerkeOptimismSampleSize,
    binaryOverallRiskSampleSize,
    binaryShrinkageSampleSize,
    calculateNormalModelIci,
    calculatePopulationCalibrationMetrics,
    continuousOptimismSampleSize,
    continuousShrinkageSampleSize,
    maximumCoxSnellR2,
    minimumValidCollinearity,
    multivariateRSquared,
    outcomeReliabilityFactor,
    selectableCoxSnellR2Limit,
    validateCoxSnellInputs
} = require('../js/statistical-core.js');

function approximatelyEqual(actual, expected, tolerance = 1e-10) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${actual} to be within ${tolerance} of ${expected}`
    );
}

function logistic(value) {
    return 1 / (1 + Math.exp(-value));
}

function logit(probability) {
    return Math.log(probability / (1 - probability));
}

function normalDensity(value, mean, standardDeviation) {
    const z = (value - mean) / standardDeviation;
    return (
        Math.exp(-0.5 * z * z) /
        (standardDeviation * Math.sqrt(2 * Math.PI))
    );
}

function normalPosterior(value, parameters) {
    const density0 =
        normalDensity(
            value,
            parameters.group0.mean,
            parameters.group0.stdDev
        ) *
        (1 - parameters.baseRate);
    const density1 =
        normalDensity(
            value,
            parameters.group1.mean,
            parameters.group1.stdDev
        ) *
        parameters.baseRate;
    return density1 / (density0 + density1);
}

function normalCalibrationPoints(
    testParameters,
    deploymentParameters,
    pointCount = 1000
) {
    const groups = [
        testParameters.group0,
        testParameters.group1,
        deploymentParameters.group0,
        deploymentParameters.group1
    ];
    const minimum = Math.min(
        ...groups.map((group) => group.mean - 8 * group.stdDev)
    );
    const maximum = Math.max(
        ...groups.map((group) => group.mean + 8 * group.stdDev)
    );
    const width = (maximum - minimum) / pointCount;

    return Array.from({ length: pointCount }, (_, index) => {
        const value = minimum + (index + 0.5) * width;
        const weight =
            normalDensity(
                value,
                deploymentParameters.group0.mean,
                deploymentParameters.group0.stdDev
            ) *
                (1 - deploymentParameters.baseRate) +
            normalDensity(
                value,
                deploymentParameters.group1.mean,
                deploymentParameters.group1.stdDev
            ) *
                deploymentParameters.baseRate;

        return {
            predicted: normalPosterior(value, testParameters),
            observed: normalPosterior(value, deploymentParameters),
            weight
        };
    });
}

test('outcome reliability uses sqrt(sin(pi*kappa/2))', () => {
    approximatelyEqual(
        outcomeReliabilityFactor(0.5),
        Math.sqrt(Math.sin(Math.PI / 4))
    );
});

test('continuous optimism criterion treats its input as R-squared', () => {
    assert.equal(continuousOptimismSampleSize(10, 0.5, 0.05), 101);
});

test('binary Riley criteria reproduce the pmsampsize worked inputs', () => {
    assert.equal(binaryShrinkageSampleSize(24, 0.288, 0.9), 623);
    assert.equal(
        binaryNagelkerkeOptimismSampleSize(24, 0.288, 0.174, 0.05),
        662
    );
    assert.equal(binaryOverallRiskSampleSize(0.174, 0.05), 221);
});

test('continuous Riley criteria reproduce the published shrinkage example', () => {
    assert.equal(continuousShrinkageSampleSize(25, 0.2, 0.9), 918);
});

test('continuous multivariable formula identifies the minimum valid collinearity', () => {
    approximatelyEqual(minimumValidCollinearity(1, 0.8), 0);
    approximatelyEqual(minimumValidCollinearity(20, 0.25), 0.25 / 19);
    approximatelyEqual(minimumValidCollinearity(20, 0.8), 11.8 / 19);
});

test('continuous multivariable R-squared is uncapped and rejects impossible inputs', () => {
    approximatelyEqual(multivariateRSquared(20, 0.25, 0.05), 1.25 / 1.95);
    approximatelyEqual(multivariateRSquared(20, 0.8, 11.8 / 19), 1);
    assert.ok(Number.isNaN(multivariateRSquared(20, 0.8, 0.4)));
});

test('standard population Brier score includes irreducible outcome variation', () => {
    const metrics = calculatePopulationCalibrationMetrics([
        { predicted: 0.2, observed: 0.2, weight: 1 },
        { predicted: 0.8, observed: 0.8, weight: 1 }
    ]);

    approximatelyEqual(metrics.brierScore, 0.16);
    approximatelyEqual(metrics.ici, 0);
    approximatelyEqual(metrics.calibrationIntercept, 0);
    approximatelyEqual(metrics.calibrationSlope, 1);
});

test('population logistic recalibration recovers known intercept and slope', () => {
    const probabilities = [0.1, 0.3, 0.7, 0.9];
    const expectedIntercept = -0.5;
    const expectedSlope = 0.8;
    const points = probabilities.map((predicted) => {
        const linearPredictor = Math.log(predicted / (1 - predicted));
        const observed =
            1 / (1 + Math.exp(-(expectedIntercept + expectedSlope * linearPredictor)));
        return { predicted, observed, weight: 1 };
    });

    const metrics = calculatePopulationCalibrationMetrics(points);
    approximatelyEqual(metrics.calibrationIntercept, expectedIntercept);
    approximatelyEqual(metrics.calibrationSlope, expectedSlope);
});

test('recalibration remains stable when predicted risks have little spread', () => {
    const expectedIntercept = logit(0.5) - logit(0.1);
    const points = Array.from({ length: 101 }, (_, index) => {
        const predicted = 0.1 + (0.01 * (index - 50)) / 100;
        const observed = logistic(
            expectedIntercept + logit(predicted)
        );
        return { predicted, observed, weight: 1 };
    });

    const metrics = calculatePopulationCalibrationMetrics(points);
    approximatelyEqual(
        metrics.calibrationIntercept,
        expectedIntercept,
        1e-9
    );
    approximatelyEqual(metrics.calibrationSlope, 1, 1e-9);
});

test('unequal-variance recalibration matches an independent logistic fit', () => {
    const testParameters = {
        group0: { mean: 0, stdDev: 1 / Math.sqrt(0.9) },
        group1: { mean: 2, stdDev: 1 / Math.sqrt(0.2) },
        baseRate: 0.4
    };
    const deploymentParameters = {
        group0: { mean: 0, stdDev: 1 / Math.sqrt(0.2) },
        group1: { mean: 2.5, stdDev: 1 / Math.sqrt(0.9) },
        baseRate: 0.4
    };
    const points = normalCalibrationPoints(
        testParameters,
        deploymentParameters
    );
    const metrics = calculatePopulationCalibrationMetrics(points);

    // Golden values independently obtained using R's quasibinomial glm.
    approximatelyEqual(metrics.calibrationIntercept, -0.6872500, 1e-6);
    approximatelyEqual(metrics.calibrationSlope, 0.2945739, 1e-6);
});

test('ICI combines equal-risk branches before taking absolute error', () => {
    const testParameters = {
        group0: { mean: 0, stdDev: 1 / Math.sqrt(0.9) },
        group1: { mean: 2, stdDev: 1 / Math.sqrt(0.2) },
        baseRate: 0.4
    };
    const deploymentParameters = {
        group0: { mean: 0, stdDev: 1 / Math.sqrt(0.2) },
        group1: { mean: 2.5, stdDev: 1 / Math.sqrt(0.9) },
        baseRate: 0.4
    };

    // Golden value from independent branch-aware numerical quadrature.
    approximatelyEqual(
        calculateNormalModelIci(
            testParameters,
            deploymentParameters
        ),
        0.1647758617214,
        1e-10
    );
});

test('ICI is zero for an identical unequal-variance population', () => {
    const parameters = {
        group0: { mean: 0, stdDev: 1 / Math.sqrt(0.9) },
        group1: { mean: 2.5, stdDev: 1 / Math.sqrt(0.2) },
        baseRate: 0.4
    };

    approximatelyEqual(
        calculateNormalModelIci(parameters, parameters),
        0,
        1e-12
    );
});

test('ICI handles a constant predicted risk as one risk stratum', () => {
    const testParameters = {
        group0: { mean: 0, stdDev: 1 },
        group1: { mean: 0, stdDev: 1 },
        baseRate: 0.4
    };
    const deploymentParameters = {
        group0: { mean: 0, stdDev: 1 },
        group1: { mean: 2, stdDev: 1 },
        baseRate: 0.7
    };

    approximatelyEqual(
        calculateNormalModelIci(
            testParameters,
            deploymentParameters
        ),
        0.3,
        1e-12
    );
});

test('maximum Cox-Snell R-squared depends on prevalence', () => {
    approximatelyEqual(maximumCoxSnellR2(0.5), 0.75);

    const prevalence = 0.3;
    const expected =
        1 -
        Math.exp(
            2 *
                (prevalence * Math.log(prevalence) +
                    (1 - prevalence) * Math.log(1 - prevalence))
        );
    approximatelyEqual(maximumCoxSnellR2(prevalence), expected);
});

test('Cox-Snell slider stops at the largest valid step for the base rate', () => {
    const limit = selectableCoxSnellR2Limit(0.3, 0.9);

    approximatelyEqual(limit.selectableMaximum, 0.7);
    approximatelyEqual(limit.theoreticalMaximum, 0.7052797283, 1e-10);
    assert.equal(limit.limitingConstraint, 'base-rate');
});

test('Cox-Snell slider remains strictly below the shrinkage factor', () => {
    const limit = selectableCoxSnellR2Limit(0.5, 0.7);

    approximatelyEqual(limit.selectableMaximum, 0.69);
    assert.equal(limit.limitingConstraint, 'shrinkage');
});

test('Cox-Snell validation rejects impossible and undefined inputs', () => {
    const aboveMaximum = validateCoxSnellInputs(0.8, 0.9, 0.5);
    assert.equal(aboveMaximum.valid, false);
    assert.match(aboveMaximum.errors.join(' '), /cannot exceed 0\.750/);

    const aboveShrinkage = validateCoxSnellInputs(0.6, 0.5, 0.5);
    assert.equal(aboveShrinkage.valid, false);
    assert.match(aboveShrinkage.errors.join(' '), /smaller than shrinkage factor/);

    assert.equal(validateCoxSnellInputs(0.2, 0.9, 0.3).valid, true);
});
