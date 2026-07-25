"""
Bivariate-normal continuous model for parametric E2P.

Matches the JavaScript simulator (StatUtils.bivariate* in js/utils.js):

    X, Y ~ BVN(0, 0, 1, 1, r)
    positive class = top `base_rate` of Y  (Y > Φ^{-1}(1 - base_rate))
    score = X

Predictive metrics use 1D quadrature over Y (truncated normals), not an
r → d conversion into the equal-variance binary normal model.
"""

from __future__ import annotations

import numpy as np
from scipy import stats
from typing import Dict, Literal, Optional, Tuple


def _trapz(y, x) -> float:
    """Trapezoidal integral; works across NumPy versions."""
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(y, x))
    return float(np.trapz(y, x))


def _clip_r(r: float) -> float:
    return float(np.clip(r, -0.999999, 0.999999))


def _clip_base_rate(base_rate: float) -> float:
    return float(np.clip(base_rate, 1e-12, 1.0 - 1e-12))


def class_cutoff(base_rate: float) -> float:
    """Outcome cutoff c such that P(Y > c) = base_rate."""
    p = _clip_base_rate(base_rate)
    return float(stats.norm.ppf(1.0 - p))


def residual_sd(r: float) -> float:
    """Conditional SD of X | Y (or Y | X) under unit-variance BVN."""
    rr = _clip_r(r)
    return float(np.sqrt(max(1e-12, 1.0 - rr * rr)))


def group_moments(r: float, base_rate: float) -> Dict[str, float]:
    """Moments of X | case (Y > c) and X | control (Y ≤ c)."""
    p = _clip_base_rate(base_rate)
    c = class_cutoff(p)
    phi_c = float(stats.norm.pdf(c))
    ey1 = phi_c / p
    ey0 = -phi_c / (1.0 - p)
    vy1 = 1.0 + c * phi_c / p - ey1 * ey1
    vy0 = 1.0 - c * phi_c / (1.0 - p) - ey0 * ey0
    rr = _clip_r(r)
    resid = 1.0 - rr * rr
    return {
        "c": c,
        "mean_case": rr * ey1,
        "mean_control": rr * ey0,
        "variance_case": rr * rr * max(vy1, 0.0) + resid,
        "variance_control": rr * rr * max(vy0, 0.0) + resid,
        "base_rate": p,
    }


def effect_sizes(
    r: float,
    base_rate: float,
    auc: Optional[float] = None,
) -> Dict[str, float]:
    """
    Dichotomized-outcome effect sizes under the BVN model.

    Returns pooled Cohen's d, nonpooled d_a, Glass's Δ, Cohen's U3, and
    rank-biserial (2*AUC - 1) when AUC is supplied or computed.
    """
    m = group_moments(r, base_rate)
    p = m["base_rate"]
    pooled_var = (1.0 - p) * m["variance_control"] + p * m["variance_case"]
    pooled_sd = np.sqrt(max(pooled_var, 1e-12))
    nonpooled_sd = np.sqrt(
        max((m["variance_control"] + m["variance_case"]) / 2.0, 1e-12)
    )
    delta = m["mean_case"] - m["mean_control"]
    d = delta / pooled_sd
    da = delta / nonpooled_sd
    glass_d = delta / np.sqrt(max(m["variance_control"], 1e-12))
    cohens_u3 = float(stats.norm.cdf(da))
    if auc is None:
        auc = discrimination_curves(r, p, curve_points=240, y_nodes=100)["auc"]
    return {
        "d": float(d),
        "da": float(da),
        "glass_d": float(glass_d),
        "cohens_u3": cohens_u3,
        "rank_biserial": float(2.0 * auc - 1.0),
        "mean_case": m["mean_case"],
        "mean_control": m["mean_control"],
        "variance_case": m["variance_case"],
        "variance_control": m["variance_control"],
        "auc": float(auc),
    }


