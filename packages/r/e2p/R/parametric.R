#' E2P Parametric Analysis
#'
#' @name parametric
#' @description Functions for computing predictive metrics from effect sizes
#'   (Cohen's d, Pearson's r) assuming idealized normal distributions,
#'   without requiring empirical data.
#'
#'   This mirrors the JavaScript simulator's functionality for programmatic use.
NULL

# =============================================================================
# Effect Size Conversions
# =============================================================================

#' Convert Cohen's d to Odds Ratio
#'
#' Uses the formula: OR = exp(d * pi / sqrt(3))
#'
#' @param d Cohen's d (standardized mean difference)
#' @return Odds ratio (numeric)
#' @export
#' @examples
#' d_to_odds_ratio(0.8)  # approximately 4.27
d_to_odds_ratio <- function(d) {
  exp(d * pi / sqrt(3))
}

#' Convert Cohen's d to Log Odds Ratio
#'
#' Uses the formula: log(OR) = d * pi / sqrt(3)
#'
#' @param d Cohen's d (standardized mean difference)
#' @return Log odds ratio (numeric)
#' @export
#' @examples
#' d_to_log_odds_ratio(0.8)
d_to_log_odds_ratio <- function(d) {
  d * pi / sqrt(3)
}

#' Convert Cohen's d to Cohen's U3
#'
#' U3 = proportion of group 2 above median of group 1 = Phi(d)
#'
#' @param d Cohen's d (standardized mean difference)
#' @return Cohen's U3 (numeric between 0 and 1)
#' @export
#' @examples
#' d_to_cohens_u3(0.8)  # approximately 0.788
d_to_cohens_u3 <- function(d) {
  pnorm(d)
}

#' Convert Cohen's d to Point-Biserial Correlation
#'
#' r = d / sqrt(d^2 + 1/(p*(1-p)))
#' When base_rate = 0.5, this reduces to d / sqrt(d^2 + 4)
#'
#' @param d Cohen's d (standardized mean difference)
#' @param base_rate Prevalence of positive class (between 0 and 1)
#' @return Point-biserial correlation (numeric)
#' @export
#' @examples
#' d_to_point_biserial_r(0.8, 0.5)
d_to_point_biserial_r <- function(d, base_rate) {
  d / sqrt(d^2 + 1 / (base_rate * (1 - base_rate)))
}

#' Convert Pearson's r to Cohen's d
#'
#' Uses the formula: d = 2r / sqrt(1 - r^2)
#'
#' @param r Pearson correlation coefficient
#' @return Cohen's d (numeric)
#' @export
#' @examples
#' r_to_d(0.5)
r_to_d <- function(r) {
  if (abs(r) >= 1) {
    return(sign(r) * Inf)
  }
  2 * r / sqrt(1 - r^2)
}

# =============================================================================
# Reverse Conversions (other effect sizes -> Cohen's d)
# =============================================================================

#' Convert ROC-AUC to Cohen's d
#'
#' Uses the formula: d = Phi^(-1)(AUC) * sqrt(2)
#' where Phi^(-1) is the inverse standard normal CDF.
#'
#' @param auc ROC-AUC value (0.5 to 1.0 for positive effect)
#' @return Cohen's d (numeric)
#' @export
#' @examples
#' auc_to_d(0.714)  # approximately 0.8
auc_to_d <- function(auc) {
  if (auc <= 0.5) {
    return(0.0)
  }
  if (auc >= 1.0) {
    return(Inf)
  }
  qnorm(auc) * sqrt(2)
}

#' Convert Odds Ratio to Cohen's d
#'
#' Uses the formula: d = ln(OR) * sqrt(3) / pi
#'
#' @param odds_ratio Odds ratio (must be > 0)
#' @return Cohen's d (numeric)
#' @export
#' @examples
#' odds_ratio_to_d(4.27)  # approximately 0.8
odds_ratio_to_d <- function(odds_ratio) {
  if (odds_ratio <= 0) {
    stop("odds_ratio must be > 0")
  }
  log(odds_ratio) * sqrt(3) / pi
}

