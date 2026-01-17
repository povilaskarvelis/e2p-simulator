"""
Parametric computation module for e2p.

Computes predictive metrics from effect sizes (Cohen's d, Pearson's r) assuming
idealized normal distributions, without requiring empirical data.

This mirrors the JavaScript simulator's functionality for programmatic/AI agent use.
"""

import numpy as np
from scipy import stats
from scipy.optimize import minimize_scalar
from dataclasses import dataclass
from typing import Optional, Literal


@dataclass
class ParametricResults:
    """Results from parametric e2p computation."""
    # Input parameters
    cohens_d_true: float
    cohens_d_observed: float
    base_rate: float
    threshold_prob: float
    icc1: float
    icc2: float
    kappa: float
    
    # Effect sizes
    odds_ratio: float
    log_odds_ratio: float
    cohens_u3: float
    point_biserial_r: float
    eta_squared: float
    
    # Discrimination metrics
    roc_auc: float
    pr_auc: float
    
    # Threshold-dependent metrics
    threshold_value: float
    sensitivity: float
    specificity: float
    ppv: float
    npv: float
    accuracy: float
    balanced_accuracy: float
    f1: float
    mcc: float
    lr_plus: float
    lr_minus: float
    dor: float
    youden_j: float
    g_mean: float
    kappa_statistic: float
    post_test_prob_plus: float
    post_test_prob_minus: float
    delta_nb: float


def _normal_pdf(x: float, mean: float, std: float) -> float:
    """Normal probability density function."""
    return np.exp(-0.5 * ((x - mean) / std) ** 2) / (std * np.sqrt(2 * np.pi))


def _normal_cdf(x: float, mean: float = 0.0, std: float = 1.0) -> float:
    """Normal cumulative distribution function."""
    return stats.norm.cdf(x, loc=mean, scale=std)


def attenuate_d(
    true_d: float,
    kappa: float = 1.0,
) -> float:
    """
    Compute observed Cohen's d from true d given diagnostic reliability (kappa).
    
    The attenuation formula is: d_obs = d_true * sqrt(sin(pi/2 * kappa))
    
    Parameters
    ----------
    true_d : float
        True (latent) Cohen's d.
    kappa : float
        Diagnostic/label reliability (0-1). Default 1.0 (perfect).
    
    Returns
    -------
    float
        Observed (attenuated) Cohen's d.
    """
    return true_d * np.sqrt(np.sin(np.pi / 2 * kappa))


def compute_sigma_from_icc(icc: float) -> float:
    """
    Compute standard deviation inflation factor from ICC (measurement reliability).
    
    When ICC < 1, measurement error inflates the observed variance.
    sigma_obs = sigma_true / sqrt(ICC)
    
    With sigma_true = 1, we get sigma_obs = 1 / sqrt(ICC)
    
    Parameters
    ----------
    icc : float
        Intraclass correlation coefficient (measurement reliability), 0 < icc <= 1.
    
    Returns
    -------
    float
        Standard deviation for the observed distribution.
    """
    if icc <= 0 or icc > 1:
        raise ValueError("ICC must be in (0, 1]")
    return 1.0 / np.sqrt(icc)


def compute_roc_auc_parametric(
    cohens_d: float,
    sigma1: float = 1.0,
    sigma2: float = 1.0,
) -> float:
    """
    Compute ROC-AUC analytically from Cohen's d.
    
    For two normal distributions N(0, sigma1) and N(d, sigma2),
    the ROC-AUC is: Phi(d_att / sqrt(2))
    where d_att = d * sqrt(2) / sqrt(sigma1^2 + sigma2^2)
    
    Parameters
    ----------
    cohens_d : float
        Cohen's d (standardized mean difference).
    sigma1 : float
        Standard deviation of group 1 (controls). Default 1.0.
    sigma2 : float
        Standard deviation of group 2 (cases). Default 1.0.
    
    Returns
    -------
    float
        ROC-AUC value.
    """
    d_att = cohens_d * np.sqrt(2) / np.sqrt(sigma1**2 + sigma2**2)
    return _normal_cdf(d_att / np.sqrt(2))


