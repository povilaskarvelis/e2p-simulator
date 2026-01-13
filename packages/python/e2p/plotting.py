"""
Plotting functions for e2p.
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
from typing import Tuple

from .core import BinaryResults


def compute_dca_curve(group1: np.ndarray, group2: np.ndarray, 
                      prevalence: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Compute Decision Curve Analysis data.
    
    Returns threshold probabilities, model net benefit, and treat-all net benefit.
    """
    # Threshold probabilities to evaluate
    pt_values = np.linspace(0.01, 0.99, 100)
    
    model_nb = []
    treat_all_nb = []
    
    for pt in pt_values:
        # Compute sensitivity and specificity at this threshold
        # Need to find the measurement threshold corresponding to this pt
        from .utils import convert_pt_to_threshold
        
        try:
            thresh = convert_pt_to_threshold(group1, group2, prevalence, pt)
            sens = np.mean(group2 >= thresh)
            spec = np.mean(group1 < thresh)
        except:
            sens = 0
            spec = 1
        
        # Net benefit for model
        # NB = sens * prevalence - (1 - spec) * (1 - prevalence) * (pt / (1 - pt))
        if pt < 1:
            nb = sens * prevalence - (1 - spec) * (1 - prevalence) * (pt / (1 - pt))
        else:
            nb = 0
        model_nb.append(nb)
        
        # Net benefit for treat all
        # NB_all = prevalence - (1 - prevalence) * (pt / (1 - pt))
        if pt < 1:
            nb_all = prevalence - (1 - prevalence) * (pt / (1 - pt))
        else:
            nb_all = 0
        treat_all_nb.append(nb_all)
    
    return pt_values, np.array(model_nb), np.array(treat_all_nb)


