#' E2P Continuous Outcome Analysis
#'
#' @name continuous
#' @description Functions for computing effect sizes and predictive metrics
#'   from continuous predictor (X) and outcome (Y) data.
NULL

#' Create an E2PContinuous object
#'
#' Takes continuous predictor (X) and outcome (Y) data, dichotomizes the
#' outcome using the base rate, then computes all classification metrics.
#'
#' @param X Numeric vector of continuous predictor values
#' @param Y Numeric vector of continuous outcome values
#' @param base_rate Proportion of cases (top base_rate of Y are classified as positive)
#' @param threshold_prob Threshold probability (p_t) for threshold-dependent metrics
#' @param n_bootstrap Number of bootstrap iterations (default: 1000)
#' @param ci_level Confidence interval level (default: 0.95)
#' @param seed Random seed for reproducibility
#' @return S3 object of class "e2p_continuous"
#' @export
E2PContinuous <- function(X, Y, base_rate, threshold_prob,
                          n_bootstrap = 1000, ci_level = 0.95, seed = NULL) {
  X <- as.numeric(X)
  Y <- as.numeric(Y)

  # Validation
  if (length(X) != length(Y)) {
    stop("X and Y must have the same length")
  }
  if (length(X) == 0) {
    stop("X and Y must have at least one observation")
  }
  if (base_rate <= 0 || base_rate >= 1) {
    stop("base_rate must be between 0 and 1 (exclusive)")
  }
  if (threshold_prob <= 0 || threshold_prob >= 1) {
    stop("threshold_prob must be between 0 and 1 (exclusive)")
  }

  # Dichotomize Y based on base_rate
  # Top base_rate proportion of Y are "cases" (group2)
  y_threshold <- quantile(Y, 1 - base_rate)
  is_case <- Y >= y_threshold

  # Split X into two groups based on dichotomized Y
  group1 <- X[!is_case]  # controls (lower Y)
  group2 <- X[is_case]   # cases (higher Y)

  if (length(group1) == 0 || length(group2) == 0) {
    stop("Dichotomization resulted in empty group(s)")
  }

  structure(
    list(
      X = X,
      Y = Y,
      base_rate = base_rate,
      threshold_prob = threshold_prob,
      n_bootstrap = n_bootstrap,
      ci_level = ci_level,
      seed = seed,
      y_threshold = unname(y_threshold),
      is_case = is_case,
      group1 = group1,
      group2 = group2
    ),
    class = "e2p_continuous"
  )
}

#' Compute all metrics for E2PContinuous
#'
#' @param obj E2PContinuous object
#' @return S3 object of class "e2p_binary_results"
#' @export
compute.e2p_continuous <- function(obj) {
  calculator <- E2PBinary(
    group1 = obj$group1,
    group2 = obj$group2,
    base_rate = obj$base_rate,
    threshold_prob = obj$threshold_prob,
    n_bootstrap = obj$n_bootstrap,
    ci_level = obj$ci_level,
    seed = obj$seed
  )
  compute.e2p_binary(calculator)
}

#' Compute metrics at a different reliability for E2PContinuous
#'
#' @param obj E2PContinuous object
#' @param r_x_current Current reliability of X
#' @param r_x_target Target reliability of X (default: 1.0)
#' @param r_y_current Current reliability of Y (optional)
#' @param r_y_target Target reliability of Y (optional)
#' @param center Center for transform: "mean" or "median"
#' @return S3 object of class "e2p_binary_results"
#' @export
compute_at_reliability.e2p_continuous <- function(obj, r_x_current, r_x_target = 1.0,
                                                   r_y_current = NULL, r_y_target = NULL,
                                                   center = "mean") {
  X_tgt <- transform_for_target_reliability(obj$X, r_x_current, r_x_target, center = center)

  # Optional Y transform check
  if (xor(is.null(r_y_current), is.null(r_y_target))) {
    stop("Provide both r_y_current and r_y_target, or neither")
  }

  # Use fixed is_case mask from original data
  group1_tgt <- X_tgt[!obj$is_case]
  group2_tgt <- X_tgt[obj$is_case]

  calculator <- E2PBinary(
    group1 = group1_tgt,
    group2 = group2_tgt,
    base_rate = obj$base_rate,
    threshold_prob = obj$threshold_prob,
    n_bootstrap = obj$n_bootstrap,
    ci_level = obj$ci_level,
    seed = obj$seed
  )
  compute.e2p_binary(calculator)
}

