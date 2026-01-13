# e2p - Effect-to-Prediction

Estimate real-world predictive utility from empirical data distributions.

## Installation

```bash
# From source (development mode)
pip install -e packages/python/

# Or when published to PyPI
pip install e2p
```

## Quick Start

### Binary Analysis (Two Groups)

```python
import numpy as np
from e2p import e2p_binary

# Generate example data
np.random.seed(42)
controls = np.random.normal(0, 1, 200)
cases = np.random.normal(1.5, 1, 100)

# Compute metrics with bootstrap CIs
results = e2p_binary(
    group1=controls,
    group2=cases,
    base_rate=0.10,        # Real-world prevalence
    threshold_prob=0.20,   # Decision threshold probability
    n_bootstrap=500
)

print(results)
```

### Continuous Analysis (Predictor → Outcome)

```python
import numpy as np
from e2p import e2p_continuous

# Generate correlated X, Y
np.random.seed(42)
n = 500
X = np.random.normal(0, 1, n)
Y = 0.6 * X + np.random.normal(0, 0.8, n)

# Dichotomizes Y by base_rate, then computes classification metrics
results = e2p_continuous(
    X=X,
    Y=Y,
    base_rate=0.10,
    threshold_prob=0.20,
    n_bootstrap=200
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

## License

MIT License - see [LICENSE](LICENSE) for details.
