# Tests for e2p parametric module

# =============================================================================
# Effect Size Conversions
# =============================================================================

test_that("d_to_odds_ratio computes correctly", {
  # OR = exp(d * pi / sqrt(3))
  d <- 0.8
  expected_or <- exp(0.8 * pi / sqrt(3))
  expect_equal(d_to_odds_ratio(d), expected_or, tolerance = 1e-10)

  # d=0 should give OR=1

  expect_equal(d_to_odds_ratio(0), 1.0, tolerance = 1e-10)
})

test_that("d_to_log_odds_ratio computes correctly", {
  d <- 0.8
  expected_lor <- 0.8 * pi / sqrt(3)
  expect_equal(d_to_log_odds_ratio(d), expected_lor, tolerance = 1e-10)

  # d=0 should give log(OR)=0
  expect_equal(d_to_log_odds_ratio(0), 0.0, tolerance = 1e-10)
})

test_that("d_to_cohens_u3 computes correctly", {
  # U3 = Phi(d), where Phi is standard normal CDF
  d <- 0.8
  expected_u3 <- pnorm(d)
  expect_equal(d_to_cohens_u3(d), expected_u3, tolerance = 1e-10)

  # d=0 should give U3=0.5
  expect_equal(d_to_cohens_u3(0), 0.5, tolerance = 1e-10)
})

test_that("d_to_point_biserial_r computes correctly", {
  d <- 0.8
  base_rate <- 0.5
  # r = d / sqrt(d^2 + 1/(p*(1-p)))
  expected_r <- d / sqrt(d^2 + 1 / (base_rate * (1 - base_rate)))
  expect_equal(d_to_point_biserial_r(d, base_rate), expected_r, tolerance = 1e-10)

  # At base_rate=0.5, this simplifies to d / sqrt(d^2 + 4)
  expected_r_balanced <- d / sqrt(d^2 + 4)
  expect_equal(d_to_point_biserial_r(d, 0.5), expected_r_balanced, tolerance = 1e-10)
})

test_that("r_to_d computes correctly", {
  r <- 0.5
  # d = 2r / sqrt(1 - r^2)
  expected_d <- 2 * r / sqrt(1 - r^2)
  expect_equal(r_to_d(r), expected_d, tolerance = 1e-10)

  # r=0 should give d=0
  expect_equal(r_to_d(0), 0.0, tolerance = 1e-10)
})

# =============================================================================
# Reverse Conversions (other effect sizes -> Cohen's d)
# =============================================================================

test_that("auc_to_d computes correctly", {
  # d = Phi^(-1)(AUC) * sqrt(2)
  auc <- 0.714
  expected_d <- qnorm(auc) * sqrt(2)
  expect_equal(auc_to_d(auc), expected_d, tolerance = 1e-10)

  # AUC=0.5 should give d=0
  expect_equal(auc_to_d(0.5), 0.0, tolerance = 1e-10)

  # AUC below 0.5 should return 0
  expect_equal(auc_to_d(0.4), 0.0, tolerance = 1e-10)
})

test_that("odds_ratio_to_d computes correctly", {
  # d = ln(OR) * sqrt(3) / pi
  or_val <- 4.27
  expected_d <- log(or_val) * sqrt(3) / pi
  expect_equal(odds_ratio_to_d(or_val), expected_d, tolerance = 1e-10)

  # OR=1 should give d=0
  expect_equal(odds_ratio_to_d(1.0), 0.0, tolerance = 1e-10)
})

test_that("odds_ratio_to_d validates inputs", {
  expect_error(odds_ratio_to_d(0))   # OR must be > 0
  expect_error(odds_ratio_to_d(-1))  # OR must be > 0
})

test_that("log_odds_ratio_to_d computes correctly", {
  # d = log_OR * sqrt(3) / pi
  log_or <- 1.45
  expected_d <- log_or * sqrt(3) / pi
  expect_equal(log_odds_ratio_to_d(log_or), expected_d, tolerance = 1e-10)

  # log(OR)=0 should give d=0
  expect_equal(log_odds_ratio_to_d(0), 0.0, tolerance = 1e-10)
})

test_that("cohens_u3_to_d computes correctly", {
  # d = Phi^(-1)(U3)
  u3 <- 0.788
  expected_d <- qnorm(u3)
  expect_equal(cohens_u3_to_d(u3), expected_d, tolerance = 1e-10)

  # U3=0.5 should give d=0
  expect_equal(cohens_u3_to_d(0.5), 0.0, tolerance = 1e-10)
})

