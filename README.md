# E2P Simulator

The E2P Simulator (Effect-to-Prediction Simulator) is designed to help researchers better understand how statistical effect sizes (like Cohen's d, Pearon's r) translate to predictive metrics. It accounts for real-world challenges like measurement reliability and condition prevalence rates to provide realistic estimates of predictive performance.  

**Try it out**: [https://povilaskarvelis.github.io/e2p-simulator](https://povilaskarvelis.github.io/e2p-simulator)

![Screenshot of the simulator](images/interface.png)

## Applications

1. **Result Interpretation**: Move beyond arbitrary "small/medium/large" effect size labels by translating statistical metrics into predictive performance measures that are more relevant for real-world applications
2. **Research Planning**: Determine required effect sizes for desired predictive performance by simulating various scenarios
3. **Education**: Develop a more intuitive understanding of statistical metrics and their practical implications through interactive visualization

## Key Features

- **Two Analysis Modes**:
  - **Binary Outcomes**: Explore how effect size measures of binary outcomes (e.g., patients vs. controls, treatment vs. control) translate to predictive metrics
  - **Continuous Outcomes**: Explore how continuous outcomes (e.g., symptom improvement) that are later thresholded for practical purposes (e.g., responder vs. non-responder) translate to predictive metrics

- **Measurement Reliability**: Explore how measurement error affects observed vs. true effect sizes as well as predictive metrics

- **Base Rate**: Explore how outcome prevalence impacts real-world predictive performance

- **Multivariate Calculators**:
  - Mahalanobis D Calculator (Binary mode) and Multivariate R² Calculator (Continuous mode): Explore the interaction between the number of predictors, their effect sizes and their collinearity. 

## Citation

If you use this simulator in your research, please cite:

Karvelis, P., & Diaconescu, A. O. (2025). E2P Simulator: Understanding predictive value of effect sizes - 
An interactive tool for exploring reliability and base rate effects. (TBC)

Zenodo
JOSS