def plot_binary(group1: np.ndarray, group2: np.ndarray, 
                base_rate: float, threshold_prob: float,
                results: BinaryResults = None,
                threshold: float = None,
                figsize: Tuple[float, float] = (16, 9),
                group1_label: str = "Group 1 (Controls)",
                group2_label: str = "Group 2 (Cases)",
                figure_title_prefix: str | None = None) -> plt.Figure:
    """
    Plot 3x2 panel figure for binary classification:
    - Row 1: Empirical distributions, ROC curve
    - Row 2: Scaled distributions, PR curve
    - Row 3: Empirical DCA, Real-world DCA
    
    Parameters
    ----------
    group1 : np.ndarray
        Measurements from group 1.
    group2 : np.ndarray
        Measurements from group 2.
    base_rate : float
        Real-world prevalence.
    threshold_prob : float
        Threshold probability (p_t).
    results : BinaryResults, optional
        Pre-computed results for metrics display.
    threshold : float, optional
        Threshold value on measurement scale.
    figsize : tuple, optional
        Figure size.
    group1_label : str
        Label for group 1.
    group2_label : str
        Label for group 2.
    
    Returns
    -------
    matplotlib.figure.Figure
    """
    from .utils import (compute_cohens_d, compute_roc_auc, compute_pr_auc,
                       compute_threshold_metrics, convert_pt_to_threshold,
                       compute_roc_curve, compute_pr_curve)
    
    # Compute empirical base rate from data
    empirical_base_rate = len(group2) / (len(group1) + len(group2))
    
    # Compute TWO thresholds - one for each base rate
    # p_t maps to different x values depending on prevalence
    threshold_rw = convert_pt_to_threshold(group1, group2, base_rate, threshold_prob)
    threshold_emp = convert_pt_to_threshold(group1, group2, empirical_base_rate, threshold_prob)
    
    if results is not None:
        # Use pre-computed metrics for real-world
        sens = results.sensitivity.estimate
        spec = results.specificity.estimate
        ppv = results.ppv.estimate
        npv = results.npv.estimate
        auc = results.roc_auc.estimate
        pr_auc = results.pr_auc.estimate
        d = results.cohens_d.estimate
        delta_nb = results.delta_nb.estimate
    else:
        # Compute real-world metrics at real-world threshold
        rw_metrics = compute_threshold_metrics(group1, group2, threshold_rw, base_rate, threshold_prob)
        sens = rw_metrics['sensitivity']
        spec = rw_metrics['specificity']
        ppv = rw_metrics['ppv']
        npv = rw_metrics['npv']
        delta_nb = rw_metrics['delta_nb']
        auc = compute_roc_auc(group1, group2)
        pr_auc = compute_pr_auc(group1, group2, base_rate)
        d = compute_cohens_d(group1, group2)
    
    # Compute metrics with empirical base rate at EMPIRICAL threshold
    emp_metrics = compute_threshold_metrics(group1, group2, threshold_emp, empirical_base_rate, threshold_prob)
    emp_pr_auc = compute_pr_auc(group1, group2, empirical_base_rate)
    
    # Compute curves
    fprs, tprs, _ = compute_roc_curve(group1, group2)
    precisions, recalls, _ = compute_pr_curve(group1, group2, base_rate)
    
    # Compute DCA curves
    dca_pt_emp, dca_nb_emp, dca_all_emp = compute_dca_curve(group1, group2, empirical_base_rate)
    dca_pt_rw, dca_nb_rw, dca_all_rw = compute_dca_curve(group1, group2, base_rate)
    
    fig, axes = plt.subplots(2, 3, figsize=figsize)
    ax1, ax2, ax3 = axes[0]  # Row 1: Empirical distributions, ROC, Empirical DCA
    ax4, ax5, ax6 = axes[1]  # Row 2: Scaled distributions, PR, Real-world DCA

    if figure_title_prefix:
        fig.suptitle(str(figure_title_prefix), fontsize=14, fontweight="bold")
    
    # Determine bin edges and compute KDE for smooth curves
    all_data = np.concatenate([group1, group2])
    x_range = np.linspace(np.min(all_data) - 0.5, np.max(all_data) + 0.5, 200)
    bins = np.linspace(np.min(all_data), np.max(all_data), 40)
    
    # Compute KDEs
    kde1 = stats.gaussian_kde(group1)
    kde2 = stats.gaussian_kde(group2)
    density1 = kde1(x_range)
    density2 = kde2(x_range)
    
    # =========================================================================
    # Row 1, Left: Empirical densities
    # =========================================================================
    ax1.hist(group1, bins=bins, alpha=0.3, color='gray', density=True)
    ax1.hist(group2, bins=bins, alpha=0.3, color='teal', density=True)
    ax1.plot(x_range, density1, color='gray', linewidth=2, label=group1_label)
    ax1.plot(x_range, density2, color='teal', linewidth=2, label=group2_label)
    
    ax1.axvline(x=threshold_emp, color='red', linestyle='-', linewidth=2, 
                label=f'Threshold')
    
    ax1.set_xlabel('Measurement Value', fontsize=11)
    ax1.set_ylabel('Density', fontsize=11)
    ax1.set_title(f'Empirical Distributions (n₁={len(group1)}, n₂={len(group2)})', fontsize=12)
    ax1.set_ylim(bottom=0)
    ax1.legend(loc='upper left', fontsize=9)
    
    # Add empirical metrics text box
    emp_metrics_text = (
        f"Empirical prev = {empirical_base_rate:.1%}\n"
        f"─────────────\n"
        f"Cohen's d = {d:.3f}\n"
        f"─────────────\n"
        f"At threshold:\n"
        f"  Sens = {emp_metrics['sensitivity']:.3f}\n"
        f"  Spec = {emp_metrics['specificity']:.3f}\n"
        f"  PPV = {emp_metrics['ppv']:.3f}\n"
        f"  NPV = {emp_metrics['npv']:.3f}"
    )
    
    props = dict(boxstyle='round', facecolor='white', alpha=0.9)
    ax1.text(0.98, 0.98, emp_metrics_text, transform=ax1.transAxes, fontsize=9,
             verticalalignment='top', horizontalalignment='right', 
             bbox=props, family='monospace')
    
    # =========================================================================
    # Row 1, Middle: ROC curve (operating point at empirical threshold)
    # =========================================================================
    ax2.plot(fprs, tprs, color='#404040', linewidth=2)
    ax2.plot([0, 1], [0, 1], 'k--', linewidth=1, alpha=0.5)
    
    # Mark operating point at empirical threshold
    ax2.scatter([1 - emp_metrics['specificity']], [emp_metrics['sensitivity']], 
                color='red', s=50, zorder=5)
    
    ax2.set_xlabel('False Positive Rate (1 - Specificity)', fontsize=11)
    ax2.set_ylabel('True Positive Rate (Sensitivity)', fontsize=11)
    ax2.set_title(f'ROC Curve (AUC = {auc:.3f})', fontsize=12)
    ax2.set_xlim(-0.02, 1.02)
    ax2.set_ylim(-0.02, 1.02)
    
    # =========================================================================
    # Row 1, Right: Empirical DCA
    # =========================================================================
    ax3.plot(dca_pt_emp, dca_nb_emp, color='#404040', linewidth=2, label='Model')
    ax3.plot(dca_pt_emp, dca_all_emp, color='gray', linewidth=2, linestyle='--', label='Treat All')
    ax3.axhline(y=0, color='black', linewidth=1, linestyle=':', label='Treat None')
    
    # Mark operating point
    ax3.scatter([threshold_prob], [emp_metrics['delta_nb'] + max(0, empirical_base_rate - (1 - empirical_base_rate) * (threshold_prob / (1 - threshold_prob)))], 
                color='red', s=50, zorder=5, label=f'p_t={threshold_prob:.2f}')
    
    ax3.set_xlabel('Threshold Probability', fontsize=11)
    ax3.set_ylabel('Net Benefit', fontsize=11)
    ax3.set_title(f'Decision Curve (Empirical, prev={empirical_base_rate:.1%})', fontsize=12)
    ax3.set_xlim(0, 1)
    # Set y limits: bottom just below 0, top based on max NB with margin
    y_max_emp = max(np.max(dca_nb_emp), empirical_base_rate) * 1.1
    ax3.set_ylim(bottom=-0.05, top=y_max_emp)
    ax3.legend(loc='upper right', fontsize=9)
    
    # Add Delta NB annotation
    props = dict(boxstyle='round', facecolor='white', alpha=0.9)
    ax3.text(0.02, 0.98, f"ΔNB = {emp_metrics['delta_nb']:.4f}", transform=ax3.transAxes, fontsize=10,
             verticalalignment='top', horizontalalignment='left', bbox=props, family='monospace')
    
    # =========================================================================
    # Row 2, Left: Densities scaled to base rate
    # =========================================================================
    density1_scaled = density1 * (1 - base_rate)
    density2_scaled = density2 * base_rate
    
    ax4.fill_between(x_range, density1_scaled, alpha=0.4, color='gray', label=group1_label)
    ax4.fill_between(x_range, density2_scaled, alpha=0.4, color='teal', label=group2_label)
    ax4.plot(x_range, density1_scaled, color='gray', linewidth=2)
    ax4.plot(x_range, density2_scaled, color='teal', linewidth=2)
    
    ax4.axvline(x=threshold_rw, color='red', linestyle='-', linewidth=2,
                label=f'Threshold')
    
    ax4.set_xlabel('Measurement Value', fontsize=11)
    ax4.set_ylabel('Density (scaled)', fontsize=11)
    ax4.set_title(f'Scaled to Real-World Base Rate = {base_rate:.1%}', fontsize=12)
    ax4.set_ylim(bottom=0)
    
    # Add real-world metrics text box
    metrics_text = (
        f"Real-world prev = {base_rate:.1%}\n"
        f"─────────────\n"
        f"Cohen's d = {d:.3f}\n"
        f"─────────────\n"
        f"At threshold:\n"
        f"  Sens = {sens:.3f}\n"
        f"  Spec = {spec:.3f}\n"
        f"  PPV = {ppv:.3f}\n"
        f"  NPV = {npv:.3f}"
    )
    
    props = dict(boxstyle='round', facecolor='white', alpha=0.9)
    ax4.text(0.98, 0.98, metrics_text, transform=ax4.transAxes, fontsize=9,
             verticalalignment='top', horizontalalignment='right', 
             bbox=props, family='monospace')
    
    # =========================================================================
    # Row 2, Middle: PR curve (Real-World)
    # =========================================================================
    ax5.plot(recalls, precisions, color='#404040', linewidth=2)
    ax5.axhline(y=base_rate, color='k', linestyle='--', linewidth=1, alpha=0.5)
    
    # Mark operating point
    ax5.scatter([sens], [ppv], color='red', s=50, zorder=5)
    
    ax5.set_xlabel('Recall (Sensitivity)', fontsize=11)
    ax5.set_ylabel('Precision (PPV)', fontsize=11)
    ax5.set_title(f'PR Curve (AUC = {pr_auc:.3f})', fontsize=12)
    ax5.set_xlim(-0.02, 1.02)
    ax5.set_ylim(-0.02, 1.02)
    
    # =========================================================================
    # Row 2, Right: Real-world DCA
    # =========================================================================
    ax6.plot(dca_pt_rw, dca_nb_rw, color='#404040', linewidth=2, label='Model')
    ax6.plot(dca_pt_rw, dca_all_rw, color='gray', linewidth=2, linestyle='--', label='Treat All')
    ax6.axhline(y=0, color='black', linewidth=1, linestyle=':', label='Treat None')
    
    # Mark operating point
    ax6.scatter([threshold_prob], [delta_nb + max(0, base_rate - (1 - base_rate) * (threshold_prob / (1 - threshold_prob)))], 
                color='red', s=50, zorder=5, label=f'p_t={threshold_prob:.2f}')
    
    ax6.set_xlabel('Threshold Probability', fontsize=11)
    ax6.set_ylabel('Net Benefit', fontsize=11)
    ax6.set_title(f'Decision Curve (Real-World, prev={base_rate:.1%})', fontsize=12)
    ax6.set_xlim(0, 1)
    # Set y limits: bottom just below 0, top based on max NB with margin
    y_max_rw = max(np.max(dca_nb_rw), base_rate) * 1.1
    ax6.set_ylim(bottom=-0.05, top=y_max_rw)
    ax6.legend(loc='upper right', fontsize=9)
    
    # Add Delta NB annotation
    props = dict(boxstyle='round', facecolor='white', alpha=0.9)
    ax6.text(0.02, 0.98, f"ΔNB = {delta_nb:.4f}", transform=ax6.transAxes, fontsize=10,
             verticalalignment='top', horizontalalignment='left', bbox=props, family='monospace')
    
    if figure_title_prefix:
        fig.tight_layout(rect=[0, 0, 1, 0.95])
    else:
        fig.tight_layout()
    return fig