test_that("cohens_u3_to_d validates inputs", {
  expect_error(cohens_u3_to_d(0))  # U3 must be > 0
  expect_error(cohens_u3_to_d(1))  # U3 must be < 1
})

test_that("round-trip AUC conversion", {
  d_original <- 0.8
  auc <- compute_roc_auc_parametric(d_original)
  d_recovered <- auc_to_d(auc)
  expect_equal(d_original, d_recovered, tolerance = 1e-6)
})

test_that("round-trip odds ratio conversion", {
  d_original <- 0.8
  or_val <- d_to_odds_ratio(d_original)
  d_recovered <- odds_ratio_to_d(or_val)
  expect_equal(d_original, d_recovered, tolerance = 1e-10)
})

test_that("round-trip log odds ratio conversion", {
  d_original <- 0.8
  log_or <- d_to_log_odds_ratio(d_original)
  d_recovered <- log_odds_ratio_to_d(log_or)
  expect_equal(d_original, d_recovered, tolerance = 1e-10)
})

test_that("round-trip Cohen's U3 conversion", {
  d_original <- 0.8
  u3 <- d_to_cohens_u3(d_original)
  d_recovered <- cohens_u3_to_d(u3)
  expect_equal(d_original, d_recovered, tolerance = 1e-10)
})

# =============================================================================
# Reverse Conversion Use Cases
# =============================================================================

test_that("AUC to PR-AUC use case", {
  # Researcher has ROC-AUC = 0.75 and wants PR-AUC at base_rate = 0.05
  roc_auc <- 0.75
  base_rate <- 0.05

  # Convert to d and compute PR-AUC
  d <- auc_to_d(roc_auc)
  pr_auc <- compute_pr_auc_parametric(d, base_rate)

  # PR-AUC should be reasonable (between base_rate and 1)
  expect_true(pr_auc > base_rate)
  expect_true(pr_auc < 1.0)
})

test_that("odds ratio to full metrics use case", {
  # Researcher has OR = 3.0 from a meta-analysis
  or_val <- 3.0
  base_rate <- 0.1

  # Convert to d and get full results
  d <- odds_ratio_to_d(or_val)
  results <- e2p_parametric_binary(
    cohens_d = d,
    base_rate = base_rate,
    threshold_prob = 0.5
  )

  # Check we get reasonable results
  expect_true(results$roc_auc > 0.5 && results$roc_auc < 1.0)
  expect_true(results$sensitivity > 0 && results$sensitivity < 1)
  expect_true(results$ppv > 0 && results$ppv < 1)
})

# =============================================================================
# Attenuation Functions
# =============================================================================

test_that("attenuate_d computes correctly", {
  true_d <- 1.0
  kappa <- 0.7
  # d_obs = d_true * sqrt(sin(pi/2 * kappa))
  expected_d_obs <- true_d * sqrt(sin(pi / 2 * kappa))
  expect_equal(attenuate_d(true_d, kappa), expected_d_obs, tolerance = 1e-10)

  # Perfect kappa should not attenuate
  expect_equal(attenuate_d(true_d, 1.0), true_d, tolerance = 1e-10)
})

test_that("compute_sigma_from_icc computes correctly", {
  icc <- 0.64
  # sigma = 1 / sqrt(icc)
  expected_sigma <- 1 / sqrt(icc)
  expect_equal(compute_sigma_from_icc(icc), expected_sigma, tolerance = 1e-10)

  # Perfect ICC should give sigma=1
  expect_equal(compute_sigma_from_icc(1.0), 1.0, tolerance = 1e-10)
})

test_that("compute_sigma_from_icc validates inputs", {
  expect_error(compute_sigma_from_icc(0))      # ICC must be > 0
  expect_error(compute_sigma_from_icc(-0.5))   # ICC must be > 0
  expect_error(compute_sigma_from_icc(1.5))    # ICC must be <= 1
})

# =============================================================================
# ROC-AUC Computation
# =============================================================================

test_that("compute_roc_auc_parametric matches analytical formula", {
  d <- 0.8
  # For equal variances sigma1=sigma2=1:
  # AUC = Phi(d / sqrt(2))
  expected_auc <- pnorm(d / sqrt(2))
  computed_auc <- compute_roc_auc_parametric(d)
  expect_equal(computed_auc, expected_auc, tolerance = 1e-10)
})

test_that("compute_roc_auc_parametric returns 0.5 for d=0", {
  expect_equal(compute_roc_auc_parametric(0), 0.5, tolerance = 1e-10)
})