#' Convert Log Odds Ratio to Cohen's d
#'
#' Uses the formula: d = log_OR * sqrt(3) / pi
#'
#' @param log_odds_ratio Log odds ratio
#' @return Cohen's d (numeric)
#' @export
#' @examples
#' log_odds_ratio_to_d(1.45)  # approximately 0.8
log_odds_ratio_to_d <- function(log_odds_ratio) {
  log_odds_ratio * sqrt(3) / pi
}

#' Convert Cohen's U3 to Cohen's d
#'
#' Uses the formula: d = Phi^(-1)(U3)
#' where Phi^(-1) is the inverse standard normal CDF.
#'
#' @param u3 Cohen's U3 (0 to 1)
#' @return Cohen's d (numeric)
#' @export
#' @examples
#' cohens_u3_to_d(0.788)  # approximately 0.8
cohens_u3_to_d <- function(u3) {
  if (u3 <= 0 || u3 >= 1) {
    stop("u3 must be between 0 and 1 (exclusive)")
  }
  qnorm(u3)
}

# =============================================================================
# Attenuation Functions
# =============================================================================

#' Attenuate Cohen's d by Diagnostic Reliability (Kappa)
#'
#' The attenuation formula is: d_obs = d_true * sqrt(sin(pi/2 * kappa))
#'
#' @param true_d True (latent) Cohen's d
#' @param kappa Diagnostic/label reliability (0-1). Default 1.0 (perfect)
#' @return Observed (attenuated) Cohen's d
#' @export
#' @examples
#' attenuate_d(1.0, kappa = 0.7)
attenuate_d <- function(true_d, kappa = 1.0) {
  true_d * sqrt(sin(pi / 2 * kappa))
}

#' Compute Standard Deviation from ICC (Measurement Reliability)
#'
#' When ICC < 1, measurement error inflates the observed variance.
#' sigma_obs = sigma_true / sqrt(ICC)
#' With sigma_true = 1, we get sigma_obs = 1 / sqrt(ICC)
#'
#' @param icc Intraclass correlation coefficient (measurement reliability), 0 < icc <= 1
#' @return Standard deviation for the observed distribution
#' @export
#' @examples
#' compute_sigma_from_icc(0.64)  # returns 1.25
compute_sigma_from_icc <- function(icc) {
  if (icc <= 0 || icc > 1) {
    stop("ICC must be in (0, 1]")
  }
  1.0 / sqrt(icc)
}

# =============================================================================
# Parametric ROC-AUC and PR-AUC
# =============================================================================

#' Compute ROC-AUC Analytically from Cohen's d
#'
#' For two normal distributions N(0, sigma1) and N(d, sigma2),
#' the ROC-AUC is: Phi(d_att / sqrt(2))
#' where d_att = d * sqrt(2) / sqrt(sigma1^2 + sigma2^2)
#'
#' @param cohens_d Cohen's d (standardized mean difference)
#' @param sigma1 Standard deviation of group 1 (controls). Default 1.0
#' @param sigma2 Standard deviation of group 2 (cases). Default 1.0
#' @return ROC-AUC value (numeric between 0.5 and 1)
#' @export
#' @examples
#' compute_roc_auc_parametric(0.8)  # approximately 0.714
compute_roc_auc_parametric <- function(cohens_d, sigma1 = 1.0, sigma2 = 1.0) {
  d_att <- cohens_d * sqrt(2) / sqrt(sigma1^2 + sigma2^2)
  pnorm(d_att / sqrt(2))
}

