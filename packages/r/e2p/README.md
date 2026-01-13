# e2p - Effect-to-Prediction

Estimate real-world predictive utility from empirical data distributions.

## Installation

```r
# From source (development)
devtools::install("packages/r/e2p")

# Or via remotes
remotes::install_github("pkarvelis/e2p", subdir = "packages/r/e2p")
```
## Quick Start

### Binary Analysis (Two Groups)

```r
library(e2p)

set.seed(42)
controls <- rnorm(200, mean = 0, sd = 1)
cases <- rnorm(100, mean = 1.5, sd = 1)

# Compute metrics with bootstrap CIs
results <- e2p_binary(
  group1 = controls,
  group2 = cases,
  base_rate = 0.10,
  threshold_prob = 0.20,
  n_bootstrap = 500,
  seed = 42
)

print(results)
```

### Continuous Analysis (Predictor → Outcome)

```r
library(e2p)

set.seed(42)
n <- 500
X <- rnorm(n, mean = 0, sd = 1)
Y <- 0.6 * X + rnorm(n, mean = 0, sd = 0.8)

# Dichotomizes Y by base_rate, then computes classification metrics
results <- e2p_continuous(
  X = X,
  Y = Y,
  base_rate = 0.10,
  threshold_prob = 0.20,
  n_bootstrap = 200,
  seed = 42
)

print(results)
```

## Features

- **Effect sizes**: Cohen's d, Cohen's U3, point-biserial r, eta-squared, odds ratio
- **Discrimination**: ROC-AUC, PR-AUC
- **Threshold-dependent metrics**: Sensitivity, Specificity, PPV, NPV, F1, MCC, likelihood ratios, Youden's J, kappa, and more
- **Decision curve analysis**: Net benefit, delta NB
- **Bootstrap confidence intervals** for all metrics
- **Reliability deattenuation**: Transform metrics to reflect improved measurement reliability
- **Plotting**: Base R visualization of distributions, ROC, PR, and DCA curves

## License

MIT License - see [LICENSE](LICENSE) for details.
