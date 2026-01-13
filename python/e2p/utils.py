"""
Shared statistical utility functions for e2p.
"""

import numpy as np
from scipy import stats
from scipy.optimize import brentq
from typing import Tuple
import warnings


def transform_for_target_reliability(
    x: np.ndarray,
    r_current: float,
    r_target: float,
    *,
    center: str = "mean",
) -> np.ndarray:
    """
    Deterministically transform measurements to reflect a target reliability.

    This implements a simple "distribution-rescale" model based on the classical
    measurement error decomposition:

        X_obs = X_true + E,  with  Rel(X_obs) = Var(X_true) / Var(X_obs)

    If we interpret the observed deviations around a location parameter as
    containing both true-score variation and error variation, then changing
    reliability from r_current to r_target corresponds to scaling the total
    variance by a factor of (r_current / r_target) while keeping the location
    fixed:

        x_tgt = c + sqrt(r_current / r_target) * (x - c)

    Notes
    -----
    - If r_target > r_current, the scale factor is < 1, shrinking variance
      (i.e., "improving reliability" by reducing measurement noise).
    - If r_target < r_current, the scale factor is > 1 (worsening reliability).
    - This is exact with respect to this deterministic transformation; it is not
      a full deconvolution of the measurement error distribution.

    Parameters
    ----------
    x : np.ndarray
        Observed measurements.
    r_current : float
        Current reliability in (0, 1].
    r_target : float
        Target reliability in (0, 1].
    center : {"mean","median"}
        Location parameter c used for centering before rescaling.

    Returns
    -------
    np.ndarray
        Transformed measurements.
    """
    x = np.asarray(x, dtype=float)

    if not np.all(np.isfinite(x)):
        raise ValueError("x must contain only finite values")
    if not (0 < r_current <= 1):
        raise ValueError("r_current must be in (0, 1]")
    if not (0 < r_target <= 1):
        raise ValueError("r_target must be in (0, 1]")

    if center not in {"mean", "median"}:
        raise ValueError("center must be 'mean' or 'median'")

    c = float(np.mean(x)) if center == "mean" else float(np.median(x))
    scale = float(np.sqrt(r_current / r_target))
    return c + scale * (x - c)


def transform_groups_for_target_kappa(
    group1: np.ndarray,
    group2: np.ndarray,
    kappa_current: float,
    kappa_target: float = 1.0,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Deterministically adjust between-group separation to reflect target label reliability.

    This mirrors the webapp's attenuation relationship (see `js/binary.js`):

        d_observed = d_true * sqrt( sin(pi/2 * kappa) )

    Interpreting kappa as attenuating the *between-group separation* (not the
    within-group variability), we can map kappa changes onto a mean-shift
    transformation that increases/decreases the difference in group means while
    preserving each group's within-group deviations.

    The mean difference is scaled by:

        scale = sqrt( sin(pi/2 * kappa_target) / sin(pi/2 * kappa_current) )

    For deattenuation to perfect labels, use kappa_target=1.0 (since sin(pi/2)=1).

    Parameters
    ----------
    group1, group2 : np.ndarray
        Observed measurements for controls/negatives and cases/positives.
    kappa_current : float
        Current label reliability in (0, 1].
    kappa_target : float
        Target label reliability in (0, 1].

    Returns
    -------
    (np.ndarray, np.ndarray)
        Transformed (group1, group2).
    """
    g1 = np.asarray(group1, dtype=float)
    g2 = np.asarray(group2, dtype=float)

    if not np.all(np.isfinite(g1)) or not np.all(np.isfinite(g2)):
        raise ValueError("group1 and group2 must contain only finite values")
    if not (0 < kappa_current <= 1):
        raise ValueError("kappa_current must be in (0, 1]")
    if not (0 < kappa_target <= 1):
        raise ValueError("kappa_target must be in (0, 1]")

    s_cur = float(np.sin((np.pi / 2) * kappa_current))
    s_tgt = float(np.sin((np.pi / 2) * kappa_target))
    if s_cur <= 0:
        raise ValueError("sin(pi/2 * kappa_current) must be > 0")

    scale = float(np.sqrt(s_tgt / s_cur))
    if np.isclose(scale, 1.0):
        return g1, g2

    m1 = float(np.mean(g1))
    m2 = float(np.mean(g2))
    delta = m2 - m1
    delta_tgt = delta * scale

    # Symmetric mean shift: preserve grand mean of the two group means.
    shift = 0.5 * (delta_tgt - delta)
    return (g1 - shift), (g2 + shift)


def compute_cohens_d(g1: np.ndarray, g2: np.ndarray) -> float:
    """Compute Cohen's d: standardized mean difference with pooled SD."""
    n1, n2 = len(g1), len(g2)
    mean1, mean2 = np.mean(g1), np.mean(g2)
    var1, var2 = np.var(g1, ddof=1), np.var(g2, ddof=1)
    
    # Pooled standard deviation
    pooled_var = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2)
    pooled_sd = np.sqrt(pooled_var)
    
    if pooled_sd == 0:
        return 0.0
    
    return (mean2 - mean1) / pooled_sd


