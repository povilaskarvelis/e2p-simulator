#' Plotting functions for e2p
#'
#' @name plotting
#' @description Visualization functions for E2P results using base R graphics.
NULL

#' Compute Decision Curve Analysis data
#'
#' @param group1 Numeric vector for group 1
#' @param group2 Numeric vector for group 2
#' @param prevalence Real-world prevalence
#' @return List with pt_values, model_nb, and treat_all_nb
#' @export
compute_dca_curve <- function(group1, group2, prevalence) {
  pt_values <- seq(0.01, 0.99, length.out = 100)

  model_nb <- numeric(length(pt_values))
  treat_all_nb <- numeric(length(pt_values))

  for (i in seq_along(pt_values)) {
    pt <- pt_values[i]

    tryCatch({
      thresh <- convert_pt_to_threshold(group1, group2, prevalence, pt)
      sens <- mean(group2 >= thresh)
      spec <- mean(group1 < thresh)
    }, error = function(e) {
      sens <<- 0
      spec <<- 1
    })

    if (pt < 1) {
      model_nb[i] <- sens * prevalence - (1 - spec) * (1 - prevalence) * (pt / (1 - pt))
      treat_all_nb[i] <- prevalence - (1 - prevalence) * (pt / (1 - pt))
    } else {
      model_nb[i] <- 0
      treat_all_nb[i] <- 0
    }
  }

  list(pt_values = pt_values, model_nb = model_nb, treat_all_nb = treat_all_nb)
}

