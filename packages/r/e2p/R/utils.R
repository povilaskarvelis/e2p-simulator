#' Shared statistical utility functions for e2p
#'
#' @name utils
#' @keywords internal
NULL

#' Transform measurements to reflect a target reliability
#'
#' Implements a "distribution-rescale" model based on the classical
#' measurement error decomposition. Changing reliability from r_current
#' to r_target scales the total variance by (r_current / r_target).
#'
#' @param x Numeric vector of observed measurements
#' @param r_current Current reliability in (0, 1]
#' @param r_target Target reliability in (0, 1]
#' @param center Location parameter: "mean" or "median"
#' @return Transformed measurements (numeric vector)
#' @export
transform_for_target_reliability <- function(x, r_current, r_target,
                                             center = c("mean", "median")) {
  center <- match.arg(center)

  if (!all(is.finite(x))) {
    stop("x must contain only finite values")
  }
  if (r_current <= 0 || r_current > 1) {
    stop("r_current must be in (0, 1]")
  }

  if (r_target <= 0 || r_target > 1) {
    stop("r_target must be in (0, 1]")
  }

  c_val <- if (center == "mean") mean(x) else median(x)
  scale <- sqrt(r_current / r_target)
  c_val + scale * (x - c_val)
}

#' Adjust between-group separation for target label reliability (kappa)
#'
#' Mirrors the webapp's attenuation relationship:
#' d_observed = d_true * sqrt(sin(pi/2 * kappa))
#'
#' @param group1 Numeric vector for controls/negatives
#' @param group2 Numeric vector for cases/positives
#' @param kappa_current Current label reliability in (0, 1]
#' @param kappa_target Target label reliability in (0, 1]
#' @return List with transformed group1 and group2
#' @export
transform_groups_for_target_kappa <- function(group1, group2,
                                               kappa_current,
                                               kappa_target = 1.0) {
  if (!all(is.finite(group1)) || !all(is.finite(group2))) {
    stop("group1 and group2 must contain only finite values")
  }
  if (kappa_current <= 0 || kappa_current > 1) {
    stop("kappa_current must be in (0, 1]")
  }
  if (kappa_target <= 0 || kappa_target > 1) {
    stop("kappa_target must be in (0, 1]")
  }

  s_cur <- sin((pi / 2) * kappa_current)
  s_tgt <- sin((pi / 2) * kappa_target)
  if (s_cur <= 0) {
    stop("sin(pi/2 * kappa_current) must be > 0")
  }

  scale <- sqrt(s_tgt / s_cur)
  if (abs(scale - 1.0) < 1e-10) {
    return(list(group1 = group1, group2 = group2))
  }

  m1 <- mean(group1)
  m2 <- mean(group2)
  delta <- m2 - m1
  delta_tgt <- delta * scale

  # Symmetric mean shift: preserve grand mean
  shift <- 0.5 * (delta_tgt - delta)
  list(group1 = group1 - shift, group2 = group2 + shift)
}

#' Compute Cohen's d (standardized mean difference)
#'
#' @param g1 Numeric vector for group 1
#' @param g2 Numeric vector for group 2
#' @return Cohen's d (numeric)
#' @export
compute_cohens_d <- function(g1, g2) {
  n1 <- length(g1)
  n2 <- length(g2)
  mean1 <- mean(g1)
  mean2 <- mean(g2)
  var1 <- var(g1)
  var2 <- var(g2)

  pooled_var <- ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2)
  pooled_sd <- sqrt(pooled_var)

  if (pooled_sd == 0) {
    return(0.0)
  }

  (mean2 - mean1) / pooled_sd
}

#' Compute point-biserial correlation
#'
#' @param g1 Numeric vector for group 1
#' @param g2 Numeric vector for group 2
#' @return Point-biserial r (numeric)
#' @export
compute_point_biserial_r <- function(g1, g2) {
  values <- c(g1, g2)
  labels <- c(rep(0, length(g1)), rep(1, length(g2)))
  cor(labels, values)
}

#' Compute eta-squared
#'
#' @param g1 Numeric vector for group 1
#' @param g2 Numeric vector for group 2
#' @return Eta-squared (numeric)
#' @export
compute_eta_squared <- function(g1, g2) {
  all_values <- c(g1, g2)
  grand_mean <- mean(all_values)

  ss_between <- length(g1) * (mean(g1) - grand_mean)^2 +
                length(g2) * (mean(g2) - grand_mean)^2
  ss_total <- sum((all_values - grand_mean)^2)

  if (ss_total == 0) {
    return(0.0)
  }

  ss_between / ss_total
}

#' Compute odds ratio from Cohen's d
#'
#' Uses: OR = exp(d * pi / sqrt(3))
#'
#' @param g1 Numeric vector for group 1
#' @param g2 Numeric vector for group 2
#' @return Named list with odds_ratio and log_odds_ratio
#' @export
compute_odds_ratio <- function(g1, g2) {
  d <- compute_cohens_d(g1, g2)
  log_or <- d * pi / sqrt(3)
  list(odds_ratio = exp(log_or), log_odds_ratio = log_or)
}

