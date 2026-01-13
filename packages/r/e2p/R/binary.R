#' E2P Binary Outcome Analysis
#'
#' @name binary
#' @description Functions for computing effect sizes and predictive metrics
#'   from two-group (binary outcome) data.
NULL

#' Create a MetricWithCI object
#'
#' @param estimate Point estimate
#' @param ci_lower Lower CI bound
#' @param ci_upper Upper CI bound
#' @return S3 object of class "metric_with_ci"
#' @export
metric_with_ci <- function(estimate, ci_lower, ci_upper) {

  structure(
    list(estimate = estimate, ci_lower = ci_lower, ci_upper = ci_upper),
    class = "metric_with_ci"
  )
}

#' @export
print.metric_with_ci <- function(x, ...) {
  cat(sprintf("%.4f [%.4f, %.4f]\n", x$estimate, x$ci_lower, x$ci_upper))
  invisible(x)
}

#' @export
format.metric_with_ci <- function(x, ...) {
  sprintf("%.4f [%.4f, %.4f]", x$estimate, x$ci_lower, x$ci_upper)
}

#' Create an E2PBinary object
#'
#' @param group1 Numeric vector for group 1 (controls/negatives)
#' @param group2 Numeric vector for group 2 (cases/positives)
#' @param base_rate Real-world prevalence of group 2 (between 0 and 1)
#' @param threshold_prob Threshold probability (p_t) for threshold-dependent metrics
#' @param n_bootstrap Number of bootstrap iterations for CI computation (default: 1000)
#' @param ci_level Confidence interval level (default: 0.95)
#' @param seed Random seed for reproducibility
#' @return S3 object of class "e2p_binary"
#' @export
E2PBinary <- function(group1, group2, base_rate, threshold_prob,
                      n_bootstrap = 1000, ci_level = 0.95, seed = NULL) {
  group1 <- as.numeric(group1)
  group2 <- as.numeric(group2)

  # Validation
 if (length(group1) == 0 || length(group2) == 0) {
    stop("Both groups must have at least one observation")
  }
  if (base_rate <= 0 || base_rate >= 1) {
    stop("base_rate must be between 0 and 1 (exclusive)")
  }
  if (threshold_prob <= 0 || threshold_prob >= 1) {
    stop("threshold_prob must be between 0 and 1 (exclusive)")
  }
  if (ci_level <= 0 || ci_level >= 1) {
    stop("ci_level must be between 0 and 1 (exclusive)")
  }

  structure(
    list(
      group1 = group1,
      group2 = group2,
      base_rate = base_rate,
      threshold_prob = threshold_prob,
      n_bootstrap = n_bootstrap,
      ci_level = ci_level,
      seed = seed,
      n1 = length(group1),
      n2 = length(group2)
    ),
    class = "e2p_binary"
  )
}