test_that("compute_roc_auc_parametric increases monotonically with d", {
  d_values <- c(0.0, 0.2, 0.5, 0.8, 1.0, 1.5, 2.0)
  aucs <- sapply(d_values, compute_roc_auc_parametric)

  # Check monotonicity
  for (i in seq_len(length(aucs) - 1)) {
    expect_true(aucs[i] <= aucs[i + 1])
  }
})

test_that("compute_roc_auc_parametric works with unequal variances", {
  d <- 0.8
  sigma1 <- 1.0
  sigma2 <- 1.5
  # d_att = d * sqrt(2) / sqrt(sigma1^2 + sigma2^2)
  d_att <- d * sqrt(2) / sqrt(sigma1^2 + sigma2^2)
  expected_auc <- pnorm(d_att / sqrt(2))
  computed_auc <- compute_roc_auc_parametric(d, sigma1, sigma2)
  expect_equal(computed_auc, expected_auc, tolerance = 1e-10)
})

# =============================================================================
# PR-AUC Computation
# =============================================================================

test_that("compute_pr_auc_parametric >= base_rate", {
  base_rate <- 0.1
  d <- 0.8
  pr_auc <- compute_pr_auc_parametric(d, base_rate)
  expect_true(pr_auc >= base_rate)
})

test_that("compute_pr_auc_parametric increases with d", {
  base_rate <- 0.1
  d_values <- c(0.0, 0.5, 1.0, 1.5, 2.0)
  pr_aucs <- sapply(d_values, function(d) compute_pr_auc_parametric(d, base_rate))

  # Should generally increase (allowing small numerical tolerance)
  for (i in seq_len(length(pr_aucs) - 1)) {
    expect_true(pr_aucs[i] <= pr_aucs[i + 1] + 0.01)
  }
})

test_that("compute_pr_auc_parametric close to base_rate when d=0", {
  base_rate <- 0.1
  pr_auc <- compute_pr_auc_parametric(0, base_rate)
  expect_equal(pr_auc, base_rate, tolerance = 0.1)  # Allow 10% tolerance
})

# =============================================================================
# Threshold Functions
# =============================================================================

test_that("find_optimal_threshold_parametric maximizes Youden's J", {
  d <- 0.8
  base_rate <- 0.1
  opt_thresh <- find_optimal_threshold_parametric(d, base_rate, metric = "youden")

  # Compute Youden's J at optimal and nearby thresholds
  j_opt <- compute_binary_metrics_parametric(d, base_rate, opt_thresh)$youden_j
  j_lower <- compute_binary_metrics_parametric(d, base_rate, opt_thresh - 0.1)$youden_j
  j_higher <- compute_binary_metrics_parametric(d, base_rate, opt_thresh + 0.1)$youden_j

  expect_true(j_opt >= j_lower - 1e-6)
  expect_true(j_opt >= j_higher - 1e-6)
})

test_that("find_optimal_threshold_parametric maximizes F1", {
  d <- 0.8
  base_rate <- 0.1
  opt_thresh <- find_optimal_threshold_parametric(d, base_rate, metric = "f1")

  f1_opt <- compute_binary_metrics_parametric(d, base_rate, opt_thresh)$f1
  f1_lower <- compute_binary_metrics_parametric(d, base_rate, opt_thresh - 0.1)$f1
  f1_higher <- compute_binary_metrics_parametric(d, base_rate, opt_thresh + 0.1)$f1

  expect_true(f1_opt >= f1_lower - 1e-6)
  expect_true(f1_opt >= f1_higher - 1e-6)
})

# =============================================================================
# Main Parametric Functions
# =============================================================================

test_that("e2p_parametric_binary returns expected structure", {
  results <- e2p_parametric_binary(
    cohens_d = 0.8,
    base_rate = 0.1,
    threshold_prob = 0.5
  )

  # Check that all expected fields are present
  expect_true(!is.null(results$cohens_d_true))
  expect_true(!is.null(results$cohens_d_observed))
  expect_true(!is.null(results$roc_auc))
  expect_true(!is.null(results$sensitivity))
  expect_true(!is.null(results$specificity))
  expect_true(!is.null(results$ppv))
  expect_true(!is.null(results$npv))

  # Check reasonable ranges
  expect_true(results$roc_auc >= 0 && results$roc_auc <= 1)
  expect_true(results$sensitivity >= 0 && results$sensitivity <= 1)
  expect_true(results$specificity >= 0 && results$specificity <= 1)
  expect_true(results$ppv >= 0 && results$ppv <= 1)
  expect_true(results$npv >= 0 && results$npv <= 1)
})

