"""
Test script for e2p.py

Run with: python test_e2p.py
"""

import os
import sys

# Allow running this script from repo root without installing the package.
_PKG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _PKG_ROOT not in sys.path:
    sys.path.insert(0, _PKG_ROOT)

def _env_show_plots() -> bool:
    """
    Control plotting for interactive/manual runs vs CI/headless runs.

    Default: ON (show plots)
    Disable: set E2P_SHOW_PLOTS=0 (or 'false'/'no'/'off')
    """
    raw = os.getenv("E2P_SHOW_PLOTS", "1").strip().lower()
    return raw not in {"0", "false", "no", "off", ""}


_SHOW_PLOTS = _env_show_plots()
if not _SHOW_PLOTS:
    # Must be set before importing pyplot, otherwise the backend is already chosen.
    import matplotlib

    matplotlib.use("Agg")

import numpy as np
import matplotlib.pyplot as plt
from e2p import (
    E2PBinary,
    E2PContinuous,
    e2p_binary,
    e2p_binary_deattenuated,
    e2p_continuous,
    e2p_continuous_deattenuated,
)
from e2p.utils import transform_for_target_reliability

# Set seed for reproducibility
np.random.seed(42)

# =============================================================================
# Quick unit-style checks for deattenuation utilities
# =============================================================================
print("\n" + "=" * 60)
print("DEATTENUATION UTILITY CHECKS")
print("=" * 60)

x = np.random.normal(0, 1, 1000)
r_cur = 0.50
r_tgt = 0.90
x_tgt = transform_for_target_reliability(x, r_cur, r_tgt, center="mean")

var_ratio = np.var(x_tgt, ddof=1) / np.var(x, ddof=1)
expected_ratio = r_cur / r_tgt
print(f"Variance ratio observed:  {var_ratio:.4f}")
print(f"Variance ratio expected:  {expected_ratio:.4f}")
assert np.isclose(var_ratio, expected_ratio, rtol=0.05), "Variance scaling check failed"
print("✓ Transform variance scaling check passed")

# Generate simulated data
# Group 1 (controls): mean=0, sd=1
# Group 2 (cases): mean=1.5, sd=1 (Cohen's d ≈ 1.5)
n_controls = 200
n_cases = 100

controls = np.random.normal(0, 1, n_controls)
cases = np.random.normal(1.5, 1, n_cases)

print("=" * 60)
print("E2P Binary Test")
print("=" * 60)
print(f"\nData: {n_controls} controls (mean=0, sd=1)")
print(f"      {n_cases} cases (mean=1.5, sd=1)")
print(f"      True Cohen's d ≈ 1.5")
print(f"\nParameters:")
print(f"  Base rate: 0.10 (10% prevalence)")
print(f"  Threshold probability (p_t): 0.20")
print(f"  Bootstrap iterations: 500")

# Run the analysis
print("\nComputing metrics (this may take a few seconds)...")
results = e2p_binary(
    group1=controls,
    group2=cases,
    base_rate=0.10,
    threshold_prob=0.20,
    n_bootstrap=500,
    random_state=42
)

# Print results
print("\n" + "=" * 60)
print("EFFECT SIZES")
print("=" * 60)
print(f"Cohen's d:        {results.cohens_d}")
print(f"Cohen's U3:       {results.cohens_u3}")
print(f"Point-biserial r: {results.r}")
print(f"Eta-squared:      {results.eta_squared}")
print(f"Odds Ratio:       {results.odds_ratio}")
print(f"Log Odds Ratio:   {results.log_odds_ratio}")

print("\n" + "=" * 60)
print("DISCRIMINATION")
print("=" * 60)
print(f"ROC-AUC:          {results.roc_auc}")
print(f"PR-AUC:           {results.pr_auc}")

print("\n" + "=" * 60)
print(f"THRESHOLD-DEPENDENT METRICS (p_t = {results.threshold_prob})")
print("=" * 60)
print(f"Threshold value:  {results.threshold_value:.4f}")
print(f"Sensitivity:      {results.sensitivity}")
print(f"Specificity:      {results.specificity}")
print(f"PPV:              {results.ppv}")
print(f"NPV:              {results.npv}")
print(f"Accuracy:         {results.accuracy}")
print(f"Balanced Acc:     {results.balanced_accuracy}")
print(f"F1 Score:         {results.f1}")
print(f"MCC:              {results.mcc}")
print(f"LR+:              {results.lr_plus}")
print(f"LR-:              {results.lr_minus}")
print(f"DOR:              {results.dor}")
print(f"Youden's J:       {results.youden_j}")
print(f"G-Mean:           {results.g_mean}")
print(f"Kappa:            {results.kappa}")
print(f"Post-test Prob+:  {results.post_test_prob_plus}")
print(f"Post-test Prob-:  {results.post_test_prob_minus}")
print(f"Delta NB:         {results.delta_nb}")

print("\n" + "=" * 60)
print("SAMPLE INFO")
print("=" * 60)
print(f"N (Group 1):      {results.n_group1}")
print(f"N (Group 2):      {results.n_group2}")
print(f"Base rate:        {results.base_rate}")

print("\n✓ Binary test completed!")

# Create binary plot (don't show yet)
e2p_obj = E2PBinary(
    group1=controls,
    group2=cases,
    base_rate=0.10,
    threshold_prob=0.20,
    n_bootstrap=0
)
fig_binary = e2p_obj.plot(results, group1_label="Controls", group2_label="Cases")