#' Plot E2P binary results
#'
#' Creates a 2x3 panel plot showing:
#' - Row 1: Empirical distributions, ROC curve, Empirical DCA
#' - Row 2: Scaled distributions, PR curve, Real-world DCA
#'
#' @param group1 Numeric vector for group 1 (controls)
#' @param group2 Numeric vector for group 2 (cases)
#' @param base_rate Real-world prevalence
#' @param threshold_prob Threshold probability
#' @param results Optional e2p_binary_results object
#' @param group1_label Label for group 1
#' @param group2_label Label for group 2
#' @param main Optional main title
#' @export
plot_binary <- function(group1, group2, base_rate, threshold_prob,
                        results = NULL,
                        group1_label = "Group 1 (Controls)",
                        group2_label = "Group 2 (Cases)",
                        main = NULL) {

  # Set up 2x3 panel
  old_par <- par(mfrow = c(2, 3), mar = c(4, 4, 3, 1), oma = c(0, 0, 2, 0))
  on.exit(par(old_par))

  # Compute empirical base rate
  empirical_base_rate <- length(group2) / (length(group1) + length(group2))

  # Compute thresholds
  threshold_rw <- convert_pt_to_threshold(group1, group2, base_rate, threshold_prob)
  threshold_emp <- convert_pt_to_threshold(group1, group2, empirical_base_rate, threshold_prob)

  # Get metrics
  if (!is.null(results)) {
    sens <- results$sensitivity$estimate
    spec <- results$specificity$estimate
    ppv <- results$ppv$estimate
    npv <- results$npv$estimate
    auc <- results$roc_auc$estimate
    pr_auc <- results$pr_auc$estimate
    d <- results$cohens_d$estimate
    delta_nb <- results$delta_nb$estimate
  } else {
    rw_metrics <- compute_threshold_metrics(group1, group2, threshold_rw, base_rate, threshold_prob)
    sens <- rw_metrics$sensitivity
    spec <- rw_metrics$specificity
    ppv <- rw_metrics$ppv
    npv <- rw_metrics$npv
    delta_nb <- rw_metrics$delta_nb
    auc <- compute_roc_auc(group1, group2)
    pr_auc <- compute_pr_auc(group1, group2, base_rate)
    d <- compute_cohens_d(group1, group2)
  }

  # Empirical metrics
  emp_metrics <- compute_threshold_metrics(group1, group2, threshold_emp, empirical_base_rate, threshold_prob)
  emp_pr_auc <- compute_pr_auc(group1, group2, empirical_base_rate)

  # Compute curves
  roc_data <- compute_roc_curve(group1, group2)
  pr_data <- compute_pr_curve(group1, group2, base_rate)

  # Compute DCA
  dca_emp <- compute_dca_curve(group1, group2, empirical_base_rate)
  dca_rw <- compute_dca_curve(group1, group2, base_rate)

  # KDE
  all_data <- c(group1, group2)
  x_range <- seq(min(all_data) - 0.5, max(all_data) + 0.5, length.out = 200)
  d1 <- density(group1, from = min(x_range), to = max(x_range), n = 200)
  d2 <- density(group2, from = min(x_range), to = max(x_range), n = 200)

  # ===========================================================================
  # Panel 1: Empirical distributions
  # ===========================================================================
  y_max <- max(c(d1$y, d2$y)) * 1.1
  plot(d1$x, d1$y, type = "l", col = "gray50", lwd = 2,
       xlim = range(x_range), ylim = c(0, y_max),
       xlab = "Measurement Value", ylab = "Density",
       main = sprintf("Empirical (n1=%d, n2=%d)", length(group1), length(group2)))
  lines(d2$x, d2$y, col = "darkcyan", lwd = 2)
  abline(v = threshold_emp, col = "red", lwd = 2)
  legend("topleft", legend = c(group1_label, group2_label, "Threshold"),
         col = c("gray50", "darkcyan", "red"), lwd = 2, cex = 0.7)

  # Add metrics text
  mtext(sprintf("Emp prev=%.1f%% | d=%.2f", empirical_base_rate * 100, d),
        side = 3, line = -1.5, cex = 0.6, adj = 0.98)

  # ===========================================================================
  # Panel 2: ROC curve
  # ===========================================================================
  plot(roc_data$fpr, roc_data$tpr, type = "l", col = "gray30", lwd = 2,
       xlim = c(0, 1), ylim = c(0, 1),
       xlab = "False Positive Rate", ylab = "True Positive Rate",
       main = sprintf("ROC Curve (AUC=%.3f)", auc))
  abline(0, 1, lty = 2, col = "gray")
  points(1 - emp_metrics$specificity, emp_metrics$sensitivity, col = "red", pch = 19, cex = 1.2)

  # ===========================================================================
  # Panel 3: Empirical DCA
  # ===========================================================================
  y_max_dca <- max(c(dca_emp$model_nb, empirical_base_rate), na.rm = TRUE) * 1.1
  plot(dca_emp$pt_values, dca_emp$model_nb, type = "l", col = "gray30", lwd = 2,
       xlim = c(0, 1), ylim = c(-0.05, y_max_dca),
       xlab = "Threshold Probability", ylab = "Net Benefit",
       main = sprintf("DCA (Empirical, prev=%.1f%%)", empirical_base_rate * 100))
  lines(dca_emp$pt_values, dca_emp$treat_all_nb, col = "gray", lwd = 2, lty = 2)
  abline(h = 0, lty = 3)
  legend("topright", legend = c("Model", "Treat All", "Treat None"),
         col = c("gray30", "gray", "black"), lty = c(1, 2, 3), lwd = 2, cex = 0.7)

  # ===========================================================================
  # Panel 4: Scaled distributions
  # ===========================================================================
  d1_scaled <- approx(d1$x, d1$y * (1 - base_rate), xout = x_range)$y
  d2_scaled <- approx(d2$x, d2$y * base_rate, xout = x_range)$y
  y_max_scaled <- max(c(d1_scaled, d2_scaled), na.rm = TRUE) * 1.1

  plot(x_range, d1_scaled, type = "l", col = "gray50", lwd = 2,
       xlim = range(x_range), ylim = c(0, y_max_scaled),
       xlab = "Measurement Value", ylab = "Density (scaled)",
       main = sprintf("Scaled to Base Rate = %.1f%%", base_rate * 100))
  lines(x_range, d2_scaled, col = "darkcyan", lwd = 2)
  abline(v = threshold_rw, col = "red", lwd = 2)

  # Add metrics text
  mtext(sprintf("Sens=%.2f Spec=%.2f PPV=%.2f NPV=%.2f",
                sens, spec, ppv, npv),
        side = 3, line = -1.5, cex = 0.6, adj = 0.98)

  # ===========================================================================
  # Panel 5: PR curve
  # ===========================================================================
  plot(pr_data$recall, pr_data$precision, type = "l", col = "gray30", lwd = 2,
       xlim = c(0, 1), ylim = c(0, 1),
       xlab = "Recall (Sensitivity)", ylab = "Precision (PPV)",
       main = sprintf("PR Curve (AUC=%.3f)", pr_auc))
  abline(h = base_rate, lty = 2, col = "gray")
  points(sens, ppv, col = "red", pch = 19, cex = 1.2)

  # ===========================================================================
  # Panel 6: Real-world DCA
  # ===========================================================================
  y_max_dca_rw <- max(c(dca_rw$model_nb, base_rate), na.rm = TRUE) * 1.1
  plot(dca_rw$pt_values, dca_rw$model_nb, type = "l", col = "gray30", lwd = 2,
       xlim = c(0, 1), ylim = c(-0.05, y_max_dca_rw),
       xlab = "Threshold Probability", ylab = "Net Benefit",
       main = sprintf("DCA (Real-World, prev=%.1f%%)", base_rate * 100))
  lines(dca_rw$pt_values, dca_rw$treat_all_nb, col = "gray", lwd = 2, lty = 2)
  abline(h = 0, lty = 3)
  legend("topright", legend = c("Model", "Treat All", "Treat None"),
         col = c("gray30", "gray", "black"), lty = c(1, 2, 3), lwd = 2, cex = 0.7)
  mtext(sprintf("Delta NB=%.4f", delta_nb), side = 3, line = -1.5, cex = 0.6, adj = 0.02)

  # Main title
  if (!is.null(main)) {
    mtext(main, outer = TRUE, cex = 1.2, font = 2)
  }

  invisible(NULL)
}

