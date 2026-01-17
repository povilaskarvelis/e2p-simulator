# e2p - Effect-to-Prediction

Estimate real-world predictive utility from effect sizes or empirical data.

**Two approaches:**
- **Parametric**: Compute metrics directly from effect sizes (Cohen's d, Pearson's r, ROC-AUC, odds ratio) assuming idealized normal distributions
- **Empirical**: Compute metrics from actual data with bootstrap confidence intervals

## Installation

```r
# From GitHub
remotes::install_github("pkarvelis/e2p", subdir = "packages/r/e2p")

# From source (development)
devtools::install("packages/r/e2p")
```

## Quick Start

### Parametric Analysis (from effect sizes)
  
Use this when you have an effect size from the literature or a meta-analysis and want to estimate predictive metrics at different base rates.

```r
# Source the package (or library(e2p) if installed)
source("R/utils.R")
source("R/parametric.R")

# From Cohen's d
results <- e2p_parametric_binary(
  cohens_d = 0.8,
  base_rate = 0.10,
  threshold_prob = 0.5
)
cat(sprintf("ROC-AUC: %.3f\n", results$roc_auc))
cat(sprintf("PR-AUC: %.3f\n", results$pr_auc))
cat(sprintf("Sensitivity: %.3f\n", results$sensitivity))
cat(sprintf("PPV: %.3f\n", results$ppv))

# From ROC-AUC (convert to d first)
d <- auc_to_d(0.75)
pr_auc <- compute_pr_auc_parametric(d, base_rate = 0.05)

# From odds ratio
d <- odds_ratio_to_d(3.0)
results <- e2p_parametric_binary(cohens_d = d, base_rate = 0.1)
```

### Effect Size Conversions

Convert between different effect size metrics:

```r
# Cohen's d to other metrics
d <- 0.8
or_val <- d_to_odds_ratio(d)              # → 4.27
u3 <- d_to_cohens_u3(d)                   # → 0.788
auc <- compute_roc_auc_parametric(d)      # → 0.714

# Other metrics to Cohen's d
d <- auc_to_d(0.75)               # AUC → d
d <- odds_ratio_to_d(3.0)         # OR → d
d <- log_odds_ratio_to_d(1.1)     # log(OR) → d
d <- cohens_u3_to_d(0.8)          # U3 → d
d <- r_to_d(0.4)                  # Pearson's r → d
```

### Reliability Attenuation

Account for imperfect measurement reliability:

```r
# With ICC (measurement reliability) and kappa (diagnostic reliability)
results <- e2p_parametric_binary(
  cohens_d = 0.8,
  base_rate = 0.10,
  icc1 = 0.7,    # Reliability of predictor in group 1
  icc2 = 0.7,    # Reliability of predictor in group 2
  kappa = 0.85,  # Diagnostic reliability
  view = "observed"  # Show attenuated metrics
)
```

### Empirical Analysis (from data)

Use this when you have actual data and want bootstrap confidence intervals.

```r
library(e2p)

# Binary: Two pre-defined groups
set.seed(42)
controls <- rnorm(200, mean = 0, sd = 1)
cases <- rnorm(100, mean = 1.5, sd = 1)

results <- e2p_binary(
  group1 = controls,
  group2 = cases,
  base_rate = 0.10,
  threshold_prob = 0.20,
  n_bootstrap = 500,
  seed = 42
)
print(results)

# Continuous: Predictor → Outcome
set.seed(42)
n <- 500
X <- rnorm(n, mean = 0, sd = 1)
Y <- 0.6 * X + rnorm(n, mean = 0, sd = 0.8)

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

### Parametric Analysis
- **Effect size conversions**: Cohen's d ↔ OR, log(OR), U3, point-biserial r, ROC-AUC
- **Discrimination metrics**: ROC-AUC, PR-AUC from effect sizes
- **Threshold optimization**: Find optimal thresholds (Youden's J, F1)
- **Reliability modeling**: ICC and kappa attenuation
- **Fast computation**: No simulation needed

### Empirical Analysis
- **Bootstrap confidence intervals** for all metrics
- **Reliability deattenuation**: Project metrics to improved reliability
- **Plotting**: Base R visualization of distributions, ROC, PR, and DCA curves

### Both Approaches
- **Effect sizes**: Cohen's d, Cohen's U3, point-biserial r, eta-squared, odds ratio
- **Discrimination**: ROC-AUC, PR-AUC
- **Threshold-dependent metrics**: Sensitivity, Specificity, PPV, NPV, F1, MCC, likelihood ratios, Youden's J, kappa
- **Decision curve analysis**: Net benefit, delta NB

## License

MIT License - see [LICENSE](LICENSE) for details.
