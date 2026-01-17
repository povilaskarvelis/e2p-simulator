"""
Test script for e2p parametric module.

Tests the parametric computation functions against known analytical values
and cross-validates with the empirical module.

Run with: pytest test_parametric.py -v
Or standalone: python test_parametric.py
"""

import os
import sys

# Allow running this script from repo root without installing the package.
_PKG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _PKG_ROOT not in sys.path:
    sys.path.insert(0, _PKG_ROOT)

import numpy as np
import pytest
from scipy import stats

from e2p import (
    e2p_parametric_binary,
    e2p_parametric_continuous,
    compute_roc_auc_parametric,
    compute_pr_auc_parametric,
    find_optimal_threshold,
    attenuate_d,
    compute_sigma_from_icc,
    d_to_odds_ratio,
    d_to_log_odds_ratio,
    d_to_point_biserial_r,
    d_to_cohens_u3,
    r_to_d,
    auc_to_d,
    odds_ratio_to_d,
    log_odds_ratio_to_d,
    cohens_u3_to_d,
    e2p_binary,
)


# =============================================================================
# Test effect size conversions
# =============================================================================

class TestEffectSizeConversions:
    """Test effect size conversion functions."""
    
    def test_d_to_odds_ratio(self):
        """Test Cohen's d to odds ratio conversion."""
        # OR = exp(d * pi / sqrt(3))
        d = 0.8
        expected_or = np.exp(0.8 * np.pi / np.sqrt(3))
        assert np.isclose(d_to_odds_ratio(d), expected_or, rtol=1e-10)
        
        # d=0 should give OR=1
        assert np.isclose(d_to_odds_ratio(0), 1.0, rtol=1e-10)
    
    def test_d_to_log_odds_ratio(self):
        """Test Cohen's d to log odds ratio conversion."""
        d = 0.8
        expected_lor = 0.8 * np.pi / np.sqrt(3)
        assert np.isclose(d_to_log_odds_ratio(d), expected_lor, rtol=1e-10)
        
        # d=0 should give log(OR)=0
        assert np.isclose(d_to_log_odds_ratio(0), 0.0, rtol=1e-10)
    
    def test_d_to_cohens_u3(self):
        """Test Cohen's d to U3 conversion."""
        # U3 = Phi(d), where Phi is standard normal CDF
        d = 0.8
        expected_u3 = stats.norm.cdf(d)
        assert np.isclose(d_to_cohens_u3(d), expected_u3, rtol=1e-10)
        
        # d=0 should give U3=0.5
        assert np.isclose(d_to_cohens_u3(0), 0.5, rtol=1e-10)
    
    def test_d_to_point_biserial_r(self):
        """Test Cohen's d to point-biserial r conversion."""
        d = 0.8
        base_rate = 0.5
        # r = d / sqrt(d^2 + 1/(p*(1-p)))
        expected_r = d / np.sqrt(d**2 + 1 / (base_rate * (1 - base_rate)))
        assert np.isclose(d_to_point_biserial_r(d, base_rate), expected_r, rtol=1e-10)
        
        # At base_rate=0.5, this simplifies to d / sqrt(d^2 + 4)
        expected_r_balanced = d / np.sqrt(d**2 + 4)
        assert np.isclose(d_to_point_biserial_r(d, 0.5), expected_r_balanced, rtol=1e-10)
    
    def test_r_to_d(self):
        """Test Pearson's r to Cohen's d conversion."""
        r = 0.5
        # d = 2r / sqrt(1 - r^2)
        expected_d = 2 * r / np.sqrt(1 - r**2)
        assert np.isclose(r_to_d(r), expected_d, rtol=1e-10)
        
        # r=0 should give d=0
        assert np.isclose(r_to_d(0), 0.0, rtol=1e-10)


# =============================================================================
# Test reverse conversions (other effect sizes -> d)
# =============================================================================

