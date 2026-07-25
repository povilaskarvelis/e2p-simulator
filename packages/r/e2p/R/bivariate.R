# Bivariate-normal continuous model for parametric E2P.
#
# Matches the JavaScript simulator (StatUtils.bivariate* in js/utils.js):
#   X, Y ~ BVN(0, 0, 1, 1, r)
#   positive class = top base_rate of Y
#   score = X

.bvn_clip_r <- function(r) {
  max(min(r, 0.999999), -0.999999)
}

.bvn_clip_p <- function(base_rate) {
  max(min(base_rate, 1 - 1e-12), 1e-12)
}

.bvn_class_cutoff <- function(base_rate) {
  p <- .bvn_clip_p(base_rate)
  stats::qnorm(1 - p)
}

.bvn_residual_sd <- function(r) {
  rr <- .bvn_clip_r(r)
  sqrt(max(1e-12, 1 - rr * rr))
}

.bvn_group_moments <- function(r, base_rate) {
  p <- .bvn_clip_p(base_rate)
  c <- .bvn_class_cutoff(p)
  phi_c <- stats::dnorm(c)
  ey1 <- phi_c / p
  ey0 <- -phi_c / (1 - p)
  vy1 <- 1 + c * phi_c / p - ey1 * ey1
  vy0 <- 1 - c * phi_c / (1 - p) - ey0 * ey0
  rr <- .bvn_clip_r(r)
  resid <- 1 - rr * rr
  list(
    c = c,
    mean_case = rr * ey1,
    mean_control = rr * ey0,
    variance_case = rr * rr * max(vy1, 0) + resid,
    variance_control = rr * rr * max(vy0, 0) + resid,
    base_rate = p
  )
}

.bvn_make_y_grid <- function(y0, y1, n) {
  nodes <- max(8L, as.integer(n))
  y <- seq(y0, y1, length.out = nodes + 1L)
  h <- (y1 - y0) / nodes
  w <- rep(h, nodes + 1L)
  w[1] <- 0.5 * h
  w[length(w)] <- 0.5 * h
  list(y = y, w = w)
}

.bvn_threshold_range <- function(r, base_rate) {
  m <- .bvn_group_moments(r, base_rate)
  sd1 <- sqrt(max(m$variance_case, 1e-12))
  sd0 <- sqrt(max(m$variance_control, 1e-12))
  t_min <- min(m$mean_case - 6 * sd1, m$mean_control - 6 * sd0, -4)
  t_max <- max(m$mean_case + 6 * sd1, m$mean_control + 6 * sd0, 4)
  list(t_min = t_min, t_max = t_max)
}

.bvn_class_mass_grids <- function(r, base_rate, y_nodes = 160L) {
  p <- .bvn_clip_p(base_rate)
  c <- .bvn_class_cutoff(p)
  sigma <- .bvn_residual_sd(r)
  rr <- .bvn_clip_r(r)
  y_lo <- min(c - 8, -8)
  y_hi <- max(c + 8, 8)
  n_pos <- max(40L, as.integer(round(y_nodes * min(1, (y_hi - c) / 8))))
  n_neg <- max(40L, as.integer(round(y_nodes * min(1, (c - y_lo) / 8))))
  pos <- .bvn_make_y_grid(c, y_hi, n_pos)
  neg <- .bvn_make_y_grid(y_lo, c, n_neg)
  list(
    p = p,
    c = c,
    sigma = sigma,
    rr = rr,
    pos_mean = rr * pos$y,
    neg_mean = rr * neg$y,
    pos_phi_w = stats::dnorm(pos$y) * pos$w,
    neg_phi_w = stats::dnorm(neg$y) * neg$w
  )
}

