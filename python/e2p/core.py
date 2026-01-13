"""
Core data structures for e2p.
"""

import numpy as np
from dataclasses import dataclass
from typing import Tuple


@dataclass
class MetricWithCI:
    """A metric value with confidence interval."""
    estimate: float
    ci_lower: float
    ci_upper: float
    
    def __repr__(self):
        return f"{self.estimate:.4f} [{self.ci_lower:.4f}, {self.ci_upper:.4f}]"


@dataclass
class BinaryResults:
    """Results from E2PBinary.compute()"""
    # Effect sizes
    cohens_d: MetricWithCI
    cohens_u3: MetricWithCI
    r: MetricWithCI  # point-biserial correlation
    eta_squared: MetricWithCI
    odds_ratio: MetricWithCI
    log_odds_ratio: MetricWithCI
    
    # Discrimination
    roc_auc: MetricWithCI
    pr_auc: MetricWithCI
    
    # Threshold-dependent metrics
    threshold_value: float  # the measurement threshold corresponding to p_t
    sensitivity: MetricWithCI
    specificity: MetricWithCI
    ppv: MetricWithCI
    npv: MetricWithCI
    accuracy: MetricWithCI
    balanced_accuracy: MetricWithCI
    f1: MetricWithCI
    mcc: MetricWithCI
    lr_plus: MetricWithCI
    lr_minus: MetricWithCI
    dor: MetricWithCI
    youden_j: MetricWithCI
    g_mean: MetricWithCI
    kappa: MetricWithCI
    post_test_prob_plus: MetricWithCI
    post_test_prob_minus: MetricWithCI
    delta_nb: MetricWithCI
    
    # Curve data (for plotting)
    roc_curve: Tuple[np.ndarray, np.ndarray, np.ndarray]  # (fpr, tpr, thresholds)
    pr_curve: Tuple[np.ndarray, np.ndarray, np.ndarray]   # (precision, recall, thresholds)
    
    # Sample info
    n_group1: int
    n_group2: int
    base_rate: float
    threshold_prob: float