# Deattenuated binary results + plot (separate window)
print("\nComputing deattenuated binary metrics (no bootstrap)...")
results_deatt = e2p_binary_deattenuated(
    group1=controls,
    group2=cases,
    base_rate=0.10,
    threshold_prob=0.20,
    r_current=0.60,
    n_bootstrap=0,
    random_state=42,
)
print(f"Original d:      {results.cohens_d.estimate:.4f}")
print(f"Deattenuated d:  {results_deatt.cohens_d.estimate:.4f}")
print(f"Original AUC:    {results.roc_auc.estimate:.4f}")
print(f"Deattenuated AUC:{results_deatt.roc_auc.estimate:.4f}")
assert results_deatt.cohens_d.estimate > results.cohens_d.estimate, "Deattenuated d should increase"
assert results_deatt.roc_auc.estimate >= results.roc_auc.estimate - 1e-6, "Deattenuated AUC should not decrease"

fig_binary_deatt = e2p_obj.plot_deattenuated(
    r_current=0.60,
    group1_label="Controls",
    group2_label="Cases",
)
assert fig_binary_deatt is not fig_binary
assert fig_binary_deatt._suptitle is not None and "Deattenuated" in fig_binary_deatt._suptitle.get_text()
assert "ICC g1" in fig_binary_deatt._suptitle.get_text() and "ICC g2" in fig_binary_deatt._suptitle.get_text()
print("✓ Binary deattenuation checks passed")

# Add kappa deattenuation check (binary labels)
print("\nComputing deattenuated binary metrics with kappa correction...")
results_deatt_kappa = e2p_binary_deattenuated(
    group1=controls,
    group2=cases,
    base_rate=0.10,
    threshold_prob=0.20,
    r_current=0.60,
    kappa_current=0.70,
    n_bootstrap=0,
    random_state=42,
)
print(f"Deattenuated d (ICC only):      {results_deatt.cohens_d.estimate:.4f}")
print(f"Deattenuated d (ICC + kappa):   {results_deatt_kappa.cohens_d.estimate:.4f}")
assert results_deatt_kappa.cohens_d.estimate > results_deatt.cohens_d.estimate, "kappa correction should further increase d"

# =============================================================================
# Test E2PContinuous
# =============================================================================
print("\n\n")
print("=" * 60)
print("E2P Continuous Test")
print("=" * 60)

# Generate continuous X and Y with correlation
n_samples = 500
X = np.random.normal(0, 1, n_samples)
Y = 0.6 * X + np.random.normal(0, 0.8, n_samples)  # r ≈ 0.6

print(f"\nData: {n_samples} samples")
print(f"      X ~ N(0, 1)")
print(f"      Y = 0.6*X + noise (correlation ≈ 0.6)")
print(f"\nParameters:")
print(f"  Base rate: 0.10 (top 10% of Y are 'cases')")
print(f"  Threshold probability (p_t): 0.20")
print(f"  Bootstrap iterations: 200")

print("\nComputing metrics...")
results_cont = e2p_continuous(
    X=X,
    Y=Y,
    base_rate=0.10,
    threshold_prob=0.20,
    n_bootstrap=200,
    random_state=42
)

print("\n" + "=" * 60)
print("KEY METRICS (Continuous)")
print("=" * 60)
print(f"Cohen's d:        {results_cont.cohens_d}")
print(f"ROC-AUC:          {results_cont.roc_auc}")
print(f"PR-AUC:           {results_cont.pr_auc}")
print(f"Sensitivity:      {results_cont.sensitivity}")
print(f"Specificity:      {results_cont.specificity}")
print(f"PPV:              {results_cont.ppv}")
print(f"Delta NB:         {results_cont.delta_nb}")

print("\n✓ Continuous test completed!")

# Create continuous plot
e2p_cont_obj = E2PContinuous(
    X=X,
    Y=Y,
    base_rate=0.10,
    threshold_prob=0.20,
    n_bootstrap=0
)
fig_cont = e2p_cont_obj.plot(results_cont, x_label="Predictor (X)", y_label="Outcome (Y)")

# Deattenuated continuous results + plot (fixed split)
print("\nComputing deattenuated continuous metrics (no bootstrap)...")
is_case_before = e2p_cont_obj.is_case.copy()

results_cont_deatt = e2p_continuous_deattenuated(
    X=X,
    Y=Y,
    base_rate=0.10,
    threshold_prob=0.20,
    r_x_current=0.60,
    r_x_target=1.0,
    r_y_current=0.70,
    r_y_target=1.0,
    n_bootstrap=0,
    random_state=42,
)
assert np.array_equal(is_case_before, e2p_cont_obj.is_case), "is_case split must remain fixed"
assert results_cont_deatt.cohens_d.estimate >= results_cont.cohens_d.estimate, "Deattenuated d should not decrease"

fig_cont_deatt = e2p_cont_obj.plot_deattenuated(
    r_x_current=0.60,
    r_x_target=1.0,
    r_y_current=0.70,
    r_y_target=1.0,
    x_label="Predictor (X)",
    y_label="Outcome (Y)",
)
assert fig_cont_deatt is not fig_cont
assert fig_cont_deatt._suptitle is not None and "Deattenuated" in fig_cont_deatt._suptitle.get_text()
print("✓ Continuous deattenuation checks passed")

print("\n" + "=" * 60)
print("All tests passed!")
print("=" * 60)

# Show both plots at the end
if _SHOW_PLOTS:
    print("\nShowing plots (close windows to exit)...")
    plt.show()
else:
    print("\nSkipping plot display (E2P_SHOW_PLOTS=0).")