.bvn_sens_spec <- function(r, base_rate, threshold, y_nodes = 160L) {
  g <- .bvn_class_mass_grids(r, base_rate, y_nodes)
  p <- g$p
  mass_pos <- sum((1 - stats::pnorm(threshold, mean = g$pos_mean, sd = g$sigma)) * g$pos_phi_w)
  mass_neg <- sum((1 - stats::pnorm(threshold, mean = g$neg_mean, sd = g$sigma)) * g$neg_phi_w)
  sensitivity <- max(0, min(1, mass_pos / p))
  fpr <- max(0, min(1, mass_neg / (1 - p)))
  list(
    sensitivity = sensitivity,
    specificity = 1 - fpr,
    fpr = fpr,
    base_rate = p
  )
}

.bvn_posterior_prob <- function(r, base_rate, threshold) {
  p <- .bvn_clip_p(base_rate)
  c <- .bvn_class_cutoff(p)
  rr <- .bvn_clip_r(r)
  sigma <- .bvn_residual_sd(rr)
  1 - stats::pnorm((c - rr * threshold) / sigma)
}

.bvn_threshold_from_pt <- function(r, base_rate, pt) {
  p <- .bvn_clip_p(base_rate)
  pt <- max(min(pt, 1 - 1e-12), 1e-12)
  rr <- .bvn_clip_r(r)
  if (abs(rr) < 1e-12) {
    return(0)
  }
  c <- .bvn_class_cutoff(p)
  sigma <- .bvn_residual_sd(rr)
  z <- stats::qnorm(1 - pt)
  (c - sigma * z) / rr
}

.bvn_effect_sizes <- function(r, base_rate, auc = NULL) {
  m <- .bvn_group_moments(r, base_rate)
  p <- m$base_rate
  pooled_var <- (1 - p) * m$variance_control + p * m$variance_case
  pooled_sd <- sqrt(max(pooled_var, 1e-12))
  nonpooled_sd <- sqrt(max((m$variance_control + m$variance_case) / 2, 1e-12))
  delta <- m$mean_case - m$mean_control
  d <- delta / pooled_sd
  da <- delta / nonpooled_sd
  glass_d <- delta / sqrt(max(m$variance_control, 1e-12))
  cohens_u3 <- stats::pnorm(da)
  if (is.null(auc)) {
    auc <- .bvn_discrimination_curves(r, p, curve_points = 240L, y_nodes = 100L)$auc
  }
  list(
    d = d,
    da = da,
    glass_d = glass_d,
    cohens_u3 = cohens_u3,
    rank_biserial = 2 * auc - 1,
    mean_case = m$mean_case,
    mean_control = m$mean_control,
    variance_case = m$variance_case,
    variance_control = m$variance_control,
    auc = auc
  )
}