def plot_continuous(X: np.ndarray, Y: np.ndarray,
                    base_rate: float, threshold_prob: float,
                    y_threshold: float, is_case: np.ndarray,
                    group1: np.ndarray, group2: np.ndarray,
                    results: BinaryResults = None,
                    figsize: Tuple[float, float] = (16, 9),
                    x_label: str = "Predictor (X)",
                    y_label: str = "Outcome (Y)",
                    figure_title_prefix: str | None = None) -> plt.Figure:
    """
    Plot 2x3 panel figure for continuous prediction:
    - Row 1: Scatterplot, ROC curve, DCA
    - Row 2: Density distributions, PR curve, Metrics summary
    
    Parameters
    ----------
    X : np.ndarray
        Predictor values.
    Y : np.ndarray
        Outcome values.
    base_rate : float
        Real-world prevalence.
    threshold_prob : float
        Threshold probability.
    y_threshold : float
        Y threshold for dichotomization.
    is_case : np.ndarray
        Boolean array indicating cases.
    group1 : np.ndarray
        X values for controls.
    group2 : np.ndarray
        X values for cases.
    results : BinaryResults, optional
        Pre-computed results.
    figsize : tuple
        Figure size.
    x_label : str
        X axis label.
    y_label : str
        Y axis label.
    
    Returns
    -------
    matplotlib.figure.Figure
    """
    from .utils import (compute_cohens_d, compute_roc_auc, compute_pr_auc,
                       compute_threshold_metrics, convert_pt_to_threshold,
                       compute_roc_curve, compute_pr_curve)
    
    if results is not None:
        x_threshold = results.threshold_value
        sens = results.sensitivity.estimate
        spec = results.specificity.estimate
        ppv = results.ppv.estimate
        npv = results.npv.estimate
        auc = results.roc_auc.estimate
        pr_auc = results.pr_auc.estimate
        d = results.cohens_d.estimate
        delta_nb = results.delta_nb.estimate
    else:
        x_threshold = convert_pt_to_threshold(group1, group2, base_rate, threshold_prob)
        metrics = compute_threshold_metrics(group1, group2, x_threshold, base_rate, threshold_prob)
        sens = metrics['sensitivity']
        spec = metrics['specificity']
        ppv = metrics['ppv']
        npv = metrics['npv']
        delta_nb = metrics['delta_nb']
        auc = compute_roc_auc(group1, group2)
        pr_auc = compute_pr_auc(group1, group2, base_rate)
        d = compute_cohens_d(group1, group2)
    
    # Compute curves
    fprs, tprs, _ = compute_roc_curve(group1, group2)
    precisions, recalls, _ = compute_pr_curve(group1, group2, base_rate)
    
    # Compute DCA curve
    dca_pt, dca_nb, dca_all = compute_dca_curve(group1, group2, base_rate)
    
    fig, axes = plt.subplots(2, 3, figsize=figsize)
    ax1, ax2, ax3 = axes[0]  # Row 1: Scatterplot, ROC, DCA
    ax4, ax5, ax6 = axes[1]  # Row 2: Distributions, PR, Metrics

    if figure_title_prefix:
        fig.suptitle(str(figure_title_prefix), fontsize=14, fontweight="bold")
    
    # =========================================================================
    # Row 1, Left: Scatterplot of X vs Y
    # =========================================================================
    controls_mask = ~is_case
    cases_mask = is_case
    
    ax1.scatter(X[controls_mask], Y[controls_mask], alpha=0.5, c='gray', 
                label='Controls', s=30)
    ax1.scatter(X[cases_mask], Y[cases_mask], alpha=0.5, c='teal', 
                label='Cases', s=30)
    
    ax1.axhline(y=y_threshold, color='black', linestyle='--', linewidth=1.5,
                label=f'Y threshold (top {base_rate:.0%})')
    ax1.axvline(x=x_threshold, color='red', linestyle='-', linewidth=2,
                label=f'X threshold')
    
    ax1.set_xlabel(x_label, fontsize=11)
    ax1.set_ylabel(y_label, fontsize=11)
    ax1.set_title(f'Predictor vs Outcome (n={len(X)})', fontsize=12)
    ax1.legend(loc='lower right', fontsize=9)
    
    # Compute and display Pearson's r and R²
    r_pearson, _ = stats.pearsonr(X, Y)
    r_squared = r_pearson ** 2
    
    corr_text = (
        f"Pearson r = {r_pearson:.3f}\n"
        f"R² = {r_squared:.3f}"
    )
    
    props = dict(boxstyle='round', facecolor='white', alpha=0.9)
    ax1.text(0.02, 0.98, corr_text, transform=ax1.transAxes, fontsize=10,
             verticalalignment='top', horizontalalignment='left', 
             bbox=props, family='monospace')
    
    # =========================================================================
    # Row 1, Right: ROC curve
    # =========================================================================
    ax2.plot(fprs, tprs, color='#404040', linewidth=2)
    ax2.plot([0, 1], [0, 1], 'k--', linewidth=1, alpha=0.5)
    
    # Mark operating point
    ax2.scatter([1 - spec], [sens], color='red', s=50, zorder=5)
    
    ax2.set_xlabel('False Positive Rate (1 - Specificity)', fontsize=11)
    ax2.set_ylabel('True Positive Rate (Sensitivity)', fontsize=11)
    ax2.set_title(f'ROC Curve (AUC = {auc:.3f})', fontsize=12)
    ax2.set_xlim(-0.02, 1.02)
    ax2.set_ylim(-0.02, 1.02)
    
    # =========================================================================
    # Row 1, Right: DCA curve
    # =========================================================================
    ax3.plot(dca_pt, dca_nb, color='#404040', linewidth=2, label='Model')
    ax3.plot(dca_pt, dca_all, color='gray', linewidth=2, linestyle='--', label='Treat All')
    ax3.axhline(y=0, color='black', linewidth=1, linestyle=':', label='Treat None')
    
    # Mark operating point
    ax3.scatter([threshold_prob], [delta_nb + max(0, base_rate - (1 - base_rate) * (threshold_prob / (1 - threshold_prob)))], 
                color='red', s=50, zorder=5, label=f'p_t={threshold_prob:.2f}')
    
    ax3.set_xlabel('Threshold Probability', fontsize=11)
    ax3.set_ylabel('Net Benefit', fontsize=11)
    ax3.set_title(f'Decision Curve (Base Rate = {base_rate:.1%})', fontsize=12)
    ax3.set_xlim(0, 1)
    # Set y limits: bottom just below 0, top based on max NB with margin
    y_max = max(np.max(dca_nb), base_rate) * 1.1
    ax3.set_ylim(bottom=-0.05, top=y_max)
    ax3.legend(loc='upper right', fontsize=9)
    
    # Add Delta NB annotation
    props = dict(boxstyle='round', facecolor='white', alpha=0.9)
    ax3.text(0.02, 0.98, f"ΔNB = {delta_nb:.4f}", transform=ax3.transAxes, fontsize=10,
             verticalalignment='top', horizontalalignment='left', bbox=props, family='monospace')
    
    # =========================================================================
    # Row 2, Left: Density distributions of X
    # =========================================================================
    x_range_density = np.linspace(np.min(X) - 0.5, np.max(X) + 0.5, 200)
    
    # Compute KDEs
    kde1 = stats.gaussian_kde(group1)
    kde2 = stats.gaussian_kde(group2)
    density1 = kde1(x_range_density)
    density2 = kde2(x_range_density)
    
    # Rescale to base rate
    density1_scaled = density1 * (1 - base_rate)
    density2_scaled = density2 * base_rate
    
    ax4.fill_between(x_range_density, density1_scaled, alpha=0.4, color='gray', label='Controls')
    ax4.fill_between(x_range_density, density2_scaled, alpha=0.4, color='teal', label='Cases')
    ax4.plot(x_range_density, density1_scaled, color='gray', linewidth=2)
    ax4.plot(x_range_density, density2_scaled, color='teal', linewidth=2)
    
    ax4.axvline(x=x_threshold, color='red', linestyle='-', linewidth=2,
                label=f'Threshold')
    
    ax4.set_xlabel(x_label, fontsize=11)
    ax4.set_ylabel('Density (scaled)', fontsize=11)
    ax4.set_title(f'Predictor Distributions (Base Rate = {base_rate:.1%})', fontsize=12)
    ax4.set_ylim(bottom=0)
    
    # Add metrics text box to distributions panel
    metrics_text = (
        f"Real-world prev = {base_rate:.1%}\n"
        f"─────────────\n"
        f"Cohen's d = {d:.3f}\n"
        f"─────────────\n"
        f"At threshold:\n"
        f"  Sens = {sens:.3f}\n"
        f"  Spec = {spec:.3f}\n"
        f"  PPV = {ppv:.3f}\n"
        f"  NPV = {npv:.3f}"
    )
    
    props = dict(boxstyle='round', facecolor='white', alpha=0.9)
    ax4.text(0.98, 0.98, metrics_text, transform=ax4.transAxes, fontsize=9,
             verticalalignment='top', horizontalalignment='right', 
             bbox=props, family='monospace')
    
    # =========================================================================
    # Row 2, Middle: PR curve
    # =========================================================================
    ax5.plot(recalls, precisions, color='#404040', linewidth=2)
    ax5.axhline(y=base_rate, color='k', linestyle='--', linewidth=1, alpha=0.5)
    
    # Mark operating point
    ax5.scatter([sens], [ppv], color='red', s=50, zorder=5)
    
    ax5.set_xlabel('Recall (Sensitivity)', fontsize=11)
    ax5.set_ylabel('Precision (PPV)', fontsize=11)
    ax5.set_title(f'PR Curve (AUC = {pr_auc:.3f})', fontsize=12)
    ax5.set_xlim(-0.02, 1.02)
    ax5.set_ylim(-0.02, 1.02)
    
    # =========================================================================
    # Row 2, Right: Correlation info
    # =========================================================================
    ax6.axis('off')
    
    # Add correlation and effect size summary
    summary_text = (
        f"Correlation Summary\n"
        f"{'═' * 25}\n\n"
        f"Pearson r = {r_pearson:.3f}\n"
        f"R² = {r_squared:.3f}\n\n"
        f"After Dichotomization:\n"
        f"Cohen's d = {d:.3f}\n"
        f"ROC-AUC = {auc:.3f}"
    )
    
    ax6.text(0.1, 0.9, summary_text, transform=ax6.transAxes, fontsize=11,
             verticalalignment='top', horizontalalignment='left',
             family='monospace',
             bbox=dict(boxstyle='round', facecolor='lightgray', alpha=0.3))
    
    if figure_title_prefix:
        fig.tight_layout(rect=[0, 0, 1, 0.95])
    else:
        fig.tight_layout()
    return fig