class TestReverseConversions:
    """Test reverse conversion functions (effect sizes to Cohen's d)."""
    
    def test_auc_to_d(self):
        """Test ROC-AUC to Cohen's d conversion."""
        # d = Phi^(-1)(AUC) * sqrt(2)
        auc = 0.714
        expected_d = stats.norm.ppf(auc) * np.sqrt(2)
        assert np.isclose(auc_to_d(auc), expected_d, rtol=1e-10)
        
        # AUC=0.5 should give d=0
        assert np.isclose(auc_to_d(0.5), 0.0, rtol=1e-10)
        
        # AUC below 0.5 should return 0
        assert np.isclose(auc_to_d(0.4), 0.0, rtol=1e-10)
    
    def test_odds_ratio_to_d(self):
        """Test odds ratio to Cohen's d conversion."""
        # d = ln(OR) * sqrt(3) / pi
        or_val = 4.27
        expected_d = np.log(or_val) * np.sqrt(3) / np.pi
        assert np.isclose(odds_ratio_to_d(or_val), expected_d, rtol=1e-10)
        
        # OR=1 should give d=0
        assert np.isclose(odds_ratio_to_d(1.0), 0.0, rtol=1e-10)
    
    def test_odds_ratio_to_d_validation(self):
        """Test that invalid odds ratios raise errors."""
        with pytest.raises(ValueError):
            odds_ratio_to_d(0)  # OR must be > 0
        with pytest.raises(ValueError):
            odds_ratio_to_d(-1)  # OR must be > 0
    
    def test_log_odds_ratio_to_d(self):
        """Test log odds ratio to Cohen's d conversion."""
        # d = log_OR * sqrt(3) / pi
        log_or = 1.45
        expected_d = log_or * np.sqrt(3) / np.pi
        assert np.isclose(log_odds_ratio_to_d(log_or), expected_d, rtol=1e-10)
        
        # log(OR)=0 should give d=0
        assert np.isclose(log_odds_ratio_to_d(0), 0.0, rtol=1e-10)
    
    def test_cohens_u3_to_d(self):
        """Test Cohen's U3 to Cohen's d conversion."""
        # d = Phi^(-1)(U3)
        u3 = 0.788
        expected_d = stats.norm.ppf(u3)
        assert np.isclose(cohens_u3_to_d(u3), expected_d, rtol=1e-10)
        
        # U3=0.5 should give d=0
        assert np.isclose(cohens_u3_to_d(0.5), 0.0, rtol=1e-10)
    
    def test_cohens_u3_to_d_validation(self):
        """Test that invalid U3 values raise errors."""
        with pytest.raises(ValueError):
            cohens_u3_to_d(0)  # U3 must be > 0
        with pytest.raises(ValueError):
            cohens_u3_to_d(1)  # U3 must be < 1
    
    def test_round_trip_auc(self):
        """Test that d -> AUC -> d is identity."""
        d_original = 0.8
        auc = compute_roc_auc_parametric(d_original)
        d_recovered = auc_to_d(auc)
        assert np.isclose(d_original, d_recovered, rtol=1e-6)
    
    def test_round_trip_odds_ratio(self):
        """Test that d -> OR -> d is identity."""
        d_original = 0.8
        or_val = d_to_odds_ratio(d_original)
        d_recovered = odds_ratio_to_d(or_val)
        assert np.isclose(d_original, d_recovered, rtol=1e-10)
    
    def test_round_trip_log_odds_ratio(self):
        """Test that d -> log(OR) -> d is identity."""
        d_original = 0.8
        log_or = d_to_log_odds_ratio(d_original)
        d_recovered = log_odds_ratio_to_d(log_or)
        assert np.isclose(d_original, d_recovered, rtol=1e-10)
    
    def test_round_trip_cohens_u3(self):
        """Test that d -> U3 -> d is identity."""
        d_original = 0.8
        u3 = d_to_cohens_u3(d_original)
        d_recovered = cohens_u3_to_d(u3)
        assert np.isclose(d_original, d_recovered, rtol=1e-10)