#' Compute PR-AUC Parametrically via Numerical Integration
#'
#' Computes PR-AUC for idealized normal distributions using trapezoidal integration.
#'
#' @param cohens_d Cohen's d (standardized mean difference)
#' @param base_rate Prevalence of the positive class (0-1)
#' @param sigma1 Standard deviation of group 1 (controls). Default 1.0
#' @param sigma2 Standard deviation of group 2 (cases). Default 1.0
#' @param n_points Number of threshold points for integration. Default 500
#' @return PR-AUC value (numeric)
#' @export
#' @examples
#' compute_pr_auc_parametric(0.8, 0.1)
compute_pr_auc_parametric <- function(cohens_d, base_rate,
                                       sigma1 = 1.0, sigma2 = 1.0,
                                       n_points = 500) {
  if (base_rate <= 0) return(0.0)
  if (base_rate >= 1) return(1.0)

  # Generate thresholds spanning the distributions
  min_thresh <- min(0, cohens_d) - 6 * max(sigma1, sigma2)
  max_thresh <- max(0, cohens_d) + 6 * max(sigma1, sigma2)
  thresholds <- seq(max_thresh, min_thresh, length.out = n_points)

  recalls <- numeric(n_points)
  precisions <- numeric(n_points)

  for (i in seq_along(thresholds)) {
    t <- thresholds[i]
    # Sensitivity (recall) = P(X >= t | positive) = 1 - CDF(t; d, sigma2)
    recall <- 1 - pnorm(t, mean = cohens_d, sd = sigma2)
    # FPR = P(X >= t | negative) = 1 - CDF(t; 0, sigma1)
    fpr <- 1 - pnorm(t, mean = 0, sd = sigma1)

    # Precision = (base_rate * recall) / (base_rate * recall + (1 - base_rate) * fpr)
    numerator <- base_rate * recall
    denominator <- numerator + (1 - base_rate) * fpr

    precision <- if (denominator < 1e-9) 1.0 else numerator / denominator

    recalls[i] <- recall
    precisions[i] <- precision
  }

  # Add boundary points
  recalls <- c(0, recalls, 1)
  precisions <- c(1, precisions, base_rate)

  # Sort by recall and remove duplicates
  ord <- order(recalls)
  recalls <- recalls[ord]
  precisions <- precisions[ord]

  # Remove duplicate recall values (keep first)
  unique_idx <- !duplicated(recalls)
  recalls <- recalls[unique_idx]
  precisions <- precisions[unique_idx]

  # Compute area using trapezoidal rule
  area <- sum(diff(recalls) * (precisions[-length(precisions)] + precisions[-1]) / 2)

  pmin(pmax(area, 0), 1)
}

# =============================================================================
# Core Parametric Metrics Computation
# =============================================================================

#' Compute Threshold Probability from Measurement Threshold (Parametric)
#'
#' p_t = P(positive | X = threshold) using Bayes' theorem
#'
#' @param cohens_d Cohen's d (mean of cases distribution)
#' @param threshold Decision threshold on the measurement scale
#' @param base_rate Prevalence of positive class (0-1)
#' @param sigma1 Standard deviation of group 1 (controls). Default 1.0
#' @param sigma2 Standard deviation of group 2 (cases). Default 1.0
#' @return Threshold probability p_t
#' @export
compute_pt_from_threshold_parametric <- function(cohens_d, threshold, base_rate,
                                                  sigma1 = 1.0, sigma2 = 1.0) {
  pdf1 <- dnorm(threshold, mean = 0, sd = sigma1)
  pdf2 <- dnorm(threshold, mean = cohens_d, sd = sigma2)

  numerator <- pdf2 * base_rate
  denominator <- pdf1 * (1 - base_rate) + pdf2 * base_rate

  if (denominator == 0) {
    return(0.5)
  }

  numerator / denominator
}

#' Compute Measurement Threshold from Threshold Probability (Parametric)
#'
#' Uses bisection search to find threshold t where P(positive | X = t) = pt
#'
#' @param cohens_d Cohen's d (mean of cases distribution)
#' @param pt Target threshold probability (0-1)
#' @param base_rate Prevalence of positive class (0-1)
#' @param sigma1 Standard deviation of group 1 (controls). Default 1.0
#' @param sigma2 Standard deviation of group 2 (cases). Default 1.0
#' @return Measurement threshold corresponding to pt
#' @export
compute_threshold_from_pt_parametric <- function(cohens_d, pt, base_rate,
                                                  sigma1 = 1.0, sigma2 = 1.0) {
  # Bisection search
  left <- -8.0 * max(sigma1, sigma2)
  right <- 8.0 * max(sigma1, sigma2) + cohens_d
  epsilon <- 1e-8
  max_iter <- 100

  for (i in seq_len(max_iter)) {
    mid <- (left + right) / 2
    pt_mid <- compute_pt_from_threshold_parametric(cohens_d, mid, base_rate, sigma1, sigma2)

    if (abs(pt_mid - pt) < epsilon) {
      return(mid)
    }

    if (pt_mid < pt) {
      left <- mid
    } else {
      right <- mid
    }

    if (right - left < epsilon) {
      break
    }
  }

  (left + right) / 2
}