def compute_pr_auc_parametric(
    cohens_d: float,
    base_rate: float,
    sigma1: float = 1.0,
    sigma2: float = 1.0,
    n_points: int = 500,
) -> float:
    """
    Compute PR-AUC via numerical integration for idealized normal distributions.
    
    Parameters
    ----------
    cohens_d : float
        Cohen's d (standardized mean difference).
    base_rate : float
        Prevalence of the positive class (0-1).
    sigma1 : float
        Standard deviation of group 1 (controls). Default 1.0.
    sigma2 : float
        Standard deviation of group 2 (cases). Default 1.0.
    n_points : int
        Number of threshold points for integration. Default 500.
    
    Returns
    -------
    float
        PR-AUC value.
    """
    if base_rate <= 0:
        return 0.0
    if base_rate >= 1:
        return 1.0
    
    # Generate thresholds spanning the distributions
    min_thresh = min(0, cohens_d) - 6 * max(sigma1, sigma2)
    max_thresh = max(0, cohens_d) + 6 * max(sigma1, sigma2)
    thresholds = np.linspace(max_thresh, min_thresh, n_points)
    
    recalls = []
    precisions = []
    
    for t in thresholds:
        # Sensitivity (recall) = P(X >= t | positive) = 1 - CDF(t; d, sigma2)
        recall = 1 - _normal_cdf(t, cohens_d, sigma2)
        # FPR = P(X >= t | negative) = 1 - CDF(t; 0, sigma1)
        fpr = 1 - _normal_cdf(t, 0, sigma1)
        
        # Precision = (base_rate * recall) / (base_rate * recall + (1 - base_rate) * fpr)
        numerator = base_rate * recall
        denominator = numerator + (1 - base_rate) * fpr
        
        precision = 1.0 if denominator < 1e-9 else numerator / denominator
        
        recalls.append(recall)
        precisions.append(precision)
    
    # Add boundary points
    points = [{'recall': 0, 'precision': 1.0}]
    for r, p in zip(recalls, precisions):
        points.append({'recall': r, 'precision': p})
    points.append({'recall': 1.0, 'precision': base_rate})
    
    # Remove duplicates and sort by recall
    unique_points = []
    seen_recalls = set()
    for pt in sorted(points, key=lambda x: x['recall']):
        if pt['recall'] not in seen_recalls:
            unique_points.append(pt)
            seen_recalls.add(pt['recall'])
    
    # Compute area using trapezoidal rule
    area = 0.0
    for i in range(1, len(unique_points)):
        delta_recall = unique_points[i]['recall'] - unique_points[i-1]['recall']
        avg_precision = (unique_points[i]['precision'] + unique_points[i-1]['precision']) / 2
        area += delta_recall * avg_precision
    
    return np.clip(area, 0, 1)