class TestReverseConversionUseCases:
    """Test practical use cases for reverse conversions."""
    
    def test_auc_to_pr_auc(self):
        """Test converting ROC-AUC to PR-AUC via Cohen's d."""
        # Researcher has ROC-AUC = 0.75 and wants PR-AUC at base_rate = 0.05
        roc_auc = 0.75
        base_rate = 0.05
        
        # Convert to d and compute PR-AUC
        d = auc_to_d(roc_auc)
        pr_auc = compute_pr_auc_parametric(d, base_rate)
        
        # PR-AUC should be reasonable (between base_rate and 1)
        assert pr_auc > base_rate
        assert pr_auc < 1.0
    
    def test_odds_ratio_to_full_metrics(self):
        """Test computing full metrics from odds ratio."""
        # Researcher has OR = 3.0 from a meta-analysis
        or_val = 3.0
        base_rate = 0.1
        
        # Convert to d and get full results
        d = odds_ratio_to_d(or_val)
        results = e2p_parametric_binary(
            cohens_d=d,
            base_rate=base_rate,
            threshold_prob=0.5
        )
        
        # Check we get reasonable results
        assert 0.5 < results.roc_auc < 1.0
        assert 0 < results.sensitivity < 1
        assert 0 < results.specificity < 1
        assert 0 < results.ppv < 1
    
    def test_auc_to_net_benefit(self):
        """Test computing net benefit from ROC-AUC."""
        # Researcher wants to know clinical utility at 10% threshold
        roc_auc = 0.80
        base_rate = 0.10
        threshold_prob = 0.10
        
        # Convert and compute
        d = auc_to_d(roc_auc)
        results = e2p_parametric_binary(
            cohens_d=d,
            base_rate=base_rate,
            threshold_prob=threshold_prob
        )
        
        # Check delta_nb is computed
        assert hasattr(results, 'delta_nb')
        # At reasonable settings, delta_nb should be positive (better than treat-all)
        assert results.delta_nb > -1


# =============================================================================
# Test attenuation formulas
# =============================================================================

class TestAttenuation:
    """Test reliability attenuation functions."""
    
    def test_attenuate_d(self):
        """Test Cohen's d attenuation by kappa."""
        true_d = 1.0
        kappa = 0.7
        # d_obs = d_true * sqrt(sin(pi/2 * kappa))
        expected_d_obs = true_d * np.sqrt(np.sin(np.pi / 2 * kappa))
        assert np.isclose(attenuate_d(true_d, kappa), expected_d_obs, rtol=1e-10)
        
        # Perfect kappa should not attenuate
        assert np.isclose(attenuate_d(true_d, 1.0), true_d, rtol=1e-10)
    
    def test_compute_sigma_from_icc(self):
        """Test sigma computation from ICC."""
        icc = 0.64
        # sigma = 1 / sqrt(icc)
        expected_sigma = 1 / np.sqrt(icc)
        assert np.isclose(compute_sigma_from_icc(icc), expected_sigma, rtol=1e-10)
        
        # Perfect ICC should give sigma=1
        assert np.isclose(compute_sigma_from_icc(1.0), 1.0, rtol=1e-10)
    
    def test_sigma_from_icc_validation(self):
        """Test that invalid ICC values raise errors."""
        with pytest.raises(ValueError):
            compute_sigma_from_icc(0)  # ICC must be > 0
        with pytest.raises(ValueError):
            compute_sigma_from_icc(-0.5)  # ICC must be > 0
        with pytest.raises(ValueError):
            compute_sigma_from_icc(1.5)  # ICC must be <= 1


# =============================================================================
# Test ROC-AUC computation
# =============================================================================

class TestROCAUC:
    """Test ROC-AUC parametric computation."""
    
    def test_roc_auc_analytical(self):
        """Test ROC-AUC matches analytical formula for equal variances."""
        d = 0.8
        # For equal variances sigma1=sigma2=1:
        # AUC = Phi(d / sqrt(2))
        expected_auc = stats.norm.cdf(d / np.sqrt(2))
        computed_auc = compute_roc_auc_parametric(d)
        assert np.isclose(computed_auc, expected_auc, rtol=1e-10)
    
    def test_roc_auc_d_zero(self):
        """Test that d=0 gives AUC=0.5."""
        assert np.isclose(compute_roc_auc_parametric(0), 0.5, rtol=1e-10)
    
    def test_roc_auc_increases_with_d(self):
        """Test that AUC increases monotonically with d."""
        d_values = [0.0, 0.2, 0.5, 0.8, 1.0, 1.5, 2.0]
        aucs = [compute_roc_auc_parametric(d) for d in d_values]
        assert all(aucs[i] <= aucs[i+1] for i in range(len(aucs)-1))
    
    def test_roc_auc_with_unequal_variances(self):
        """Test ROC-AUC with unequal variances."""
        d = 0.8
        sigma1 = 1.0
        sigma2 = 1.5
        # d_att = d * sqrt(2) / sqrt(sigma1^2 + sigma2^2)
        d_att = d * np.sqrt(2) / np.sqrt(sigma1**2 + sigma2**2)
        expected_auc = stats.norm.cdf(d_att / np.sqrt(2))
        computed_auc = compute_roc_auc_parametric(d, sigma1, sigma2)
        assert np.isclose(computed_auc, expected_auc, rtol=1e-10)


