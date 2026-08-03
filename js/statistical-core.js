(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.E2PStatCore = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const PROBABILITY_EPSILON = 1e-12;

    function clampProbability(value) {
        return Math.min(1 - PROBABILITY_EPSILON, Math.max(PROBABILITY_EPSILON, value));
    }

    function logistic(value) {
        if (value >= 0) {
            const expNegative = Math.exp(-value);
            return 1 / (1 + expNegative);
        }

        const expPositive = Math.exp(value);
        return expPositive / (1 + expPositive);
    }

    function logit(probability) {
        const bounded = clampProbability(probability);
        return Math.log(bounded / (1 - bounded));
    }

    function softplus(value) {
        if (value > 0) {
            return value + Math.log1p(Math.exp(-value));
        }
        return Math.log1p(Math.exp(value));
    }

    function normalDensity(value, mean, standardDeviation) {
        const z = (value - mean) / standardDeviation;
        return (
            Math.exp(-0.5 * z * z) /
            (standardDeviation * Math.sqrt(2 * Math.PI))
        );
    }

    function normalModelPosterior(value, parameters) {
        const likelihood0 =
            normalDensity(
                value,
                parameters.group0.mean,
                parameters.group0.stdDev
            ) *
            (1 - parameters.baseRate);
        const likelihood1 =
            normalDensity(
                value,
                parameters.group1.mean,
                parameters.group1.stdDev
            ) *
            parameters.baseRate;
        const denominator = likelihood0 + likelihood1;

        return denominator > 1e-300
            ? likelihood1 / denominator
            : parameters.baseRate;
    }

    function normalModelMarginalDensity(value, parameters) {
        return (
            normalDensity(
                value,
                parameters.group0.mean,
                parameters.group0.stdDev
            ) *
                (1 - parameters.baseRate) +
            normalDensity(
                value,
                parameters.group1.mean,
                parameters.group1.stdDev
            ) *
                parameters.baseRate
        );
    }

    function hasValidNormalModelParameters(parameters) {
        return !!(
            parameters &&
            parameters.group0 &&
            parameters.group1 &&
            Number.isFinite(parameters.group0.mean) &&
            Number.isFinite(parameters.group1.mean) &&
            Number.isFinite(parameters.group0.stdDev) &&
            Number.isFinite(parameters.group1.stdDev) &&
            parameters.group0.stdDev > 0 &&
            parameters.group1.stdDev > 0 &&
            Number.isFinite(parameters.baseRate) &&
            parameters.baseRate > 0 &&
            parameters.baseRate < 1
        );
    }

    /**
     * Population ICI for the two-normal model used by the calibration module.
     *
     * With unequal class variances, logit(predicted risk) is quadratic in x,
     * so two x values can have the same predicted risk. Their deployment risks
     * must be averaged first; only then is the absolute calibration error taken.
     */
    function calculateNormalModelIci(
        testParameters,
        deploymentParameters,
        integrationPoints = 5000
    ) {
        if (
            !hasValidNormalModelParameters(testParameters) ||
            !hasValidNormalModelParameters(deploymentParameters) ||
            !Number.isInteger(integrationPoints) ||
            integrationPoints < 100
        ) {
            return NaN;
        }

        const groups = [
            testParameters.group0,
            testParameters.group1,
            deploymentParameters.group0,
            deploymentParameters.group1
        ];
        const xMin = Math.min(
            ...groups.map((group) => group.mean - 8 * group.stdDev)
        );
        const xMax = Math.max(
            ...groups.map((group) => group.mean + 8 * group.stdDev)
        );

        const inverseVariance0 =
            1 /
            (testParameters.group0.stdDev *
                testParameters.group0.stdDev);
        const inverseVariance1 =
            1 /
            (testParameters.group1.stdDev *
                testParameters.group1.stdDev);
        const quadraticCoefficient =
            -0.5 * (inverseVariance1 - inverseVariance0);
        const linearCoefficient =
            testParameters.group1.mean * inverseVariance1 -
            testParameters.group0.mean * inverseVariance0;
        const constantCoefficient =
            logit(testParameters.baseRate) +
            Math.log(
                testParameters.group0.stdDev /
                    testParameters.group1.stdDev
            ) -
            0.5 *
                (testParameters.group1.mean *
                    testParameters.group1.mean *
                    inverseVariance1 -
                    testParameters.group0.mean *
                        testParameters.group0.mean *
                        inverseVariance0);

        let weightedError = 0;
        let totalWeight = 0;

        if (
            Math.abs(quadraticCoefficient) <= 1e-10 &&
            Math.abs(linearCoefficient) <= 1e-10
        ) {
            return Math.abs(
                logistic(constantCoefficient) -
                    deploymentParameters.baseRate
            );
        }

        const vertex =
            Math.abs(quadraticCoefficient) > 1e-10
                ? -linearCoefficient / (2 * quadraticCoefficient)
                : NaN;
        const scoreIsEffectivelyMonotonic =
            !Number.isFinite(vertex) || vertex <= xMin || vertex >= xMax;

        if (scoreIsEffectivelyMonotonic) {
            const dx = (xMax - xMin) / integrationPoints;

            for (let index = 0; index < integrationPoints; index++) {
                const x = xMin + (index + 0.5) * dx;
                const weight = normalModelMarginalDensity(
                    x,
                    deploymentParameters
                );
                const predicted = normalModelPosterior(x, testParameters);
                const observed = normalModelPosterior(
                    x,
                    deploymentParameters
                );

                totalWeight += weight;
                weightedError +=
                    weight * Math.abs(predicted - observed);
            }
        } else {
            const logOddsAtVertex =
                constantCoefficient -
                (linearCoefficient * linearCoefficient) /
                    (4 * quadraticCoefficient);
            const maximumDistance = Math.max(
                vertex - xMin,
                xMax - vertex
            );
            const dz = maximumDistance / integrationPoints;

            for (let index = 0; index < integrationPoints; index++) {
                const distance = (index + 0.5) * dz;
                const leftX = vertex - distance;
                const rightX = vertex + distance;
                const leftWeight = normalModelMarginalDensity(
                    leftX,
                    deploymentParameters
                );
                const rightWeight = normalModelMarginalDensity(
                    rightX,
                    deploymentParameters
                );
                const weight = leftWeight + rightWeight;

                if (!(weight > 0)) continue;

                // At equal distance from the quadratic vertex, |d logit(p)/dx|
                // is identical on both branches, so marginal-density weights
                // are the correct conditional branch weights.
                const observed =
                    (leftWeight *
                        normalModelPosterior(
                            leftX,
                            deploymentParameters
                        ) +
                        rightWeight *
                            normalModelPosterior(
                                rightX,
                                deploymentParameters
                            )) /
                    weight;
                const predicted = logistic(
                    logOddsAtVertex +
                        quadraticCoefficient * distance * distance
                );

                totalWeight += weight;
                weightedError +=
                    weight * Math.abs(predicted - observed);
            }
        }

        return totalWeight > 0 ? weightedError / totalWeight : NaN;
    }

    function outcomeReliabilityFactor(kappa) {
        const boundedKappa = Math.min(1, Math.max(0, kappa));
        return Math.sqrt(Math.sin((Math.PI / 2) * boundedKappa));
    }

    function continuousOptimismSampleSize(predictorParameters, rSquared, targetOptimism) {
        if (
            !Number.isFinite(predictorParameters) ||
            !Number.isFinite(rSquared) ||
            !Number.isFinite(targetOptimism) ||
            predictorParameters < 0 ||
            rSquared < 0 ||
            rSquared >= 1 ||
            targetOptimism <= 0
        ) {
            return NaN;
        }

        return 1 + (predictorParameters * (1 - rSquared)) / targetOptimism;
    }

    function minimumValidCollinearity(predictorCount, predictorCorrelation) {
        if (
            !Number.isFinite(predictorCount) ||
            predictorCount < 1 ||
            !Number.isFinite(predictorCorrelation) ||
            Math.abs(predictorCorrelation) > 1
        ) {
            return NaN;
        }

        if (predictorCount === 1) return 0;

        return Math.max(
            0,
            (predictorCount * predictorCorrelation * predictorCorrelation - 1) /
                (predictorCount - 1)
        );
    }

    function multivariateRSquared(
        predictorCount,
        predictorCorrelation,
        collinearity
    ) {
        const minimumCollinearity = minimumValidCollinearity(
            predictorCount,
            predictorCorrelation
        );

        if (
            !Number.isFinite(minimumCollinearity) ||
            !Number.isFinite(collinearity) ||
            collinearity < minimumCollinearity - 1e-12 ||
            collinearity > 1
        ) {
            return NaN;
        }

        return (
            predictorCount * predictorCorrelation * predictorCorrelation /
            (1 + (predictorCount - 1) * collinearity)
        );
    }

    function maximumCoxSnellR2(prevalence) {
        if (!Number.isFinite(prevalence) || prevalence <= 0 || prevalence >= 1) {
            return NaN;
        }

        const nullLogLikelihoodPerPerson =
            prevalence * Math.log(prevalence) +
            (1 - prevalence) * Math.log(1 - prevalence);

        return 1 - Math.exp(2 * nullLogLikelihoodPerPerson);
    }

    function selectableCoxSnellR2Limit(
        prevalence,
        shrinkage,
        step = 0.01,
        minimum = 0.01
    ) {
        const theoreticalMaximum = maximumCoxSnellR2(prevalence);

        if (
            !Number.isFinite(theoreticalMaximum) ||
            !Number.isFinite(shrinkage) ||
            shrinkage <= 0 ||
            shrinkage >= 1 ||
            !Number.isFinite(step) ||
            step <= 0 ||
            !Number.isFinite(minimum) ||
            minimum <= 0
        ) {
            return {
                selectableMaximum: NaN,
                theoreticalMaximum,
                limitingConstraint: null
            };
        }

        const limitingConstraint =
            theoreticalMaximum < shrinkage - 1e-12
                ? 'base-rate'
                : 'shrinkage';
        const rawLimit =
            limitingConstraint === 'base-rate'
                ? theoreticalMaximum
                : shrinkage - Number.EPSILON;
        let stepCount = Math.floor(
            (rawLimit - minimum) / step + 1e-10
        );
        let selectableMaximum = minimum + stepCount * step;

        if (
            limitingConstraint === 'shrinkage' &&
            selectableMaximum >= shrinkage - 1e-12
        ) {
            stepCount -= 1;
            selectableMaximum = minimum + stepCount * step;
        }

        if (stepCount < 0 || selectableMaximum < minimum) {
            selectableMaximum = NaN;
        } else {
            selectableMaximum = Number(selectableMaximum.toFixed(12));
        }

        return {
            selectableMaximum,
            theoreticalMaximum,
            limitingConstraint
        };
    }

    function validateCoxSnellInputs(rSquared, shrinkage, prevalence) {
        const maximum = maximumCoxSnellR2(prevalence);
        const errors = [];

        if (!Number.isFinite(rSquared) || rSquared <= 0) {
            errors.push('Anticipated Cox–Snell R² must be greater than 0.');
        }

        if (!Number.isFinite(shrinkage) || shrinkage <= 0 || shrinkage >= 1) {
            errors.push('Shrinkage factor S must be between 0 and 1.');
        }

        if (!Number.isFinite(maximum)) {
            errors.push('Base rate must be strictly between 0% and 100%.');
        } else if (Number.isFinite(rSquared) && rSquared > maximum + 1e-12) {
            errors.push(
                `At this base rate, Cox–Snell R² cannot exceed ${maximum.toFixed(3)}.`
            );
        }

        if (
            Number.isFinite(rSquared) &&
            Number.isFinite(shrinkage) &&
            rSquared >= shrinkage
        ) {
            errors.push('Cox–Snell R² must be smaller than shrinkage factor S.');
        }

        return {
            valid: errors.length === 0,
            errors,
            maximum
        };
    }

    function fitPopulationLogisticRecalibration(points) {
        const totalWeight = points.reduce(
            (sum, point) => sum + point.weight,
            0
        );
        if (!(totalWeight > 0)) {
            return { intercept: NaN, slope: NaN };
        }

        const data = points.map(({ predicted, observed, weight }) => ({
            predictor: logit(predicted),
            observed,
            weight: weight / totalWeight
        }));
        const predictorMean = data.reduce(
            (sum, point) =>
                sum + point.weight * point.predictor,
            0
        );
        const predictorVariance = data.reduce(
            (sum, point) =>
                sum +
                point.weight *
                    Math.pow(point.predictor - predictorMean, 2),
            0
        );
        const predictorScale = Math.sqrt(predictorVariance);

        if (
            !Number.isFinite(predictorScale) ||
            predictorScale < 1e-12
        ) {
            return { intercept: NaN, slope: NaN };
        }

        data.forEach((point) => {
            point.standardizedPredictor =
                (point.predictor - predictorMean) / predictorScale;
        });

        const observedMean = data.reduce(
            (sum, point) =>
                sum + point.weight * point.observed,
            0
        );
        let standardizedIntercept = logit(observedMean);
        let standardizedSlope = 0;

        function logLikelihood(intercept, slope) {
            return data.reduce((sum, point) => {
                const linearPredictor =
                    intercept +
                    slope * point.standardizedPredictor;
                return (
                    sum +
                    point.weight *
                        (point.observed * linearPredictor -
                            softplus(linearPredictor))
                );
            }, 0);
        }

        let currentLogLikelihood = logLikelihood(
            standardizedIntercept,
            standardizedSlope
        );
        let converged = false;

        for (let iteration = 0; iteration < 100; iteration++) {
            let gradientIntercept = 0;
            let gradientSlope = 0;
            let informationIntercept = 0;
            let informationCross = 0;
            let informationSlope = 0;

            data.forEach((point) => {
                const linearPredictor =
                    standardizedIntercept +
                    standardizedSlope *
                        point.standardizedPredictor;
                const recalibrated = logistic(linearPredictor);
                const variance = Math.max(
                    Number.EPSILON,
                    recalibrated * (1 - recalibrated)
                );
                const residual = point.observed - recalibrated;

                gradientIntercept += point.weight * residual;
                gradientSlope +=
                    point.weight *
                    residual *
                    point.standardizedPredictor;
                informationIntercept += point.weight * variance;
                informationCross +=
                    point.weight *
                    variance *
                    point.standardizedPredictor;
                informationSlope +=
                    point.weight *
                    variance *
                    point.standardizedPredictor *
                    point.standardizedPredictor;
            });

            const determinant =
                informationIntercept * informationSlope -
                informationCross * informationCross;

            if (!Number.isFinite(determinant) || determinant <= 1e-20) {
                break;
            }

            const interceptStep =
                (gradientIntercept * informationSlope -
                    gradientSlope * informationCross) /
                determinant;
            const slopeStep =
                (gradientSlope * informationIntercept -
                    gradientIntercept * informationCross) /
                determinant;

            if (
                !Number.isFinite(interceptStep) ||
                !Number.isFinite(slopeStep)
            ) {
                break;
            }

            let stepScale = 1;
            let accepted = false;
            let nextLogLikelihood = currentLogLikelihood;

            for (let attempt = 0; attempt < 30; attempt++) {
                nextLogLikelihood = logLikelihood(
                    standardizedIntercept +
                        stepScale * interceptStep,
                    standardizedSlope + stepScale * slopeStep
                );

                if (
                    Number.isFinite(nextLogLikelihood) &&
                    nextLogLikelihood >= currentLogLikelihood - 1e-14
                ) {
                    accepted = true;
                    break;
                }
                stepScale *= 0.5;
            }

            if (!accepted) break;

            standardizedIntercept += stepScale * interceptStep;
            standardizedSlope += stepScale * slopeStep;
            currentLogLikelihood = nextLogLikelihood;

            if (
                Math.max(
                    Math.abs(stepScale * interceptStep),
                    Math.abs(stepScale * slopeStep)
                ) < 1e-10
            ) {
                converged = true;
                break;
            }
        }

        if (!converged) {
            return { intercept: NaN, slope: NaN };
        }

        const slope = standardizedSlope / predictorScale;
        const intercept =
            standardizedIntercept - slope * predictorMean;

        return { intercept, slope };
    }

    function calculatePopulationCalibrationMetrics(points, options = {}) {
        const usablePoints = points.filter(
            ({ predicted, observed, weight }) =>
                Number.isFinite(predicted) &&
                Number.isFinite(observed) &&
                Number.isFinite(weight) &&
                predicted >= 0 &&
                predicted <= 1 &&
                observed >= 0 &&
                observed <= 1 &&
                weight > 0
        );

        const totalWeight = usablePoints.reduce((sum, point) => sum + point.weight, 0);
        if (!(totalWeight > 0)) {
            return {
                calibrationSlope: NaN,
                calibrationIntercept: NaN,
                brierScore: NaN,
                ici: NaN
            };
        }

        let brierSum = 0;

        usablePoints.forEach(({ predicted, observed, weight }) => {
            // E[(predicted - Y)^2 | X] for Bernoulli Y with P(Y=1|X)=observed.
            const conditionalBrier =
                observed * Math.pow(1 - predicted, 2) +
                (1 - observed) * Math.pow(predicted, 2);

            brierSum += weight * conditionalBrier;
        });

        const recalibration = fitPopulationLogisticRecalibration(usablePoints);
        const hasIntegratedCalibrationIndex =
            Object.prototype.hasOwnProperty.call(
                options,
                'integratedCalibrationIndex'
            );
        const integratedCalibrationIndex =
            hasIntegratedCalibrationIndex
                ? options.integratedCalibrationIndex
                : usablePoints.reduce(
                      (sum, point) =>
                          sum +
                          point.weight *
                              Math.abs(
                                  point.predicted - point.observed
                              ),
                      0
                  ) / totalWeight;

        return {
            calibrationSlope: recalibration.slope,
            calibrationIntercept: recalibration.intercept,
            brierScore: brierSum / totalWeight,
            ici: integratedCalibrationIndex
        };
    }

    return {
        calculateNormalModelIci,
        calculatePopulationCalibrationMetrics,
        continuousOptimismSampleSize,
        maximumCoxSnellR2,
        minimumValidCollinearity,
        multivariateRSquared,
        outcomeReliabilityFactor,
        selectableCoxSnellR2Limit,
        validateCoxSnellInputs
    };
});
