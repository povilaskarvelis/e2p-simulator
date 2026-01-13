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
from .binary import E2PBinary, e2p_binary
from .continuous import E2PContinuous, e2p_continuous

__all__ = [
    'MetricWithCI',
    'BinaryResults', 
    'E2PBinary',
    'e2p_binary',
    'E2PContinuous',
    'e2p_continuous',
]

__version__ = '0.1.0'
