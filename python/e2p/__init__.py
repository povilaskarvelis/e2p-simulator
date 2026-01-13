"""
e2p - Effect-to-Prediction Library

Estimates real-world predictive utility from empirical data distributions.
Computes effect sizes, discrimination metrics, and threshold-dependent 
classification metrics with bootstrap confidence intervals.

Classes:
    E2PBinary: Two pre-defined groups (cases/controls)
    E2PContinuous: Continuous X and Y, with Y dichotomized by base_rate

Functions:
    e2p_binary: Convenience function for binary analysis
    e2p_continuous: Convenience function for continuous analysis
"""

from .core import MetricWithCI, BinaryResults
from .binary import E2PBinary, e2p_binary, e2p_binary_deattenuated
from .continuous import E2PContinuous, e2p_continuous, e2p_continuous_deattenuated
from .plotting import plot_binary_deattenuated, plot_continuous_deattenuated

__all__ = [
    'MetricWithCI',
    'BinaryResults', 
    'E2PBinary',
    'e2p_binary',
    'e2p_binary_deattenuated',
    'E2PContinuous',
    'e2p_continuous',
    'e2p_continuous_deattenuated',
    'plot_binary_deattenuated',
    'plot_continuous_deattenuated',
]

__version__ = '0.1.0'