#' Compute Cohen's U3
#'
#' Proportion of g2 above median of g1.
#'
#' @param g1 Numeric vector for group 1
#' @param g2 Numeric vector for group 2
#' @return Cohen's U3 (numeric)
#' @export
compute_cohens_u3 <- function(g1, g2) {
  median_g1 <- median(g1)
  mean(g2 > median_g1)
}

#' Compute ROC-AUC using Mann-Whitney U statistic
#'
#' @param g1 Numeric vector for group 1 (controls)
#' @param g2 Numeric vector for group 2 (cases)
#' @return ROC-AUC (numeric)
#' @export
compute_roc_auc <- function(g1, g2) {
  n1 <- length(g1)
  n2 <- length(g2)

  count <- 0
  for (x2 in g2) {
    count <- count + sum(g1 < x2) + 0.5 * sum(g1 == x2)
  }

  count / (n1 * n2)
}

#' Compute PR-AUC
#'
#' @param g1 Numeric vector for group 1 (controls)
#' @param g2 Numeric vector for group 2 (cases)
#' @param base_rate Real-world prevalence
#' @return PR-AUC (numeric)
#' @export
compute_pr_auc <- function(g1, g2, base_rate) {
  all_values <- c(g1, g2)
  thresholds <- sort(unique(all_values), decreasing = TRUE)

  precisions <- numeric(length(thresholds))
  recalls <- numeric(length(thresholds))

  for (i in seq_along(thresholds)) {
    t <- thresholds[i]
    sens <- mean(g2 >= t)
    spec <- mean(g1 < t)

    numerator <- sens * base_rate
    denominator <- numerator + (1 - spec) * (1 - base_rate)

    if (denominator > 0) {
      precisions[i] <- numerator / denominator
    } else {
      precisions[i] <- 1.0
    }
    recalls[i] <- sens
  }

  precisions <- c(1.0, precisions, base_rate)
  recalls <- c(0.0, recalls, 1.0)

  sorted_idx <- order(recalls)
  recalls <- recalls[sorted_idx]
  precisions <- precisions[sorted_idx]

  # Trapezoidal integration
  pr_auc <- sum(diff(recalls) * (precisions[-length(precisions)] + precisions[-1]) / 2)
  pmin(pmax(pr_auc, 0), 1)
}

#' Compute ROC curve data
#'
#' @param g1 Numeric vector for group 1
#' @param g2 Numeric vector for group 2
#' @return List with fpr, tpr, and thresholds
#' @export
compute_roc_curve <- function(g1, g2) {
  all_values <- c(g1, g2)
  thresholds <- sort(unique(all_values))

  fprs <- numeric(length(thresholds))
  tprs <- numeric(length(thresholds))

  for (i in seq_along(thresholds)) {
    t <- thresholds[i]
    tprs[i] <- mean(g2 >= t)
    fprs[i] <- mean(g1 >= t)
  }

  fprs <- c(1.0, fprs, 0.0)
  tprs <- c(1.0, tprs, 0.0)
  thresholds <- c(thresholds[1] - 1, thresholds, thresholds[length(thresholds)] + 1)

  list(fpr = fprs, tpr = tprs, thresholds = thresholds)
}

#' Compute PR curve data
#'
#' @param g1 Numeric vector for group 1
#' @param g2 Numeric vector for group 2
#' @param base_rate Real-world prevalence
#' @return List with precision, recall, and thresholds
#' @export
compute_pr_curve <- function(g1, g2, base_rate) {
  all_values <- c(g1, g2)
  thresholds <- sort(unique(all_values), decreasing = TRUE)

  precisions <- numeric(length(thresholds))
  recalls <- numeric(length(thresholds))

  for (i in seq_along(thresholds)) {
    t <- thresholds[i]
    sens <- mean(g2 >= t)
    spec <- mean(g1 < t)

    numerator <- sens * base_rate
    denominator <- numerator + (1 - spec) * (1 - base_rate)

    if (denominator > 0) {
      precisions[i] <- numerator / denominator
    } else {
      precisions[i] <- 1.0
    }
    recalls[i] <- sens
  }

  list(precision = precisions, recall = recalls, thresholds = thresholds)
}