def plot_binary_deattenuated(
    group1: np.ndarray,
    group2: np.ndarray,
    base_rate: float,
    threshold_prob: float,
    *,
    r_current: float,
    r_target: float = 1.0,
    kappa_current: float | None = None,
    kappa_target: float = 1.0,
    per_group: bool = False,
    r1_current: float | None = None,
    r2_current: float | None = None,
    r1_target: float | None = None,
    r2_target: float | None = None,
    center: str = "mean",
    n_bootstrap: int = 0,
    ci_level: float = 0.95,
    random_state: int | None = None,
    figsize: Tuple[float, float] = (16, 9),
    group1_label: str = "Group 1 (Controls)",
    group2_label: str = "Group 2 (Cases)",
) -> plt.Figure:
    """
    Plot the same binary panels after applying a reliability transformation.

    Returns a fresh matplotlib Figure (i.e., a separate window when shown).
    """
    from .binary import E2PBinary
    from .utils import transform_for_target_reliability, transform_groups_for_target_kappa

    g1 = np.asarray(group1, dtype=float)
    g2 = np.asarray(group2, dtype=float)

    if per_group:
        if None in (r1_current, r2_current, r1_target, r2_target):
            raise ValueError(
                "When per_group=True, provide r1_current, r2_current, r1_target, r2_target"
            )
        g1_tgt = transform_for_target_reliability(g1, r1_current, r1_target, center=center)
        g2_tgt = transform_for_target_reliability(g2, r2_current, r2_target, center=center)
        icc_title = f"ICC g1 {r1_current:.2f}→{r1_target:.2f}, ICC g2 {r2_current:.2f}→{r2_target:.2f}"
    else:
        g1_tgt = transform_for_target_reliability(g1, r_current, r_target, center=center)
        g2_tgt = transform_for_target_reliability(g2, r_current, r_target, center=center)
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
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        n_bootstrap=n_bootstrap,
        ci_level=ci_level,
        random_state=random_state,
    ).compute()

    return plot_binary(
        g1_tgt,
        g2_tgt,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        results=results,
        figsize=figsize,
        group1_label=group1_label,
        group2_label=group2_label,
        figure_title_prefix=title,
    )


