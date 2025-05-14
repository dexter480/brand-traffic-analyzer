import React, { useState, useCallback, useEffect } from 'react';
import { FileUploadComponent, ConfigurationComponent, TabsComponent, VisualizationComponent } from './components';
import { processCsvData, analyzeDataQuality, inferContentType } from './utils';

const BrandTrafficAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('config');
  const [brandTerms, setBrandTerms] = useState('');
  const [useCustomRegex, setUseCustomRegex] = useState(false);
  const [customRegex, setCustomRegex] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [detectLanguageCodes, setDetectLanguageCodes] = useState(true);
  const [expandedPath, setExpandedPath] = useState(null);
  const [pathExampleLimit, setPathExampleLimit] = useState(5);
  const [queryDisplayLimit, setQueryDisplayLimit] = useState(10);
  const [dataQuality, setDataQuality] = useState(null);
  const [segmentationSamples, setSegmentationSamples] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pathFilter, setPathFilter] = useState('');
  const [exportLoading, setExportLoading] = useState(false); // New: Export loading state

  // Configuration Persistence
  useEffect(() => {
    const saved = localStorage.getItem('brandTrafficConfig');
    if (saved) {
      const { brandTerms, useCustomRegex, customRegex, caseSensitive, detectLanguageCodes } = JSON.parse(saved);
      setBrandTerms(brandTerms || 'pipedrive, pipe drive');
      setUseCustomRegex(useCustomRegex || false);
      setCustomRegex(customRegex || '');
      setCaseSensitive(caseSensitive || false);
      setDetectLanguageCodes(detectLanguageCodes !== false); // Default to true if not set
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('brandTrafficConfig', JSON.stringify({
      brandTerms, useCustomRegex, customRegex, caseSensitive, detectLanguageCodes
    }));
  }, [brandTerms, useCustomRegex, customRegex, caseSensitive, detectLanguageCodes]);

  const handleFileUpload = (uploadedFile, parsedData) => {
    if (!uploadedFile || !(uploadedFile instanceof File) || !uploadedFile.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file');
      console.error('Invalid file object:', uploadedFile);
      return;
    }

    setFile(uploadedFile);
    setCsvData(parsedData);
    setError(null);
    analyzeData(parsedData);
  };

  const analyzeData = useCallback(async (dataToAnalyze) => {
    setLoading(true);
    try {
      const data = dataToAnalyze || csvData;
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No valid data to analyze');
      }

      const config = { brandTerms, useCustomRegex, customRegex, caseSensitive, detectLanguageCodes };
      const analysisResults = await processCsvData(data, config);
      setResults({ ...analysisResults });

      const qualityAnalysis = analyzeDataQuality(analysisResults.data);
      setDataQuality(qualityAnalysis);

      const brandedSamples = analysisResults.branded?.samples || [];
      const nonBrandedSamples = analysisResults.nonBranded?.samples || [];
      const borderlineSamples = analysisResults.borderline?.samples || [];
      setSegmentationSamples({
        branded: brandedSamples.slice(0, 5),
        nonBranded: nonBrandedSamples.slice(0, 5),
        borderline: borderlineSamples,
      });

      setActiveTab('results');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Error analyzing data');
    } finally {
      setLoading(false);
    }
  }, [csvData, brandTerms, useCustomRegex, customRegex, caseSensitive, detectLanguageCodes]);

  const handleAnalyze = () => {
    if (file && file instanceof File) {
      analyzeData(null);
    } else {
      setError('Please upload a valid CSV file first');
    }
  };

  // Data Validation and Cleaning: Clean duplicates
  const handleCleanDuplicates = () => {
    if (!results || !results.duplicates?.length) return;
    const cleanedData = results.data.filter((row, index, self) =>
      index === self.findIndex(r => r.query === row.query && r.page === row.page)
    );
    setResults({ ...results, data: cleanedData, duplicates: [] });
    analyzeData(cleanedData); // Re-analyze cleaned data
  };

  // Export functions with loading state
  const exportUrlData = async () => {
    if (!results?.pathData) return setError('No results to export');
    setExportLoading(true);
    const csv = [
      ['URL Path', 'Queries', 'Branded %', 'Non-Branded %', 'Content Type'].join(','),
      ...results.pathData.map((row) => [row.name, row.sortableTotal, row.branded, row.nonBranded, inferContentType(row.name) || 'Unknown'].map((field) => `"${field}"`).join(',')),
    ].join('\n');
    await downloadCSV(csv, 'url_analysis_data.csv');
    setExportLoading(false);
  };

  const exportQueryData = async (type = 'all') => {
    if (!results) return setError('No results to export');
    setExportLoading(true);
    let dataToExport = [], filename = 'query_data.csv';
    if (type === 'branded') {
      dataToExport = results.branded?.samples || [];
      filename = 'branded_queries.csv';
    } else if (type === 'nonBranded') {
      dataToExport = results.nonBranded?.samples || [];
      filename = 'non_branded_queries.csv';
    } else {
      dataToExport = [...(results.branded?.samples || []), ...(results.nonBranded?.samples || [])];
    }
    const csv = [
      ['Query', 'Clicks', 'Impressions', 'CTR', 'Avg Position', 'Content Types', 'Landing Page', 'Language'].join(','),
      ...dataToExport.map((row) => [
        row.query || '', row.clicks || 0, row.impressions || 0, (row.ctr * 100).toFixed(1) || 0, row.avgPosition?.toFixed(1) || 0,
        (Array.isArray(row.contentTypes) ? row.contentTypes.join(';') : row.contentTypes) || 'Unknown',
        (row.urls && row.urls.length > 0 ? row.urls[0].url : '') || '',
        (row.urls && row.urls.length > 0 ? row.urls[0].language : 'en') || 'en',
      ].map((field) => `"${field}"`).join(',')),
    ].join('\n');
    await downloadCSV(csv, filename);
    setExportLoading(false);
  };

  const exportLanguageData = async () => {
    if (!results?.languageData) return setError('No results to export');
    setExportLoading(true);
    const csv = [
      ['Language', 'Code', 'Total Queries', 'Clicks', 'Branded %', 'Non-Branded %'].join(','),
      ...results.languageData.map((row) => [row.language, row.code, row.sortableTotal, row.clicks, row.branded, row.nonBranded].map((field) => `"${field}"`).join(',')),
    ].join('\n');
    await downloadCSV(csv, 'language_analysis_data.csv');
    setExportLoading(false);
  };

  const exportInsightsData = async () => {
    if (!results) return setError('No results to export');
    setExportLoading(true);
    const csv = [
      ['Insight Type', 'Description', 'Value'].join(','),
      ...[
        ['Branded CTR', 'Branded traffic CTR', ((results.branded?.metrics?.ctr || 0) * 100).toFixed(1) + '%'],
        ['Non-Branded CTR', 'Non-Branded traffic CTR', ((results.nonBranded?.metrics?.ctr || 0) * 100).toFixed(1) + '%'],
        ['Branded Avg Position', 'Average position for branded terms', (results.branded?.metrics?.avgPosition || 0).toFixed(1)],
        ['Non-Branded Avg Position', 'Average position for non-branded terms', (results.nonBranded?.metrics?.avgPosition || 0).toFixed(1)],
        ['Branded Percentage', 'Percentage of branded traffic', (results.summary?.brandedPercentage || 0).toFixed(1) + '%'],
        ['Non-Branded Percentage', 'Percentage of non-branded traffic', (results.summary?.nonBrandedPercentage || 0).toFixed(1) + '%'],
      ].map((row) => row.map((field) => `"${field}"`).join(',')),
    ].join('\n');
    await downloadCSV(csv, 'insights_data.csv');
    setExportLoading(false);
  };

  const exportAllData = async () => {
    setExportLoading(true);
    await Promise.all([
      exportUrlData(),
      exportQueryData('branded'),
      exportQueryData('nonBranded'),
      exportLanguageData(),
      exportInsightsData()
    ]);
    setExportLoading(false);
  };

  const downloadCSV = (csv, filename) => {
    return new Promise((resolve) => {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      resolve();
    });
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Brand Traffic Analyzer</h1>
      {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>}
      {loading && <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">Analyzing data, please wait...</div>}
      {exportLoading && <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">Exporting data, please wait...</div>}
      <TabsComponent activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeTab === 'config' && (
        <>
          <FileUploadComponent onFileUpload={handleFileUpload} setError={setError} />
          <ConfigurationComponent
            brandTerms={brandTerms}
            setBrandTerms={setBrandTerms}
            useCustomRegex={useCustomRegex}
            setUseCustomRegex={setUseCustomRegex}
            customRegex={customRegex}
            setCustomRegex={setCustomRegex}
            caseSensitive={caseSensitive}
            setCaseSensitive={setCaseSensitive}
            detectLanguageCodes={detectLanguageCodes}
            setDetectLanguageCodes={setDetectLanguageCodes}
          />
          {file && file instanceof File && (
            <button onClick={handleAnalyze} disabled={loading} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400">
              {loading ? 'Analyzing...' : 'Analyze Data'}
            </button>
          )}
        </>
      )}
      {results && activeTab !== 'config' && (
        <>
          {activeTab === 'results' && (
            <div className="mb-4">
              <input
                type="text"
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                placeholder="Filter paths (e.g., /blog)"
                className="p-2 border rounded w-full"
              />
            </div>
          )}
          <VisualizationComponent
            results={{
              ...results,
              pathData: results.pathData.filter((row) => row.name.toLowerCase().includes(pathFilter.toLowerCase())),
            }}
            type={activeTab}
            pathUrlExamples={results.pathUrlExamples}
            pathUrlCounts={results.pathUrlCounts}
            expandedPath={expandedPath}
            setExpandedPath={setExpandedPath}
            pathExampleLimit={pathExampleLimit}
            setPathExampleLimit={setPathExampleLimit}
            queryDisplayLimit={queryDisplayLimit}
            setQueryDisplayLimit={setQueryDisplayLimit}
            onExport={exportUrlData}
            onExportBranded={() => exportQueryData('branded')}
            onExportNonBranded={() => exportQueryData('nonBranded')}
            onExportAll={exportAllData}
            dataQuality={dataQuality}
            segmentationSamples={segmentationSamples}
            onCleanDuplicates={handleCleanDuplicates} // New: Pass cleaning function
          />
        </>
      )}
    </div>
  );
};

export default BrandTrafficAnalyzer;
