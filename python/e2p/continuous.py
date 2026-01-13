"""
E2PContinuous class for continuous outcome analysis.
"""

import numpy as np
from typing import Tuple, Optional
import matplotlib.pyplot as plt

from .core import BinaryResults
from .binary import E2PBinary
from .utils import transform_for_target_reliability
from .plotting import plot_continuous


class E2PContinuous:
    """
    E2P Continuous Outcome Metrics Calculator.
    
    Takes continuous predictor (X) and outcome (Y) data, dichotomizes the 
    outcome using the base rate, then computes all classification metrics.
    
    Parameters
    ----------
    X : array-like
        Continuous predictor values.
    Y : array-like
        Continuous outcome values.
    base_rate : float
        Proportion of cases (top base_rate of Y are classified as positive).
    threshold_prob : float
        Threshold probability (p_t) for computing threshold-dependent metrics.
    n_bootstrap : int, optional
        Number of bootstrap iterations for CI computation. Default: 1000.
    ci_level : float, optional
        Confidence interval level. Default: 0.95.
    random_state : int, optional
        Random seed for reproducibility.
    
    Example
    -------
    >>> import numpy as np
    >>> X = np.random.normal(0, 1, 500)
    >>> Y = 0.5 * X + np.random.normal(0, 1, 500)
    >>> e2p = E2PContinuous(X, Y, base_rate=0.10, threshold_prob=0.20)
    >>> results = e2p.compute()
    """
    
    def __init__(
        self,
        X: np.ndarray,
        Y: np.ndarray,
        base_rate: float,
        threshold_prob: float,
        n_bootstrap: int = 1000,
        ci_level: float = 0.95,
        random_state: Optional[int] = None
    ):
        self.X = np.asarray(X, dtype=float)
        self.Y = np.asarray(Y, dtype=float)
        self.base_rate = base_rate
        self.threshold_prob = threshold_prob
        self.n_bootstrap = n_bootstrap
        self.ci_level = ci_level
        self.random_state = random_state
        
        # Validation
        if len(self.X) != len(self.Y):
            raise ValueError("X and Y must have the same length")
        if len(self.X) == 0:
            raise ValueError("X and Y must have at least one observation")
        if not 0 < base_rate < 1:
            raise ValueError("base_rate must be between 0 and 1 (exclusive)")
        if not 0 < threshold_prob < 1:
            raise ValueError("threshold_prob must be between 0 and 1 (exclusive)")
        
        # Dichotomize Y based on base_rate
        # Top base_rate proportion of Y are "cases" (group2)
        self.y_threshold = np.percentile(self.Y, 100 * (1 - base_rate))
        self.is_case = self.Y >= self.y_threshold
        
        # Split X into two groups based on dichotomized Y
        self.group1 = self.X[~self.is_case]  # controls (lower Y)
        self.group2 = self.X[self.is_case]   # cases (higher Y)
        
        if len(self.group1) == 0 or len(self.group2) == 0:
            raise ValueError("Dichotomization resulted in empty group(s)")
        
        if random_state is not None:
            np.random.seed(random_state)
    
    def compute(self) -> BinaryResults:
        """
        Compute all metrics with bootstrap confidence intervals.
        
        Returns
        -------
        BinaryResults
            Dataclass containing all metrics with CIs.
        """
        calculator = E2PBinary(
            group1=self.group1,
            group2=self.group2,
            base_rate=self.base_rate,
            threshold_prob=self.threshold_prob,
            n_bootstrap=self.n_bootstrap,
            ci_level=self.ci_level,
            random_state=self.random_state
        )
        return calculator.compute()
    
    def compute_at_threshold(self, threshold_prob: float) -> dict:
        """
        Compute threshold-dependent metrics at a different threshold probability.
        """
        calculator = E2PBinary(
            group1=self.group1,
            group2=self.group2,
            base_rate=self.base_rate,
            threshold_prob=threshold_prob,
            n_bootstrap=0,
            ci_level=self.ci_level,
            random_state=self.random_state
        )
        return calculator.compute_at_threshold(threshold_prob)

    def compute_at_reliability(
        self,
        r_x_current: float,
        r_x_target: float = 1.0,
        *,
        r_y_current: Optional[float] = None,
        r_y_target: Optional[float] = None,
        center: str = "mean",
    ) -> BinaryResults:
        """
        Compute all metrics after deterministic reliability transformation.

        Notes
        -----
        - The case/control split is kept fixed (the original `is_case` mask).
        - X is always transformed. Y is optionally transformed for completeness,
          but does not currently change metrics because the split is fixed.
        """
        X_tgt = transform_for_target_reliability(self.X, r_x_current, r_x_target, center=center)

        # Optional Y transform (does not affect split in this scope)
        if (r_y_current is None) ^ (r_y_target is None):
            raise ValueError("Provide both r_y_current and r_y_target, or neither")
        if r_y_current is not None and r_y_target is not None:
            _ = transform_for_target_reliability(self.Y, r_y_current, r_y_target, center=center)

        group1_tgt = X_tgt[~self.is_case]
        group2_tgt = X_tgt[self.is_case]

        calculator = E2PBinary(
            group1=group1_tgt,
            group2=group2_tgt,
            base_rate=self.base_rate,
            threshold_prob=self.threshold_prob,
            n_bootstrap=self.n_bootstrap,
            ci_level=self.ci_level,
            random_state=self.random_state,
        )
        return calculator.compute()
    
    def plot(self, results: BinaryResults = None,
             figsize: Tuple[float, float] = (10, 8),
             x_label: str = "Predictor (X)",
             y_label: str = "Outcome (Y)") -> plt.Figure:
        """
        Plot scatterplot of X vs Y with threshold lines and metrics.
        """
        return plot_continuous(
            self.X, self.Y,
            self.base_rate, self.threshold_prob,
            self.y_threshold, self.is_case,
            self.group1, self.group2,
            results=results,
            figsize=figsize,
            x_label=x_label,
            y_label=y_label
        )

    def plot_deattenuated(
        self,
        *,
        r_x_current: float,
        r_x_target: float = 1.0,
        r_y_current: Optional[float] = None,
        r_y_target: Optional[float] = None,
        center: str = "mean",
        figsize: Tuple[float, float] = (16, 9),
        x_label: str = "Predictor (X)",
        y_label: str = "Outcome (Y)",
    ) -> plt.Figure:
        """
        Plot the standard continuous panels after applying reliability transformation.

        Keeps the original case/control split fixed (based on observed Y).
        Returns a fresh matplotlib Figure (a separate window when shown).
        """
        X_tgt = transform_for_target_reliability(self.X, r_x_current, r_x_target, center=center)

        if (r_y_current is None) ^ (r_y_target is None):
            raise ValueError("Provide both r_y_current and r_y_target, or neither")
        Y_tgt = (
            transform_for_target_reliability(self.Y, r_y_current, r_y_target, center=center)
            if (r_y_current is not None and r_y_target is not None)
            else self.Y
        )

        group1_tgt = X_tgt[~self.is_case]
        group2_tgt = X_tgt[self.is_case]

        results = E2PBinary(
            group1=group1_tgt,
            group2=group2_tgt,
            base_rate=self.base_rate,
            threshold_prob=self.threshold_prob,
            n_bootstrap=self.n_bootstrap,
            ci_level=self.ci_level,
            random_state=self.random_state,
        ).compute()

        title_bits = [f"Deattenuated (X reliability: {r_x_current:.2f}→{r_x_target:.2f}"]
        if r_y_current is not None and r_y_target is not None:
            title_bits.append(f", Y reliability: {r_y_current:.2f}→{r_y_target:.2f}")
        title_bits.append("; fixed split)")
        title = "".join(title_bits)

        return plot_continuous(
            X_tgt,
            Y_tgt,
            self.base_rate,
            self.threshold_prob,
            self.y_threshold,
            self.is_case,
            group1_tgt,
            group2_tgt,
            results=results,
            figsize=figsize,
            x_label=x_label,
            y_label=y_label,
            figure_title_prefix=title,
        )