def _make_y_grid(y0: float, y1: float, n: int) -> Tuple[np.ndarray, np.ndarray]:
    nodes = max(8, int(n))
    y = np.linspace(y0, y1, nodes + 1)
    h = (y1 - y0) / nodes
    w = np.full(nodes + 1, h)
    w[0] = 0.5 * h
    w[-1] = 0.5 * h
    return y, w


def _threshold_range(r: float, base_rate: float) -> Tuple[float, float]:
    m = group_moments(r, base_rate)
    sd1 = np.sqrt(max(m["variance_case"], 1e-12))
    sd0 = np.sqrt(max(m["variance_control"], 1e-12))
    t_min = min(m["mean_case"] - 6 * sd1, m["mean_control"] - 6 * sd0, -4.0)
    t_max = max(m["mean_case"] + 6 * sd1, m["mean_control"] + 6 * sd0, 4.0)
    return float(t_min), float(t_max)


def _class_mass_grids(r: float, base_rate: float, y_nodes: int = 160):
    """Precompute trapezoid weights for positive/negative Y regions."""
    p = _clip_base_rate(base_rate)
    c = class_cutoff(p)
    sigma = residual_sd(r)
    rr = _clip_r(r)
    y_lo = min(c - 8.0, -8.0)
    y_hi = max(c + 8.0, 8.0)
    n_pos = max(40, int(round(y_nodes * min(1.0, (y_hi - c) / 8.0))))
    n_neg = max(40, int(round(y_nodes * min(1.0, (c - y_lo) / 8.0))))
    y_pos, w_pos = _make_y_grid(c, y_hi, n_pos)
    y_neg, w_neg = _make_y_grid(y_lo, c, n_neg)
    pos_phi_w = stats.norm.pdf(y_pos) * w_pos
    neg_phi_w = stats.norm.pdf(y_neg) * w_neg
    return {
        "p": p,
        "c": c,
        "sigma": sigma,
        "rr": rr,
        "pos_mean": rr * y_pos,
        "neg_mean": rr * y_neg,
        "pos_phi_w": pos_phi_w,
        "neg_phi_w": neg_phi_w,
    }


def sens_spec(
    r: float,
    base_rate: float,
    threshold: float,
    y_nodes: int = 160,
) -> Dict[str, float]:
    """Sensitivity / specificity at a score threshold under the BVN model."""
    g = _class_mass_grids(r, base_rate, y_nodes)
    p = g["p"]
    sigma = g["sigma"]
    mass_pos = float(np.sum((1.0 - stats.norm.cdf(threshold, loc=g["pos_mean"], scale=sigma)) * g["pos_phi_w"]))
    mass_neg = float(np.sum((1.0 - stats.norm.cdf(threshold, loc=g["neg_mean"], scale=sigma)) * g["neg_phi_w"]))
    sensitivity = float(np.clip(mass_pos / p, 0.0, 1.0))
    fpr = float(np.clip(mass_neg / (1.0 - p), 0.0, 1.0))
    return {
        "sensitivity": sensitivity,
        "specificity": 1.0 - fpr,
        "fpr": fpr,
        "base_rate": p,
    }


def posterior_prob(r: float, base_rate: float, threshold: float) -> float:
    """
    P(Y > c | X = threshold) under the unit-variance BVN model.

    Equals 1 - Φ((c - r t) / sqrt(1 - r^2)).
    """
    p = _clip_base_rate(base_rate)
    c = class_cutoff(p)
    rr = _clip_r(r)
    sigma = residual_sd(rr)
    return float(1.0 - stats.norm.cdf((c - rr * threshold) / sigma))


def threshold_from_pt(r: float, base_rate: float, pt: float) -> float:
    """
    Score threshold t such that P(Y > c | X = t) = pt.

    Closed form under the BVN model. If r ≈ 0, returns 0 (posterior is flat).
    """
    p = _clip_base_rate(base_rate)
    pt = float(np.clip(pt, 1e-12, 1.0 - 1e-12))
    rr = _clip_r(r)
    if abs(rr) < 1e-12:
        return 0.0
    c = class_cutoff(p)
    sigma = residual_sd(rr)
    z = float(stats.norm.ppf(1.0 - pt))
    return (c - sigma * z) / rr


