# Tests for e2p R package

test_that("transform_for_target_reliability scales variance correctly", {
  set.seed(42)
  x <- rnorm(1000, mean = 0, sd = 1)
  r_cur <- 0.50
  r_tgt <- 0.90

  x_tgt <- transform_for_target_reliability(x, r_cur, r_tgt, center = "mean")

  var_ratio <- var(x_tgt) / var(x)
  expected_ratio <- r_cur / r_tgt

  expect_equal(var_ratio, expected_ratio, tolerance = 0.05)
})

test_that("compute_cohens_d returns expected value", {
  # Zero variance case: returns 0 (undefined d, fallback)
  g1 <- c(0, 0, 0, 0)
  g2 <- c(1, 1, 1, 1)
  d <- compute_cohens_d(g1, g2)
  expect_equal(d, 0)  # Pooled SD = 0, so d = 0 by convention

  # Realistic case with variance
  set.seed(42)
  g1 <- rnorm(100, mean = 0, sd = 1)
  g2 <- rnorm(100, mean = 1, sd = 1)
  d <- compute_cohens_d(g1, g2)
  expect_true(d > 0.5 && d < 1.5)  # Should be around 1
})

test_that("compute_roc_auc returns value between 0 and 1", {
  set.seed(42)
  g1 <- rnorm(100, mean = 0, sd = 1)
  g2 <- rnorm(100, mean = 1, sd = 1)

  auc <- compute_roc_auc(g1, g2)
  expect_true(auc >= 0 && auc <= 1)
  expect_true(auc > 0.5)  # Should be better than chance
})

test_that("e2p_binary returns expected structure", {
  set.seed(42)
  controls <- rnorm(200, mean = 0, sd = 1)
  cases <- rnorm(100, mean = 1.5, sd = 1)

  results <- e2p_binary(controls, cases,
                        base_rate = 0.10,
                        threshold_prob = 0.20,
                        n_bootstrap = 50,
                        seed = 42)

  # Check structure
  expect_s3_class(results, "e2p_binary_results")
  expect_s3_class(results$cohens_d, "metric_with_ci")
  expect_s3_class(results$roc_auc, "metric_with_ci")

  # Check values are reasonable
  expect_true(results$cohens_d$estimate > 0)
  expect_true(results$roc_auc$estimate > 0.5)
  expect_true(results$sensitivity$estimate >= 0 && results$sensitivity$estimate <= 1)
  expect_true(results$specificity$estimate >= 0 && results$specificity$estimate <= 1)
})

test_that("e2p_continuous returns expected structure", {
  set.seed(42)
  n <- 500
  X <- rnorm(n, mean = 0, sd = 1)
  Y <- 0.6 * X + rnorm(n, mean = 0, sd = 0.8)

  results <- e2p_continuous(X, Y,
                            base_rate = 0.10,
                            threshold_prob = 0.20,
                            n_bootstrap = 50,
                            seed = 42)

  # Check structure
  expect_s3_class(results, "e2p_binary_results")

  # Check values are reasonable
  expect_true(results$cohens_d$estimate > 0)
  expect_true(results$roc_auc$estimate > 0.5)
})

test_that("e2p_binary_deattenuated increases effect size", {
  set.seed(42)
  controls <- rnorm(200, mean = 0, sd = 1)
  cases <- rnorm(100, mean = 1.5, sd = 1)

  results_orig <- e2p_binary(controls, cases,
                             base_rate = 0.10,
                             threshold_prob = 0.20,
                             n_bootstrap = 0,
                             seed = 42)

  results_deatt <- e2p_binary_deattenuated(controls, cases,
                                           base_rate = 0.10,
                                           threshold_prob = 0.20,
                                           r_current = 0.60,
                                           r_target = 1.0,
                                           n_bootstrap = 0,
                                           seed = 42)

  # Deattenuated d should be larger
  expect_true(results_deatt$cohens_d$estimate > results_orig$cohens_d$estimate)
})

test_that("metric_with_ci prints correctly", {
  m <- metric_with_ci(0.75, 0.60, 0.90)
  expect_output(print(m), "0.7500")
  expect_output(print(m), "0.6000")
  expect_output(print(m), "0.9000")
})

test_that("E2PBinary validates inputs", {
  expect_error(E2PBinary(numeric(0), c(1, 2), 0.1, 0.2),
               "Both groups must have at least one observation")
  expect_error(E2PBinary(c(1, 2), c(1, 2), 0, 0.2),
               "base_rate must be between 0 and 1")
  expect_error(E2PBinary(c(1, 2), c(1, 2), 0.1, 0),
               "threshold_prob must be between 0 and 1")
})

test_that("E2PContinuous validates inputs", {
  expect_error(E2PContinuous(c(1, 2), c(1, 2, 3), 0.1, 0.2),
               "X and Y must have the same length")
  expect_error(E2PContinuous(c(1, 2), c(1, 2), 0, 0.2),
               "base_rate must be between 0 and 1")
})

test_that("compute_threshold_metrics returns all expected metrics", {
  set.seed(42)
  g1 <- rnorm(100, mean = 0, sd = 1)
  g2 <- rnorm(100, mean = 1, sd = 1)
  threshold <- 0.5
  base_rate <- 0.1
  pt <- 0.2

  metrics <- compute_threshold_metrics(g1, g2, threshold, base_rate, pt)

  expected_names <- c("sensitivity", "specificity", "ppv", "npv",
                      "accuracy", "balanced_accuracy", "f1", "mcc",
                      "lr_plus", "lr_minus", "dor", "youden_j", "g_mean",
                      "kappa", "post_test_prob_plus", "post_test_prob_minus",
                      "delta_nb")

  for (nm in expected_names) {
    expect_true(nm %in% names(metrics), info = paste("Missing:", nm))
  }
})
