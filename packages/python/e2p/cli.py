"""
Command-line interface for e2p.

Usage:
    e2p parametric --cohens-d 0.8 --base-rate 0.1
    e2p convert --from auc --value 0.75
    e2p roc-auc --cohens-d 0.8
    e2p pr-auc --cohens-d 0.8 --base-rate 0.05
"""

import json
from dataclasses import asdict
from typing import Optional

try:
    import typer
except ImportError:
    raise ImportError(
        "typer is required for CLI. Install with: pip install e2p[cli]"
    )

from e2p import (
    e2p_parametric_binary,
    e2p_parametric_continuous,
    compute_roc_auc_parametric,
    compute_pr_auc_parametric,
    d_to_odds_ratio,
    d_to_log_odds_ratio,
    d_to_cohens_u3,
    d_to_point_biserial_r,
    r_to_d,
    auc_to_d,
    odds_ratio_to_d,
    log_odds_ratio_to_d,
    cohens_u3_to_d,
)

app = typer.Typer(
    name="e2p",
    help="Effect-to-Prediction: Compute predictive metrics from effect sizes.",
    add_completion=False,
)


def _print_json(data: dict) -> None:
    """Print data as formatted JSON."""
    typer.echo(json.dumps(data, indent=2))


def _print_value(name: str, value: float, decimals: int = 4) -> None:
    """Print a single named value."""
    typer.echo(f"{name}: {value:.{decimals}f}")


@app.command()
def parametric(
    cohens_d: float = typer.Option(..., "--cohens-d", "-d", help="Cohen's d effect size"),
    base_rate: float = typer.Option(..., "--base-rate", "-b", help="Base rate / prevalence (0-1)"),
    threshold: float = typer.Option(0.5, "--threshold", "-t", help="Decision threshold probability (0-1)"),
    icc1: float = typer.Option(1.0, "--icc1", help="ICC for group 1 (measurement reliability)"),
    icc2: float = typer.Option(1.0, "--icc2", help="ICC for group 2 (measurement reliability)"),
    kappa: float = typer.Option(1.0, "--kappa", "-k", help="Kappa (diagnostic reliability)"),
    view: str = typer.Option("observed", "--view", "-v", help="View: 'true' or 'observed'"),
    output: str = typer.Option("summary", "--output", "-o", help="Output format: 'summary', 'json', or 'full'"),
):
    """
    Compute predictive metrics from Cohen's d using parametric assumptions.
    
    Example:
        e2p parametric --cohens-d 0.8 --base-rate 0.1 --threshold 0.5
    """
    results = e2p_parametric_binary(
        cohens_d=cohens_d,
        base_rate=base_rate,
        threshold_prob=threshold,
        icc1=icc1,
        icc2=icc2,
        kappa=kappa,
        view=view,
    )
    
    if output == "json" or output == "full":
        _print_json(asdict(results))
    else:
        # Summary output
        typer.echo(f"{'='*50}")
        typer.echo(f"E2P Parametric Analysis (Cohen's d = {cohens_d})")
        typer.echo(f"{'='*50}")
        typer.echo(f"\nBase rate: {base_rate:.2%}")
        typer.echo(f"Threshold: {threshold:.2%}")
        typer.echo(f"\n--- Effect Sizes ---")
        _print_value("Cohen's d (observed)", results.cohens_d_observed)
        _print_value("Odds Ratio", results.odds_ratio)
        _print_value("Cohen's U3", results.cohens_u3)
        typer.echo(f"\n--- Discrimination ---")
        _print_value("ROC-AUC", results.roc_auc)
        _print_value("PR-AUC", results.pr_auc)
        typer.echo(f"\n--- Classification (at threshold) ---")
        _print_value("Sensitivity", results.sensitivity)
        _print_value("Specificity", results.specificity)
        _print_value("PPV", results.ppv)
        _print_value("NPV", results.npv)
        _print_value("F1", results.f1)
        typer.echo(f"\n--- Clinical Utility ---")
        _print_value("Delta NB", results.delta_nb, decimals=6)


@app.command()
def parametric_continuous(
    pearson_r: float = typer.Option(..., "--pearson-r", "-r", help="Pearson correlation coefficient"),
    base_rate: float = typer.Option(..., "--base-rate", "-b", help="Base rate / prevalence (0-1)"),
    threshold: float = typer.Option(0.5, "--threshold", "-t", help="Decision threshold probability (0-1)"),
    reliability_x: float = typer.Option(1.0, "--rel-x", help="Reliability of X"),
    reliability_y: float = typer.Option(1.0, "--rel-y", help="Reliability of Y"),
    view: str = typer.Option("observed", "--view", "-v", help="View: 'true' or 'observed'"),
    output: str = typer.Option("summary", "--output", "-o", help="Output format: 'summary', 'json', or 'full'"),
):
    """
    Compute predictive metrics from Pearson's r using parametric assumptions.
    
    Example:
        e2p parametric-continuous --pearson-r 0.4 --base-rate 0.1
    """
    results = e2p_parametric_continuous(
        pearson_r=pearson_r,
        base_rate=base_rate,
        threshold_prob=threshold,
        reliability_x=reliability_x,
        reliability_y=reliability_y,
        view=view,
    )
    
    if output == "json" or output == "full":
        _print_json(asdict(results))
    else:
        typer.echo(f"{'='*50}")
        typer.echo(f"E2P Parametric Analysis (Pearson's r = {pearson_r})")
        typer.echo(f"{'='*50}")
        typer.echo(f"\nBase rate: {base_rate:.2%}")
        typer.echo(f"Threshold: {threshold:.2%}")
        typer.echo(f"\n--- Effect Sizes ---")
        _print_value("Cohen's d (observed)", results.cohens_d_observed)
        _print_value("Odds Ratio", results.odds_ratio)
        typer.echo(f"\n--- Discrimination ---")
        _print_value("ROC-AUC", results.roc_auc)
        _print_value("PR-AUC", results.pr_auc)
        typer.echo(f"\n--- Classification (at threshold) ---")
        _print_value("Sensitivity", results.sensitivity)
        _print_value("Specificity", results.specificity)
        _print_value("PPV", results.ppv)
        _print_value("NPV", results.npv)