#' Compute All Binary Metrics for Idealized Normal Distributions (Parametric)
#'
#' Assumes group 1 (controls) ~ N(0, sigma1) and group 2 (cases) ~ N(d, sigma2)
#'
#' @param cohens_d Cohen's d (mean of cases distribution)
#' @param base_rate Prevalence of positive class (0-1)
#' @param threshold Decision threshold on the measurement scale
#' @param sigma1 Standard deviation of group 1 (controls). Default 1.0
#' @param sigma2 Standard deviation of group 2 (cases). Default 1.0
#' @return Named list containing all computed metrics
#' @export
compute_binary_metrics_parametric <- function(cohens_d, base_rate, threshold,
                                               sigma1 = 1.0, sigma2 = 1.0) {
  # FPR and TPR at threshold
  fpr <- 1 - pnorm(threshold, mean = 0, sd = sigma1)
  tpr <- 1 - pnorm(threshold, mean = cohens_d, sd = sigma2)

  sensitivity <- tpr
  specificity <- 1 - fpr

  # PPV (precision)
  if (sensitivity == 0) {
    ppv <- 1.0  # Convention when sensitivity is 0
  } else {
    ppv_num <- sensitivity * base_rate
    ppv_denom <- ppv_num + (1 - specificity) * (1 - base_rate)
    ppv <- if (ppv_denom > 0) ppv_num / ppv_denom else 1.0
  }

  # NPV
  npv_num <- specificity * (1 - base_rate)
  npv_denom <- npv_num + (1 - sensitivity) * base_rate
  npv <- if (npv_denom > 0) npv_num / npv_denom else 1.0

  # Accuracy metrics
  accuracy <- sensitivity * base_rate + specificity * (1 - base_rate)
  balanced_accuracy <- (sensitivity + specificity) / 2

  # F1 score
  f1 <- if ((ppv + sensitivity) > 0) 2 * (ppv * sensitivity) / (ppv + sensitivity) else 0.0

  # MCC (Matthews Correlation Coefficient)
  tp <- sensitivity * base_rate
  tn <- specificity * (1 - base_rate)
  fp <- (1 - specificity) * (1 - base_rate)
  fn <- (1 - sensitivity) * base_rate

  mcc_num <- tp * tn - fp * fn
  mcc_denom <- sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
  mcc <- if (mcc_denom > 0) mcc_num / mcc_denom else 0.0

  # Likelihood ratios
  lr_plus <- if (specificity < 1) sensitivity / (1 - specificity) else Inf
  lr_minus <- if (specificity > 0) (1 - sensitivity) / specificity else Inf
  dor <- if (lr_minus > 0 && is.finite(lr_minus) && is.finite(lr_plus)) lr_plus / lr_minus else Inf

  # Youden's J and G-mean
  youden_j <- sensitivity + specificity - 1
  g_mean <- sqrt(sensitivity * specificity)

  # Cohen's kappa
  p_yes_true <- base_rate
  p_yes_pred <- tp + fp
  p_no_true <- 1 - p_yes_true
  p_no_pred <- 1 - p_yes_pred
  po <- accuracy
  pe_chance <- p_yes_true * p_yes_pred + p_no_true * p_no_pred
  kappa_stat <- if (pe_chance < 1) (po - pe_chance) / (1 - pe_chance) else 0.0

  # Post-test probabilities
  pre_test_odds <- if (base_rate < 1) base_rate / (1 - base_rate) else Inf
  post_test_odds_plus <- if (is.finite(lr_plus)) pre_test_odds * lr_plus else Inf
  post_test_odds_minus <- if (is.finite(lr_minus)) pre_test_odds * lr_minus else Inf

  post_test_prob_plus <- if (is.finite(post_test_odds_plus)) post_test_odds_plus / (1 + post_test_odds_plus) else 1.0
  post_test_prob_minus <- if (is.finite(post_test_odds_minus)) post_test_odds_minus / (1 + post_test_odds_minus) else 1.0

  # Delta Net Benefit
  pt <- compute_pt_from_threshold_parametric(cohens_d, threshold, base_rate, sigma1, sigma2)
  odds_pt <- if (pt < 1) pt / (1 - pt) else Inf
  nb_predictor <- if (is.finite(odds_pt)) (sensitivity * base_rate) - ((1 - specificity) * (1 - base_rate) * odds_pt) else 0.0
  nb_treat_all <- if (is.finite(odds_pt)) base_rate - (1 - base_rate) * odds_pt else -Inf
  nb_treat_none <- 0.0
  delta_nb <- nb_predictor - max(nb_treat_all, nb_treat_none)

  list(
    fpr = fpr,
    tpr = tpr,
    sensitivity = sensitivity,
    specificity = specificity,
    ppv = ppv,
    npv = npv,
    accuracy = accuracy,
    balanced_accuracy = balanced_accuracy,
    f1 = f1,
    mcc = mcc,
    lr_plus = lr_plus,
    lr_minus = lr_minus,
    dor = dor,
    youden_j = youden_j,
    g_mean = g_mean,
    kappa = kappa_stat,
    post_test_prob_plus = post_test_prob_plus,
    post_test_prob_minus = post_test_prob_minus,
    delta_nb = delta_nb
  )
}

