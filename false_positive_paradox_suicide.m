% The false positive paradox and prediction of suicide

% Subplot 1: PPV vs Prevalence (Base Rate)
% Total population
N = 39000000; % Total population

% Sensitivity and Specificity (Fixed)
% Total population
N = 39000000; % Total population

% Fixed number of suicide attempts (base rate)
fixed_Ns = 73000; % Assume a fixed number of suicide attempts
prevalence_fixed = fixed_Ns / N * 100; % Fixed prevalence

% Define a range of equal sensitivity and specificity values (from 0.5 to 1)
sensitivity_specificity_range = linspace(0.5, 1, 100);

% Initialize arrays for PPV for different sensitivity/specificity values
TP_sens_spec = sensitivity_specificity_range * fixed_Ns;       % True Positives
FP_sens_spec = (1 - sensitivity_specificity_range) * (N - fixed_Ns); % False Positives
PPV_sens_spec = (TP_sens_spec ./ (TP_sens_spec + FP_sens_spec)) * 100; % Positive Predictive Value

% Create the plot
figure('WindowStyle', 'docked'); % Dock the figure window
plot(sensitivity_specificity_range, PPV_sens_spec, 'b-', 'LineWidth', 1.5);
xlabel('Sensitivity/Specificity (equal values)', 'FontSize', 12);
ylabel('Positive Predictive Value (PPV) (%)', 'FontSize', 12);
title(sprintf('PPV vs Sensitivity/Specificity at %.2f%% Prevalence', prevalence_fixed), 'FontSize', 14);
grid on; vline(0.8,'k--')
set(gca, 'FontSize', 12);


