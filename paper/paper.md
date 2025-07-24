---
title: 'E2P Simulator: An Interactive Tool for Estimating Real-World Predictive Utility of Research Findings'
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
date: 22 July 2025
bibliography: paper.bib
---

# Summary

E2P Simulator (Effect-to-Prediction Simulator) allows researchers to interactively and quantitatively explore the relationship between effect sizes (e.g., Cohen's d, Odds Ratio, Pearson's r), the corresponding predictive performance (e.g., ROC-AUC, Sensitivity, Specificity, Accuracy, etc.), and real-world predictive utility (e.g., PPV, NPV, PR-AUC, MCC, Net Benefit, etc.) by accounting for measurement reliability and outcome base rates. (\autoref{fig:interface}).

![E2P Simulator interface with a high-level summary of its use. The left panel allows users to adjust parameters such as effect size, reliability, and base rate. The middle panel displays the resulting distributions with the adjustable threshold. The panel on the right displays Receiver Operating Charactersitic (ROC) and Precision-Recall (PR) curves with corresponding Area Under the Curve (AUC) metrics, as well as Decision Curve Analysis (DCA) plot. The panel at the bottom displays the most common predictive metrics.\label{fig:interface}](interface_paper.png)

E2P Simulator has several potential applications:

1. **Interpretation of findings**: It helps researchers move beyond arbitrary "small/medium/large" effect size labels and misleading predictive metrics by grounding their interpretation in estimated real-world predictive utility. 

2. **Research planning**: Being able to easily derive what effect sizes and predictive performance are needed to achieve a desired real-world predictive performance allows researchers to plan their studies more effectively and allocate resources more efficiently.

3. **Education**: The simulator's interactive design makes it a valuable teaching tool, helping researchers develop a more intuitive understanding of how different abstract statistical metrics relate to one another and to real-world utility.

This tool has been designed with biomedical and behavioral sciences in mind, particularly areas such as biomarker research and precision medicine/psychiatry. However, it may be just as useful for any area of research that focuses on personalization of interventions, such as within education and sports sciences.

# Statement of Need

In biomedical and behavioral sciences, the focus on statistical significance, which quantifies the probability of the effect being real, often overshadows effect sizes, which quantify the practical significance of the effect [@wasserstein2016asa]. This emphasis, combined with a methodological disconnect between classical statistics and predictive modeling, frequently leads researchers to misinterpret any statistically significant finding as clinically meaningful, regardless of its effect size [@funder2019evaluating;@wasserstein2019moving]. This misinterpretation is particularly problematic in areas such as biomarker research and precision medicine/psychiatry, where the goal is to find robust predictors of treatment response or disease course for individual patients [@monsarrat2018intriguing;@abi2023candidate]. Furthermore, factors such as measurement reliability, which attenuates effect sizes [@karvelis2023individual;@karvelis2025clarifying], and outcome base rates, which limit predictive power in real-world contexts [baldessarini1983predictive;@ozenne2015precision;@abi2016search;@large2018role;brabec2020model], are often overlooked in evaluating both individual predictors and predictive models, leading to unlrealistic expectations, ineffective research planning, and resource misalocation. 

E2P Simulator addressess these challenges by providing an interactive platform where researchers can explore the relationships among all of these factors. Similar to how GPower [@faul2007g] is used to explore the relationships between effect size, sample size and significance levels to perform *power analysis*, E2P Simulator can be used to explore the relationships between effect size, predictive performance, and real-world predictive utility to perform *predictive utility analysis*. By making the relationships between effect sizes, reliability, base rates, and predictive metrics explicit, E2P Simulator enables researchers to interpret findings more accurately, design more impactful studies, and communicate results more clearly to a broader audience.

# Implementation

E2P Simulator is implemented using HTML, CSS, and JavaScript. The tool leverages several open-source libraries:

- D3.js for data visualization [@d3js]
- Plotly.js for interactive plots [@plotlyjs]
- Chart.js for additional charting capabilities [@chartjs]
- MathJax.js for rendering mathematical expressions [@mathjax]

The application is designed to be accessible without installation, running entirely on the web ([www.e2p-simulator.com](https://www.e2p-simulator.com)). This implementation ensures broad accessibility across different operating systems and devices. Alternatively, the tool can also be run on a local node. The instructions and examples of usage are included in the tool on the Get Started page.

# Acknowledgements

AOD is supported by the Canadian Institutes of Health Research and the Krembil Foundation.

# References 

