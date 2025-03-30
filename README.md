# E2P Simulator

The E2P Simulator (Effect-to-Prediction Simulator) is designed to help researchers better understand how statistical effect sizes (like Cohen's d, Pearon's r) translate into predictive metrics. It accounts for real-world challenges like measurement reliability and condition prevalence rates to provide realistic estimates of predictive performance.  

**Try it out**: [https://povilaskarvelis.github.io/e2p-simulator](https://povilaskarvelis.github.io/e2p-simulator)

![Screenshot of the simulator](images/interface.png)

## Applications

1. **Result Interpretation**: Instead of applying arbitrary "small/medium/large" effect size labels, interpret the practical significance of your findings by deriving predictive performance metrics which are more relevant for real-world applications
2. **Research Planning**: Determine required effect sizes for desired predictive performance by simulating various scenarios
3. **Education**: Develop a more intuitive understanding of statistical metrics and their practical implications through interactive visualization

This tool has been designed with biomedical and behavioral sciences in mind, particularly areas such as biomarker research and precision medicine/psychiatry. However, it may be just as applicable in many other areas of research that focus on personalization of interventions, such as within education and sports sciences.

## Key Features

- **Two Analysis Modes**:
  - **Binary Outcomes**: Explore how effect size measures of binary outcomes (e.g., cases vs. controls) translate into predictive metrics
  - **Continuous Outcomes**: Explore how continuous outcomes (e.g., symptom/performance improvement) that are later thresholded for practical purposes (e.g., responder vs. non-responder) translate into predictive metrics

- **Measurement Reliability**: Explore how measurement error affects observed vs. true effect sizes as well as predictive metrics

- **Base Rate**: Explore how outcome prevalence impacts real-world predictive performance

- **Multivariate Calculators**:
  - Mahalanobis D Calculator (Binary mode) and Multivariate R² Calculator (Continuous mode): Explore the interaction between the number of predictors, their effect sizes and their collinearity. 

## Citation

If you use this simulator in your research, please cite:

Karvelis, P., & Diaconescu, A. O. (2025). E2P Simulator: An interactive web-based tool for understanding predictive value of effect sizes. (TBC)

Zenodo
JOSS

## Running the E2P Simulator Locally

To run the E2P Simulator on your local machine for development or testing purposes, follow these steps:

1. **Prerequisites**:
   - Make sure you have [Node.js](https://nodejs.org/) installed (which includes npm)

2. **Clone the Repository**:
   ```
   git clone https://github.com/povilaskarvelis/e2p-simulator.git
   cd e2p-simulator
   ```

3. **Install Dependencies**:
   ```
   npm install
   ```

4. **Start the Local Server**:
   ```
   npm start
   ```

5. **Access the Simulator**:
   - Open your web browser and navigate to `http://localhost:8000`
   - The simulator should now be running locally on your machine

