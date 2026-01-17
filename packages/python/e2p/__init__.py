"""
e2p - Effect-to-Prediction Library

Estimates real-world predictive utility from empirical data distributions
or parametric effect sizes.

Computes effect sizes, discrimination metrics, and threshold-dependent 
classification metrics with bootstrap confidence intervals.

Classes:
    E2PBinary: Two pre-defined groups (cases/controls) - empirical data
    E2PContinuous: Continuous X and Y, with Y dichotomized by base_rate - empirical data
    ParametricResults: Results from parametric computation

Functions:
    e2p_binary: Convenience function for binary analysis (empirical)
    e2p_continuous: Convenience function for continuous analysis (empirical)
    e2p_parametric_binary: Compute metrics from Cohen's d (parametric)
    e2p_parametric_continuous: Compute metrics from Pearson's r (parametric)
"""

from .core import MetricWithCI, BinaryResults
from .binary import E2PBinary, e2p_binary, e2p_binary_deattenuated
from .continuous import E2PContinuous, e2p_continuous, e2p_continuous_deattenuated
from .plotting import plot_binary_deattenuated, plot_continuous_deattenuated
from .parametric import (
    ParametricResults,
    e2p_parametric_binary,
    e2p_parametric_continuous,
    compute_roc_auc_parametric,
    compute_pr_auc_parametric,
    find_optimal_threshold,
    attenuate_d,
    compute_sigma_from_icc,
    # d -> other effect sizes
    d_to_odds_ratio,
    d_to_log_odds_ratio,
    d_to_point_biserial_r,
    d_to_cohens_u3,
    # other effect sizes -> d
    r_to_d,
    auc_to_d,
    odds_ratio_to_d,
    log_odds_ratio_to_d,
    cohens_u3_to_d,
)

__all__ = [
    # Core
    'MetricWithCI',
    'BinaryResults', 
    # Empirical - Binary
    'E2PBinary',
    'e2p_binary',
    'e2p_binary_deattenuated',
    # Empirical - Continuous
    'E2PContinuous',
    'e2p_continuous',
    'e2p_continuous_deattenuated',
    # Plotting
    'plot_binary_deattenuated',
    'plot_continuous_deattenuated',
    # Parametric
    'ParametricResults',
    'e2p_parametric_binary',
    'e2p_parametric_continuous',
    'compute_roc_auc_parametric',
    'compute_pr_auc_parametric',
    'find_optimal_threshold',
    'attenuate_d',
    'compute_sigma_from_icc',
    # d -> other effect sizes
    'd_to_odds_ratio',
    'd_to_log_odds_ratio',
    'd_to_point_biserial_r',
    'd_to_cohens_u3',
    # other effect sizes -> d
    'r_to_d',
    'auc_to_d',
    'odds_ratio_to_d',
    'log_odds_ratio_to_d',
    'cohens_u3_to_d',
]

__version__ = '0.1.0'