def predictive_metrics(
    r: float,
    base_rate: float,
    threshold: float,
    y_nodes: int = 160,
    threshold_prob: Optional[float] = None,
) -> Dict[str, float]:
    """Threshold-dependent classification metrics under the BVN model."""
    ss = sens_spec(r, base_rate, threshold, y_nodes)
    sensitivity = ss["sensitivity"]
    specificity = ss["specificity"]
    fpr = ss["fpr"]
    p = ss["base_rate"]

    ppv_denom = p * sensitivity + (1.0 - p) * fpr
    npv_denom = p * (1.0 - sensitivity) + (1.0 - p) * specificity
    ppv = (p * sensitivity) / ppv_denom if ppv_denom > 0 else 0.0
    npv = ((1.0 - p) * specificity) / npv_denom if npv_denom > 0 else 0.0
    accuracy = p * sensitivity + (1.0 - p) * specificity
    balanced_accuracy = (sensitivity + specificity) / 2.0
    f1 = (2.0 * ppv * sensitivity / (ppv + sensitivity)) if (ppv + sensitivity) > 0 else 0.0

    tp = p * sensitivity
    fn = p * (1.0 - sensitivity)
    tn = (1.0 - p) * specificity
    fp = (1.0 - p) * fpr
    mcc_den = np.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
    mcc = ((tp * tn - fp * fn) / mcc_den) if mcc_den > 0 else 0.0

    lr_plus = sensitivity / (1.0 - specificity) if (1.0 - specificity) > 0 else np.inf
    lr_minus = (1.0 - sensitivity) / specificity if specificity > 0 else np.inf
    if np.isfinite(lr_plus) and np.isfinite(lr_minus) and lr_minus > 0:
        dor = lr_plus / lr_minus
    else:
        dor = np.inf

    youden_j = sensitivity + specificity - 1.0
    g_mean = float(np.sqrt(max(0.0, sensitivity * specificity)))

    p_yes_true = p
    p_yes_pred = tp + fp
    pe_chance = p_yes_true * p_yes_pred + (1.0 - p_yes_true) * (1.0 - p_yes_pred)
    kappa_stat = (accuracy - pe_chance) / (1.0 - pe_chance) if pe_chance < 1 else 0.0

    pre_test_odds = p / (1.0 - p)
    post_test_odds_plus = pre_test_odds * lr_plus
    post_test_odds_minus = pre_test_odds * lr_minus
    post_test_prob_plus = (
        1.0 if not np.isfinite(post_test_odds_plus)
        else post_test_odds_plus / (1.0 + post_test_odds_plus)
    )
    post_test_prob_minus = (
        0.0 if not np.isfinite(post_test_odds_minus)
        else post_test_odds_minus / (1.0 + post_test_odds_minus)
    )

    pt = threshold_prob if threshold_prob is not None else posterior_prob(r, p, threshold)
    pt = float(np.clip(pt, 1e-12, 1.0 - 1e-12))
    odds_pt = pt / (1.0 - pt)
    nb_predictor = (sensitivity * p) - ((1.0 - specificity) * (1.0 - p) * odds_pt)
    nb_treat_all = p - (1.0 - p) * odds_pt
    delta_nb = nb_predictor - max(nb_treat_all, 0.0)

    return {
        "sensitivity": sensitivity,
        "specificity": specificity,
        "fpr": fpr,
        "ppv": ppv,
        "npv": npv,
        "accuracy": accuracy,
        "balanced_accuracy": balanced_accuracy,
        "f1": f1,
        "mcc": float(mcc),
        "lr_plus": float(lr_plus),
        "lr_minus": float(lr_minus),
        "dor": float(dor),
        "youden_j": youden_j,
        "g_mean": g_mean,
        "kappa": kappa_stat,
        "post_test_prob_plus": float(post_test_prob_plus),
        "post_test_prob_minus": float(post_test_prob_minus),
        "delta_nb": float(delta_nb),
        "threshold_prob": pt,
        "base_rate": p,
    }