def compute_binary_metrics(
    cohens_d: float,
    base_rate: float,
    threshold: float,
    sigma1: float = 1.0,
    sigma2: float = 1.0,
) -> dict:
    """
    Compute all threshold-dependent metrics for idealized normal distributions.
    
    Assumes group 1 (controls) ~ N(0, sigma1) and group 2 (cases) ~ N(d, sigma2).
    
    Parameters
    ----------
    cohens_d : float
        Cohen's d (mean of cases distribution).
    base_rate : float
        Prevalence of positive class (0-1).
    threshold : float
        Decision threshold on the measurement scale.
    sigma1 : float
        Standard deviation of group 1 (controls). Default 1.0.
    sigma2 : float
        Standard deviation of group 2 (cases). Default 1.0.
    
    Returns
    -------
    dict
        Dictionary containing all computed metrics.
    """
    # FPR and TPR at threshold
    fpr = 1 - _normal_cdf(threshold, 0, sigma1)
    tpr = 1 - _normal_cdf(threshold, cohens_d, sigma2)
    
    sensitivity = tpr
    specificity = 1 - fpr
    
    # PPV (precision)
    if sensitivity == 0:
        ppv = 1.0  # Convention when sensitivity is 0
    else:
        ppv_num = sensitivity * base_rate
        ppv_denom = ppv_num + (1 - specificity) * (1 - base_rate)
        ppv = ppv_num / ppv_denom if ppv_denom > 0 else 1.0
    
    # NPV
    npv_num = specificity * (1 - base_rate)
    npv_denom = npv_num + (1 - sensitivity) * base_rate
    npv = npv_num / npv_denom if npv_denom > 0 else 1.0
    
    # Accuracy metrics
    accuracy = sensitivity * base_rate + specificity * (1 - base_rate)
    balanced_accuracy = (sensitivity + specificity) / 2
    
    # F1 score
    f1 = 2 * (ppv * sensitivity) / (ppv + sensitivity) if (ppv + sensitivity) > 0 else 0.0
    
    # MCC (Matthews Correlation Coefficient)
    tp = sensitivity * base_rate
    tn = specificity * (1 - base_rate)
    fp = (1 - specificity) * (1 - base_rate)
    fn = (1 - sensitivity) * base_rate
    
    mcc_num = tp * tn - fp * fn
    mcc_denom = np.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
    mcc = mcc_num / mcc_denom if mcc_denom > 0 else 0.0
    
    # Likelihood ratios
    lr_plus = sensitivity / (1 - specificity) if specificity < 1 else np.inf
    lr_minus = (1 - sensitivity) / specificity if specificity > 0 else np.inf
    dor = lr_plus / lr_minus if (lr_minus > 0 and lr_minus != np.inf and lr_plus != np.inf) else np.inf
    
    # Youden's J and G-mean
    youden_j = sensitivity + specificity - 1
    g_mean = np.sqrt(sensitivity * specificity)
    
    # Cohen's kappa
    p_yes_true = base_rate
    p_yes_pred = tp + fp
    p_no_true = 1 - p_yes_true
    p_no_pred = 1 - p_yes_pred
    po = accuracy
    pe_chance = p_yes_true * p_yes_pred + p_no_true * p_no_pred
    kappa_stat = (po - pe_chance) / (1 - pe_chance) if pe_chance < 1 else 0.0
    
    # Post-test probabilities
    pre_test_odds = base_rate / (1 - base_rate) if base_rate < 1 else np.inf
    post_test_odds_plus = pre_test_odds * lr_plus if lr_plus != np.inf else np.inf
    post_test_odds_minus = pre_test_odds * lr_minus if lr_minus != np.inf else np.inf
    
    post_test_prob_plus = post_test_odds_plus / (1 + post_test_odds_plus) if post_test_odds_plus != np.inf else 1.0
    post_test_prob_minus = post_test_odds_minus / (1 + post_test_odds_minus) if post_test_odds_minus != np.inf else 1.0
    
    # Delta Net Benefit (using threshold_prob for pt)
    # For parametric case, we need to compute pt from threshold
    pt = compute_pt_from_threshold(cohens_d, threshold, base_rate, sigma1, sigma2)
    odds_pt = pt / (1 - pt) if pt < 1 else np.inf
    nb_predictor = (sensitivity * base_rate) - ((1 - specificity) * (1 - base_rate) * odds_pt) if odds_pt != np.inf else 0.0
    nb_treat_all = base_rate - (1 - base_rate) * odds_pt if odds_pt != np.inf else -np.inf
    nb_treat_none = 0.0
    delta_nb = nb_predictor - max(nb_treat_all, nb_treat_none)
    
    return {
        'fpr': fpr,
        'tpr': tpr,
        'sensitivity': sensitivity,
        'specificity': specificity,
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
        'kappa': kappa_stat,
        'post_test_prob_plus': post_test_prob_plus,
        'post_test_prob_minus': post_test_prob_minus,
        'delta_nb': delta_nb,
    }


def compute_pt_from_threshold(
    cohens_d: float,
    threshold: float,
    base_rate: float,
    sigma1: float = 1.0,
    sigma2: float = 1.0,
) -> float:
    """
    Compute threshold probability p_t from measurement threshold using Bayes' theorem.
    
    p_t = P(positive | X = threshold)
        = (pdf2 * base_rate) / (pdf1 * (1 - base_rate) + pdf2 * base_rate)
    
    Parameters
    ----------
    cohens_d : float
        Cohen's d (mean of cases distribution).
    threshold : float
        Decision threshold on the measurement scale.
    base_rate : float
        Prevalence of positive class (0-1).
    sigma1 : float
        Standard deviation of group 1 (controls). Default 1.0.
    sigma2 : float
        Standard deviation of group 2 (cases). Default 1.0.
    
    Returns
    -------
    float
        Threshold probability p_t.
    """
    pdf1 = _normal_pdf(threshold, 0, sigma1)
    pdf2 = _normal_pdf(threshold, cohens_d, sigma2)
    
    numerator = pdf2 * base_rate
    denominator = pdf1 * (1 - base_rate) + pdf2 * base_rate
    
    if denominator == 0:
        return 0.5
    
    return numerator / denominator