#' Compute all metrics for E2PBinary
#'
#' @param obj E2PBinary object
#' @return S3 object of class "e2p_binary_results"
#' @export
compute.e2p_binary <- function(obj) {
  if (!is.null(obj$seed)) set.seed(obj$seed)

  # Compute point estimates
  point_estimates <- compute_all_metrics_binary(
    obj$group1, obj$group2, obj$base_rate, obj$threshold_prob
  )

  # Bootstrap
  if (obj$n_bootstrap > 0) {
    boot_results <- lapply(names(point_estimates), function(nm) numeric(0))
    names(boot_results) <- names(point_estimates)

    for (b in seq_len(obj$n_bootstrap)) {
      g1_boot <- sample(obj$group1, obj$n1, replace = TRUE)
      g2_boot <- sample(obj$group2, obj$n2, replace = TRUE)

      tryCatch({
        boot_metrics <- compute_all_metrics_binary(
          g1_boot, g2_boot, obj$base_rate, obj$threshold_prob
        )
        for (nm in names(boot_metrics)) {
          boot_results[[nm]] <- c(boot_results[[nm]], boot_metrics[[nm]])
        }
      }, error = function(e) NULL)
    }
  } else {
    boot_results <- NULL
  }

  # Construct results with CIs
  alpha <- 1 - obj$ci_level
  ci_lower_pct <- alpha / 2
  ci_upper_pct <- 1 - alpha / 2

  make_metric_with_ci <- function(key) {
    estimate <- point_estimates[[key]]
    if (!is.null(boot_results) && length(boot_results[[key]]) > 0) {
      boot_vals <- boot_results[[key]]
      boot_vals <- boot_vals[is.finite(boot_vals)]
      if (length(boot_vals) > 0) {
        ci_lower <- quantile(boot_vals, ci_lower_pct, na.rm = TRUE)
        ci_upper <- quantile(boot_vals, ci_upper_pct, na.rm = TRUE)
      } else {
        ci_lower <- ci_upper <- estimate
      }
    } else {
      ci_lower <- ci_upper <- estimate
    }
    metric_with_ci(estimate, unname(ci_lower), unname(ci_upper))
  }

  # Compute curves
  roc_curve <- compute_roc_curve(obj$group1, obj$group2)
  pr_curve <- compute_pr_curve(obj$group1, obj$group2, obj$base_rate)

  structure(
    list(
      # Effect sizes
      cohens_d = make_metric_with_ci("cohens_d"),
      cohens_u3 = make_metric_with_ci("cohens_u3"),
      r = make_metric_with_ci("r"),
      eta_squared = make_metric_with_ci("eta_squared"),
      odds_ratio = make_metric_with_ci("odds_ratio"),
      log_odds_ratio = make_metric_with_ci("log_odds_ratio"),

      # Discrimination
      roc_auc = make_metric_with_ci("roc_auc"),
      pr_auc = make_metric_with_ci("pr_auc"),

      # Threshold-dependent
      threshold_value = point_estimates$threshold_value,
      sensitivity = make_metric_with_ci("sensitivity"),
      specificity = make_metric_with_ci("specificity"),
      ppv = make_metric_with_ci("ppv"),
      npv = make_metric_with_ci("npv"),
      accuracy = make_metric_with_ci("accuracy"),
      balanced_accuracy = make_metric_with_ci("balanced_accuracy"),
      f1 = make_metric_with_ci("f1"),
      mcc = make_metric_with_ci("mcc"),
      lr_plus = make_metric_with_ci("lr_plus"),
      lr_minus = make_metric_with_ci("lr_minus"),
      dor = make_metric_with_ci("dor"),
      youden_j = make_metric_with_ci("youden_j"),
      g_mean = make_metric_with_ci("g_mean"),
      kappa = make_metric_with_ci("kappa"),
      post_test_prob_plus = make_metric_with_ci("post_test_prob_plus"),
      post_test_prob_minus = make_metric_with_ci("post_test_prob_minus"),
      delta_nb = make_metric_with_ci("delta_nb"),

      # Curve data
      roc_curve = roc_curve,
      pr_curve = pr_curve,

      # Sample info
      n_group1 = obj$n1,
      n_group2 = obj$n2,
      base_rate = obj$base_rate,
      threshold_prob = obj$threshold_prob
    ),
    class = "e2p_binary_results"
  )
}

#' Internal: compute all metrics for given data
#' @keywords internal
compute_all_metrics_binary <- function(g1, g2, base_rate, pt) {
  cohens_d <- compute_cohens_d(g1, g2)
  r <- compute_point_biserial_r(g1, g2)
  eta_squared <- compute_eta_squared(g1, g2)
  or_result <- compute_odds_ratio(g1, g2)
  cohens_u3 <- compute_cohens_u3(g1, g2)

  roc_auc <- compute_roc_auc(g1, g2)
  pr_auc <- compute_pr_auc(g1, g2, base_rate)

  threshold <- convert_pt_to_threshold(g1, g2, base_rate, pt)
  threshold_metrics <- compute_threshold_metrics(g1, g2, threshold, base_rate, pt)

  c(
    list(
      cohens_d = cohens_d,
      r = r,
      eta_squared = eta_squared,
      odds_ratio = or_result$odds_ratio,
      log_odds_ratio = or_result$log_odds_ratio,
      cohens_u3 = cohens_u3,
      roc_auc = roc_auc,
      pr_auc = pr_auc,
      threshold_value = threshold
    ),
    threshold_metrics
  )
}

