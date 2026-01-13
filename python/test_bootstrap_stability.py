"""
Test bootstrap CI stability across different:
1. Random seeds (same n_bootstrap)
2. Number of bootstrap iterations

This helps determine if 500 iterations is sufficient.
"""

import numpy as np
from e2p import e2p_binary

# Generate fixed data
np.random.seed(42)
n_controls = 200
n_cases = 100
controls = np.random.normal(0, 1, n_controls)
cases = np.random.normal(1.5, 1, n_cases)

print("=" * 70)
print("BOOTSTRAP CI STABILITY ANALYSIS")
print("=" * 70)
print(f"\nData: {n_controls} controls, {n_cases} cases, true d ≈ 1.5")
print(f"Base rate: 0.10, Threshold prob: 0.20")

# =============================================================================
# Test 1: Same n_bootstrap, different seeds
# =============================================================================
print("\n" + "=" * 70)
print("TEST 1: CI variability across 5 different random seeds (n=500)")
print("=" * 70)

seeds = [1, 42, 123, 456, 999]
results_by_seed = []

for seed in seeds:
    print(f"\nSeed {seed}...", end=" ", flush=True)
    result = e2p_binary(
        group1=controls,
        group2=cases,
        base_rate=0.10,
        threshold_prob=0.20,
        n_bootstrap=500,
        random_state=seed
    )
    results_by_seed.append(result)
    print("done")

# Compare key metrics
metrics = ['cohens_d', 'roc_auc', 'pr_auc', 'sensitivity', 'specificity', 'ppv']

print("\n" + "-" * 70)
print(f"{'Metric':<15} {'Point Est':>10} {'CI Range (min-max across seeds)':<30}")
print("-" * 70)

for metric_name in metrics:
    point_est = getattr(results_by_seed[0], metric_name).estimate
    
    ci_lows = [getattr(r, metric_name).ci_lower for r in results_by_seed]
    ci_highs = [getattr(r, metric_name).ci_upper for r in results_by_seed]
    
    ci_low_range = f"{min(ci_lows):.3f}-{max(ci_lows):.3f}"
    ci_high_range = f"{min(ci_highs):.3f}-{max(ci_highs):.3f}"
    ci_low_spread = max(ci_lows) - min(ci_lows)
    ci_high_spread = max(ci_highs) - min(ci_highs)
    
    print(f"{metric_name:<15} {point_est:>10.3f}   "
          f"Low: {ci_low_range} (Δ={ci_low_spread:.3f})  "
          f"High: {ci_high_range} (Δ={ci_high_spread:.3f})")

# =============================================================================
# Test 2: Different n_bootstrap values
# =============================================================================
print("\n" + "=" * 70)
print("TEST 2: CI convergence with increasing bootstrap iterations")
print("=" * 70)

bootstrap_sizes = [100, 250, 500, 1000, 2000]
results_by_n = []

for n_boot in bootstrap_sizes:
    print(f"\nn_bootstrap = {n_boot}...", end=" ", flush=True)
    result = e2p_binary(
        group1=controls,
        group2=cases,
        base_rate=0.10,
        threshold_prob=0.20,
        n_bootstrap=n_boot,
        random_state=42  # Same seed for comparability
    )
    results_by_n.append((n_boot, result))
    print("done")

print("\n" + "-" * 70)
print(f"{'n_boot':<8} {'Cohen d CI':<20} {'ROC-AUC CI':<20} {'PPV CI':<20}")
print("-" * 70)

for n_boot, result in results_by_n:
    d_ci = f"[{result.cohens_d.ci_lower:.3f}, {result.cohens_d.ci_upper:.3f}]"
    auc_ci = f"[{result.roc_auc.ci_lower:.3f}, {result.roc_auc.ci_upper:.3f}]"
    ppv_ci = f"[{result.ppv.ci_lower:.3f}, {result.ppv.ci_upper:.3f}]"
    print(f"{n_boot:<8} {d_ci:<20} {auc_ci:<20} {ppv_ci:<20}")

# =============================================================================
# Summary
# =============================================================================
print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)

# Calculate max spread at 500 iterations
spreads_500 = []
for metric_name in metrics:
    ci_lows = [getattr(r, metric_name).ci_lower for r in results_by_seed]
    ci_highs = [getattr(r, metric_name).ci_upper for r in results_by_seed]
    spreads_500.append(max(max(ci_lows) - min(ci_lows), max(ci_highs) - min(ci_highs)))

max_spread = max(spreads_500)
avg_spread = np.mean(spreads_500)

print(f"\nAt n_bootstrap=500:")
print(f"  Max CI bound variation across seeds: {max_spread:.4f}")
print(f"  Avg CI bound variation across seeds: {avg_spread:.4f}")

if max_spread < 0.02:
    print("\n✓ 500 iterations appears SUFFICIENT (variation < 0.02)")
elif max_spread < 0.05:
    print("\n⚠ 500 iterations is BORDERLINE (variation 0.02-0.05)")
    print("  Consider using 1000 iterations for publication-quality results")
else:
    print("\n✗ 500 iterations may be INSUFFICIENT (variation > 0.05)")
    print("  Recommend using 1000-2000 iterations")

print("\n" + "=" * 70)