#' Find Optimal Threshold Maximizing Youden's J or F1 (Parametric)
#'
#' @param cohens_d Cohen's d (mean of cases distribution)
#' @param base_rate Prevalence of positive class (0-1)
#' @param sigma1 Standard deviation of group 1 (controls). Default 1.0
#' @param sigma2 Standard deviation of group 2 (cases). Default 1.0
#' @param metric Which metric to maximize: "youden" or "f1". Default "youden"
#' @return Optimal threshold value
#' @export
#' @examples
#' find_optimal_threshold_parametric(0.8, 0.1, metric = "youden")
find_optimal_threshold_parametric <- function(cohens_d, base_rate,
                                               sigma1 = 1.0, sigma2 = 1.0,
                                               metric = c("youden", "f1")) {
  metric <- match.arg(metric)

  objective <- function(t) {
    metrics <- compute_binary_metrics_parametric(cohens_d, base_rate, t, sigma1, sigma2)
    if (metric == "f1") {
      return(-metrics$f1)  # Negative for minimization
    } else {
      return(-metrics$youden_j)
    }
  }

  # Search range
  t_min <- -8.0 * max(sigma1, sigma2)
  t_max <- 8.0 * max(sigma1, sigma2) + cohens_d

  result <- optimize(objective, interval = c(t_min, t_max))
  result$minimum
}

# =============================================================================
# Main Parametric Functions
# =============================================================================