def compute_point_biserial_r(g1: np.ndarray, g2: np.ndarray) -> float:
    """Compute point-biserial correlation directly."""
    values = np.concatenate([g1, g2])
    labels = np.concatenate([np.zeros(len(g1)), np.ones(len(g2))])
    r, _ = stats.pearsonr(labels, values)
    return r


def compute_eta_squared(g1: np.ndarray, g2: np.ndarray) -> float:
    """Compute eta-squared from one-way ANOVA decomposition."""
    all_values = np.concatenate([g1, g2])
    grand_mean = np.mean(all_values)
    
    ss_between = len(g1) * (np.mean(g1) - grand_mean)**2 + \
                 len(g2) * (np.mean(g2) - grand_mean)**2
    ss_total = np.sum((all_values - grand_mean)**2)
    
    if ss_total == 0:
        return 0.0
    
    return ss_between / ss_total


def compute_odds_ratio(g1: np.ndarray, g2: np.ndarray) -> Tuple[float, float]:
    """
    Compute odds ratio from Cohen's d.
    Uses: OR = exp(d × π / √3)
    Returns (odds_ratio, log_odds_ratio)
    """
    d = compute_cohens_d(g1, g2)
    log_or = d * np.pi / np.sqrt(3)
    odds_ratio = np.exp(log_or)
    return odds_ratio, log_or


def compute_cohens_u3(g1: np.ndarray, g2: np.ndarray) -> float:
    """Compute Cohen's U3: proportion of g2 above median of g1."""
    median_g1 = np.median(g1)
    return np.mean(g2 > median_g1)


def compute_roc_auc(g1: np.ndarray, g2: np.ndarray) -> float:
    """Compute ROC-AUC using Mann-Whitney U statistic."""
    n1, n2 = len(g1), len(g2)
    
    count = 0
    for x2 in g2:
        count += np.sum(g1 < x2) + 0.5 * np.sum(g1 == x2)
    
    return count / (n1 * n2)


def compute_pr_auc(g1: np.ndarray, g2: np.ndarray, base_rate: float) -> float:
    """Compute PR-AUC using base_rate for precision calculation."""
    all_values = np.concatenate([g1, g2])
    thresholds = np.unique(all_values)
    thresholds = np.sort(thresholds)[::-1]
    
    precisions = []
    recalls = []
    
    for t in thresholds:
        sens = np.mean(g2 >= t)
        spec = np.mean(g1 < t)
        
        numerator = sens * base_rate
        denominator = numerator + (1 - spec) * (1 - base_rate)
        
        if denominator > 0:
            precision = numerator / denominator
        else:
            precision = 1.0
        
        precisions.append(precision)
        recalls.append(sens)
    
    precisions = [1.0] + precisions + [base_rate]
    recalls = [0.0] + recalls + [1.0]
    
    sorted_indices = np.argsort(recalls)
    recalls = np.array(recalls)[sorted_indices]
    precisions = np.array(precisions)[sorted_indices]
    
    pr_auc = np.trapezoid(precisions, recalls)
    return np.clip(pr_auc, 0, 1)