#' Plot E2P continuous results
#'
#' Creates a 2x3 panel plot showing:
#' - Row 1: Scatterplot, ROC curve, DCA
#' - Row 2: Density distributions, PR curve, Summary
#'
#' @param X Numeric vector of predictor values
#' @param Y Numeric vector of outcome values
#' @param base_rate Real-world prevalence
#' @param threshold_prob Threshold probability
#' @param y_threshold Y threshold for dichotomization
#' @param is_case Logical vector indicating cases
#' @param group1 X values for controls
#' @param group2 X values for cases
#' @param results Optional e2p_binary_results object
#' @param x_label Label for X axis
#' @param y_label Label for Y axis
#' @param main Optional main title
#' @export
plot_continuous <- function(X, Y, base_rate, threshold_prob,
                            y_threshold, is_case, group1, group2,
                            results = NULL,
                            x_label = "Predictor (X)",
                            y_label = "Outcome (Y)",
                            main = NULL) {

  # Set up 2x3 panel
  old_par <- par(mfrow = c(2, 3), mar = c(4, 4, 3, 1), oma = c(0, 0, 2, 0))
  on.exit(par(old_par))

  # Get metrics
  if (!is.null(results)) {
    x_threshold <- results$threshold_value
    sens <- results$sensitivity$estimate
    spec <- results$specificity$estimate
    ppv <- results$ppv$estimate
    npv <- results$npv$estimate
    auc <- results$roc_auc$estimate
    pr_auc <- results$pr_auc$estimate
    d <- results$cohens_d$estimate
    delta_nb <- results$delta_nb$estimate
  } else {
    x_threshold <- convert_pt_to_threshold(group1, group2, base_rate, threshold_prob)
    metrics <- compute_threshold_metrics(group1, group2, x_threshold, base_rate, threshold_prob)
    sens <- metrics$sensitivity
    spec <- metrics$specificity
    ppv <- metrics$ppv
    npv <- metrics$npv
    delta_nb <- metrics$delta_nb
    auc <- compute_roc_auc(group1, group2)
    pr_auc <- compute_pr_auc(group1, group2, base_rate)
    d <- compute_cohens_d(group1, group2)
  }

  # Compute curves
  roc_data <- compute_roc_curve(group1, group2)
  pr_data <- compute_pr_curve(group1, group2, base_rate)
  dca_data <- compute_dca_curve(group1, group2, base_rate)

  # Correlation
  r_pearson <- cor(X, Y)
  r_squared <- r_pearson^2

  # ===========================================================================
  # Panel 1: Scatterplot
  # ===========================================================================
  plot(X[!is_case], Y[!is_case], col = rgb(0.5, 0.5, 0.5, 0.5), pch = 16,
       xlim = range(X), ylim = range(Y),
       xlab = x_label, ylab = y_label,
       main = sprintf("Predictor vs Outcome (n=%d)", length(X)))
  points(X[is_case], Y[is_case], col = rgb(0, 0.5, 0.5, 0.5), pch = 16)
  abline(h = y_threshold, lty = 2, lwd = 1.5)
  abline(v = x_threshold, col = "red", lwd = 2)
  legend("bottomright", legend = c("Controls", "Cases", "Y threshold", "X threshold"),
         col = c("gray50", "darkcyan", "black", "red"),
         pch = c(16, 16, NA, NA), lty = c(NA, NA, 2, 1), lwd = c(NA, NA, 1.5, 2), cex = 0.7)
  mtext(sprintf("r=%.3f R2=%.3f", r_pearson, r_squared), side = 3, line = -1.5, cex = 0.6, adj = 0.02)

  # ===========================================================================
  # Panel 2: ROC curve
  # ===========================================================================
  plot(roc_data$fpr, roc_data$tpr, type = "l", col = "gray30", lwd = 2,
       xlim = c(0, 1), ylim = c(0, 1),
       xlab = "False Positive Rate", ylab = "True Positive Rate",
       main = sprintf("ROC Curve (AUC=%.3f)", auc))
  abline(0, 1, lty = 2, col = "gray")
  points(1 - spec, sens, col = "red", pch = 19, cex = 1.2)

  # ===========================================================================
  # Panel 3: DCA
  # ===========================================================================
  y_max_dca <- max(c(dca_data$model_nb, base_rate), na.rm = TRUE) * 1.1
  plot(dca_data$pt_values, dca_data$model_nb, type = "l", col = "gray30", lwd = 2,
       xlim = c(0, 1), ylim = c(-0.05, y_max_dca),
       xlab = "Threshold Probability", ylab = "Net Benefit",
       main = sprintf("DCA (Base Rate=%.1f%%)", base_rate * 100))
  lines(dca_data$pt_values, dca_data$treat_all_nb, col = "gray", lwd = 2, lty = 2)
  abline(h = 0, lty = 3)
  legend("topright", legend = c("Model", "Treat All", "Treat None"),
         col = c("gray30", "gray", "black"), lty = c(1, 2, 3), lwd = 2, cex = 0.7)
  mtext(sprintf("Delta NB=%.4f", delta_nb), side = 3, line = -1.5, cex = 0.6, adj = 0.02)

  # ===========================================================================
  # Panel 4: Density distributions
  # ===========================================================================
  x_range <- seq(min(X) - 0.5, max(X) + 0.5, length.out = 200)
  d1 <- density(group1, from = min(x_range), to = max(x_range), n = 200)
  d2 <- density(group2, from = min(x_range), to = max(x_range), n = 200)

  d1_scaled <- d1$y * (1 - base_rate)
  d2_scaled <- d2$y * base_rate
  y_max <- max(c(d1_scaled, d2_scaled)) * 1.1

  plot(d1$x, d1_scaled, type = "l", col = "gray50", lwd = 2,
       xlim = range(x_range), ylim = c(0, y_max),
       xlab = x_label, ylab = "Density (scaled)",
       main = sprintf("Predictor Distributions (Base Rate=%.1f%%)", base_rate * 100))
  lines(d2$x, d2_scaled, col = "darkcyan", lwd = 2)
  abline(v = x_threshold, col = "red", lwd = 2)
  mtext(sprintf("d=%.2f Sens=%.2f Spec=%.2f PPV=%.2f NPV=%.2f",
                d, sens, spec, ppv, npv),
        side = 3, line = -1.5, cex = 0.55, adj = 0.98)

  # ===========================================================================
  # Panel 5: PR curve
  # ===========================================================================
  plot(pr_data$recall, pr_data$precision, type = "l", col = "gray30", lwd = 2,
       xlim = c(0, 1), ylim = c(0, 1),
       xlab = "Recall (Sensitivity)", ylab = "Precision (PPV)",
       main = sprintf("PR Curve (AUC=%.3f)", pr_auc))
  abline(h = base_rate, lty = 2, col = "gray")
  points(sens, ppv, col = "red", pch = 19, cex = 1.2)

  # ===========================================================================
  # Panel 6: Summary
  # ===========================================================================
  plot.new()
  text(0.5, 0.9, "Correlation Summary", font = 2, cex = 1.2)
  text(0.5, 0.75, sprintf("Pearson r = %.3f", r_pearson), cex = 1.0)
  text(0.5, 0.65, sprintf("R-squared = %.3f", r_squared), cex = 1.0)
  text(0.5, 0.50, "After Dichotomization:", font = 2, cex = 1.0)
  text(0.5, 0.40, sprintf("Cohen's d = %.3f", d), cex = 1.0)
  text(0.5, 0.30, sprintf("ROC-AUC = %.3f", auc), cex = 1.0)

  # Main title
  if (!is.null(main)) {
    mtext(main, outer = TRUE, cex = 1.2, font = 2)
  }

  invisible(NULL)
}

#' Plot method for e2p_binary_results
#'
#' @param x An e2p_binary_results object
#' @param group1 Numeric vector for group 1
#' @param group2 Numeric vector for group 2
#' @param ... Additional arguments passed to plot_binary
#' @export
plot.e2p_binary_results <- function(x, group1, group2, ...) {
  plot_binary(group1, group2,
              base_rate = x$base_rate,
              threshold_prob = x$threshold_prob,
              results = x, ...)
}