#' Compute E2P Metrics from Cohen's d (Parametric Binary)
#'
#' This is the main entry point for parametric binary outcome analysis,
#' mirroring the JavaScript simulator's binary mode functionality.
#'
#' @param cohens_d True Cohen's d (standardized mean difference between groups)
#' @param base_rate Real-world prevalence of the positive class (0-1)
#' @param threshold_prob Threshold probability p_t for threshold-dependent metrics (0-1). Default 0.5
#' @param icc1 Measurement reliability (ICC) for group 1. Default 1.0 (perfect)
#' @param icc2 Measurement reliability (ICC) for group 2. Default 1.0 (perfect)
#' @param kappa Diagnostic/label reliability. Default 1.0 (perfect)
#' @param view Whether to compute metrics for "true" (latent) or "observed" distributions. Default "observed"
#' @return S3 object of class "e2p_parametric_results" containing all computed metrics
#' @export
#' @examples
#' results <- e2p_parametric_binary(cohens_d = 0.8, base_rate = 0.1, threshold_prob = 0.5)
#' print(results)
#' results$roc_auc
e2p_parametric_binary <- function(cohens_d, base_rate,
                                   threshold_prob = 0.5,
                                   icc1 = 1.0, icc2 = 1.0, kappa = 1.0,
                                   view = c("observed", "true")) {
  view <- match.arg(view)

  # Validate inputs
  if (base_rate <= 0 || base_rate >= 1) {
    stop("base_rate must be between 0 and 1 (exclusive)")
  }
  if (threshold_prob <= 0 || threshold_prob >= 1) {
    stop("threshold_prob must be between 0 and 1 (exclusive)")
  }
  if (icc1 <= 0 || icc1 > 1) {
    stop("icc1 must be in (0, 1]")
  }
  if (icc2 <= 0 || icc2 > 1) {
    stop("icc2 must be in (0, 1]")
  }
  if (kappa <= 0 || kappa > 1) {
    stop("kappa must be in (0, 1]")
  }

  # Compute observed d (attenuated by kappa)
  d_observed <- attenuate_d(cohens_d, kappa)

  # Compute standard deviations based on ICC
  sigma1 <- if (view == "true") 1.0 else compute_sigma_from_icc(icc1)
  sigma2 <- if (view == "true") 1.0 else compute_sigma_from_icc(icc2)

  # Use appropriate d based on view
  d_eff <- if (view == "true") cohens_d else d_observed

  # Find threshold from threshold_prob
  threshold_value <- compute_threshold_from_pt_parametric(d_eff, threshold_prob, base_rate, sigma1, sigma2)

  # Compute all metrics
  metrics <- compute_binary_metrics_parametric(d_eff, base_rate, threshold_value, sigma1, sigma2)

  # Compute discrimination metrics
  roc_auc <- compute_roc_auc_parametric(d_eff, sigma1, sigma2)
  pr_auc <- compute_pr_auc_parametric(d_eff, base_rate, sigma1, sigma2)

  # Compute effect size conversions
  odds_ratio <- d_to_odds_ratio(d_eff)
  log_odds_ratio <- d_to_log_odds_ratio(d_eff)
  cohens_u3 <- d_to_cohens_u3(d_eff)
  pb_r <- d_to_point_biserial_r(d_eff, base_rate)
  eta_squared <- pb_r^2

  structure(
    list(
      # Input parameters
      cohens_d_true = cohens_d,
      cohens_d_observed = d_observed,
      base_rate = base_rate,
      threshold_prob = threshold_prob,
      icc1 = icc1,
      icc2 = icc2,
      kappa = kappa,
      view = view,

      # Effect sizes
      odds_ratio = odds_ratio,
      log_odds_ratio = log_odds_ratio,
      cohens_u3 = cohens_u3,
      point_biserial_r = pb_r,
      eta_squared = eta_squared,

      # Discrimination metrics
      roc_auc = roc_auc,
      pr_auc = pr_auc,

      # Threshold-dependent metrics
      threshold_value = threshold_value,
      sensitivity = metrics$sensitivity,
      specificity = metrics$specificity,
      ppv = metrics$ppv,
      npv = metrics$npv,
      accuracy = metrics$accuracy,
      balanced_accuracy = metrics$balanced_accuracy,
      f1 = metrics$f1,
      mcc = metrics$mcc,
      lr_plus = metrics$lr_plus,
      lr_minus = metrics$lr_minus,
      dor = metrics$dor,
      youden_j = metrics$youden_j,
      g_mean = metrics$g_mean,
      kappa_statistic = metrics$kappa,
      post_test_prob_plus = metrics$post_test_prob_plus,
      post_test_prob_minus = metrics$post_test_prob_minus,
      delta_nb = metrics$delta_nb
    ),
    class = "e2p_parametric_results"
  )
}