#' @export
print.e2p_binary_results <- function(x, ...) {
  cat("E2P Binary Results\n")
  cat("==================\n\n")

  cat("EFFECT SIZES\n")
  cat(sprintf("  Cohen's d:        %s\n", format(x$cohens_d)))
  cat(sprintf("  Cohen's U3:       %s\n", format(x$cohens_u3)))
  cat(sprintf("  Point-biserial r: %s\n", format(x$r)))
  cat(sprintf("  Eta-squared:      %s\n", format(x$eta_squared)))
  cat(sprintf("  Odds Ratio:       %s\n", format(x$odds_ratio)))
  cat(sprintf("  Log Odds Ratio:   %s\n", format(x$log_odds_ratio)))

  cat("\nDISCRIMINATION\n")
  cat(sprintf("  ROC-AUC:          %s\n", format(x$roc_auc)))
  cat(sprintf("  PR-AUC:           %s\n", format(x$pr_auc)))

  cat(sprintf("\nTHRESHOLD-DEPENDENT METRICS (p_t = %.2f)\n", x$threshold_prob))
  cat(sprintf("  Threshold value:  %.4f\n", x$threshold_value))
  cat(sprintf("  Sensitivity:      %s\n", format(x$sensitivity)))
  cat(sprintf("  Specificity:      %s\n", format(x$specificity)))
  cat(sprintf("  PPV:              %s\n", format(x$ppv)))
  cat(sprintf("  NPV:              %s\n", format(x$npv)))
  cat(sprintf("  Accuracy:         %s\n", format(x$accuracy)))
  cat(sprintf("  Balanced Acc:     %s\n", format(x$balanced_accuracy)))
  cat(sprintf("  F1 Score:         %s\n", format(x$f1)))
  cat(sprintf("  MCC:              %s\n", format(x$mcc)))
  cat(sprintf("  LR+:              %s\n", format(x$lr_plus)))
  cat(sprintf("  LR-:              %s\n", format(x$lr_minus)))
  cat(sprintf("  DOR:              %s\n", format(x$dor)))
  cat(sprintf("  Youden's J:       %s\n", format(x$youden_j)))
  cat(sprintf("  G-Mean:           %s\n", format(x$g_mean)))
  cat(sprintf("  Kappa:            %s\n", format(x$kappa)))
  cat(sprintf("  Post-test Prob+:  %s\n", format(x$post_test_prob_plus)))
  cat(sprintf("  Post-test Prob-:  %s\n", format(x$post_test_prob_minus)))
  cat(sprintf("  Delta NB:         %s\n", format(x$delta_nb)))

  cat("\nSAMPLE INFO\n")
  cat(sprintf("  N (Group 1):      %d\n", x$n_group1))
  cat(sprintf("  N (Group 2):      %d\n", x$n_group2))
  cat(sprintf("  Base rate:        %.4f\n", x$base_rate))

  invisible(x)
}

#' Convenience function to compute E2P binary metrics
#'
#' @param group1 Numeric vector for group 1 (controls/negatives)
#' @param group2 Numeric vector for group 2 (cases/positives)
#' @param base_rate Real-world prevalence of group 2
#' @param threshold_prob Threshold probability (default: 0.5)
#' @param n_bootstrap Number of bootstrap iterations (default: 1000)
#' @param ci_level Confidence interval level (default: 0.95)
#' @param seed Random seed for reproducibility
#' @return S3 object of class "e2p_binary_results"
#' @export
#' @examples
#' set.seed(42)
#' controls <- rnorm(200, mean = 0, sd = 1)
#' cases <- rnorm(100, mean = 1.5, sd = 1)
#' results <- e2p_binary(controls, cases, base_rate = 0.10, threshold_prob = 0.20)
#' print(results)
e2p_binary <- function(group1, group2, base_rate, threshold_prob = 0.5,
                       n_bootstrap = 1000, ci_level = 0.95, seed = NULL) {
  obj <- E2PBinary(
    group1 = group1,
    group2 = group2,
    base_rate = base_rate,
    threshold_prob = threshold_prob,
    n_bootstrap = n_bootstrap,
    ci_level = ci_level,
    seed = seed
  )
  compute.e2p_binary(obj)
}

#' Compute E2P binary metrics with reliability transformation (deattenuation)
#'
#' @param group1 Numeric vector for group 1 (controls/negatives)
#' @param group2 Numeric vector for group 2 (cases/positives)
#' @param base_rate Real-world prevalence
#' @param threshold_prob Threshold probability (default: 0.5)
#' @param r_current Current reliability
#' @param r_target Target reliability (default: 1.0)
#' @param kappa_current Current label reliability (optional)
#' @param kappa_target Target label reliability (default: 1.0)
#' @param n_bootstrap Number of bootstrap iterations (default: 1000)
#' @param ci_level Confidence interval level (default: 0.95)
#' @param seed Random seed
#' @param center Center for reliability transform: "mean" or "median"
#' @return S3 object of class "e2p_binary_results"
#' @export
e2p_binary_deattenuated <- function(group1, group2, base_rate,
                                     threshold_prob = 0.5,
                                     r_current, r_target = 1.0,
                                     kappa_current = NULL, kappa_target = 1.0,
                                     n_bootstrap = 1000, ci_level = 0.95,
                                     seed = NULL, center = "mean") {
  g1_tgt <- transform_for_target_reliability(group1, r_current, r_target, center = center)
  g2_tgt <- transform_for_target_reliability(group2, r_current, r_target, center = center)

  if (!is.null(kappa_current)) {
    kappa_result <- transform_groups_for_target_kappa(
      g1_tgt, g2_tgt, kappa_current = kappa_current, kappa_target = kappa_target
    )
    g1_tgt <- kappa_result$group1
    g2_tgt <- kappa_result$group2
  }

  e2p_binary(
    group1 = g1_tgt,
    group2 = g2_tgt,
    base_rate = base_rate,
    threshold_prob = threshold_prob,
    n_bootstrap = n_bootstrap,
    ci_level = ci_level,
    seed = seed
  )
}
