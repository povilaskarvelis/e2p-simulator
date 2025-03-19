---
title: 'E2P Simulator: An Interactive Tool for Translating Statistical Effect Sizes into Practical Predictive Utility'
tags:
  - JavaScript
  - statistics
  - effect size
  - prediction
  - classification
  - reliability
  - base rate
  - visualization
  - research planning
authors:
  - name: Povilas Karvelis
    orcid: 0000-0001-7469-5624  
    affiliation: 1
  - name: Andreea O. Diaconescu
    orcid: 0000-0002-3633-9757
    affiliation: 1
affiliations:
  - name: Krembil Centre for Neuroinformatics, Centre for Addiction and Mental Health, University of Toronto, Canada
    index: 1
date: 13 March 2024
bibliography: paper.bib
---

# Summary

The E2P Simulator (Effect-to-Prediction Simulator) is an interactive web-based tool designed to help researchers understand how statistical effect sizes translate into practical predictive utility. This tool addresses a critical gap in research methodology by visually demonstrating the relationship between commonly reported statistical metrics (such as Cohen's d [@cohen1992power] and correlation coefficients [@spearman1904general]) and their real-world predictive value, while accounting for crucial factors like measurement reliability and outcome base rates.

# Statement of Need

Researchers across disciplines frequently report effect sizes to quantify the magnitude of their findings [@funder2019evaluating;@gignac2016effect]. However, there is often a disconnect between these statistical metrics and their practical implications for prediction and classification tasks [@meehl1990summaries;@webb2020effect]. This disconnect can lead to:

1. Overestimation of the practical utility of research findings
2. Unrealistic expectations about the predictive performance of models
3. Inadequate study planning that fails to account for reliability and base rate effects

The E2P Simulator addresses these challenges by providing an intuitive, interactive platform that allows researchers to:

- Visualize how statistical effect sizes translate to group separation and predictive performance
- Understand how measurement reliability affects the observed effect sizes and predictive utility
- Explore the impact of outcome base rates on classification metrics
- Determine required effect sizes for achieving desired levels of predictive performance 
- Estimate how many predictors of smaller effect sizes would need to be combined to achieve a target level of predictive performance

This tool is particularly valuable for researchers in psychology, medicine, neuroscience, and other fields where prediction and classification are important but where the limitations imposed by reliability and base rates are often overlooked.

# Features

The E2P Simulator offers two primary analysis modes:

## Binary Outcome Measures (Classification)

This mode addresses scenarios where groups are naturally distinct (e.g., treatment vs. control, male vs. female). Users can:

- Adjust Cohen's d values and observe the resulting group separation
- Modify reliability to see how measurement error affects observed effect sizes
- Change base rates to understand their impact on classification metrics
- Use the Mahalanobis D calculator to estimate how many predictors would need to be combined to achieve a desired level of group separation

## Continuous Outcome Measures (Prediction)

This mode addresses scenarios where groups are formed by thresholding a continuous outcome variable (e.g., responders vs. non-responders). Users can:

- Adjust correlation coefficients or R² values and observe the resulting predictive performance
- Modify reliability to see how measurement error affects observed correlations
- Change base rates to understand their impact on classification metrics
- Use the Multivariate R² calculator to estimate how many predictors would need to be combined to achieve a desired level of explained variance

Both modes provide interactive visualizations and quantitative metrics that update in real-time as parameters are adjusted, facilitating intuitive understanding of complex statistical relationships.

# Implementation

The E2P Simulator is implemented as a client-side web application using HTML, CSS, and JavaScript. The tool leverages several open-source libraries:

- D3.js for data visualization [@d3js]
- Plotly.js for interactive plots [@plotlyjs]
- Math.js for mathematical operations [@mathjs]
- Chart.js for additional charting capabilities [@chartjs]
- MathJax for rendering mathematical equations [@mathjax]

The application is designed to be accessible without installation, running entirely in the user's web browser. This implementation ensures broad accessibility across different operating systems and devices.

# Impact and Applications

The E2P Simulator has several potential applications:

1. **Interpretation of findings**: Instead of applying arbitrary "small/medium/large" labels to effect sizes, this tool enalbes the interpretation of effect sizes in terms of their predictive value in specific settings
2. **Research planning**: Better understanding of the relationship between effect sizes and practical utility - as well as how they are affected by measurement reliability and outcome base rates - allows for more realisitc research planning and resource allocation
3. **Education**: The interactive nature of the simulator makes it a valuable tool for teaching students and researchers about the relationship between statistical metrics and practical implications, improving their intuitive understanding of abstract metrics

# Acknowledgements

We acknowledge contributions from colleagues who provided feedback during the development of this tool, as well as the open-source community for developing the libraries that made this project possible.

# References 