#' Convert threshold probability to measurement threshold
#'
#' Uses kernel density estimation to find the threshold where
#' P(group2 | measurement = t) = pt
#'
#' @param g1 Numeric vector for group 1
#' @param g2 Numeric vector for group 2
#' @param base_rate Real-world prevalence
#' @param pt Threshold probability
#' @return Measurement threshold (numeric)
#' @export
convert_pt_to_threshold <- function(g1, g2, base_rate, pt) {
  all_values <- c(g1, g2)
  sd_all <- sd(all_values)
  t_min <- min(all_values) - 2 * sd_all
  t_max <- max(all_values) + 2 * sd_all

  # Fit KDEs
  tryCatch({
    kde1 <- density(g1, from = t_min, to = t_max, n = 512)
    kde2 <- density(g2, from = t_min, to = t_max, n = 512)

    # Create interpolation functions
    f1 <- approxfun(kde1$x, kde1$y, rule = 2)
    f2 <- approxfun(kde2$x, kde2$y, rule = 2)

    posterior_minus_pt <- function(t) {
      d1 <- f1(t)
      d2 <- f2(t)

      numerator <- d2 * base_rate
      denominator <- d1 * (1 - base_rate) + d2 * base_rate

      if (denominator < 1e-15) {
        return(0.5 - pt)
      }

      posterior <- numerator / denominator
      posterior - pt
    }

    # Try to find root
    tryCatch({
      uniroot(posterior_minus_pt, c(t_min, t_max))$root
    }, error = function(e) {
      # Fallback: grid search
      t_grid <- seq(t_min, t_max, length.out = 1000)
      posteriors <- sapply(t_grid, function(t) posterior_minus_pt(t) + pt)
      idx <- which.min(abs(posteriors - pt))
      t_grid[idx]
    })
  }, error = function(e) {
    # Fallback: quantile-based threshold
    warning("KDE failed, using quantile-based threshold")
    quantile(all_values, 1 - pt)
  })
}

#' Compute all threshold-dependent metrics
#'
#' @param g1 Numeric vector for group 1
#' @param g2 Numeric vector for group 2
#' @param threshold Measurement threshold
#' @param base_rate Real-world prevalence
#' @param pt Threshold probability
#' @return Named list of metrics
#' @export
compute_threshold_metrics <- function(g1, g2, threshold, base_rate, pt) {
  sens <- mean(g2 >= threshold)
  spec <- mean(g1 < threshold)

  # PPV and NPV using base_rate
  ppv_num <- sens * base_rate
  ppv_denom <- ppv_num + (1 - spec) * (1 - base_rate)
  ppv <- if (ppv_denom > 0) ppv_num / ppv_denom else 1.0

  npv_num <- spec * (1 - base_rate)
  npv_denom <- npv_num + (1 - sens) * base_rate
  npv <- if (npv_denom > 0) npv_num / npv_denom else 1.0

  # Accuracy (using base_rate)
  accuracy <- sens * base_rate + spec * (1 - base_rate)

  # Balanced accuracy
  balanced_accuracy <- (sens + spec) / 2

  # F1 score
  f1 <- if ((ppv + sens) > 0) 2 * (ppv * sens) / (ppv + sens) else 0.0

  # MCC
  tp_rate <- sens * base_rate
  tn_rate <- spec * (1 - base_rate)
  fp_rate <- (1 - spec) * (1 - base_rate)
  fn_rate <- (1 - sens) * base_rate

  mcc_num <- (tp_rate * tn_rate) - (fp_rate * fn_rate)
  mcc_denom <- sqrt((tp_rate + fp_rate) * (tp_rate + fn_rate) *
                    (tn_rate + fp_rate) * (tn_rate + fn_rate))
  mcc <- if (mcc_denom > 0) mcc_num / mcc_denom else 0.0

  # Likelihood ratios
  lr_plus <- if (spec < 1) sens / (1 - spec) else Inf
  lr_minus <- if (spec > 0) (1 - sens) / spec else Inf
  dor <- if (lr_minus > 0 && is.finite(lr_minus)) lr_plus / lr_minus else Inf

  # Youden's J and G-mean
  youden_j <- sens + spec - 1
  g_mean <- sqrt(sens * spec)

  # Cohen's kappa
  po <- accuracy
  pe <- base_rate * (tp_rate + fp_rate) + (1 - base_rate) * (tn_rate + fn_rate)
  kappa <- if (pe < 1) (po - pe) / (1 - pe) else 0.0

  # Post-test probabilities
  pre_odds <- base_rate / (1 - base_rate)
  post_odds_plus <- if (is.finite(lr_plus)) pre_odds * lr_plus else Inf
  post_odds_minus <- if (is.finite(lr_minus)) pre_odds * lr_minus else Inf

  post_prob_plus <- if (is.finite(post_odds_plus)) post_odds_plus / (1 + post_odds_plus) else 1.0
  post_prob_minus <- if (is.finite(post_odds_minus)) post_odds_minus / (1 + post_odds_minus) else 1.0

  # Delta NB
  odds <- pt / (1 - pt)
  nb_predictor <- (sens * base_rate) - ((1 - spec) * (1 - base_rate) * odds)
  nb_treat_all <- base_rate - (1 - base_rate) * odds
  nb_treat_none <- 0.0
  delta_nb <- nb_predictor - max(nb_treat_all, nb_treat_none)

  list(
    sensitivity = sens,
    specificity = spec,
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
    kappa = kappa,
    post_test_prob_plus = post_prob_plus,
    post_test_prob_minus = post_prob_minus,
    delta_nb = delta_nb
  )
}