#' @export
print.e2p_continuous <- function(x, ...) {
  cat("E2PContinuous Object\n")
  cat("====================\n")
  cat(sprintf("  N samples:        %d\n", length(x$X)))
  cat(sprintf("  Base rate:        %.4f\n", x$base_rate))
  cat(sprintf("  Threshold prob:   %.4f\n", x$threshold_prob))
  cat(sprintf("  Y threshold:      %.4f\n", x$y_threshold))
  cat(sprintf("  N controls:       %d\n", length(x$group1)))
  cat(sprintf("  N cases:          %d\n", length(x$group2)))
  invisible(x)
}

#' Convenience function to compute E2P metrics from continuous data
#'
#' Dichotomizes the outcome Y using base_rate, then computes all metrics.
#'
#' @param X Numeric vector of continuous predictor values
#' @param Y Numeric vector of continuous outcome values
#' @param base_rate Proportion of cases (top base_rate of Y are classified as positive)
#' @param threshold_prob Threshold probability (default: 0.5)
#' @param n_bootstrap Number of bootstrap iterations (default: 1000)
#' @param ci_level Confidence interval level (default: 0.95)
#' @param seed Random seed for reproducibility
#' @return S3 object of class "e2p_binary_results"
#' @export
#' @examples
#' set.seed(42)
#' n <- 500
#' X <- rnorm(n, mean = 0, sd = 1)
#' Y <- 0.6 * X + rnorm(n, mean = 0, sd = 0.8)
#' results <- e2p_continuous(X, Y, base_rate = 0.10, threshold_prob = 0.20)
#' print(results)
e2p_continuous <- function(X, Y, base_rate, threshold_prob = 0.5,
                           n_bootstrap = 1000, ci_level = 0.95, seed = NULL) {
  obj <- E2PContinuous(
    X = X,
    Y = Y,
    base_rate = base_rate,
    threshold_prob = threshold_prob,
    n_bootstrap = n_bootstrap,
    ci_level = ci_level,
    seed = seed
  )
  compute.e2p_continuous(obj)
}

#' Compute E2P continuous metrics with reliability transformation (deattenuation)
#'
#' Keeps the original case/control split fixed (based on observed Y).
#'
#' @param X Numeric vector of continuous predictor values
#' @param Y Numeric vector of continuous outcome values
#' @param base_rate Proportion of cases
#' @param threshold_prob Threshold probability (default: 0.5)
#' @param r_x_current Current reliability of X
#' @param r_x_target Target reliability of X (default: 1.0)
#' @param r_y_current Current reliability of Y (optional)
#' @param r_y_target Target reliability of Y (optional)
#' @param n_bootstrap Number of bootstrap iterations (default: 1000)
#' @param ci_level Confidence interval level (default: 0.95)
#' @param seed Random seed
#' @param center Center for transform: "mean" or "median"
#' @return S3 object of class "e2p_binary_results"
#' @export
e2p_continuous_deattenuated <- function(X, Y, base_rate, threshold_prob = 0.5,
                                         r_x_current, r_x_target = 1.0,
                                         r_y_current = NULL, r_y_target = NULL,
                                         n_bootstrap = 1000, ci_level = 0.95,
                                         seed = NULL, center = "mean") {
  obj <- E2PContinuous(
    X = X,
    Y = Y,
    base_rate = base_rate,
    threshold_prob = threshold_prob,
    n_bootstrap = n_bootstrap,
    ci_level = ci_level,
    seed = seed
  )
  compute_at_reliability.e2p_continuous(
    obj,
    r_x_current = r_x_current,
    r_x_target = r_x_target,
    r_y_current = r_y_current,
    r_y_target = r_y_target,
    center = center
  )
}