#' Compute E2P Metrics from Pearson's r (Parametric Continuous)
#'
#' This mirrors the JavaScript simulator's continuous mode. The continuous outcome Y
#' is dichotomized at the base_rate percentile, then binary metrics are computed.
#'
#' @param pearson_r True Pearson correlation between predictor X and outcome Y
#' @param base_rate Proportion of cases (top base_rate of Y are classified as positive)
#' @param threshold_prob Threshold probability p_t for threshold-dependent metrics (0-1). Default 0.5
#' @param reliability_x Measurement reliability of predictor X. Default 1.0 (perfect)
#' @param reliability_y Measurement reliability of outcome Y. Default 1.0 (perfect)
#' @param view Whether to compute metrics for "true" (latent) or "observed" distributions. Default "observed"
#' @return S3 object of class "e2p_parametric_results" containing all computed metrics
#' @export
#' @examples
#' results <- e2p_parametric_continuous(pearson_r = 0.5, base_rate = 0.1)
#' print(results)
e2p_parametric_continuous <- function(pearson_r, base_rate,
                                       threshold_prob = 0.5,
                                       reliability_x = 1.0, reliability_y = 1.0,
                                       view = c("observed", "true")) {
  view <- match.arg(view)

  # Validate inputs
  if (abs(pearson_r) >= 1) {
    stop("pearson_r must be between -1 and 1 (exclusive)")
  }
  if (base_rate <= 0 || base_rate >= 1) {
    stop("base_rate must be between 0 and 1 (exclusive)")
  }
  if (threshold_prob <= 0 || threshold_prob >= 1) {
    stop("threshold_prob must be between 0 and 1 (exclusive)")
  }
  if (reliability_x <= 0 || reliability_x > 1) {
    stop("reliability_x must be in (0, 1]")
  }
  if (reliability_y <= 0 || reliability_y > 1) {
    stop("reliability_y must be in (0, 1]")
  }

  # Compute observed r (attenuated by reliabilities)
  r_observed <- pearson_r * sqrt(reliability_x * reliability_y)

  # Use appropriate r based on view
  r_eff <- if (view == "true") pearson_r else r_observed

  # Convert r to Cohen's d for the dichotomized outcome
  d_eff <- r_to_d(r_eff)

  # For continuous mode, ICC adjustments don't apply the same way
  sigma1 <- 1.0
  sigma2 <- 1.0

  # Find threshold from threshold_prob
  threshold_value <- compute_threshold_from_pt_parametric(d_eff, threshold_prob, base_rate, sigma1, sigma2)

  # Compute all metrics
  metrics <- compute_binary_metrics_parametric(d_eff, base_rate, threshold_value, sigma1, sigma2)

  # Compute discrimination metrics
  roc_auc <- compute_roc_auc_parametric(d_eff, sigma1, sigma2)
  pr_auc <- compute_pr_auc_parametric(d_eff, base_rate, sigma1, sigma2)

  # Compute effect size conversions
  odds_ratio <- d_to_odds_ratio(d_eff)
  log_odds_ratio <- d_to_log_odds_ratio(d_eff)
  cohens_u3 <- d_to_cohens_u3(d_eff)
  pb_r <- d_to_point_biserial_r(d_eff, base_rate)
  eta_squared <- pb_r^2

  # Convert back to d for results
  d_true <- r_to_d(pearson_r)
  d_observed <- r_to_d(r_observed)

  structure(
    list(
      # Input parameters
      cohens_d_true = d_true,
      cohens_d_observed = d_observed,
      pearson_r_true = pearson_r,
      pearson_r_observed = r_observed,
      base_rate = base_rate,
      threshold_prob = threshold_prob,
      reliability_x = reliability_x,
      reliability_y = reliability_y,
      view = view,

      # Effect sizes
      odds_ratio = odds_ratio,
      log_odds_ratio = log_odds_ratio,
      cohens_u3 = cohens_u3,
      point_biserial_r = pb_r,
      eta_squared = eta_squared,

      # Discrimination metrics
      roc_auc = roc_auc,
      pr_auc = pr_auc,

      # Threshold-dependent metrics
      threshold_value = threshold_value,
      sensitivity = metrics$sensitivity,
      specificity = metrics$specificity,
      ppv = metrics$ppv,
      npv = metrics$npv,
      accuracy = metrics$accuracy,
      balanced_accuracy = metrics$balanced_accuracy,
      f1 = metrics$f1,
      mcc = metrics$mcc,
      lr_plus = metrics$lr_plus,
      lr_minus = metrics$lr_minus,
      dor = metrics$dor,
      youden_j = metrics$youden_j,
      g_mean = metrics$g_mean,
      kappa_statistic = metrics$kappa,
      post_test_prob_plus = metrics$post_test_prob_plus,
      post_test_prob_minus = metrics$post_test_prob_minus,
      delta_nb = metrics$delta_nb
    ),
    class = "e2p_parametric_results"
  )
}