def compute_roc_curve(g1: np.ndarray, g2: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute ROC curve data."""
    all_values = np.concatenate([g1, g2])
    thresholds = np.unique(all_values)
    thresholds = np.sort(thresholds)
    
    fprs = []
    tprs = []
    
    for t in thresholds:
        tpr = np.mean(g2 >= t)
        fpr = np.mean(g1 >= t)
        tprs.append(tpr)
        fprs.append(fpr)
    
    fprs = [1.0] + fprs + [0.0]
    tprs = [1.0] + tprs + [0.0]
    thresholds = np.concatenate([[thresholds[0] - 1], thresholds, [thresholds[-1] + 1]])
    
    return np.array(fprs), np.array(tprs), thresholds


def compute_pr_curve(g1: np.ndarray, g2: np.ndarray, base_rate: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute PR curve data using base_rate."""
    all_values = np.concatenate([g1, g2])
    thresholds = np.unique(all_values)
    thresholds = np.sort(thresholds)[::-1]
    
    precisions = []
    recalls = []
    
    for t in thresholds:
        sens = np.mean(g2 >= t)
        spec = np.mean(g1 < t)
        
        numerator = sens * base_rate
        denominator = numerator + (1 - spec) * (1 - base_rate)
        
        if denominator > 0:
            precision = numerator / denominator
        else:
            precision = 1.0
        
        precisions.append(precision)
        recalls.append(sens)
    
    return np.array(precisions), np.array(recalls), thresholds


def convert_pt_to_threshold(g1: np.ndarray, g2: np.ndarray, 
                            base_rate: float, pt: float) -> float:
    """
    Convert threshold probability (p_t) to measurement threshold.
    Uses KDE to estimate PDFs and finds threshold t where:
    P(group2 | measurement = t) = pt
    """
    try:
        kde1 = stats.gaussian_kde(g1)
        kde2 = stats.gaussian_kde(g2)
    except np.linalg.LinAlgError:
        warnings.warn("KDE failed, using quantile-based threshold")
        return np.percentile(np.concatenate([g1, g2]), 100 * (1 - pt))
    
    all_values = np.concatenate([g1, g2])
    t_min = np.min(all_values) - 2 * np.std(all_values)
    t_max = np.max(all_values) + 2 * np.std(all_values)
    
    def posterior_minus_pt(t):
        f1 = kde1(t)[0]
        f2 = kde2(t)[0]
        
        numerator = f2 * base_rate
        denominator = f1 * (1 - base_rate) + f2 * base_rate
        
        if denominator < 1e-15:
            return 0.5 - pt
        
        posterior = numerator / denominator
        return posterior - pt
    
    try:
        threshold = brentq(posterior_minus_pt, t_min, t_max)
    except ValueError:
        t_grid = np.linspace(t_min, t_max, 1000)
        posteriors = np.array([posterior_minus_pt(t) + pt for t in t_grid])
        idx = np.argmin(np.abs(posteriors - pt))
        threshold = t_grid[idx]
    
    return threshold


def compute_threshold_metrics(g1: np.ndarray, g2: np.ndarray,
                              threshold: float, base_rate: float, 
                              pt: float) -> dict:
    """Compute all threshold-dependent metrics."""
    sens = np.mean(g2 >= threshold)
    spec = np.mean(g1 < threshold)
    
    # PPV and NPV using base_rate
    ppv_num = sens * base_rate
    ppv_denom = ppv_num + (1 - spec) * (1 - base_rate)
    ppv = ppv_num / ppv_denom if ppv_denom > 0 else 1.0
    
    npv_num = spec * (1 - base_rate)
    npv_denom = npv_num + (1 - sens) * base_rate
    npv = npv_num / npv_denom if npv_denom > 0 else 1.0
    
    # Accuracy (using base_rate)
    accuracy = sens * base_rate + spec * (1 - base_rate)
    
    # Balanced accuracy
    balanced_accuracy = (sens + spec) / 2
    
    # F1 score
    f1 = 2 * (ppv * sens) / (ppv + sens) if (ppv + sens) > 0 else 0.0
    
    # MCC
    tp_rate = sens * base_rate
    tn_rate = spec * (1 - base_rate)
    fp_rate = (1 - spec) * (1 - base_rate)
    fn_rate = (1 - sens) * base_rate
    
    mcc_num = (tp_rate * tn_rate) - (fp_rate * fn_rate)
    mcc_denom = np.sqrt((tp_rate + fp_rate) * (tp_rate + fn_rate) * 
                       (tn_rate + fp_rate) * (tn_rate + fn_rate))
    mcc = mcc_num / mcc_denom if mcc_denom > 0 else 0.0
    
    # Likelihood ratios
    lr_plus = sens / (1 - spec) if spec < 1 else np.inf
    lr_minus = (1 - sens) / spec if spec > 0 else np.inf
    dor = lr_plus / lr_minus if (lr_minus > 0 and lr_minus != np.inf) else np.inf
    
    # Youden's J and G-mean
    youden_j = sens + spec - 1
    g_mean = np.sqrt(sens * spec)
    
    # Cohen's kappa
    po = accuracy
    pe = base_rate * (tp_rate + fp_rate) + (1 - base_rate) * (tn_rate + fn_rate)
    kappa = (po - pe) / (1 - pe) if pe < 1 else 0.0
    
    # Post-test probabilities
    pre_odds = base_rate / (1 - base_rate)
    post_odds_plus = pre_odds * lr_plus if lr_plus != np.inf else np.inf
    post_odds_minus = pre_odds * lr_minus if lr_minus != np.inf else np.inf
    
    post_prob_plus = post_odds_plus / (1 + post_odds_plus) if post_odds_plus != np.inf else 1.0
    post_prob_minus = post_odds_minus / (1 + post_odds_minus) if post_odds_minus != np.inf else 1.0
    
    # Delta NB
    odds = pt / (1 - pt)
    nb_predictor = (sens * base_rate) - ((1 - spec) * (1 - base_rate) * odds)
    nb_treat_all = base_rate - (1 - base_rate) * odds
    nb_treat_none = 0.0
    delta_nb = nb_predictor - max(nb_treat_all, nb_treat_none)
    
    return {
        'sensitivity': sens,
        'specificity': spec,
        'ppv': ppv,
        'npv': npv,
        'accuracy': accuracy,
        'balanced_accuracy': balanced_accuracy,
        'f1': f1,
        'mcc': mcc,
        'lr_plus': lr_plus,
        'lr_minus': lr_minus,
        'dor': dor,
        'youden_j': youden_j,
        'g_mean': g_mean,
        'kappa': kappa,
        'post_test_prob_plus': post_prob_plus,
        'post_test_prob_minus': post_prob_minus,
        'delta_nb': delta_nb
    }