def compute_threshold_from_pt(
    cohens_d: float,
    pt: float,
    base_rate: float,
    sigma1: float = 1.0,
    sigma2: float = 1.0,
) -> float:
    """
    Find measurement threshold corresponding to a given threshold probability p_t.
    
    Uses bisection search to find threshold t where P(positive | X = t) = pt.
    
    Parameters
    ----------
    cohens_d : float
        Cohen's d (mean of cases distribution).
    pt : float
        Target threshold probability (0-1).
    base_rate : float
        Prevalence of positive class (0-1).
    sigma1 : float
        Standard deviation of group 1 (controls). Default 1.0.
    sigma2 : float
        Standard deviation of group 2 (cases). Default 1.0.
    
    Returns
    -------
    float
        Measurement threshold corresponding to pt.
    """
    # Bisection search
    left = -8.0 * max(sigma1, sigma2)
    right = 8.0 * max(sigma1, sigma2) + cohens_d
    epsilon = 1e-8
    max_iter = 100
    
    for _ in range(max_iter):
        mid = (left + right) / 2
        pt_mid = compute_pt_from_threshold(cohens_d, mid, base_rate, sigma1, sigma2)
        
        if abs(pt_mid - pt) < epsilon:
            return mid
        
        if pt_mid < pt:
            left = mid
        else:
            right = mid
        
        if right - left < epsilon:
            break
    
    return (left + right) / 2


def find_optimal_threshold(
    cohens_d: float,
    base_rate: float,
    sigma1: float = 1.0,
    sigma2: float = 1.0,
    metric: Literal['youden', 'f1'] = 'youden',
) -> float:
    """
    Find optimal threshold maximizing Youden's J or F1 score.
    
    Parameters
    ----------
    cohens_d : float
        Cohen's d (mean of cases distribution).
    base_rate : float
        Prevalence of positive class (0-1).
    sigma1 : float
        Standard deviation of group 1 (controls). Default 1.0.
    sigma2 : float
        Standard deviation of group 2 (cases). Default 1.0.
    metric : {'youden', 'f1'}
        Which metric to maximize. Default 'youden'.
    
    Returns
    -------
    float
        Optimal threshold value.
    """
    def objective(t):
        metrics = compute_binary_metrics(cohens_d, base_rate, t, sigma1, sigma2)
        if metric == 'f1':
            return -metrics['f1']  # Negative for minimization
        else:  # youden
            return -metrics['youden_j']
    
    # Search range
    t_min = -8.0 * max(sigma1, sigma2)
    t_max = 8.0 * max(sigma1, sigma2) + cohens_d
    
    result = minimize_scalar(objective, bounds=(t_min, t_max), method='bounded')
    return result.x


def d_to_odds_ratio(d: float) -> float:
    """Convert Cohen's d to odds ratio."""
    return np.exp(d * np.pi / np.sqrt(3))


def d_to_log_odds_ratio(d: float) -> float:
    """Convert Cohen's d to log odds ratio."""
    return d * np.pi / np.sqrt(3)


def d_to_point_biserial_r(d: float, base_rate: float) -> float:
    """
    Convert Cohen's d to point-biserial correlation.
    
    r = d / sqrt(d^2 + 1/(p*(1-p)))
    
    When base_rate = 0.5, this reduces to d / sqrt(d^2 + 4).
    """
    return d / np.sqrt(d**2 + 1 / (base_rate * (1 - base_rate)))


def d_to_cohens_u3(d: float) -> float:
    """
    Compute Cohen's U3 from d.
    
    U3 = proportion of group 2 above median of group 1 = Phi(d)
    """
    return _normal_cdf(d)


