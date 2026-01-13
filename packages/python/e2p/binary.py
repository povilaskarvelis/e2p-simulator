"""
E2PBinary class for binary outcome analysis.
"""

import numpy as np
from typing import Tuple, Optional
import matplotlib.pyplot as plt

from .core import MetricWithCI, BinaryResults
from .utils import (
    compute_cohens_d, compute_point_biserial_r, compute_eta_squared,
    compute_odds_ratio, compute_cohens_u3, compute_roc_auc, compute_pr_auc,
    compute_roc_curve, compute_pr_curve, convert_pt_to_threshold,
    compute_threshold_metrics, transform_for_target_reliability,
    transform_groups_for_target_kappa
)
from .plotting import plot_binary


class E2PBinary:
    """
    E2P Binary Outcome Metrics Calculator.
    
    Computes effect sizes and discriminative metrics directly from two group
    distributions.
    
    Parameters
    ----------
    group1 : array-like
        Measurements from Group 1 (controls/negatives).
    group2 : array-like
        Measurements from Group 2 (cases/positives).
    base_rate : float
        Real-world prevalence of Group 2 (between 0 and 1).
    threshold_prob : float
        Threshold probability (p_t) for computing threshold-dependent metrics.
    n_bootstrap : int, optional
        Number of bootstrap iterations for CI computation. Default: 1000.
    ci_level : float, optional
        Confidence interval level. Default: 0.95.
    random_state : int, optional
        Random seed for reproducibility.
    """
    
    def __init__(
        self,
        group1: np.ndarray,
        group2: np.ndarray,
        base_rate: float,
        threshold_prob: float,
        n_bootstrap: int = 1000,
        ci_level: float = 0.95,
        random_state: Optional[int] = None
    ):
        self.group1 = np.asarray(group1, dtype=float)
        self.group2 = np.asarray(group2, dtype=float)
        self.base_rate = base_rate
        self.threshold_prob = threshold_prob
        self.n_bootstrap = n_bootstrap
        self.ci_level = ci_level
        self.random_state = random_state
        
        # Validation
        if len(self.group1) == 0 or len(self.group2) == 0:
            raise ValueError("Both groups must have at least one observation")
        if not 0 < base_rate < 1:
            raise ValueError("base_rate must be between 0 and 1 (exclusive)")
        if not 0 < threshold_prob < 1:
            raise ValueError("threshold_prob must be between 0 and 1 (exclusive)")
        if not 0 < ci_level < 1:
            raise ValueError("ci_level must be between 0 and 1 (exclusive)")
        
        self.n1 = len(self.group1)
        self.n2 = len(self.group2)
        
        if random_state is not None:
            np.random.seed(random_state)
    
    def _compute_all_metrics(self, g1: np.ndarray, g2: np.ndarray,
                             base_rate: float, pt: float) -> dict:
        """Compute all metrics for given data."""
        cohens_d = compute_cohens_d(g1, g2)
        r = compute_point_biserial_r(g1, g2)
        eta_squared = compute_eta_squared(g1, g2)
        odds_ratio, log_or = compute_odds_ratio(g1, g2)
        cohens_u3 = compute_cohens_u3(g1, g2)
        
        roc_auc = compute_roc_auc(g1, g2)
        pr_auc = compute_pr_auc(g1, g2, base_rate)
        
        threshold = convert_pt_to_threshold(g1, g2, base_rate, pt)
        threshold_metrics = compute_threshold_metrics(g1, g2, threshold, base_rate, pt)
        
        return {
            'cohens_d': cohens_d,
            'r': r,
            'eta_squared': eta_squared,
            'odds_ratio': odds_ratio,
            'log_odds_ratio': log_or,
            'cohens_u3': cohens_u3,
            'roc_auc': roc_auc,
            'pr_auc': pr_auc,
            'threshold_value': threshold,
            **threshold_metrics
        }
    
    def compute(self) -> BinaryResults:
        """
        Compute all metrics with bootstrap confidence intervals.
        
        Returns
        -------
        BinaryResults
            Dataclass containing all metrics with CIs.
        """
        point_estimates = self._compute_all_metrics(
            self.group1, self.group2, self.base_rate, self.threshold_prob
        )
        
        bootstrap_results = {key: [] for key in point_estimates.keys()}
        
        for _ in range(self.n_bootstrap):
            g1_boot = np.random.choice(self.group1, size=self.n1, replace=True)
            g2_boot = np.random.choice(self.group2, size=self.n2, replace=True)
            
            try:
                boot_metrics = self._compute_all_metrics(
                    g1_boot, g2_boot, self.base_rate, self.threshold_prob
                )
                for key, value in boot_metrics.items():
                    bootstrap_results[key].append(value)
            except Exception:
                continue
        
        alpha = 1 - self.ci_level
        ci_lower_pct = alpha / 2 * 100
        ci_upper_pct = (1 - alpha / 2) * 100
        
        def make_metric_with_ci(key: str) -> MetricWithCI:
            estimate = point_estimates[key]
            boot_values = np.array(bootstrap_results[key])
            boot_values = boot_values[np.isfinite(boot_values)]
            
            if len(boot_values) > 0:
                ci_lower = np.percentile(boot_values, ci_lower_pct)
                ci_upper = np.percentile(boot_values, ci_upper_pct)
            else:
                ci_lower = ci_upper = estimate
            
            return MetricWithCI(estimate, ci_lower, ci_upper)
        
        roc_curve = compute_roc_curve(self.group1, self.group2)
        pr_curve = compute_pr_curve(self.group1, self.group2, self.base_rate)
        
        return BinaryResults(
            cohens_d=make_metric_with_ci('cohens_d'),
            cohens_u3=make_metric_with_ci('cohens_u3'),
            r=make_metric_with_ci('r'),
            eta_squared=make_metric_with_ci('eta_squared'),
            odds_ratio=make_metric_with_ci('odds_ratio'),
            log_odds_ratio=make_metric_with_ci('log_odds_ratio'),
            roc_auc=make_metric_with_ci('roc_auc'),
            pr_auc=make_metric_with_ci('pr_auc'),
            threshold_value=point_estimates['threshold_value'],
            sensitivity=make_metric_with_ci('sensitivity'),
            specificity=make_metric_with_ci('specificity'),
            ppv=make_metric_with_ci('ppv'),
            npv=make_metric_with_ci('npv'),
            accuracy=make_metric_with_ci('accuracy'),
            balanced_accuracy=make_metric_with_ci('balanced_accuracy'),
            f1=make_metric_with_ci('f1'),
            mcc=make_metric_with_ci('mcc'),
            lr_plus=make_metric_with_ci('lr_plus'),
            lr_minus=make_metric_with_ci('lr_minus'),
            dor=make_metric_with_ci('dor'),
            youden_j=make_metric_with_ci('youden_j'),
            g_mean=make_metric_with_ci('g_mean'),
            kappa=make_metric_with_ci('kappa'),
            post_test_prob_plus=make_metric_with_ci('post_test_prob_plus'),
            post_test_prob_minus=make_metric_with_ci('post_test_prob_minus'),
            delta_nb=make_metric_with_ci('delta_nb'),
            roc_curve=roc_curve,
            pr_curve=pr_curve,
            n_group1=self.n1,
            n_group2=self.n2,
            base_rate=self.base_rate,
            threshold_prob=self.threshold_prob
        )
    
    def compute_at_threshold(self, threshold_prob: float) -> dict:
        """
        Compute threshold-dependent metrics at a different threshold probability.
        """
        threshold = convert_pt_to_threshold(
            self.group1, self.group2, self.base_rate, threshold_prob
        )
        return compute_threshold_metrics(
            self.group1, self.group2, threshold, self.base_rate, threshold_prob
        )
    
    def plot(self, results: BinaryResults = None, 
             figsize: Tuple[float, float] = (10, 6),
             group1_label: str = "Group 1 (Controls)",
             group2_label: str = "Group 2 (Cases)") -> plt.Figure:
        """
        Plot histograms of the two groups with threshold line and metrics.
        """
        return plot_binary(
            self.group1, self.group2, 
            self.base_rate, self.threshold_prob,
            results=results,
            figsize=figsize,
            group1_label=group1_label,
            group2_label=group2_label
        )

    def plot_deattenuated(
        self,
        *,
        r_current: float,
        r_target: float = 1.0,
        kappa_current: Optional[float] = None,
        kappa_target: float = 1.0,
        per_group: bool = False,
        r1_current: Optional[float] = None,
        r2_current: Optional[float] = None,
        r1_target: Optional[float] = None,
        r2_target: Optional[float] = None,
        center: str = "mean",
        figsize: Tuple[float, float] = (16, 9),
        group1_label: str = "Group 1 (Controls)",
        group2_label: str = "Group 2 (Cases)",
    ) -> plt.Figure:
        """
        Plot the standard binary panels after applying reliability transformation.

        Returns a fresh matplotlib Figure (a separate window when shown).
        """
        if per_group:
            if None in (r1_current, r2_current, r1_target, r2_target):
                raise ValueError(
                    "When per_group=True, you must provide r1_current, r2_current, r1_target, r2_target"
                )
            g1_tgt = transform_for_target_reliability(self.group1, r1_current, r1_target, center=center)
            g2_tgt = transform_for_target_reliability(self.group2, r2_current, r2_target, center=center)
            icc_title = f"ICC g1 {r1_current:.2f}→{r1_target:.2f}, ICC g2 {r2_current:.2f}→{r2_target:.2f}"
        else:
            g1_tgt = transform_for_target_reliability(self.group1, r_current, r_target, center=center)
            g2_tgt = transform_for_target_reliability(self.group2, r_current, r_target, center=center)
            icc_title = f"ICC g1 {r_current:.2f}→{r_target:.2f}, ICC g2 {r_current:.2f}→{r_target:.2f}"

        title_parts = [f"Deattenuated ({icc_title}"]

        if kappa_current is not None:
            g1_tgt, g2_tgt = transform_groups_for_target_kappa(
                g1_tgt, g2_tgt, kappa_current=kappa_current, kappa_target=kappa_target
            )
            title_parts.append(f"; kappa {kappa_current:.2f}→{kappa_target:.2f}")

        title_parts.append(")")
        title = "".join(title_parts)

        results = E2PBinary(
            group1=g1_tgt,
            group2=g2_tgt,
            base_rate=self.base_rate,
            threshold_prob=self.threshold_prob,
            n_bootstrap=self.n_bootstrap,
            ci_level=self.ci_level,
            random_state=self.random_state,
        ).compute()

        return plot_binary(
            g1_tgt,
            g2_tgt,
            self.base_rate,
            self.threshold_prob,
            results=results,
            figsize=figsize,
            group1_label=group1_label,
            group2_label=group2_label,
            figure_title_prefix=title,
        )

    def compute_at_reliability(
        self,
        r_current: float,
        r_target: float = 1.0,
        *,
        kappa_current: Optional[float] = None,
        kappa_target: float = 1.0,
        per_group: bool = False,
        r1_current: Optional[float] = None,
        r2_current: Optional[float] = None,
        r1_target: Optional[float] = None,
        r2_target: Optional[float] = None,
        center: str = "mean",
    ) -> BinaryResults:
        """
        Compute all metrics after a deterministic reliability transformation.

        Parameters
        ----------
        r_current, r_target : float
            Current and target reliability (applied to both groups) when
            per_group=False.
        per_group : bool
            If True, transform each group with its own current/target reliability.
        r1_current, r2_current, r1_target, r2_target : float, optional
            Per-group reliabilities used when per_group=True.
        center : {"mean","median"}
            Centering used by the transformation.
        """
        if per_group:
            if None in (r1_current, r2_current, r1_target, r2_target):
                raise ValueError(
                    "When per_group=True, you must provide r1_current, r2_current, r1_target, r2_target"
                )
            g1_tgt = transform_for_target_reliability(self.group1, r1_current, r1_target, center=center)
            g2_tgt = transform_for_target_reliability(self.group2, r2_current, r2_target, center=center)
        else:
            g1_tgt = transform_for_target_reliability(self.group1, r_current, r_target, center=center)
            g2_tgt = transform_for_target_reliability(self.group2, r_current, r_target, center=center)

        if kappa_current is not None:
            g1_tgt, g2_tgt = transform_groups_for_target_kappa(
                g1_tgt, g2_tgt, kappa_current=kappa_current, kappa_target=kappa_target
            )

        calculator = E2PBinary(
            group1=g1_tgt,
            group2=g2_tgt,
            base_rate=self.base_rate,
            threshold_prob=self.threshold_prob,
            n_bootstrap=self.n_bootstrap,
            ci_level=self.ci_level,
            random_state=self.random_state,
        )
        return calculator.compute()