#' @export
print.e2p_parametric_results <- function(x, ...) {
  cat("E2P Parametric Results\n")
  cat("======================\n\n")

  cat("INPUT PARAMETERS\n")
  cat(sprintf("  Cohen's d (true):     %.4f\n", x$cohens_d_true))
  cat(sprintf("  Cohen's d (observed): %.4f\n", x$cohens_d_observed))
  if (!is.null(x$pearson_r_true)) {
    cat(sprintf("  Pearson r (true):     %.4f\n", x$pearson_r_true))
    cat(sprintf("  Pearson r (observed): %.4f\n", x$pearson_r_observed))
  }
  cat(sprintf("  Base rate:            %.4f\n", x$base_rate))
  cat(sprintf("  View:                 %s\n", x$view))

  cat("\nEFFECT SIZES\n")
  cat(sprintf("  Odds Ratio:           %.4f\n", x$odds_ratio))
  cat(sprintf("  Log Odds Ratio:       %.4f\n", x$log_odds_ratio))
  cat(sprintf("  Cohen's U3:           %.4f\n", x$cohens_u3))
  cat(sprintf("  Point-biserial r:     %.4f\n", x$point_biserial_r))
  cat(sprintf("  Eta-squared:          %.4f\n", x$eta_squared))

  cat("\nDISCRIMINATION\n")
  cat(sprintf("  ROC-AUC:              %.4f\n", x$roc_auc))
  cat(sprintf("  PR-AUC:               %.4f\n", x$pr_auc))

  cat(sprintf("\nTHRESHOLD-DEPENDENT METRICS (p_t = %.2f)\n", x$threshold_prob))
  cat(sprintf("  Threshold value:      %.4f\n", x$threshold_value))
  cat(sprintf("  Sensitivity:          %.4f\n", x$sensitivity))
  cat(sprintf("  Specificity:          %.4f\n", x$specificity))
  cat(sprintf("  PPV:                  %.4f\n", x$ppv))
  cat(sprintf("  NPV:                  %.4f\n", x$npv))
  cat(sprintf("  Accuracy:             %.4f\n", x$accuracy))
  cat(sprintf("  Balanced Accuracy:    %.4f\n", x$balanced_accuracy))
  cat(sprintf("  F1 Score:             %.4f\n", x$f1))
  cat(sprintf("  MCC:                  %.4f\n", x$mcc))
  cat(sprintf("  LR+:                  %.4f\n", x$lr_plus))
  cat(sprintf("  LR-:                  %.4f\n", x$lr_minus))
  cat(sprintf("  DOR:                  %.4f\n", x$dor))
  cat(sprintf("  Youden's J:           %.4f\n", x$youden_j))
  cat(sprintf("  G-Mean:               %.4f\n", x$g_mean))
  cat(sprintf("  Kappa:                %.4f\n", x$kappa_statistic))
  cat(sprintf("  Post-test Prob+:      %.4f\n", x$post_test_prob_plus))
  cat(sprintf("  Post-test Prob-:      %.4f\n", x$post_test_prob_minus))
  cat(sprintf("  Delta NB:             %.4f\n", x$delta_nb))

  invisible(x)
}