def r_to_d(r: float) -> float:
    """Convert Pearson's r to Cohen's d (approximate)."""
    if abs(r) >= 1:
        return np.sign(r) * np.inf
    return 2 * r / np.sqrt(1 - r**2)


def auc_to_d(auc: float) -> float:
    """
    Convert ROC-AUC to Cohen's d.
    
    Uses the formula: d = Phi^(-1)(AUC) * sqrt(2)
    where Phi^(-1) is the inverse standard normal CDF.
    
    Parameters
    ----------
    auc : float
        ROC-AUC value (0.5 to 1.0 for positive effect).
    
    Returns
    -------
    float
        Cohen's d.
    
    Example
    -------
    >>> auc_to_d(0.714)  # approximately 0.8
    """
    if auc <= 0.5:
        return 0.0
    if auc >= 1.0:
        return np.inf
    return stats.norm.ppf(auc) * np.sqrt(2)


def odds_ratio_to_d(odds_ratio: float) -> float:
    """
    Convert odds ratio to Cohen's d.
    
    Uses the formula: d = ln(OR) * sqrt(3) / pi
    
    Parameters
    ----------
    odds_ratio : float
        Odds ratio (must be > 0).
    
    Returns
    -------
    float
        Cohen's d.
    
    Example
    -------
    >>> odds_ratio_to_d(4.27)  # approximately 0.8
    """
    if odds_ratio <= 0:
        raise ValueError("odds_ratio must be > 0")
    return np.log(odds_ratio) * np.sqrt(3) / np.pi


def log_odds_ratio_to_d(log_odds_ratio: float) -> float:
    """
    Convert log odds ratio to Cohen's d.
    
    Uses the formula: d = log_OR * sqrt(3) / pi
    
    Parameters
    ----------
    log_odds_ratio : float
        Log odds ratio.
    
    Returns
    -------
    float
        Cohen's d.
    
    Example
    -------
    >>> log_odds_ratio_to_d(1.45)  # approximately 0.8
    """
    return log_odds_ratio * np.sqrt(3) / np.pi


def cohens_u3_to_d(u3: float) -> float:
    """
    Convert Cohen's U3 to Cohen's d.
    
    Uses the formula: d = Phi^(-1)(U3)
    where Phi^(-1) is the inverse standard normal CDF.
    
    Parameters
    ----------
    u3 : float
        Cohen's U3 (0 to 1).
    
    Returns
    -------
    float
        Cohen's d.
    
    Example
    -------
    >>> cohens_u3_to_d(0.788)  # approximately 0.8
    """
    if u3 <= 0 or u3 >= 1:
        raise ValueError("u3 must be between 0 and 1 (exclusive)")
    return stats.norm.ppf(u3)