def e2p_binary(group1, group2, base_rate, threshold_prob=0.5, 
               n_bootstrap=1000, ci_level=0.95, random_state=None) -> BinaryResults:
    """
    Convenience function to compute E2P binary metrics.
    
    Parameters
    ----------
    group1 : array-like
        Measurements from Group 1 (controls/negatives).
    group2 : array-like
        Measurements from Group 2 (cases/positives).
    base_rate : float
        Real-world prevalence of Group 2 (between 0 and 1).
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
    calculator = E2PBinary(
        group1=group1,
        group2=group2,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        n_bootstrap=n_bootstrap,
        ci_level=ci_level,
        random_state=random_state
    )
    return calculator.compute()


def e2p_binary_deattenuated(
    group1,
    group2,
    base_rate,
    threshold_prob: float = 0.5,
    *,
    r_current: float,
    r_target: float = 1.0,
    kappa_current: Optional[float] = None,
    kappa_target: float = 1.0,
    n_bootstrap: int = 1000,
    ci_level: float = 0.95,
    random_state: Optional[int] = None,
    per_group: bool = False,
    r1_current: Optional[float] = None,
    r2_current: Optional[float] = None,
    r1_target: Optional[float] = None,
    r2_target: Optional[float] = None,
    center: str = "mean",
) -> BinaryResults:
    """
    Convenience function: compute binary metrics after reliability transformation.
    """
    calculator = E2PBinary(
        group1=group1,
        group2=group2,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        n_bootstrap=n_bootstrap,
        ci_level=ci_level,
        random_state=random_state,
    )
    return calculator.compute_at_reliability(
        r_current=r_current,
        r_target=r_target,
        kappa_current=kappa_current,
        kappa_target=kappa_target,
        per_group=per_group,
        r1_current=r1_current,
        r2_current=r2_current,
        r1_target=r1_target,
        r2_target=r2_target,
        center=center,
    )
