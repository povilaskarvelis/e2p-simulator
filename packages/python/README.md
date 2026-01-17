# e2p - Effect-to-Prediction

Estimate real-world predictive utility from effect sizes or empirical data.

**Two approaches:**
- **Parametric**: Compute metrics directly from effect sizes (Cohen's d, Pearson's r, ROC-AUC, odds ratio) assuming idealized normal distributions
- **Empirical**: Compute metrics from actual data with bootstrap confidence intervals

## Installation

```bash
# From GitHub
pip install git+https://github.com/pkarvelis/e2p.git#subdirectory=packages/python

# From source (development mode)
pip install -e packages/python/

# Or when published to PyPI
pip install e2p
```

## Quick Start

### Parametric Analysis (from effect sizes)

Use this when you have an effect size from the literature or a meta-analysis and want to estimate predictive metrics at different base rates.

```python
import e2p

# From Cohen's d
results = e2p.e2p_parametric_binary(
    cohens_d=0.8,
    base_rate=0.10,
    threshold_prob=0.5
)
print(f"ROC-AUC: {results.roc_auc:.3f}")
print(f"PR-AUC: {results.pr_auc:.3f}")
print(f"Sensitivity: {results.sensitivity:.3f}")
print(f"PPV: {results.ppv:.3f}")

# From ROC-AUC (convert to d first)
d = e2p.auc_to_d(0.75)
pr_auc = e2p.compute_pr_auc_parametric(d, base_rate=0.05)

# From odds ratio
d = e2p.odds_ratio_to_d(3.0)
results = e2p.e2p_parametric_binary(cohens_d=d, base_rate=0.1)
```

### Effect Size Conversions

Convert between different effect size metrics:

```python
import e2p

# Cohen's d to other metrics
d = 0.8
or_val = e2p.d_to_odds_ratio(d)      # → 4.27
u3 = e2p.d_to_cohens_u3(d)           # → 0.788
auc = e2p.compute_roc_auc_parametric(d)  # → 0.714

# Other metrics to Cohen's d
d = e2p.auc_to_d(0.75)               # AUC → d
d = e2p.odds_ratio_to_d(3.0)         # OR → d
d = e2p.log_odds_ratio_to_d(1.1)     # log(OR) → d
d = e2p.cohens_u3_to_d(0.8)          # U3 → d
d = e2p.r_to_d(0.4)                  # Pearson's r → d
```

### Reliability Attenuation

Account for imperfect measurement reliability:

```python
import e2p

# With ICC (measurement reliability) and kappa (diagnostic reliability)
results = e2p.e2p_parametric_binary(
    cohens_d=0.8,
    base_rate=0.10,
    icc1=0.7,   # Reliability of predictor in group 1
    icc2=0.7,   # Reliability of predictor in group 2
    kappa=0.85, # Diagnostic reliability
    view='observed'  # Show attenuated metrics
)
```

### Empirical Analysis (from data)

Use this when you have actual data and want bootstrap confidence intervals.

```python
import numpy as np
import e2p

# Binary: Two pre-defined groups
np.random.seed(42)
controls = np.random.normal(0, 1, 200)
cases = np.random.normal(1.5, 1, 100)

results = e2p.e2p_binary(
    group1=controls,
    group2=cases,
    base_rate=0.10,
    threshold_prob=0.20,
    n_bootstrap=500
)
print(results)

# Continuous: Predictor → Outcome
X = np.random.normal(0, 1, 500)
Y = 0.6 * X + np.random.normal(0, 0.8, 500)

results = e2p.e2p_continuous(
    X=X,
    Y=Y,
    base_rate=0.10,
    threshold_prob=0.20,
    n_bootstrap=200
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

### Both Approaches
- **Effect sizes**: Cohen's d, Cohen's U3, point-biserial r, eta-squared, odds ratio
- **Discrimination**: ROC-AUC, PR-AUC
- **Threshold-dependent metrics**: Sensitivity, Specificity, PPV, NPV, F1, MCC, likelihood ratios, Youden's J, kappa
- **Decision curve analysis**: Net benefit, delta NB

## License

MIT License - see [LICENSE](LICENSE) for details.
