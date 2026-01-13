"""
Plotting functions for e2p.
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import Tuple

from .core import BinaryResults


def plot_binary(group1: np.ndarray, group2: np.ndarray, 
                base_rate: float, threshold_prob: float,
                results: BinaryResults = None,
                threshold: float = None,
                figsize: Tuple[float, float] = (10, 6),
                group1_label: str = "Group 1 (Controls)",
                group2_label: str = "Group 2 (Cases)") -> plt.Figure:
    """
    Plot histograms of the two groups with threshold line and metrics.
    
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
    if results is not None:
        threshold = results.threshold_value
        sens = results.sensitivity.estimate
        spec = results.specificity.estimate
        ppv = results.ppv.estimate
        npv = results.npv.estimate
        auc = results.roc_auc.estimate
        pr_auc = results.pr_auc.estimate
        d = results.cohens_d.estimate
        delta_nb = results.delta_nb.estimate
    else:
        # Need to import here to avoid circular import
        from .utils import (compute_cohens_d, compute_roc_auc, compute_pr_auc,
                           compute_threshold_metrics, convert_pt_to_threshold)
        
        if threshold is None:
            threshold = convert_pt_to_threshold(group1, group2, base_rate, threshold_prob)
        
        metrics = compute_threshold_metrics(group1, group2, threshold, base_rate, threshold_prob)
        sens = metrics['sensitivity']
        spec = metrics['specificity']
        ppv = metrics['ppv']
        npv = metrics['npv']
        delta_nb = metrics['delta_nb']
        auc = compute_roc_auc(group1, group2)
        pr_auc = compute_pr_auc(group1, group2, base_rate)
        d = compute_cohens_d(group1, group2)
    
    fig, ax = plt.subplots(figsize=figsize)
    
    # Determine bin edges
    all_data = np.concatenate([group1, group2])
    bins = np.linspace(np.min(all_data), np.max(all_data), 40)
    
    # Plot histograms
    ax.hist(group1, bins=bins, alpha=0.5, label=group1_label, 
            color='gray', density=True)
    ax.hist(group2, bins=bins, alpha=0.5, label=group2_label, 
            color='teal', density=True)
    
    # Plot threshold line
    ax.axvline(x=threshold, color='red', linestyle='--', linewidth=2, 
               label=f'Threshold (p_t={threshold_prob:.2f})')
    
    # Add metrics text box
    metrics_text = (
        f"Cohen's d = {d:.3f}\n"
        f"ROC-AUC = {auc:.3f}\n"
        f"PR-AUC = {pr_auc:.3f}\n"
        f"─────────────\n"
        f"At threshold:\n"
        f"  Sens = {sens:.3f}\n"
        f"  Spec = {spec:.3f}\n"
        f"  PPV = {ppv:.3f}\n"
        f"  NPV = {npv:.3f}\n"
        f"  ΔNB = {delta_nb:.4f}"
    )
    
    props = dict(boxstyle='round', facecolor='white', alpha=0.9)
    ax.text(0.98, 0.98, metrics_text, transform=ax.transAxes, fontsize=10,
            verticalalignment='top', horizontalalignment='right', 
            bbox=props, family='monospace')
    
    ax.set_xlabel('Measurement Value', fontsize=12)
    ax.set_ylabel('Density', fontsize=12)
    ax.set_title(f'Distribution Overlap (Base Rate = {base_rate:.1%})', fontsize=14)
    ax.legend(loc='upper left')
    
    plt.tight_layout()
    return fig


def plot_continuous(X: np.ndarray, Y: np.ndarray,
                    base_rate: float, threshold_prob: float,
                    y_threshold: float, is_case: np.ndarray,
                    group1: np.ndarray, group2: np.ndarray,
                    results: BinaryResults = None,
                    figsize: Tuple[float, float] = (10, 8),
                    x_label: str = "Predictor (X)",
                    y_label: str = "Outcome (Y)") -> plt.Figure:
    """
    Plot scatterplot of X vs Y with threshold lines and metrics.
    
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
        from .utils import (compute_cohens_d, compute_roc_auc, compute_pr_auc,
                           compute_threshold_metrics, convert_pt_to_threshold)
        
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
    
    fig, ax = plt.subplots(figsize=figsize)
    
    # Plot scatter with colors based on case/control
    controls = ~is_case
    cases = is_case
    
    ax.scatter(X[controls], Y[controls], alpha=0.5, c='gray', 
               label='Controls', s=30)
    ax.scatter(X[cases], Y[cases], alpha=0.5, c='teal', 
               label='Cases', s=30)
    
    # Plot Y threshold (horizontal line)
    ax.axhline(y=y_threshold, color='blue', linestyle='--', linewidth=1.5,
               label=f'Y threshold (top {base_rate:.0%})')
    
    # Plot X threshold (vertical line)
    ax.axvline(x=x_threshold, color='red', linestyle='--', linewidth=2,
               label=f'X threshold (p_t={threshold_prob:.2f})')
    
    # Add metrics text box
    metrics_text = (
        f"Cohen's d = {d:.3f}\n"
        f"ROC-AUC = {auc:.3f}\n"
        f"PR-AUC = {pr_auc:.3f}\n"
        f"─────────────\n"
        f"At threshold:\n"
        f"  Sens = {sens:.3f}\n"
        f"  Spec = {spec:.3f}\n"
        f"  PPV = {ppv:.3f}\n"
        f"  NPV = {npv:.3f}\n"
        f"  ΔNB = {delta_nb:.4f}"
    )
    
    props = dict(boxstyle='round', facecolor='white', alpha=0.9)
    ax.text(0.02, 0.98, metrics_text, transform=ax.transAxes, fontsize=10,
            verticalalignment='top', horizontalalignment='left',
            bbox=props, family='monospace')
    
    ax.set_xlabel(x_label, fontsize=12)
    ax.set_ylabel(y_label, fontsize=12)
    ax.set_title(f'Predictor vs Outcome (Base Rate = {base_rate:.1%})', fontsize=14)
    ax.legend(loc='lower right')
    
    plt.tight_layout()
    return fig
