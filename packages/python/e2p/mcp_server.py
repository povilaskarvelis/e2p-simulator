"""
MCP (Model Context Protocol) server for e2p.

Exposes e2p parametric functions as tools that AI agents can call.

Usage:
    # Run as stdio server (for Cursor/Claude Desktop integration)
    python -m e2p.mcp_server
    
    # Or via entry point
    e2p-mcp
"""

from dataclasses import asdict
from typing import Literal, Optional

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    raise ImportError(
        "mcp is required for the MCP server. Install with: pip install e2p[mcp]"
    )

from e2p import (
    e2p_parametric_binary,
    e2p_parametric_continuous,
    compute_roc_auc_parametric,
    compute_pr_auc_parametric,
    find_optimal_threshold,
    d_to_odds_ratio,
    d_to_log_odds_ratio,
    d_to_cohens_u3,
    d_to_point_biserial_r,
    r_to_d,
    auc_to_d,
    odds_ratio_to_d,
    log_odds_ratio_to_d,
    cohens_u3_to_d,
    attenuate_d,
    compute_sigma_from_icc,
)

# Create the MCP server
mcp = FastMCP("e2p")


@mcp.tool()
def parametric_binary(
    cohens_d: float,
    base_rate: float,
    threshold_prob: float = 0.5,
    icc1: float = 1.0,
    icc2: float = 1.0,
    kappa: float = 1.0,
    view: str = "observed",
) -> dict:
    """
    Compute predictive metrics from Cohen's d using parametric assumptions.
    
    This is the main function for estimating how well a predictor will perform
    in real-world classification, given an effect size from the literature.
    
    Args:
        cohens_d: Cohen's d effect size (standardized mean difference)
        base_rate: Prevalence of the positive class (0 to 1)
        threshold_prob: Decision threshold probability (0 to 1, default 0.5)
        icc1: ICC/reliability of predictor in group 1 (0 to 1, default 1.0)
        icc2: ICC/reliability of predictor in group 2 (0 to 1, default 1.0)
        kappa: Diagnostic/label reliability (0 to 1, default 1.0)
        view: "true" for latent metrics or "observed" for attenuated metrics
    
    Returns:
        Dictionary with effect sizes (odds_ratio, cohens_u3, etc.),
        discrimination metrics (roc_auc, pr_auc), and threshold-dependent
        metrics (sensitivity, specificity, ppv, npv, f1, delta_nb, etc.)
    """
    results = e2p_parametric_binary(
        cohens_d=cohens_d,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        icc1=icc1,
        icc2=icc2,
        kappa=kappa,
        view=view,
    )
    return asdict(results)


@mcp.tool()
def parametric_continuous(
    pearson_r: float,
    base_rate: float,
    threshold_prob: float = 0.5,
    reliability_x: float = 1.0,
    reliability_y: float = 1.0,
    view: str = "observed",
) -> dict:
    """
    Compute predictive metrics from Pearson's r using parametric assumptions.
    
    Use this when you have a correlation coefficient and want to estimate
    classification performance when predicting a dichotomized outcome.
    
    Args:
        pearson_r: Pearson correlation coefficient (-1 to 1)
        base_rate: Prevalence of the positive class (0 to 1)
        threshold_prob: Decision threshold probability (0 to 1, default 0.5)
        reliability_x: Reliability of X predictor (0 to 1, default 1.0)
        reliability_y: Reliability of Y outcome (0 to 1, default 1.0)
        view: "true" for latent metrics or "observed" for attenuated metrics
    
    Returns:
        Dictionary with effect sizes and classification metrics.
    """
    results = e2p_parametric_continuous(
        pearson_r=pearson_r,
        base_rate=base_rate,
        threshold_prob=threshold_prob,
        reliability_x=reliability_x,
        reliability_y=reliability_y,
        view=view,
    )
    return asdict(results)