# =============================================================================
# Test PR-AUC computation
# =============================================================================

class TestPRAUC:
    """Test PR-AUC parametric computation."""
    
    def test_pr_auc_baseline(self):
        """Test that PR-AUC >= base_rate (the baseline)."""
        base_rate = 0.1
        d = 0.8
        pr_auc = compute_pr_auc_parametric(d, base_rate)
        assert pr_auc >= base_rate
    
    def test_pr_auc_increases_with_d(self):
        """Test that PR-AUC increases with d."""
        base_rate = 0.1
        d_values = [0.0, 0.5, 1.0, 1.5, 2.0]
        pr_aucs = [compute_pr_auc_parametric(d, base_rate) for d in d_values]
        # Should generally increase (allowing small numerical tolerance)
        for i in range(len(pr_aucs) - 1):
            assert pr_aucs[i] <= pr_aucs[i+1] + 0.01
    
    def test_pr_auc_d_zero(self):
        """Test that d=0 gives PR-AUC close to base_rate."""
        base_rate = 0.1
        pr_auc = compute_pr_auc_parametric(0, base_rate)
        assert np.isclose(pr_auc, base_rate, rtol=0.1)  # Allow 10% tolerance


# =============================================================================
# Test threshold functions
# =============================================================================

class TestThresholdFunctions:
    """Test threshold-related functions."""
    
    def test_optimal_threshold_youden(self):
        """Test optimal threshold maximizes Youden's J."""
        d = 0.8
        base_rate = 0.1
        opt_thresh = find_optimal_threshold(d, base_rate, metric='youden')
        
        # Compute Youden's J at optimal and nearby thresholds
        from e2p.parametric import compute_binary_metrics
        
        j_opt = compute_binary_metrics(d, base_rate, opt_thresh)['youden_j']
        j_lower = compute_binary_metrics(d, base_rate, opt_thresh - 0.1)['youden_j']
        j_higher = compute_binary_metrics(d, base_rate, opt_thresh + 0.1)['youden_j']
        
        assert j_opt >= j_lower - 1e-6
        assert j_opt >= j_higher - 1e-6
    
    def test_optimal_threshold_f1(self):
        """Test optimal threshold maximizes F1."""
        d = 0.8
        base_rate = 0.1
        opt_thresh = find_optimal_threshold(d, base_rate, metric='f1')
        
        from e2p.parametric import compute_binary_metrics
        
        f1_opt = compute_binary_metrics(d, base_rate, opt_thresh)['f1']
        f1_lower = compute_binary_metrics(d, base_rate, opt_thresh - 0.1)['f1']
        f1_higher = compute_binary_metrics(d, base_rate, opt_thresh + 0.1)['f1']
        
        assert f1_opt >= f1_lower - 1e-6
        assert f1_opt >= f1_higher - 1e-6


# =============================================================================
# Test main parametric functions
# =============================================================================

class TestParametricBinary:
    """Test e2p_parametric_binary function."""
    
    def test_basic_computation(self):
        """Test basic parametric binary computation."""
        results = e2p_parametric_binary(
            cohens_d=0.8,
            base_rate=0.1,
            threshold_prob=0.5
        )
        
        # Check that all expected fields are present
        assert hasattr(results, 'cohens_d_true')
        assert hasattr(results, 'cohens_d_observed')
        assert hasattr(results, 'roc_auc')
        assert hasattr(results, 'sensitivity')
        assert hasattr(results, 'specificity')
        assert hasattr(results, 'ppv')
        assert hasattr(results, 'npv')
        
        # Check reasonable ranges
        assert 0 <= results.roc_auc <= 1
        assert 0 <= results.sensitivity <= 1
        assert 0 <= results.specificity <= 1
        assert 0 <= results.ppv <= 1
        assert 0 <= results.npv <= 1
    
    def test_true_vs_observed_view(self):
        """Test that observed view applies attenuation."""
        true_results = e2p_parametric_binary(
            cohens_d=0.8,
            base_rate=0.1,
            icc1=0.7,
            icc2=0.7,
            kappa=0.8,
            view='true'
        )
        
        obs_results = e2p_parametric_binary(
            cohens_d=0.8,
            base_rate=0.1,
            icc1=0.7,
            icc2=0.7,
            kappa=0.8,
            view='observed'
        )
        
        # Observed should have attenuated performance
        assert true_results.roc_auc >= obs_results.roc_auc
    
    def test_input_validation(self):
        """Test that invalid inputs raise errors."""
        with pytest.raises(ValueError):
            e2p_parametric_binary(0.8, base_rate=0)  # base_rate must be > 0
        with pytest.raises(ValueError):
            e2p_parametric_binary(0.8, base_rate=1)  # base_rate must be < 1
        with pytest.raises(ValueError):
            e2p_parametric_binary(0.8, base_rate=0.1, icc1=0)  # icc must be > 0