def plot_continuous_deattenuated(
    X: np.ndarray,
    Y: np.ndarray,
    base_rate: float,
    threshold_prob: float,
    *,
    r_x_current: float,
    r_x_target: float = 1.0,
    r_y_current: float | None = None,
    r_y_target: float | None = None,
    center: str = "mean",
    n_bootstrap: int = 0,
    ci_level: float = 0.95,
    random_state: int | None = None,
    figsize: Tuple[float, float] = (16, 9),
    x_label: str = "Predictor (X)",
    y_label: str = "Outcome (Y)",
) -> plt.Figure:
    """
    Plot the same continuous panels after applying reliability transformation.

    Keeps the original case/control split fixed (based on observed Y).
    Returns a fresh matplotlib Figure (i.e., a separate window when shown).
    """
    from .continuous import E2PContinuous
    from .binary import E2PBinary
    from .utils import transform_for_target_reliability

    X = np.asarray(X, dtype=float)
    Y = np.asarray(Y, dtype=float)

    X_tgt = transform_for_target_reliability(X, r_x_current, r_x_target, center=center)

    if (r_y_current is None) ^ (r_y_target is None):
        raise ValueError("Provide both r_y_current and r_y_target, or neither")
    Y_tgt = (
        transform_for_target_reliability(Y, r_y_current, r_y_target, center=center)
        if (r_y_current is not None and r_y_target is not None)
        else Y
    )

    calc = E2PContinuous(
        X=X,
        Y=Y,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        n_bootstrap=n_bootstrap,
        ci_level=ci_level,
        random_state=random_state,
    )
    # fixed split from observed Y
    group1_tgt = X_tgt[~calc.is_case]
    group2_tgt = X_tgt[calc.is_case]

    results = E2PBinary(
        group1=group1_tgt,
        group2=group2_tgt,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        n_bootstrap=n_bootstrap,
        ci_level=ci_level,
        random_state=random_state,
    ).compute()

    title_bits = [f"Deattenuated (X reliability: {r_x_current:.2f}→{r_x_target:.2f}"]
    if r_y_current is not None and r_y_target is not None:
        title_bits.append(f", Y reliability: {r_y_current:.2f}→{r_y_target:.2f}")
    title_bits.append("; fixed split)")
    title = "".join(title_bits)

    return plot_continuous(
        X=X_tgt,
        Y=Y_tgt,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        y_threshold=calc.y_threshold,
        is_case=calc.is_case,
        group1=group1_tgt,
        group2=group2_tgt,
        results=results,
        figsize=figsize,
        x_label=x_label,
        y_label=y_label,
        figure_title_prefix=title,
    )