def discrimination_curves(
    r: float,
    base_rate: float,
    curve_points: int = 400,
    y_nodes: int = 140,
) -> Dict[str, object]:
    """ROC/PR curves and AUCs under the BVN continuous model."""
    p = _clip_base_rate(base_rate)
    g = _class_mass_grids(r, p, y_nodes)
    sigma = g["sigma"]
    t_min, t_max = _threshold_range(r, p)

    thresholds = np.linspace(t_max, t_min, curve_points)
    # Broadcast: for each threshold, sum survival over mixture components
    # pos_mean shape (n_comp,), thresholds shape (n_t, 1)
    t_col = thresholds[:, None]
    mass_pos = np.sum(
        (1.0 - stats.norm.cdf(t_col, loc=g["pos_mean"], scale=sigma)) * g["pos_phi_w"],
        axis=1,
    )
    mass_neg = np.sum(
        (1.0 - stats.norm.cdf(t_col, loc=g["neg_mean"], scale=sigma)) * g["neg_phi_w"],
        axis=1,
    )
    tpr = np.clip(mass_pos / p, 0.0, 1.0)
    fpr = np.clip(mass_neg / (1.0 - p), 0.0, 1.0)
    prec_denom = p * tpr + (1.0 - p) * fpr
    precision = np.where(prec_denom > 0, (p * tpr) / prec_denom, 1.0)

    order = np.argsort(fpr)
    fpr_s = fpr[order]
    tpr_s = tpr[order]
    auc = float(np.clip(_trapz(tpr_s, fpr_s), 0.0, 1.0))

    recalls = np.concatenate([[0.0], tpr, [1.0]])
    precisions = np.concatenate([[1.0], precision, [p]])
    pr_order = np.argsort(recalls)
    recalls = recalls[pr_order]
    precisions = precisions[pr_order]
    _, uniq_idx = np.unique(recalls, return_index=True)
    uniq_idx = np.sort(uniq_idx)
    recalls = recalls[uniq_idx]
    precisions = precisions[uniq_idx]
    prauc = float(np.clip(_trapz(precisions, recalls), 0.0, 1.0))

    return {
        "FPR": fpr,
        "TPR": tpr,
        "precision": precision,
        "recall": tpr,
        "thresholds": thresholds,
        "auc": auc,
        "prauc": prauc,
        "base_rate": p,
        "t_min": t_min,
        "t_max": t_max,
    }


def roc_auc(r: float, base_rate: float, curve_points: int = 320, y_nodes: int = 120) -> float:
    return float(discrimination_curves(r, base_rate, curve_points, y_nodes)["auc"])


def pr_auc(r: float, base_rate: float, curve_points: int = 400, y_nodes: int = 140) -> float:
    return float(discrimination_curves(r, base_rate, curve_points, y_nodes)["prauc"])


def optimal_threshold(
    r: float,
    base_rate: float,
    metric: Literal["youden", "f1"] = "youden",
    curve_points: int = 600,
    y_nodes: int = 140,
) -> float:
    """Find score threshold maximizing Youden's J or F1 under the BVN model."""
    p = _clip_base_rate(base_rate)
    t_min, t_max = _threshold_range(r, p)
    best_value = -np.inf
    best_t = 0.0
    for t in np.linspace(t_min, t_max, curve_points):
        m = predictive_metrics(r, p, float(t), y_nodes)
        value = m["f1"] if metric == "f1" else m["youden_j"]
        if value > best_value:
            best_value = value
            best_t = float(t)
    span = (t_max - t_min) / curve_points * 8.0
    for t in np.linspace(best_t - span, best_t + span, 80):
        m = predictive_metrics(r, p, float(t), y_nodes)
        value = m["f1"] if metric == "f1" else m["youden_j"]
        if value > best_value:
            best_value = value
            best_t = float(t)
    return best_t
