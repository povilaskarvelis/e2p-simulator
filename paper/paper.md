---
title: 'E2P Simulator: An Interactive Tool for Translating Effect Sizes into Predictive Utility'
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

The E2P Simulator (Effect-to-Prediction Simulator) is an interactive web-based tool designed to help researchers translate effect sizes into predictive utility. It visually and quantitatively demonstrates the relationship between commonly reported statistical metrics (such as Cohen's d and Pearson's r) and predictive metrics (such as AUC and PR-AUC) while accounting for measurement reliability and outcome base rates (\autoref{fig:interface}).

![The E2P Simulator interface showing the relationship between effect size (Cohen's d and alternative effect size metrics) and predictive metrics. The left panel allows users to adjust parameters such as effect size, reliability, and base rate. The middle panel displays the resulting distributions with the adjustable threshold. The panel on the right displays Receiver Operating Charactersitic (ROC) and Precision-Recall (PR) curves with corresponding Area Under the Curve (AUC) metrics. The panel at the bottom displays the most common predictive metrics.\label{fig:interface}](interface_paper.png)

The E2P Simulator has several potential applications:

1. **Interpretation of findings**: It helps researchers move beyond arbitrary "small/medium/large" effect size labels and ground the interpretation of their findings in terms of predictive value in specific contexts.

2. **Research planning**: Being able to easily derive what effect sizes are needed to achieve the desired predictive performance allows researchers to plan their studies more effectively and allocate resources more efficiently.

3. **Education**: The simulator's interactive design makes it a valuable teaching tool, helping students and researchers develop a more intuitive understanding of how different abstract statistical metrics relate to one another and to real-world impact.

This tool has been designed with biomedical and behavioral sciences in mind, particularly areas such as biomarker research and precision medicine/psychiatry. However, it may be just as useful for any area of research that focuses on personalization of interventions, such as within education and sports sciences.

# Statement of Need

In biomedical and behavioral sciences, the focus on statistical significance, which quantifies the probability of the effect being real, often overshadows effect sizes, which quantify the practical significance of the effect [@wasserstein2016asa]. This emphasis, combined with a methodological disconnect between classical statistics and predictive modeling, frequently leads researchers to misinterpret any statistically significant finding as clinically meaningful, regardless of its effect size [@funder2019evaluating,@wasserstein2019moving]. This misinterpretation creates unrealistic expectations, hampers effective research planning, and leads to resource misallocation - particularly in fields like biomarker research and precision medicine/psychiatry [@monsarrat2018intriguing,@abi2023candidate]. Furthermore, critical factors such as measurement reliability, which attenuates effect sizes [@karvelis2023individual,@karvelis2025clarifying], and outcome base rates, which limit predictive power in real-world contexts [@ozenne2015precision,@abi2016search,@large2018role], are often overlooked in these assessments.

The E2P Simulator addressess these challenges by providing an interactive platform where researchers can explore the relationships among all of these factors. Similar to G*Power [@faul2007g], which has become a staple in study planning by helping researchers perform power analysis and explore relationships between sample size and significance levels, the E2P Simulator aims to fill the gap and provide an essential tool for performing predictive utility analysis. By making the relationships between effect sizes, reliability, base rates, and predictive metrics explicit, the E2P Simulator enables researchers to interpret findings more accurately, design more impactful studies, and communicate results more clearly to a broader audience.




# Implementation

The E2P Simulator is implemented using HTML, CSS, and JavaScript. The tool leverages several open-source libraries:

- D3.js for data visualization [@d3js]
- Plotly.js for interactive plots [@plotlyjs]
- Chart.js for additional charting capabilities [@chartjs]
- MathJax.js for rendering mathematical expressions [@mathjax]

The application is designed to be accessible without installation, running entirely on the web. This implementation ensures broad accessibility across different operating systems and devices. Alternatively, the tool can also be run on a local node.

# Acknowledgements

AOD is supported by the Canadian Institutes of Health Research and the Krembil Foundation.

# References 