.bvn_predictive_metrics <- function(r, base_rate, threshold,
                                    y_nodes = 160L, threshold_prob = NULL) {
  ss <- .bvn_sens_spec(r, base_rate, threshold, y_nodes)
  sensitivity <- ss$sensitivity
  specificity <- ss$specificity
  fpr <- ss$fpr
  p <- ss$base_rate

  ppv_denom <- p * sensitivity + (1 - p) * fpr
  npv_denom <- p * (1 - sensitivity) + (1 - p) * specificity
  ppv <- if (ppv_denom > 0) (p * sensitivity) / ppv_denom else 0
  npv <- if (npv_denom > 0) ((1 - p) * specificity) / npv_denom else 0
  accuracy <- p * sensitivity + (1 - p) * specificity
  balanced_accuracy <- (sensitivity + specificity) / 2
  f1 <- if ((ppv + sensitivity) > 0) 2 * ppv * sensitivity / (ppv + sensitivity) else 0

  tp <- p * sensitivity
  fn <- p * (1 - sensitivity)
  tn <- (1 - p) * specificity
  fp <- (1 - p) * fpr
  mcc_den <- sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
  mcc <- if (mcc_den > 0) (tp * tn - fp * fn) / mcc_den else 0

  lr_plus <- if ((1 - specificity) > 0) sensitivity / (1 - specificity) else Inf
  lr_minus <- if (specificity > 0) (1 - sensitivity) / specificity else Inf
  dor <- if (is.finite(lr_plus) && is.finite(lr_minus) && lr_minus > 0) {
    lr_plus / lr_minus
  } else {
    Inf
  }

  youden_j <- sensitivity + specificity - 1
  g_mean <- sqrt(max(0, sensitivity * specificity))

  p_yes_true <- p
  p_yes_pred <- tp + fp
  pe_chance <- p_yes_true * p_yes_pred + (1 - p_yes_true) * (1 - p_yes_pred)
  kappa_stat <- if (pe_chance < 1) (accuracy - pe_chance) / (1 - pe_chance) else 0

  pre_test_odds <- p / (1 - p)
  post_test_odds_plus <- pre_test_odds * lr_plus
  post_test_odds_minus <- pre_test_odds * lr_minus
  post_test_prob_plus <- if (!is.finite(post_test_odds_plus)) {
    1
  } else {
    post_test_odds_plus / (1 + post_test_odds_plus)
  }
  post_test_prob_minus <- if (!is.finite(post_test_odds_minus)) {
    0
  } else {
    post_test_odds_minus / (1 + post_test_odds_minus)
  }

  pt <- if (is.null(threshold_prob)) {
    .bvn_posterior_prob(r, p, threshold)
  } else {
    threshold_prob
  }
  pt <- max(min(pt, 1 - 1e-12), 1e-12)
  odds_pt <- pt / (1 - pt)
  nb_predictor <- (sensitivity * p) - ((1 - specificity) * (1 - p) * odds_pt)
  nb_treat_all <- p - (1 - p) * odds_pt
  delta_nb <- nb_predictor - max(nb_treat_all, 0)

  list(
    sensitivity = sensitivity,
    specificity = specificity,
    fpr = fpr,
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
    delta_nb = delta_nb,
    threshold_prob = pt,
    base_rate = p
  )
}

.bvn_discrimination_curves <- function(r, base_rate,
                                       curve_points = 400L, y_nodes = 140L) {
  p <- .bvn_clip_p(base_rate)
  g <- .bvn_class_mass_grids(r, p, y_nodes)
  tr <- .bvn_threshold_range(r, p)
  thresholds <- seq(tr$t_max, tr$t_min, length.out = curve_points)

  tpr <- numeric(curve_points)
  fpr <- numeric(curve_points)
  precision <- numeric(curve_points)

  for (i in seq_len(curve_points)) {
    t <- thresholds[i]
    mass_pos <- sum((1 - stats::pnorm(t, mean = g$pos_mean, sd = g$sigma)) * g$pos_phi_w)
    mass_neg <- sum((1 - stats::pnorm(t, mean = g$neg_mean, sd = g$sigma)) * g$neg_phi_w)
    sens <- max(0, min(1, mass_pos / p))
    fp <- max(0, min(1, mass_neg / (1 - p)))
    tpr[i] <- sens
    fpr[i] <- fp
    prec_denom <- p * sens + (1 - p) * fp
    precision[i] <- if (prec_denom > 0) (p * sens) / prec_denom else 1
  }

  ord <- order(fpr)
  auc <- sum(diff(fpr[ord]) * (tpr[ord][-1] + tpr[ord][-length(ord)]) / 2)
  auc <- max(0, min(1, auc))

  recalls <- c(0, tpr, 1)
  precisions <- c(1, precision, p)
  pr_ord <- order(recalls)
  recalls <- recalls[pr_ord]
  precisions <- precisions[pr_ord]
  keep <- !duplicated(recalls)
  recalls <- recalls[keep]
  precisions <- precisions[keep]
  prauc <- sum(diff(recalls) * (precisions[-1] + precisions[-length(precisions)]) / 2)
  prauc <- max(0, min(1, prauc))

  list(
    FPR = fpr,
    TPR = tpr,
    precision = precision,
    recall = tpr,
    thresholds = thresholds,
    auc = auc,
    prauc = prauc,
    base_rate = p,
    t_min = tr$t_min,
    t_max = tr$t_max
  )
}