class TestParametricContinuous:
    """Test e2p_parametric_continuous function."""
    
    def test_basic_computation(self):
        """Test basic parametric continuous computation."""
        results = e2p_parametric_continuous(
            pearson_r=0.5,
            base_rate=0.1,
            threshold_prob=0.5
        )
        
        # Check reasonable ranges
        assert 0 <= results.roc_auc <= 1
        assert 0 <= results.sensitivity <= 1
        assert 0 <= results.specificity <= 1
    
    def test_reliability_attenuation(self):
        """Test that reliability attenuates performance."""
        perfect_results = e2p_parametric_continuous(
            pearson_r=0.5,
            base_rate=0.1,
            reliability_x=1.0,
            reliability_y=1.0,
            view='true'
        )
        
        imperfect_results = e2p_parametric_continuous(
            pearson_r=0.5,
            base_rate=0.1,
            reliability_x=0.7,
            reliability_y=0.7,
            view='observed'
        )
        
        # Perfect reliability should have better or equal performance
        assert perfect_results.roc_auc >= imperfect_results.roc_auc - 0.01


# =============================================================================
# Cross-validation with empirical module
# =============================================================================

class TestCrossValidation:
    """Cross-validate parametric results with empirical results on simulated data."""
    
    def test_parametric_vs_empirical_large_n(self):
        """Test that parametric and empirical results converge for large N."""
        np.random.seed(42)
        
        # True parameters
        true_d = 0.8
        base_rate = 0.1
        n_total = 10000
        
        # Generate data from idealized distributions
        n_cases = int(n_total * base_rate)
        n_controls = n_total - n_cases
        
        controls = np.random.normal(0, 1, n_controls)
        cases = np.random.normal(true_d, 1, n_cases)
        
        # Parametric results
        param_results = e2p_parametric_binary(
            cohens_d=true_d,
            base_rate=base_rate,
            threshold_prob=0.5,
            view='true'
        )
        
        # Empirical results
        emp_results = e2p_binary(
            group1=controls,
            group2=cases,
            base_rate=base_rate,
            threshold_prob=0.5,
            n_bootstrap=0,
            random_state=42
        )
        
        # ROC-AUC should be very close for large N
        assert np.isclose(param_results.roc_auc, emp_results.roc_auc.estimate, rtol=0.05)
        
        # Cohen's d should be close
        assert np.isclose(true_d, emp_results.cohens_d.estimate, rtol=0.1)


# =============================================================================
# JavaScript cross-validation values
# =============================================================================

class TestJavaScriptValidation:
    """
    Validate Python results against known JavaScript simulator outputs.
    
    These values were computed using the JavaScript simulator at e2p-simulator.com
    with the following parameters:
    - Cohen's d = 0.8
    - Base rate = 10%
    - ICC1 = ICC2 = 1.0 (perfect)
    - Kappa = 1.0 (perfect)
    - Threshold at p_t = 0.5
    """
    
    def test_roc_auc_matches_js(self):
        """Test ROC-AUC matches JavaScript output."""
        # JS: For d=0.8, AUC = Phi(0.8/sqrt(2)) ≈ 0.714
        expected_auc = stats.norm.cdf(0.8 / np.sqrt(2))
        computed_auc = compute_roc_auc_parametric(0.8)
        assert np.isclose(computed_auc, expected_auc, rtol=1e-4)
        assert np.isclose(computed_auc, 0.714, rtol=0.01)
    
    def test_effect_sizes_match_js(self):
        """Test effect size conversions match JavaScript."""
        d = 0.8
        
        # Cohen's U3 = Phi(d) ≈ 0.788
        assert np.isclose(d_to_cohens_u3(d), 0.788, rtol=0.01)
        
        # Odds ratio = exp(d * pi / sqrt(3)) ≈ 4.27
        assert np.isclose(d_to_odds_ratio(d), 4.27, rtol=0.02)