@mcp.tool()
def convert_effect_size(
    value: float,
    from_type: str,
    to_type: str = "d",
    base_rate: float = 0.5,
) -> dict:
    """
    Convert between different effect size metrics.
    
    Supported types: d (Cohen's d), auc (ROC-AUC), or (odds ratio),
    log_or (log odds ratio), u3 (Cohen's U3), r (Pearson's r / point-biserial r)
    
    Args:
        value: The effect size value to convert
        from_type: Source effect size type (d, auc, or, log_or, u3, r)
        to_type: Target effect size type (d, auc, or, log_or, u3, r)
        base_rate: Base rate, only needed for point-biserial r conversion
    
    Returns:
        Dictionary with input value, converted value, and metadata
    """
    # Converters to Cohen's d
    to_d = {
        "d": lambda x: x,
        "auc": auc_to_d,
        "or": odds_ratio_to_d,
        "log_or": log_odds_ratio_to_d,
        "u3": cohens_u3_to_d,
        "r": r_to_d,
    }
    
    # Converters from Cohen's d
    from_d = {
        "d": lambda d: d,
        "auc": compute_roc_auc_parametric,
        "or": d_to_odds_ratio,
        "log_or": d_to_log_odds_ratio,
        "u3": d_to_cohens_u3,
        "r": lambda d: d_to_point_biserial_r(d, base_rate),
    }
    
    if from_type not in to_d:
        raise ValueError(f"Unknown from_type: {from_type}. Use: {list(to_d.keys())}")
    if to_type not in from_d:
        raise ValueError(f"Unknown to_type: {to_type}. Use: {list(from_d.keys())}")
    
    # Convert: from_type -> d -> to_type
    d = to_d[from_type](value)
    result = from_d[to_type](d)
    
    return {
        "input_value": value,
        "input_type": from_type,
        "output_value": result,
        "output_type": to_type,
        "cohens_d": d,
    }


@mcp.tool()
def compute_roc_auc(
    cohens_d: float,
    sigma1: float = 1.0,
    sigma2: float = 1.0,
) -> dict:
    """
    Compute ROC-AUC from Cohen's d.
    
    For equal variances (sigma1=sigma2=1), AUC = Phi(d/sqrt(2))
    where Phi is the standard normal CDF.
    
    Args:
        cohens_d: Cohen's d effect size
        sigma1: Standard deviation of group 1 (controls)
        sigma2: Standard deviation of group 2 (cases)
    
    Returns:
        Dictionary with ROC-AUC value
    """
    auc = compute_roc_auc_parametric(cohens_d, sigma1, sigma2)
    return {"cohens_d": cohens_d, "roc_auc": auc}


@mcp.tool()
def compute_pr_auc(
    cohens_d: float,
    base_rate: float,
    sigma1: float = 1.0,
    sigma2: float = 1.0,
) -> dict:
    """
    Compute PR-AUC (Precision-Recall AUC) from Cohen's d and base rate.
    
    PR-AUC is more informative than ROC-AUC for imbalanced datasets.
    Unlike ROC-AUC, PR-AUC depends on the base rate (prevalence).
    
    Args:
        cohens_d: Cohen's d effect size
        base_rate: Prevalence of the positive class (0 to 1)
        sigma1: Standard deviation of group 1 (controls)
        sigma2: Standard deviation of group 2 (cases)
    
    Returns:
        Dictionary with PR-AUC value
    """
    auc = compute_pr_auc_parametric(cohens_d, base_rate, sigma1, sigma2)
    return {"cohens_d": cohens_d, "base_rate": base_rate, "pr_auc": auc}


@mcp.tool()
def find_threshold(
    cohens_d: float,
    base_rate: float,
    metric: str = "youden",
    sigma1: float = 1.0,
    sigma2: float = 1.0,
) -> dict:
    """
    Find the optimal classification threshold.
    
    Args:
        cohens_d: Cohen's d effect size
        base_rate: Prevalence of the positive class (0 to 1)
        metric: Optimization metric - "youden" (Youden's J) or "f1" (F1 score)
        sigma1: Standard deviation of group 1 (controls)
        sigma2: Standard deviation of group 2 (cases)
    
    Returns:
        Dictionary with optimal threshold value
    """
    threshold = find_optimal_threshold(cohens_d, base_rate, sigma1, sigma2, metric)
    return {
        "cohens_d": cohens_d,
        "base_rate": base_rate,
        "metric": metric,
        "optimal_threshold": threshold,
    }


@mcp.tool()
def apply_reliability_attenuation(
    true_d: float,
    kappa: float = 1.0,
    icc: float = 1.0,
) -> dict:
    """
    Apply reliability attenuation to Cohen's d.
    
    This shows how imperfect measurement reliability (ICC) and
    diagnostic reliability (kappa) reduce the observed effect size.
    
    Args:
        true_d: True (latent) Cohen's d
        kappa: Diagnostic/label reliability (0 to 1)
        icc: Measurement reliability / ICC (0 to 1)
    
    Returns:
        Dictionary with true d, observed d, and reliability parameters
    """
    observed_d = attenuate_d(true_d, kappa)
    sigma = compute_sigma_from_icc(icc) if icc < 1.0 else 1.0
    
    return {
        "true_d": true_d,
        "observed_d": observed_d,
        "kappa": kappa,
        "icc": icc,
        "sigma_inflation": sigma,
    }


def main():
    """Entry point for the MCP server."""
    mcp.run()


if __name__ == "__main__":
    main()
