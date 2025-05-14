# Brand Traffic Analyzer

Web application for analyzing search traffic data with a focus on differentiating between branded and non-branded traffic. This tool helps you gain actionable insights from your Search Console data.

## Features

- **Traffic Segmentation**: Automatically distinguish between branded and non-branded search traffic.
- **Multi-dimensional Analysis**: Examine traffic patterns by URL path, language, and query types.
- **Data Visualization**: Interactive charts and graphs for better data comprehension.
- **Quality Assessment**: Check data completeness, consistency, and detect outliers.
- **Actionable Insights**: Get recommendations based on your traffic patterns.
- **Export Options**: Download analysis as CSV or PDF for reporting.

## Installation

### Prerequisites

- Node.js (v16.0.0 or later)
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/dexter480/brand-traffic-analyzer.git
   cd brand-traffic-analyzer

The application will be available at [https://vesivanov.com/brand-nonbrand-analyzer/](https://vesivanov.com/brand-nonbrand-analyzer/).

## Usage

1. **Upload Data**: Upload your CSV file from Search Console (must include `query`, `page`, `clicks`, `impressions`, `ctr`, and `position` columns).
2. **Configure Analysis**: Set your brand terms and additional configuration options.
3. **Analyze**: Click the "Analyze" button to process your data.
4. **Explore Results**: Navigate through different tabs to view various aspects of your traffic data.
5. **Export**: Download data or generate PDF reports for sharing.

## Configuration Options

- **Brand Terms**: Comma-separated list of terms that identify your brand.
- **Custom Regex**: Use regular expressions for more advanced brand detection.
- **Case Sensitivity**: Toggle whether brand matching should be case-sensitive.
- **Language Detection**: Automatically detect language codes in URLs for multilingual analysis.

## Technical Details

This project is built with:

- **Frontend**: React with React Hooks
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Data Parsing**: PapaParse
- **Visualization**: Recharts
- **Export Tools**: html2canvas, jsPDF

## Data Requirements

The uploaded CSV file must include the following columns:

- `query`: The search query
- `page`: The landing page URL
- `clicks`: Number of clicks
- `impressions`: Number of impressions
- `ctr`: Click-through rate (can be percentage or decimal)
- `position`: Average position

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