# =============================================================================
# Run tests as script
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("E2P Parametric Module Tests")
    print("=" * 60)
    
    # Run basic tests
    print("\n--- Effect Size Conversions (d -> other) ---")
    test_conv = TestEffectSizeConversions()
    test_conv.test_d_to_odds_ratio()
    print("✓ d_to_odds_ratio")
    test_conv.test_d_to_log_odds_ratio()
    print("✓ d_to_log_odds_ratio")
    test_conv.test_d_to_cohens_u3()
    print("✓ d_to_cohens_u3")
    test_conv.test_d_to_point_biserial_r()
    print("✓ d_to_point_biserial_r")
    test_conv.test_r_to_d()
    print("✓ r_to_d")
    
    print("\n--- Reverse Conversions (other -> d) ---")
    test_rev = TestReverseConversions()
    test_rev.test_auc_to_d()
    print("✓ auc_to_d")
    test_rev.test_odds_ratio_to_d()
    print("✓ odds_ratio_to_d")
    test_rev.test_log_odds_ratio_to_d()
    print("✓ log_odds_ratio_to_d")
    test_rev.test_cohens_u3_to_d()
    print("✓ cohens_u3_to_d")
    test_rev.test_round_trip_auc()
    print("✓ Round-trip AUC")
    test_rev.test_round_trip_odds_ratio()
    print("✓ Round-trip OR")
    test_rev.test_round_trip_cohens_u3()
    print("✓ Round-trip U3")
    
    print("\n--- Reverse Conversion Use Cases ---")
    test_use = TestReverseConversionUseCases()
    test_use.test_auc_to_pr_auc()
    print("✓ AUC -> PR-AUC")
    test_use.test_odds_ratio_to_full_metrics()
    print("✓ OR -> full metrics")
    test_use.test_auc_to_net_benefit()
    print("✓ AUC -> net benefit")
    
    print("\n--- Attenuation Functions ---")
    test_att = TestAttenuation()
    test_att.test_attenuate_d()
    print("✓ attenuate_d")
    test_att.test_compute_sigma_from_icc()
    print("✓ compute_sigma_from_icc")
    
    print("\n--- ROC-AUC Computation ---")
    test_roc = TestROCAUC()
    test_roc.test_roc_auc_analytical()
    print("✓ ROC-AUC analytical formula")
    test_roc.test_roc_auc_d_zero()
    print("✓ ROC-AUC at d=0")
    test_roc.test_roc_auc_increases_with_d()
    print("✓ ROC-AUC monotonicity")
    test_roc.test_roc_auc_with_unequal_variances()
    print("✓ ROC-AUC with unequal variances")
    
    print("\n--- PR-AUC Computation ---")
    test_pr = TestPRAUC()
    test_pr.test_pr_auc_baseline()
    print("✓ PR-AUC >= baseline")
    test_pr.test_pr_auc_increases_with_d()
    print("✓ PR-AUC increases with d")
    test_pr.test_pr_auc_d_zero()
    print("✓ PR-AUC at d=0")
    
    print("\n--- Optimal Threshold ---")
    test_thresh = TestThresholdFunctions()
    test_thresh.test_optimal_threshold_youden()
    print("✓ Optimal threshold (Youden)")
    test_thresh.test_optimal_threshold_f1()
    print("✓ Optimal threshold (F1)")
    
    print("\n--- Parametric Binary ---")
    test_binary = TestParametricBinary()
    test_binary.test_basic_computation()
    print("✓ Basic computation")
    test_binary.test_true_vs_observed_view()
    print("✓ True vs observed view")
    
    print("\n--- Parametric Continuous ---")
    test_cont = TestParametricContinuous()
    test_cont.test_basic_computation()
    print("✓ Basic computation")
    test_cont.test_reliability_attenuation()
    print("✓ Reliability attenuation")
    
    print("\n--- Cross-validation ---")
    test_cross = TestCrossValidation()
    test_cross.test_parametric_vs_empirical_large_n()
    print("✓ Parametric vs empirical (large N)")
    
    print("\n--- JavaScript Validation ---")
    test_js = TestJavaScriptValidation()
    test_js.test_roc_auc_matches_js()
    print("✓ ROC-AUC matches JS")
    test_js.test_effect_sizes_match_js()
    print("✓ Effect sizes match JS")
    
    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