test_that("e2p_parametric_binary true vs observed view", {
  true_results <- e2p_parametric_binary(
    cohens_d = 0.8,
    base_rate = 0.1,
    icc1 = 0.7,
    icc2 = 0.7,
    kappa = 0.8,
    view = "true"
  )

  obs_results <- e2p_parametric_binary(
    cohens_d = 0.8,
    base_rate = 0.1,
    icc1 = 0.7,
    icc2 = 0.7,
    kappa = 0.8,
    view = "observed"
  )

  # Observed should have attenuated performance
  expect_true(true_results$roc_auc >= obs_results$roc_auc)
})

test_that("e2p_parametric_binary validates inputs", {
  expect_error(e2p_parametric_binary(0.8, base_rate = 0))    # base_rate must be > 0
  expect_error(e2p_parametric_binary(0.8, base_rate = 1))    # base_rate must be < 1
  expect_error(e2p_parametric_binary(0.8, base_rate = 0.1, icc1 = 0))  # icc must be > 0
})

test_that("e2p_parametric_continuous returns expected structure", {
  results <- e2p_parametric_continuous(
    pearson_r = 0.5,
    base_rate = 0.1,
    threshold_prob = 0.5
  )

  # Check reasonable ranges
  expect_true(results$roc_auc >= 0 && results$roc_auc <= 1)
  expect_true(results$sensitivity >= 0 && results$sensitivity <= 1)
  expect_true(results$specificity >= 0 && results$specificity <= 1)
})

test_that("e2p_parametric_continuous reliability attenuation", {
  perfect_results <- e2p_parametric_continuous(
    pearson_r = 0.5,
    base_rate = 0.1,
    reliability_x = 1.0,
    reliability_y = 1.0,
    view = "true"
  )

  imperfect_results <- e2p_parametric_continuous(
    pearson_r = 0.5,
    base_rate = 0.1,
    reliability_x = 0.7,
    reliability_y = 0.7,
    view = "observed"
  )

  # Perfect reliability should have better or equal performance
  expect_true(perfect_results$roc_auc >= imperfect_results$roc_auc - 0.01)
})

# =============================================================================
# Cross-validation with Empirical Module
# =============================================================================

test_that("parametric and empirical results converge for large N", {
  set.seed(42)

  # True parameters
  true_d <- 0.8
  base_rate <- 0.1
  n_total <- 10000

  # Generate data from idealized distributions
  n_cases <- as.integer(n_total * base_rate)
  n_controls <- n_total - n_cases

  controls <- rnorm(n_controls, mean = 0, sd = 1)
  cases <- rnorm(n_cases, mean = true_d, sd = 1)

  # Parametric results
  param_results <- e2p_parametric_binary(
    cohens_d = true_d,
    base_rate = base_rate,
    threshold_prob = 0.5,
    view = "true"
  )

  # Empirical results
  emp_results <- e2p_binary(
    group1 = controls,
    group2 = cases,
    base_rate = base_rate,
    threshold_prob = 0.5,
    n_bootstrap = 0,
    seed = 42
  )

  # ROC-AUC should be very close for large N
  expect_equal(param_results$roc_auc, emp_results$roc_auc$estimate, tolerance = 0.05)

  # Cohen's d should be close
  expect_equal(true_d, emp_results$cohens_d$estimate, tolerance = 0.1)
})

# =============================================================================
# JavaScript Cross-validation Values
# =============================================================================

test_that("ROC-AUC matches JavaScript output", {
  # JS: For d=0.8, AUC = Phi(0.8/sqrt(2)) ≈ 0.714
  expected_auc <- pnorm(0.8 / sqrt(2))
  computed_auc <- compute_roc_auc_parametric(0.8)
  expect_equal(computed_auc, expected_auc, tolerance = 1e-4)
  expect_equal(computed_auc, 0.714, tolerance = 0.01)
})

test_that("effect sizes match JavaScript output", {
  d <- 0.8

  # Cohen's U3 = Phi(d) ≈ 0.788
  expect_equal(d_to_cohens_u3(d), 0.788, tolerance = 0.01)

  # Odds ratio = exp(d * pi / sqrt(3)) ≈ 4.27
  expect_equal(d_to_odds_ratio(d), 4.27, tolerance = 0.02)
})