def e2p_continuous(X, Y, base_rate, threshold_prob=0.5,
                   n_bootstrap=1000, ci_level=0.95, random_state=None) -> BinaryResults:
    """
    Convenience function to compute E2P metrics from continuous data.
    
    Dichotomizes the outcome Y using base_rate, then computes all metrics.
    
    Parameters
    ----------
    X : array-like
        Continuous predictor values.
    Y : array-like
        Continuous outcome values.
    base_rate : float
        Proportion of cases (top base_rate of Y are classified as positive).
    threshold_prob : float, optional
        Threshold probability (p_t). Default: 0.5.
    n_bootstrap : int, optional
        Number of bootstrap iterations. Default: 1000.
    ci_level : float, optional
        Confidence interval level. Default: 0.95.
    random_state : int, optional
        Random seed for reproducibility.
    
    Returns
    -------
    BinaryResults
        All metrics with bootstrap CIs.
    """
    calculator = E2PContinuous(
        X=X,
        Y=Y,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        n_bootstrap=n_bootstrap,
        ci_level=ci_level,
        random_state=random_state
    )
    return calculator.compute()


def e2p_continuous_deattenuated(
    X,
    Y,
    base_rate,
    threshold_prob: float = 0.5,
    *,
    r_x_current: float,
    r_x_target: float = 1.0,
    r_y_current: Optional[float] = None,
    r_y_target: Optional[float] = None,
    n_bootstrap: int = 1000,
    ci_level: float = 0.95,
    random_state: Optional[int] = None,
    center: str = "mean",
) -> BinaryResults:
    """
    Convenience function: compute metrics after reliability transformation.

    Keeps the original case/control split fixed (based on observed Y).
    """
    calculator = E2PContinuous(
        X=X,
        Y=Y,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        n_bootstrap=n_bootstrap,
        ci_level=ci_level,
        random_state=random_state,
    )
    return calculator.compute_at_reliability(
        r_x_current=r_x_current,
        r_x_target=r_x_target,
        r_y_current=r_y_current,
        r_y_target=r_y_target,
        center=center,
    )
