# ============================================================================
# E2P Demo Script - Run in RStudio to inspect results and plots
# ============================================================================

# Get the directory where this script lives
script_dir <- dirname(sys.frame(1)$ofile)
if (is.null(script_dir) || script_dir == "") {
 script_dir <- "~/Library/CloudStorage/Dropbox/Postdoc/Studies/Required_effect_sizes/interactive_website/packages/r/e2p"
}
script_dir <- normalizePath(script_dir)

# Source all package files in correct dependency order
cat("Loading e2p package from:", script_dir, "\n")
source(file.path(script_dir, "R/utils.R"))
source(file.path(script_dir, "R/binary.R"))
source(file.path(script_dir, "R/continuous.R"))
source(file.path(script_dir, "R/plotting.R"))
source(file.path(script_dir, "R/parametric.R"))
cat("Package loaded.\n")

# ============================================================================
# DEMO 1: Binary Analysis (Two Groups)
# ============================================================================
cat("\n")
cat("=" , rep("=", 69), "\n", sep = "")
cat("DEMO 1: Binary Analysis (Two Groups)\n")
cat("=", rep("=", 69), "\n", sep = "")

set.seed(42)

# Generate synthetic data: controls vs cases
n_controls <- 200
n_cases <- 100
controls <- rnorm(n_controls, mean = 0, sd = 1)
cases <- rnorm(n_cases, mean = 1.5, sd = 1)  # True Cohen's d ≈ 1.5

cat("\nData:\n")
cat(sprintf("  Controls: n=%d, mean=%.2f, sd=%.2f\n", 
            n_controls, mean(controls), sd(controls)))
cat(sprintf("  Cases:    n=%d, mean=%.2f, sd=%.2f\n", 
            n_cases, mean(cases), sd(cases)))
cat(sprintf("  True Cohen's d ≈ 1.5\n"))

cat("\nParameters:\n")
cat("  Base rate (prevalence): 10%\n")
cat("  Threshold probability:  20%\n")
cat("  Bootstrap iterations:   200\n")

cat("\nComputing metrics...\n")
results_binary <- e2p_binary(
  group1 = controls,
  group2 = cases,
  base_rate = 0.10,
  threshold_prob = 0.20,
  n_bootstrap = 200,
  seed = 42
)

cat("\n")
print(results_binary)

# Plot binary results
cat("\nGenerating binary plot (2x3 panel)...\n")
dev.new(width = 14, height = 9)
plot_binary(controls, cases,
            base_rate = 0.10,
            threshold_prob = 0.20,
            results = results_binary,
            group1_label = "Controls",
            group2_label = "Cases",
            main = "E2P Binary Analysis Demo")

# ============================================================================
# DEMO 2: Continuous Analysis (Predictor → Outcome)
# ============================================================================
cat("\n")
cat("=", rep("=", 69), "\n", sep = "")
cat("DEMO 2: Continuous Analysis (Predictor → Outcome)\n")
cat("=", rep("=", 69), "\n", sep = "")

set.seed(42)

# Generate correlated X and Y
n_samples <- 500
X <- rnorm(n_samples, mean = 0, sd = 1)
Y <- 0.6 * X + rnorm(n_samples, mean = 0, sd = 0.8)  # r ≈ 0.6

cat("\nData:\n")
cat(sprintf("  N samples: %d\n", n_samples))
cat(sprintf("  X ~ N(0, 1)\n"))
cat(sprintf("  Y = 0.6*X + noise (true r ≈ 0.6)\n"))
cat(sprintf("  Observed r = %.3f\n", cor(X, Y)))

cat("\nParameters:\n")
cat("  Base rate: 10% (top 10% of Y are 'cases')\n")
cat("  Threshold probability: 20%\n")
cat("  Bootstrap iterations: 200\n")

cat("\nComputing metrics...\n")

# Create continuous object to access is_case for plotting
cont_obj <- E2PContinuous(
  X = X,
  Y = Y,
  base_rate = 0.10,
  threshold_prob = 0.20,
  n_bootstrap = 200,
  seed = 42
)

results_cont <- compute.e2p_continuous(cont_obj)

cat("\n")
print(results_cont)

# Plot continuous results
cat("\nGenerating continuous plot (2x3 panel)...\n")
dev.new(width = 14, height = 9)
plot_continuous(X, Y,
                base_rate = 0.10,
                threshold_prob = 0.20,
                y_threshold = cont_obj$y_threshold,
                is_case = cont_obj$is_case,
                group1 = cont_obj$group1,
                group2 = cont_obj$group2,
                results = results_cont,
                x_label = "Predictor (X)",
                y_label = "Outcome (Y)",
                main = "E2P Continuous Analysis Demo")

# ============================================================================
# DEMO 3: Deattenuation (Reliability Correction)
# ============================================================================
cat("\n")
cat("=", rep("=", 69), "\n", sep = "")
cat("DEMO 3: Deattenuation (Reliability Correction)\n")
cat("=", rep("=", 69), "\n", sep = "")