@app.command()
def convert(
    value: float = typer.Option(..., "--value", "-v", help="The value to convert"),
    from_type: Optional[str] = typer.Option(None, "--from", "-f", help="Source type: auc, or, log_or, u3, r"),
    to_type: Optional[str] = typer.Option(None, "--to", "-t", help="Target type: auc, or, log_or, u3, r"),
    base_rate: float = typer.Option(0.5, "--base-rate", "-b", help="Base rate (for point-biserial r)"),
):
    """
    Convert between effect size metrics.
    
    Convert TO Cohen's d (specify --from):
        e2p convert --from auc --value 0.75
        e2p convert --from or --value 3.0
        e2p convert --from log_or --value 1.1
        e2p convert --from u3 --value 0.8
        e2p convert --from r --value 0.4
    
    Convert FROM Cohen's d (specify --to):
        e2p convert --to auc --value 0.8
        e2p convert --to or --value 0.8
        e2p convert --to u3 --value 0.8
        e2p convert --to r --value 0.8 --base-rate 0.1
    """
    if from_type and to_type:
        typer.echo("Error: Specify either --from or --to, not both.", err=True)
        raise typer.Exit(1)
    
    if not from_type and not to_type:
        typer.echo("Error: Must specify either --from or --to.", err=True)
        raise typer.Exit(1)
    
    if from_type:
        # Convert TO Cohen's d
        converters = {
            "auc": ("ROC-AUC", auc_to_d),
            "or": ("Odds Ratio", odds_ratio_to_d),
            "log_or": ("Log Odds Ratio", log_odds_ratio_to_d),
            "u3": ("Cohen's U3", cohens_u3_to_d),
            "r": ("Pearson's r", r_to_d),
        }
        
        if from_type not in converters:
            typer.echo(f"Error: Unknown source type '{from_type}'. Use: {', '.join(converters.keys())}", err=True)
            raise typer.Exit(1)
        
        name, func = converters[from_type]
        d = func(value)
        typer.echo(f"{name} = {value} → Cohen's d = {d:.4f}")
    
    else:
        # Convert FROM Cohen's d
        converters = {
            "auc": ("ROC-AUC", lambda d: compute_roc_auc_parametric(d)),
            "or": ("Odds Ratio", d_to_odds_ratio),
            "log_or": ("Log Odds Ratio", d_to_log_odds_ratio),
            "u3": ("Cohen's U3", d_to_cohens_u3),
            "r": ("Point-biserial r", lambda d: d_to_point_biserial_r(d, base_rate)),
        }
        
        if to_type not in converters:
            typer.echo(f"Error: Unknown target type '{to_type}'. Use: {', '.join(converters.keys())}", err=True)
            raise typer.Exit(1)
        
        name, func = converters[to_type]
        result = func(value)
        typer.echo(f"Cohen's d = {value} → {name} = {result:.4f}")


@app.command("roc-auc")
def roc_auc(
    cohens_d: float = typer.Option(..., "--cohens-d", "-d", help="Cohen's d effect size"),
    sigma1: float = typer.Option(1.0, "--sigma1", help="SD of group 1"),
    sigma2: float = typer.Option(1.0, "--sigma2", help="SD of group 2"),
):
    """
    Compute ROC-AUC from Cohen's d.
    
    Example:
        e2p roc-auc --cohens-d 0.8
    """
    auc = compute_roc_auc_parametric(cohens_d, sigma1, sigma2)
    _print_value("ROC-AUC", auc)


@app.command("pr-auc")
def pr_auc(
    cohens_d: float = typer.Option(..., "--cohens-d", "-d", help="Cohen's d effect size"),
    base_rate: float = typer.Option(..., "--base-rate", "-b", help="Base rate / prevalence (0-1)"),
    sigma1: float = typer.Option(1.0, "--sigma1", help="SD of group 1"),
    sigma2: float = typer.Option(1.0, "--sigma2", help="SD of group 2"),
):
    """
    Compute PR-AUC from Cohen's d and base rate.
    
    Example:
        e2p pr-auc --cohens-d 0.8 --base-rate 0.05
    """
    auc = compute_pr_auc_parametric(cohens_d, base_rate, sigma1, sigma2)
    _print_value("PR-AUC", auc)


def main():
    """Entry point for the CLI."""
    app()


if __name__ == "__main__":
    main()