def e2p_parametric_binary(
    cohens_d: float,
    base_rate: float,
    threshold_prob: float = 0.5,
    icc1: float = 1.0,
    icc2: float = 1.0,
    kappa: float = 1.0,
    view: Literal['true', 'observed'] = 'observed',
) -> ParametricResults:
    """
    Compute E2P metrics from Cohen's d assuming idealized normal distributions.
    
    This is the main entry point for parametric binary outcome analysis,
    mirroring the JavaScript simulator's binary mode functionality.
    
    Parameters
    ----------
    cohens_d : float
        True Cohen's d (standardized mean difference between groups).
    base_rate : float
        Real-world prevalence of the positive class (0-1).
    threshold_prob : float
        Threshold probability p_t for computing threshold-dependent metrics (0-1).
        Default 0.5.
    icc1 : float
        Measurement reliability (ICC) for group 1. Default 1.0 (perfect).
    icc2 : float
        Measurement reliability (ICC) for group 2. Default 1.0 (perfect).
    kappa : float
        Diagnostic/label reliability. Default 1.0 (perfect).
    view : {'true', 'observed'}
        Whether to compute metrics for 'true' (latent) or 'observed' distributions.
        Default 'observed'.
    
    Returns
    -------
    ParametricResults
        Dataclass containing all computed metrics.
    
    Example
    -------
    >>> results = e2p_parametric_binary(cohens_d=0.8, base_rate=0.1, threshold_prob=0.5)
    >>> print(f"ROC-AUC: {results.roc_auc:.3f}")
    >>> print(f"Sensitivity: {results.sensitivity:.3f}")
    >>> print(f"PPV: {results.ppv:.3f}")
    """
    # Validate inputs
    if not 0 < base_rate < 1:
        raise ValueError("base_rate must be between 0 and 1 (exclusive)")
    if not 0 < threshold_prob < 1:
        raise ValueError("threshold_prob must be between 0 and 1 (exclusive)")
    if not 0 < icc1 <= 1:
        raise ValueError("icc1 must be in (0, 1]")
    if not 0 < icc2 <= 1:
        raise ValueError("icc2 must be in (0, 1]")
    if not 0 < kappa <= 1:
        raise ValueError("kappa must be in (0, 1]")
    
    # Compute observed d (attenuated by kappa)
    d_observed = attenuate_d(cohens_d, kappa)
    
    # Compute standard deviations based on ICC
    sigma1 = 1.0 if view == 'true' else compute_sigma_from_icc(icc1)
    sigma2 = 1.0 if view == 'true' else compute_sigma_from_icc(icc2)
    
    # Use appropriate d based on view
    d_eff = cohens_d if view == 'true' else d_observed
    
    # Find threshold from threshold_prob
    threshold_value = compute_threshold_from_pt(d_eff, threshold_prob, base_rate, sigma1, sigma2)
    
    # Compute all metrics
    metrics = compute_binary_metrics(d_eff, base_rate, threshold_value, sigma1, sigma2)
    
    # Compute discrimination metrics
    roc_auc = compute_roc_auc_parametric(d_eff, sigma1, sigma2)
    pr_auc = compute_pr_auc_parametric(d_eff, base_rate, sigma1, sigma2)
    
    # Compute effect size conversions
    odds_ratio = d_to_odds_ratio(d_eff)
    log_odds_ratio = d_to_log_odds_ratio(d_eff)
    cohens_u3 = d_to_cohens_u3(d_eff)
    pb_r = d_to_point_biserial_r(d_eff, base_rate)
    eta_squared = pb_r ** 2
    
    return ParametricResults(
        cohens_d_true=cohens_d,
        cohens_d_observed=d_observed,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        icc1=icc1,
        icc2=icc2,
        kappa=kappa,
        odds_ratio=odds_ratio,
        log_odds_ratio=log_odds_ratio,
        cohens_u3=cohens_u3,
        point_biserial_r=pb_r,
        eta_squared=eta_squared,
        roc_auc=roc_auc,
        pr_auc=pr_auc,
        threshold_value=threshold_value,
        sensitivity=metrics['sensitivity'],
        specificity=metrics['specificity'],
        ppv=metrics['ppv'],
        npv=metrics['npv'],
        accuracy=metrics['accuracy'],
        balanced_accuracy=metrics['balanced_accuracy'],
        f1=metrics['f1'],
        mcc=metrics['mcc'],
        lr_plus=metrics['lr_plus'],
        lr_minus=metrics['lr_minus'],
        dor=metrics['dor'],
        youden_j=metrics['youden_j'],
        g_mean=metrics['g_mean'],
        kappa_statistic=metrics['kappa'],
        post_test_prob_plus=metrics['post_test_prob_plus'],
        post_test_prob_minus=metrics['post_test_prob_minus'],
        delta_nb=metrics['delta_nb'],
    )