cat("\nComparing original vs deattenuated binary results...\n")
cat("  Current reliability: 0.60\n")
cat("  Target reliability:  1.00 (perfect)\n\n")

# Transform the data for deattenuation
controls_deatt <- transform_for_target_reliability(controls, 0.60, 1.0, center = "mean")
cases_deatt <- transform_for_target_reliability(cases, 0.60, 1.0, center = "mean")

results_deatt <- e2p_binary(
  group1 = controls_deatt,
  group2 = cases_deatt,
  base_rate = 0.10,
  threshold_prob = 0.20,
  n_bootstrap = 0,
  seed = 42
)

cat(sprintf("Original Cohen's d:     %.4f\n", results_binary$cohens_d$estimate))
cat(sprintf("Deattenuated Cohen's d: %.4f\n", results_deatt$cohens_d$estimate))
cat(sprintf("Original ROC-AUC:       %.4f\n", results_binary$roc_auc$estimate))
cat(sprintf("Deattenuated ROC-AUC:   %.4f\n", results_deatt$roc_auc$estimate))

# Plot deattenuated results
cat("\nGenerating deattenuated plot (2x3 panel)...\n")
dev.new(width = 14, height = 9)
plot_binary(controls_deatt, cases_deatt,
            base_rate = 0.10,
            threshold_prob = 0.20,
            results = results_deatt,
            group1_label = "Controls (deattenuated)",
            group2_label = "Cases (deattenuated)",
            main = "E2P Deattenuated Analysis (reliability 0.60 -> 1.00)")

# ============================================================================
# DEMO 4: Parametric Analysis (No Empirical Data Needed)
# ============================================================================
cat("\n")
cat("=", rep("=", 69), "\n", sep = "")
cat("DEMO 4: Parametric Analysis (No Empirical Data Needed)\n")
cat("=", rep("=", 69), "\n", sep = "")

cat("\nCompute metrics directly from effect sizes (idealized distributions).\n")
cat("No data required - uses analytical formulas.\n")

# Binary outcome from Cohen's d
cat("\n--- Parametric Binary (from Cohen's d) ---\n")
cat("  Cohen's d = 0.8\n")
cat("  Base rate = 10%\n")
cat("  Threshold prob = 50%\n\n")

results_param_binary <- e2p_parametric_binary(
  cohens_d = 0.8,
  base_rate = 0.1,
  threshold_prob = 0.5
)

cat(sprintf("  ROC-AUC:     %.3f\n", results_param_binary$roc_auc))
cat(sprintf("  PR-AUC:      %.3f\n", results_param_binary$pr_auc))
cat(sprintf("  Sensitivity: %.3f\n", results_param_binary$sensitivity))
cat(sprintf("  Specificity: %.3f\n", results_param_binary$specificity))
cat(sprintf("  PPV:         %.3f\n", results_param_binary$ppv))
cat(sprintf("  NPV:         %.3f\n", results_param_binary$npv))

# With reliability attenuation
cat("\n--- With Measurement Unreliability ---\n")
cat("  ICC (both groups) = 0.7\n")
cat("  Kappa (labels) = 0.8\n\n")

results_param_attenuated <- e2p_parametric_binary(
  cohens_d = 0.8,
  base_rate = 0.1,
  threshold_prob = 0.5,
  icc1 = 0.7,
  icc2 = 0.7,
  kappa = 0.8,
  view = "observed"
)

cat(sprintf("  True d:      %.3f\n", results_param_attenuated$cohens_d_true))
cat(sprintf("  Observed d:  %.3f\n", results_param_attenuated$cohens_d_observed))
cat(sprintf("  ROC-AUC:     %.3f (was %.3f with perfect reliability)\n", 
            results_param_attenuated$roc_auc, results_param_binary$roc_auc))

# Continuous outcome from Pearson's r
cat("\n--- Parametric Continuous (from Pearson's r) ---\n")
cat("  Pearson r = 0.5\n")
cat("  Base rate = 10%\n\n")

results_param_cont <- e2p_parametric_continuous(
  pearson_r = 0.5,
  base_rate = 0.1
)

cat(sprintf("  ROC-AUC:     %.3f\n", results_param_cont$roc_auc))
cat(sprintf("  Sensitivity: %.3f\n", results_param_cont$sensitivity))
cat(sprintf("  PPV:         %.3f\n", results_param_cont$ppv))

# Find optimal threshold
cat("\n--- Optimal Threshold Finding ---\n")
opt_youden <- find_optimal_threshold_parametric(0.8, 0.1, metric = "youden")
opt_f1 <- find_optimal_threshold_parametric(0.8, 0.1, metric = "f1")
cat(sprintf("  Optimal threshold (max Youden's J): %.3f\n", opt_youden))
cat(sprintf("  Optimal threshold (max F1):         %.3f\n", opt_f1))

cat("\n")
cat("=", rep("=", 69), "\n", sep = "")
cat("Demo complete! You should see 3 plot windows.\n")
cat("=", rep("=", 69), "\n", sep = "")
