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

The E2P Simulator (Effect-to-Prediction Simulator) is an interactive web-based tool designed to help researchers translate statistical effect sizes to predictive utility. It visually and quantitatively demonstrates the relationship between commonly reported statistical metrics (such as Cohen's d and Pearson's r) and predictive metrics (such as recall and positive predictive value), while accounting for crucial factors like measurement reliability and outcome base rates.

The E2P Simulator has several potential applications:

1. **Interpretation of findings**: It can help researchers move beyond arbitrary "small/medium/large" effects size labels and ground the interpretation of their findings in terms of actual predictive value in specific contexts

2. **Research planning**: By clearly demonstrating how effect sizes relate to practical utility and how they're influenced by measurement reliability and outcome base rates, researchers can develop more realistic research plans and allocate resources more effectively

3. **Education**: The simulator's interactive design makes it a valuable teaching tool, helping students and researchers develop a more intuitive understanding of how different abstract statistical metrics relate to one another and to real-world impact

As such, this tool can be particularly valuable in biomedical and behavioral sciences, especially in areas such as biomarker research and precision medicine/psychiatry.  

# Statement of Need

In biomedical and behavioral sciences, the focus on statistical significance, which quantifies the probability of the effect being real, often overshadows effect sizes, which quantify the practical importance the effect [maher2013other]. This emphasis, paired with a methodological disconnect between classical statistics and predictive modeling, often leads to misinterpretation of results as clinically meaningful if significant, regardless of their real-world utility [funder2019evaluating]. Consequently, this results in unrealistic expectations, ineffective research planning, and resource misallocation - particularly in fields like biomarker research and precision medicine/psychiatry [abi2023candidate]. Key factors such as measurement reliability [karvelis2023individual,karvelis2025test], which attenuates effect sizes, and outcome base rates, which limit predictive power in low-prevalence scenarios, are often not accounted for.

The E2P Simulator addresses these challenges by providing an intuitive, interactive platform that allows researchers to:

- Visualize how statistical effect sizes translate to group separation and predictive performance
- Understand how measurement reliability attenuates observed effect sizes and predictive utility
- Explore the impact of outcome base rates on classification metrics
- Determine required effect sizes for achieving desired levels of predictive performance 
- Estimate how many predictors of smaller effect sizes would need to be combined to achieve a target level of predictive performance

By bridging the gap between statistical significance and practical utility, as well as the effects of measurement reliability and base rates, the E2P Simulator helps researchers make more informed decisions about their research designs, interpret findings more accurately, and communicate results more effectively to stakeholders and the broader scientific community.

# Implementation

The E2P Simulator is implemented using HTML, CSS, and JavaScript. The tool leverages several open-source libraries:

- D3.js for data visualization [@d3js]
- Plotly.js for interactive plots [@plotlyjs]
- Chart.js for additional charting capabilities [@chartjs]

The application is designed to be accessible without installation, running entirely on the web. This implementation ensures broad accessibility across different operating systems and devices.

# Acknowledgements

AOD is supported by the Canadian Institutes of Health Research and the Krembil Foundation.

# References 