def e2p_parametric_continuous(
    pearson_r: float,
    base_rate: float,
    threshold_prob: float = 0.5,
    reliability_x: float = 1.0,
    reliability_y: float = 1.0,
    view: Literal['true', 'observed'] = 'observed',
) -> ParametricResults:
    """
    Compute E2P metrics from Pearson's r assuming idealized normal distributions.
    
    This mirrors the JavaScript simulator's continuous mode. The continuous outcome Y
    is dichotomized at the base_rate percentile, then binary metrics are computed.
    
    Parameters
    ----------
    pearson_r : float
        True Pearson correlation between predictor X and outcome Y.
    base_rate : float
        Proportion of cases (top base_rate of Y are classified as positive).
    threshold_prob : float
        Threshold probability p_t for computing threshold-dependent metrics (0-1).
        Default 0.5.
    reliability_x : float
        Measurement reliability of predictor X. Default 1.0 (perfect).
    reliability_y : float
        Measurement reliability of outcome Y. Default 1.0 (perfect).
    view : {'true', 'observed'}
        Whether to compute metrics for 'true' (latent) or 'observed' distributions.
        Default 'observed'.
    
    Returns
    -------
    ParametricResults
        Dataclass containing all computed metrics.
    
    Example
    -------
    >>> results = e2p_parametric_continuous(pearson_r=0.5, base_rate=0.1)
    >>> print(f"ROC-AUC: {results.roc_auc:.3f}")
    """
    # Validate inputs
    if not -1 < pearson_r < 1:
        raise ValueError("pearson_r must be between -1 and 1 (exclusive)")
    if not 0 < base_rate < 1:
        raise ValueError("base_rate must be between 0 and 1 (exclusive)")
    if not 0 < threshold_prob < 1:
        raise ValueError("threshold_prob must be between 0 and 1 (exclusive)")
    if not 0 < reliability_x <= 1:
        raise ValueError("reliability_x must be in (0, 1]")
    if not 0 < reliability_y <= 1:
        raise ValueError("reliability_y must be in (0, 1]")
    
    # Compute observed r (attenuated by reliabilities)
    r_observed = pearson_r * np.sqrt(reliability_x * reliability_y)
    
    # Use appropriate r based on view
    r_eff = pearson_r if view == 'true' else r_observed
    
    # Convert r to Cohen's d for the dichotomized outcome
    # This is an approximation that works well for continuous-to-binary conversion
    d_eff = r_to_d(r_eff)
    
    # For continuous mode, ICC adjustments don't apply the same way
    # The separation comes from the correlation itself
    sigma1 = 1.0
    sigma2 = 1.0
    
    # Find threshold from threshold_prob
    threshold_value = compute_threshold_from_pt(d_eff, threshold_prob, base_rate, sigma1, sigma2)
    
    # Compute all metrics
    metrics = compute_binary_metrics(d_eff, base_rate, threshold_value, sigma1, sigma2)
    
    # Compute discrimination metrics
    roc_auc = compute_roc_auc_parametric(d_eff, sigma1, sigma2)
    pr_auc = compute_pr_auc_parametric(d_eff, base_rate, sigma1, sigma2)
    
    # Compute effect size conversions
    odds_ratio = d_to_odds_ratio(d_eff)
    log_odds_ratio = d_to_log_odds_ratio(d_eff)
    cohens_u3 = d_to_cohens_u3(d_eff)
    pb_r = d_to_point_biserial_r(d_eff, base_rate)
    eta_squared = pb_r ** 2
    
    # Convert back to d for results
    d_true = r_to_d(pearson_r)
    d_observed = r_to_d(r_observed)
    
    return ParametricResults(
        cohens_d_true=d_true,
        cohens_d_observed=d_observed,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        icc1=reliability_x,
        icc2=reliability_y,
        kappa=1.0,  # No kappa concept in continuous mode
        odds_ratio=odds_ratio,
        log_odds_ratio=log_odds_ratio,
        cohens_u3=cohens_u3,
        point_biserial_r=pb_r,
        eta_squared=eta_squared,
        roc_auc=roc_auc,
        pr_auc=pr_auc,
        threshold_value=threshold_value,
        sensitivity=metrics['sensitivity'],
        specificity=metrics['specificity'],
        ppv=metrics['ppv'],
        npv=metrics['npv'],
        accuracy=metrics['accuracy'],
        balanced_accuracy=metrics['balanced_accuracy'],
        f1=metrics['f1'],
        mcc=metrics['mcc'],
        lr_plus=metrics['lr_plus'],
        lr_minus=metrics['lr_minus'],
        dor=metrics['dor'],
        youden_j=metrics['youden_j'],
        g_mean=metrics['g_mean'],
        kappa_statistic=metrics['kappa'],
        post_test_prob_plus=metrics['post_test_prob_plus'],
        post_test_prob_minus=metrics['post_test_prob_minus'],
        delta_nb=metrics['delta_nb'],
    )
