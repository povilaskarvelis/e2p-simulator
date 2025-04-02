# E2P Simulator

The E2P Simulator (Effect-to-Prediction Simulator) is designed to help researchers better understand how statistical effect sizes (like Cohen's d, Pearon's r) translate into predictive utility. It accounts for real-world challenges like measurement reliability and outcome prevalence rates to provide realistic estimates of predictive performance, effectively enabling researchers to perform *predictive utility analysis*. Much like how power analysis tools (such as G*Power) help researchers plan for statistical significance, the E2P Simulator helps plan for practical significance.

Potential applications include:

1. **Result Interpretation**: Interpreting the practical significance of findings by deriving predictive performance metrics, instead of applying arbitrary "small/medium/large" labels
2. **Research Planning**: Determining required effect sizes for desired predictive performance by simulating various scenarios
3. **Education**: Developing a more intuitive understanding of statistical metrics and their practical implications through interactive visualization

This tool has been designed with biomedical and behavioral sciences in mind, particularly areas such as biomarker research and precision medicine/psychiatry. However, it may be just as applicable in many other areas of research that focus on personalization of interventions, such as within education and sports sciences.

**Try it out**: [https://www.e2p-simulator.com](https://www.e2p-simulator.com)

![Screenshot of the simulator](images/interface.png)

## Citation

If you use this simulator in your research, please cite:

Zenodo - TBD
JOSS - TBD

## Running the E2P Simulator Locally

To run the E2P Simulator on your local machine for development or testing purposes, follow these steps:

1. **Prerequisites**:
   - Make sure you have [Node.js](https://nodejs.org/) installed

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

