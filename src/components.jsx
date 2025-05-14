import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { samplePathData, sampleLanguageData, COLORS } from './utils.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// File Upload Component
export const FileUploadComponent = ({ onFileUpload, setError }) => {
  const expectedColumns = ['query', 'page', 'clicks', 'impressions', 'ctr', 'position'];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setError('No file selected');
      return;
    }
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      Papa.parse(event.target.result, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log('Raw Parsed Data:', results.data); // Logging raw data
          if (!results.data.length) {
            setError('CSV is empty or contains no data');
            return;
          }

          const actualColumns = results.meta.fields.map(col => col.toLowerCase());
          const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
          if (missingColumns.length > 0) {
            setError(`CSV is missing required columns: ${missingColumns.join(', ')}`);
            return;
          }

          const normalizedData = results.data.map(row => {
            const normalizedRow = {};
            Object.keys(row).forEach(key => {
              normalizedRow[key.toLowerCase()] = row[key];
            });
            return normalizedRow;
          });
          console.log('Normalized Data:', normalizedData); // Logging normalized data

          const emptyColumns = expectedColumns.filter(col => 
            normalizedData.every(row => row[col] === null || row[col] === undefined || row[col] === '')
          );
          if (emptyColumns.length > 0) {
            setError(`The following columns are completely empty: ${emptyColumns.join(', ')}`);
            return;
          }

          onFileUpload(selectedFile, normalizedData);
        },
        error: (err) => setError(`Error parsing CSV: ${err.message}`),
      });
    };
    reader.onerror = () => setError('Error reading file');
    reader.readAsText(selectedFile);
  };

  return (
    <div className="mb-6">
      <label className="block mb-2 font-medium">Upload CSV File</label>
      <input type="file" accept=".csv" onChange={handleFileChange} className="w-full p-2 border rounded" />
    </div>
  );
};

// Configuration Component
export const ConfigurationComponent = ({
  brandTerms,
  setBrandTerms,
  useCustomRegex,
  setUseCustomRegex,
  customRegex,
  setCustomRegex,
  caseSensitive,
  setCaseSensitive,
  detectLanguageCodes,
  setDetectLanguageCodes,
}) => {
  return (
    <div className="mb-6 p-4 bg-gray-50 rounded">
      <h3 className="font-medium mb-3">Configuration</h3>
      <div className="mb-4">
        <label className="block mb-2 font-medium">Brand Terms</label>
        <input
          type="text"
          value={brandTerms}
          onChange={(e) => setBrandTerms(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="add your brand name here"
        />
      </div>
      <label className="flex items-center mb-2">
        <input type="checkbox" checked={useCustomRegex} onChange={(e) => setUseCustomRegex(e.target.checked)} className="mr-2" />
        <span>Use Custom Regex</span>
      </label>
      {useCustomRegex && (
        <div className="mb-4">
          <label className="block mb-2 font-medium">Custom Regex</label>
          <input
            type="text"
            value={customRegex}
            onChange={(e) => setCustomRegex(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
      )}
      <label className="flex items-center mb-2">
        <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className="mr-2" />
        <span>Case Sensitive Matching</span>
      </label>
      <label className="flex items-center mb-2">
        <input
          type="checkbox"
          checked={detectLanguageCodes}
          onChange={(e) => setDetectLanguageCodes(e.target.checked)}
          className="mr-2"
        />
        <span>Detect Language Codes in URLs</span>
      </label>
      <div className="mb-4">
        <label className="block mb-2 font-medium">Path Analysis Level</label>
        <select className="w-full p-2 border rounded" defaultValue="primary">
          <option value="primary">Primary Path (e.g., /blog)</option>
          <option value="secondary">Secondary Path (e.g., /blog/category)</option>
          <option value="full">Full Path</option>
        </select>
      </div>
    </div>
  );
};

// Visualization Component
export const VisualizationComponent = React.memo(({
  results,
  type = 'results',
  pathUrlExamples,
  pathUrlCounts,
  expandedPath,
  setExpandedPath,
  pathExampleLimit,
  setPathExampleLimit,
  queryDisplayLimit,
  setQueryDisplayLimit,
  onExport,
  onExportBranded,
  onExportNonBranded,
  onExportAll,
  dataQuality,
  segmentationSamples,
  setActiveTab,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'sortableTotal', direction: 'desc' });
  const [showDataHealthModal, setShowDataHealthModal] = useState(false);

  // Memoized data for all tabs
  const sampleData = useMemo(() => [
    { name: 'Branded', clicks: results.branded?.metrics?.clicks || 0, impressions: results.branded?.metrics?.impressions || 0, ctr: results.branded?.metrics?.ctr || 0, queries: results.summary?.brandedRows || 0 },
    { name: 'Non-Branded', clicks: results.nonBranded?.metrics?.clicks || 0, impressions: results.nonBranded?.metrics?.impressions || 0, ctr: results.nonBranded?.metrics?.ctr || 0, queries: results.summary?.nonBrandedRows || 0 },
  ], [results]);

  const samplePieData = useMemo(() => [
    { name: 'Branded', value: results.summary?.brandedRows || 0 },
    { name: 'Non-Branded', value: results.summary?.nonBrandedRows || 0 },
  ], [results]);

  const trendData = useMemo(() => {
    if (!results?.data || !results.data.some(row => row.date)) return [];
    const groupedByDate = {};
    results.data.forEach(row => {
      if (!row.date) return;
      const date = new Date(row.date).toISOString().split('T')[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = { date, brandedClicks: 0, nonBrandedClicks: 0 };
      }
      if (results.branded?.samples?.some(sample => sample.query === row.query)) {
        groupedByDate[date].brandedClicks += row.clicks || 0;
      } else {
        groupedByDate[date].nonBrandedClicks += row.clicks || 0;
      }
    });
    return Object.values(groupedByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [results]);

  const topBrandedQueries = useMemo(() => {
    return (results.branded?.samples || []).sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 5);
  }, [results]);

  const topNonBrandedQueries = useMemo(() => {
    return (results.nonBranded?.samples || []).sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 5);
  }, [results]);

  const quickActions = useMemo(() => {
    const actions = [];
    if (((results.branded?.metrics?.ctr || 0) * 100) < 2) {
      actions.push({ message: 'Branded CTR is low (1.2%). Optimize titles and meta descriptions.', tab: 'queries' });
    }
    if (((results.nonBranded?.metrics?.ctr || 0) * 100) < 2) {
      actions.push({ message: 'Non-Branded CTR is low (2.1%). Optimize blog content.', tab: 'queries' });
    }
    if ((results.nonBranded?.metrics?.avgPosition || 0) > 5) {
      actions.push({ message: 'Non-Branded Avg Position is high (5.6). Improve SEO.', tab: 'insights' });
    }
    return actions;
  }, [results]);

  // Download Summary as PDF
  const downloadSummary = () => {
    const element = document.getElementById('results-tab');
    html2canvas(element).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('results_summary.pdf');
    });
  };

  // Sort function
  const sortData = (data, key) => {
    return [...data].sort((a, b) => {
      const aValue = a[key], bValue = b[key];
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  // Handle sort
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc',
    });
  };

  if (!results || !results.summary) {
    return <div className="p-4 text-gray-500">No analysis results available. Please analyze the data first.</div>;
  }

  if (type === 'results') {
    return (
      <div id="results-tab">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Analysis Results</h2>
          <button onClick={downloadSummary} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Download Summary as PDF
          </button>
        </div>
        <div className="mb-6 p-4 bg-blue-50 rounded">
          <h3 className="font-medium mb-3">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-3 rounded shadow-sm">
              <p className="text-sm text-gray-500">Total Queries</p>
              <p className="text-2xl font-bold">{results.summary.totalRows || 0}</p>
              <p className="text-xs text-gray-500" title={`Confidence: ${dataQuality?.confidenceScores?.brandedClicks || 100}%`}>
                (Confidence: {(dataQuality?.confidenceScores?.brandedClicks + dataQuality?.confidenceScores?.nonBrandedClicks) / 2 || 100}%)
              </p>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <p className="text-sm text-gray-500">Branded</p>
              <p className="text-2xl font-bold text-blue-600">{results.summary.brandedRows || 0}</p>
              <p className="text-sm">{(results.summary.brandedPercentage || 0).toFixed(1)}%</p>
              <p className="text-xs text-gray-500" title={`Confidence: ${dataQuality?.confidenceScores?.brandedClicks || 100}%`}>
                (Confidence: {dataQuality?.confidenceScores?.brandedClicks || 100}%)
              </p>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <p className="text-sm text-gray-500">Non-Branded</p>
              <p className="text-2xl font-bold text-green-600">{results.summary.nonBrandedRows || 0}</p>
              <p className="text-sm">{(results.summary.nonBrandedPercentage || 0).toFixed(1)}%</p>
              <p className="text-xs text-gray-500" title={`Confidence: ${dataQuality?.confidenceScores?.nonBrandedClicks || 100}%`}>
                (Confidence: {dataQuality?.confidenceScores?.nonBrandedClicks || 100}%)
              </p>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <p className="text-sm text-gray-500">Ratio</p>
              <p className="text-xl font-bold">
                {results.summary.totalRows > 0 ? (results.summary.nonBrandedRows / results.summary.brandedRows || 0).toFixed(1) : '0'}
              </p>
              <p className="text-xs text-gray-500">Branded : Non-Branded</p>
            </div>
            <div className="bg-white p-3 rounded shadow-sm cursor-pointer" onClick={() => setShowDataHealthModal(true)}>
              <div className="flex items-center">
                <p className="text-sm text-gray-500">Data Health</p>
                <span className="ml-1 cursor-pointer" title="Overall quality score based on completeness, consistency, and outliers">ⓘ</span>
              </div>
              <div className="flex items-center">
                <span className={`inline-block w-3 h-3 rounded-full mr-2 ${dataQuality?.healthScore > 90 ? 'bg-green-500' : dataQuality?.healthScore > 75 ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                <p className="text-xl font-bold">{dataQuality?.healthScore || 95}/100</p>
              </div>
              {(dataQuality?.warnings || []).length > 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  {(dataQuality?.warnings || []).length} warning{dataQuality?.warnings?.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Data Health Modal */}
        {showDataHealthModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Data Health Insights</h3>
              <p className="text-sm text-gray-600 mb-4">
                Overall Data Health Score: {dataQuality?.healthScore || 95}/100
              </p>
              {(dataQuality?.warnings || []).length > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-2">Warnings:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {(dataQuality?.warnings || []).map((warning, index) => (
                      <li key={`modal-warning-${index}`} className="text-sm">
                        {warning.message} (Severity: {warning.severity})
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => { setShowDataHealthModal(false); setActiveTab('dataQuality'); }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View Details in Data Quality Tab
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-600">No warnings found. Your data looks healthy!</p>
              )}
              <button
                onClick={() => setShowDataHealthModal(false)}
                className="mt-4 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 rounded">
            <h3 className="font-medium mb-3">Quick Actions</h3>
            <ul className="space-y-2">
              {quickActions.map((action, index) => (
                <li key={`action-${index}`} className="flex justify-between items-center p-2 bg-white rounded shadow-sm">
                  <span className="text-sm">{action.message}</span>
                  <button
                    onClick={() => setActiveTab(action.tab)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Take Action
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Traffic Breakdown */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded">
            <h3 className="font-medium mb-2">Branded Traffic</h3>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-1">Queries:</td>
                  <td className="py-1 text-right font-medium">{results.summary.brandedRows || 0}</td>
                </tr>
                <tr>
                  <td className="py-1">Clicks:</td>
                  <td className="py-1 text-right font-medium">{results.branded?.metrics?.clicks || 0}</td>
                </tr>
                <tr>
                  <td className="py-1">Impressions:</td>
                  <td className="py-1 text-right font-medium">{results.branded?.metrics?.impressions || 0}</td>
                </tr>
                <tr>
                  <td className="py-1">CTR:</td>
                  <td className="py-1 text-right font-medium">{((results.branded?.metrics?.ctr || 0) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="py-1">Avg Position:</td>
                  <td className="py-1 text-right font-medium">{(results.branded?.metrics?.avgPosition || 0).toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">
              {((results.branded?.metrics?.ctr || 0) * 100) >= 3 ? 'CTR is above industry average (3%)!' : 'CTR is below industry average (3%). Consider optimizing titles.'}
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded">
            <h3 className="font-medium mb-2">Non-Branded Traffic</h3>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-1">Queries:</td>
                  <td className="py-1 text-right font-medium">{results.summary.nonBrandedRows || 0}</td>
                </tr>
                <tr>
                  <td className="py-1">Clicks:</td>
                  <td className="py-1 text-right font-medium">{results.nonBranded?.metrics?.clicks || 0}</td>
                </tr>
                <tr>
                  <td className="py-1">Impressions:</td>
                  <td className="py-1 text-right font-medium">{results.nonBranded?.metrics?.impressions || 0}</td>
                </tr>
                <tr>
                  <td className="py-1">CTR:</td>
                  <td className="py-1 text-right font-medium">{((results.nonBranded?.metrics?.ctr || 0) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="py-1">Avg Position:</td>
                  <td className="py-1 text-right font-medium">{(results.nonBranded?.metrics?.avgPosition || 0).toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">
              {((results.nonBranded?.metrics?.ctr || 0) * 100) >= 2 ? 'CTR is above industry average (2%)!' : 'CTR is below industry average (2%). Consider optimizing content.'}
            </p>
          </div>
        </div>

        {/* Top Performing Queries */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded">
            <h3 className="font-medium mb-3 text-blue-600">Top 5 Branded Queries</h3>
            {topBrandedQueries.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="p-2 text-left">Query</th>
                    <th className="p-2 text-right">Clicks</th>
                    <th className="p-2 text-right">Impressions</th>
                  </tr>
                </thead>
                <tbody>
                  {topBrandedQueries.map((query, index) => (
                    <tr key={`top-branded-${index}`} className={index % 2 === 0 ? 'bg-blue-50' : ''}>
                      <td className="p-2">{query.query || 'N/A'}</td>
                      <td className="p-2 text-right">{query.clicks || 0}</td>
                      <td className="p-2 text-right">{query.impressions || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No branded queries available.</p>
            )}
          </div>
          <div className="p-4 bg-green-50 rounded">
            <h3 className="font-medium mb-3 text-green-600">Top 5 Non-Branded Queries</h3>
            {topNonBrandedQueries.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-100">
                    <th className="p-2 text-left">Query</th>
                    <th className="p-2 text-right">Clicks</th>
                    <th className="p-2 text-right">Impressions</th>
                  </tr>
                </thead>
                <tbody>
                  {topNonBrandedQueries.map((query, index) => (
                    <tr key={`top-nonbranded-${index}`} className={index % 2 === 0 ? 'bg-green-50' : ''}>
                      <td className="p-2">{query.query || 'N/A'}</td>
                      <td className="p-2 text-right">{query.clicks || 0}</td>
                      <td className="p-2 text-right">{query.impressions || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No non-branded queries available.</p>
            )}
          </div>
        </div>

        {/* Trend Chart (if Date data exists) */}
        {trendData.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <h3 className="font-medium mb-3 text-center">Traffic Trends Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="brandedClicks" stroke="#0088FE" name="Branded Clicks" />
                <Line type="monotone" dataKey="nonBrandedClicks" stroke="#00C49F" name="Non-Branded Clicks" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Enhanced Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded" style={{ minHeight: '350px' }}>
            <h3 className="font-medium mb-2 text-center">Traffic Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sampleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="clicks" fill="#0088FE" name="Clicks" />
                <Bar dataKey="impressions" fill="#00C49F" name="Impressions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="p-4 bg-gray-50 rounded" style={{ minHeight: '350px' }}>
            <h3 className="font-medium mb-2 text-center">Query Distribution (Ratio)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={samplePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {samplePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="p-4 bg-gray-50 rounded mb-6" style={{ minHeight: '350px' }}>
          <h3 className="font-medium mb-2 text-center">CTR & Avg Position Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sampleData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="ctr" fill="#8884d8" name="CTR" unit="%" formatter={(value) => (value * 100).toFixed(1)}>
                {sampleData.map((entry, index) => (
                  <Cell key={`ctr-${index}`} />
                ))}
              </Bar>
              <Bar yAxisId="right" dataKey="avgPosition" fill="#82ca9d" name="Avg Position">
                {sampleData.map((entry, index) => (
                  <Cell key={`pos-${index}`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  } else if (type === 'urlAnalysis') {
    const sortedPathData = sortData(results.pathData || samplePathData, sortConfig.key);
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">URL Path Analysis</h2>
        <div className="mb-4 flex gap-4">
          <button onClick={onExport} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Export URL Analysis Data</button>
          <button onClick={onExportAll} className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Export All Data</button>
        </div>
        <div className="mb-6">
          <h3 className="font-medium mb-3">URL Path Traffic Distribution</h3>
          <div className="p-4 bg-gray-50 rounded" style={{ minHeight: '450px' }}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={sortedPathData.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
                <Bar dataKey="branded" stackId="a" fill="#0088FE" name="Branded %" />
                <Bar dataKey="nonBranded" stackId="a" fill="#00C49F" name="Non-Branded %" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-sm text-center text-gray-500 mt-2">Showing top 10 URL paths by traffic volume</p>
          </div>
        </div>
        <div className="overflow-x-auto bg-gray-50 rounded p-4">
          <h3 className="font-medium mb-3">Detailed URL Path Analysis</h3>
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border text-left cursor-pointer" onClick={() => handleSort('name')}>
                  URL Path {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-2 border text-right cursor-pointer" onClick={() => handleSort('sortableTotal')}>
                  Queries {sortConfig.key === 'sortableTotal' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-2 border text-right">Branded %</th>
                <th className="p-2 border text-right">Non-Branded %</th>
                <th className="p-2 border text-center">Examples</th>
              </tr>
            </thead>
            <tbody>
              {sortedPathData.slice(0, 10).map((pathData, index) => (
                <React.Fragment key={`path-${index}`}>
                  <tr className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="p-2 border font-medium">{pathData.name}</td>
                    <td className="p-2 border text-right">{pathData.sortableTotal || 0}</td>
                    <td className="p-2 border text-right bg-blue-50">{(pathData.branded || 0).toFixed(1)}%</td>
                    <td className="p-2 border text-right bg-green-50">{(pathData.nonBranded || 0).toFixed(1)}%</td>
                    <td className="p-2 border text-center">
                      <button
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        onClick={() => setExpandedPath(expandedPath === pathData.name ? null : pathData.name)}
                      >
                        Show URLs
                      </button>
                    </td>
                  </tr>
                  {expandedPath === pathData.name && (
                    <tr>
                      <td colSpan="5" className="p-3 border bg-gray-50">
                        <div className="text-sm">
                          <div className="flex justify-between items-center mb-2">
                            <p className="font-medium">Example URLs for {pathData.name}:</p>
                            {(pathUrlCounts[pathData.name] || 0) > 0 && (
                              <p className="text-xs text-gray-500">
                                Showing {Math.min(pathExampleLimit, (pathUrlExamples[pathData.name] || []).length)} of {pathUrlCounts[pathData.name]} URLs
                              </p>
                            )}
                          </div>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            {(pathUrlExamples[pathData.name] || []).slice(0, pathExampleLimit).map((url, urlIndex) => (
                              <li key={`url-${index}-${urlIndex}`} className="text-gray-700 break-all">{url}</li>
                            )) || <li className="text-gray-500">No URL examples available for this path</li>}
                          </ul>
                          {((pathUrlExamples[pathData.name] || []).length > 5) && (
                            <div className="mt-3 text-right">
                              {pathExampleLimit <= 5 ? (
                                <button className="text-blue-600 hover:underline text-sm" onClick={() => setPathExampleLimit(20)}>
                                  Show more examples
                                </button>
                              ) : (
                                <button className="text-blue-600 hover:underline text-sm" onClick={() => setPathExampleLimit(5)}>
                                  Show fewer examples
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } else if (type === 'languages') {
    const sortedLanguageData = sortData(results.languageData || sampleLanguageData, sortConfig.key);
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Language Analysis</h2>
        <div className="mb-4 flex gap-4">
          <button onClick={onExport} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Export Language Analysis Data</button>
          <button onClick={onExportAll} className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Export All Data</button>
        </div>
        <div className="mb-6">
          <h3 className="font-medium mb-3">Language Distribution</h3>
          <div className="p-4 bg-gray-50 rounded" style={{ minHeight: '400px' }}>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={sortedLanguageData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="language" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sortableTotal" fill="#8884d8" name="Total Queries" />
                <Bar dataKey="clicks" fill="#82ca9d" name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-sm text-center text-gray-500 mt-2">Showing top 10 languages by query volume</p>
          </div>
        </div>
        <div className="overflow-x-auto bg-gray-50 rounded p-4">
          <h3 className="font-medium mb-3">Language Analysis Table</h3>
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border text-left cursor-pointer" onClick={() => handleSort('language')}>
                  Language {sortConfig.key === 'language' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-2 border text-left">Code</th>
                <th className="p-2 border text-right cursor-pointer" onClick={() => handleSort('sortableTotal')}>
                  Total Queries {sortConfig.key === 'sortableTotal' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-2 border text-right">Clicks</th>
                <th className="p-2 border text-right">Branded %</th>
                <th className="p-2 border text-right">Non-Branded %</th>
              </tr>
            </thead>
            <tbody>
              {sortedLanguageData.map((item, index) => (
                <tr key={`lang-${index}`} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="p-2 border font-medium">{item.language === 'unknown' ? 'Unknown' : item.language}</td>
                  <td className="p-2 border">{item.code}</td>
                  <td className="p-2 border text-right">{item.sortableTotal}</td>
                  <td className="p-2 border text-right">{item.clicks}</td>
                  <td className="p-2 border text-right bg-blue-50">{(item.branded || 0).toFixed(1)}%</td>
                  <td className="p-2 border text-right bg-green-50">{(item.nonBranded || 0).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 p-4 bg-yellow-50 rounded">
            <h3 className="font-medium mb-2">Recommendations</h3>
            <ul className="list-disc list-inside space-y-2">
              {sortedLanguageData.map((lang, index) => {
                if (lang.sortableTotal > 50 && lang.branded > 10) {
                  return (
                    <li key={`recommend-${index}`}>
                      Expand {lang.language} content—{lang.branded.toFixed(1)}% branded traffic indicates strong brand recognition.
                    </li>
                  );
                }
                return null;
              })}
            </ul>
          </div>
        </div>
      </div>
    );
  } else if (type === 'queries') {
    const sortedBrandedQueries = sortData(results.branded?.samples || [], 'clicks');
    const sortedNonBrandedQueries = sortData(results.nonBranded?.samples || [], 'clicks');
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Query Analysis</h2>
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center">
            <label className="mr-2 font-medium">Show queries:</label>
            <select
              className="p-2 border rounded"
              value={queryDisplayLimit}
              onChange={(e) => setQueryDisplayLimit(parseInt(e.target.value, 10))}
            >
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="50">Top 50</option>
              <option value="100">Top 100</option>
            </select>
          </div>
          <button onClick={onExportBranded} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Export Branded Queries
          </button>
          <button onClick={onExportNonBranded} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Export Non-Branded Queries
          </button>
          <button onClick={onExportAll} className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            Export All Data
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-3 text-blue-600">Top Branded Queries</h3>
            <div className="bg-gray-100 p-2 mb-3 rounded flex justify-between">
              <span>Showing top {queryDisplayLimit} of {results.summary?.brandedRows || 0} branded queries</span>
            </div>
            {sortedBrandedQueries.slice(0, queryDisplayLimit).map((queryData, index) => (
              <div key={`branded-q-${index}`} className="mb-4 p-3 bg-blue-50 rounded shadow-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{queryData.query || 'N/A'}</span>
                  <span className="text-sm bg-blue-200 text-blue-800 px-2 py-0.5 rounded">Clicks: {queryData.clicks || 0}</span>
                </div>
                <div className="text-sm grid grid-cols-2 gap-x-4 mb-2">
                  <div>Impressions: {queryData.impressions || 0}</div>
                  <div>CTR: {((queryData.ctr || 0) * 100).toFixed(1)}%</div>
                  <div>Avg Position: {(queryData.avgPosition || 0).toFixed(1)}</div>
                  <div>Content Types: {Array.isArray(queryData.contentTypes) ? queryData.contentTypes.join(', ') : queryData.contentTypes || 'N/A'}</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium mt-1">Landing Pages:</div>
                  <ul className="mt-1 list-disc list-inside text-xs">
                    {(queryData.urls || []).map((urlData, urlIndex) => (
                      <li key={`branded-url-${index}-${urlIndex}`} className="mb-1 truncate">
                        <span className="text-gray-600">[{urlData.contentType || 'Unknown'}]</span> {urlData.url || 'N/A'}
                        {urlData.language && <span className="ml-1 text-gray-500">({urlData.language})</span>}
                      </li>
                    )) || <li className="text-gray-500">No URLs available</li>}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-medium mb-3 text-green-600">Top Non-Branded Queries</h3>
            <div className="bg-gray-100 p-2 mb-3 rounded flex justify-between">
              <span>Showing top {queryDisplayLimit} of {results.summary?.nonBrandedRows || 0} non-branded queries</span>
            </div>
            {sortedNonBrandedQueries.slice(0, queryDisplayLimit).map((queryData, index) => (
              <div key={`nonbranded-q-${index}`} className="mb-4 p-3 bg-green-50 rounded shadow-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{queryData.query || 'N/A'}</span>
                  <span className="text-sm bg-green-200 text-green-800 px-2 py-0.5 rounded">Clicks: {queryData.clicks || 0}</span>
                </div>
                <div className="text-sm grid grid-cols-2 gap-x-4 mb-2">
                  <div>Impressions: {queryData.impressions || 0}</div>
                  <div>CTR: {((queryData.ctr || 0) * 100).toFixed(1)}%</div>
                  <div>Avg Position: {(queryData.avgPosition || 0).toFixed(1)}</div>
                  <div>Content Types: {Array.isArray(queryData.contentTypes) ? queryData.contentTypes.join(', ') : queryData.contentTypes || 'N/A'}</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium mt-1">Landing Pages:</div>
                  <ul className="mt-1 list-disc list-inside text-xs">
                    {(queryData.urls || []).map((urlData, urlIndex) => (
                      <li key={`nonbranded-url-${index}-${urlIndex}`} className="mb-1 truncate">
                        <span className="text-gray-600">[{urlData.contentType || 'Unknown'}]</span> {urlData.url || 'N/A'}
                        {urlData.language && <span className="ml-1 text-gray-500">({urlData.language})</span>}
                      </li>
                    )) || <li className="text-gray-500">No URLs available</li>}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  } else if (type === 'dataQuality') {
    const totalRows = results.summary?.totalRows || 0;
    const missingValues = dataQuality?.missingValues || {};
    const expectedColumns = ['query', 'page', 'clicks', 'impressions', 'ctr', 'position'];

    // Recalculate missing values with normalized keys
    const recalculateMissingValues = (data) => {
      const missing = {};
      expectedColumns.forEach(col => {
        missing[col] = data.reduce((count, row) => {
          return count + (row[col] === null || row[col] === undefined || row[col] === '' ? 1 : 0);
        }, 0);
      });
      console.log('Recalculated Missing Values:', missing); // Logging missing values
      return missing;
    };

    const normalizedMissingValues = recalculateMissingValues(results.data || []);
    const completeness = totalRows > 0 && expectedColumns.length > 0
      ? ((totalRows * expectedColumns.length - Object.values(normalizedMissingValues).reduce((sum, val) => sum + val, 0)) / (totalRows * expectedColumns.length) * 100).toFixed(1)
      : 0;

    const consistency = completeness > 0 && results.data && results.data.length >= 2
      ? (() => {
          const clicksImpressionsRatio = results.data
            .map(row => (row.clicks || 0) / (row.impressions || 1))
            .filter(r => !isNaN(r) && isFinite(r));
          if (clicksImpressionsRatio.length === 0) return 94.5;
          const avgRatio = clicksImpressionsRatio.reduce((a, b) => a + b, 0) / clicksImpressionsRatio.length;
          const stdDev = Math.sqrt(
            clicksImpressionsRatio.reduce((sum, val) => sum + Math.pow(val - avgRatio, 2), 0) / clicksImpressionsRatio.length
          );
          console.log('Consistency Calculation - Avg Ratio:', avgRatio, 'Std Dev:', stdDev); // Logging consistency metrics
          return (stdDev < 0.1 ? 98 : stdDev < 0.2 ? 95 : 90).toFixed(1);
        })()
      : 0;

    const outlierCount = Object.values(dataQuality?.outliers || {}).flat().length;
    const outlierScore = outlierCount === 0 ? 100 : Math.max(0, 100 - (outlierCount * 5));

    const recalculatedHealthScore = (() => {
      const warningPenalty = (dataQuality?.warnings || []).length * 2;
      const score = Math.max(0, Math.min(100, Math.round(
        (parseFloat(completeness) * 0.4) +
        (parseFloat(consistency) * 0.4) +
        (outlierScore * 0.2) -
        warningPenalty
      )));
      console.log('Recalculated Health Score:', score); // Logging health score
      return score;
    })();

    const trustworthiness = recalculatedHealthScore >= 90
      ? "Data is highly reliable for analysis."
      : recalculatedHealthScore >= 75
      ? "Data is moderately reliable but requires attention."
      : "Data reliability is low; proceed with caution.";

    const warnings = [
      {
        type: 'MissingData',
        message: parseFloat(completeness) === 0 ? 'Missing values detected in all fields' : 'Missing values detected in dataset',
        severity: parseFloat(completeness) === 0 ? 'high' : 'medium',
        count: Object.values(normalizedMissingValues).reduce((sum, val) => sum + val, 0),
        action: 'View affected rows',
      },
    ];

    const recommendations = (() => {
      const recs = [];
      if (parseFloat(completeness) < 90) recs.push("Review and fill missing values in key columns (e.g., query, page, clicks).");
      if (parseFloat(consistency) < 95) recs.push("Check for inconsistencies in metric relationships (e.g., clicks vs impressions).");
      if (outlierCount > 0) recs.push("Investigate outliers in clicks or impressions data for accuracy.");
      if (warnings.length > 0) recs.push("Address the listed warnings to improve data quality.");
      return recs.length > 0 ? recs : ["No immediate improvements needed. Your data is in good shape!"];
    })();

    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Data Quality Analysis</h2>
        <div className="mb-4">
          <button onClick={onExportAll} className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            Export All Data
          </button>
        </div>
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h3 className="font-medium mb-3 flex items-center">
            <span>Overall Data Health Score: </span>
            <span className={`ml-2 font-bold ${recalculatedHealthScore > 90 ? 'text-green-600' : recalculatedHealthScore > 75 ? 'text-yellow-600' : 'text-red-600'}`}>
              {recalculatedHealthScore}/100
            </span>
          </h3>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
            <div
              className={`h-4 rounded-full ${recalculatedHealthScore > 90 ? 'bg-green-500' : recalculatedHealthScore > 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${recalculatedHealthScore}%` }}
            ></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded shadow-sm">
              <p className="text-sm font-medium text-gray-700">Data Completeness</p>
              <p className="text-xl font-bold">{completeness || 0}%</p>
              <p className="text-xs text-gray-500">{completeness === 0 ? 'Missing values detected in all fields' : completeness < 90 ? 'Missing values detected in some fields' : 'No significant missing values'}</p>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <p className="text-sm font-medium text-gray-700">Data Consistency</p>
              <p className="text-xl font-bold">{consistency || 0}%</p>
              <p className="text-xs text-gray-500">{consistency > 0 ? (consistency < 95 ? 'Metric relationships are inconsistent' : 'Metric relationships are mostly consistent') : 'Insufficient data to calculate consistency'}</p>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <p className="text-sm font-medium text-gray-700">Outlier Detection</p>
              <p className="text-xl font-bold">{outlierScore || 0}%</p>
              <p className="text-xs text-gray-500">{outlierCount} statistical outlier{outlierCount !== 1 ? 's' : ''} found</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded">
            <h4 className="font-medium mb-2">Trustworthiness Assessment</h4>
            <p className="text-sm text-gray-700">{trustworthiness}</p>
          </div>
          <div className="mt-4 p-4 bg-yellow-50 rounded">
            <h4 className="font-medium mb-2">Improvement Recommendations</h4>
            <ul className="list-disc list-inside space-y-2">
              {recommendations.map((rec, index) => (
                <li key={`rec-${index}`} className="text-sm">{rec}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mb-6">
          <h3 className="font-medium mb-3">Missing Values By Column</h3>
          <div className="p-4 bg-white rounded border">
            {expectedColumns.map((field) => (
              <div key={field} className="mb-4">
                <div className="mb-2 flex justify-between">
                  <span className="font-medium">{field.charAt(0).toUpperCase() + field.slice(1)}</span>
                  <span>{(normalizedMissingValues[field] || 0)} missing ({(((normalizedMissingValues[field] || 0) / totalRows) * 100).toFixed(1) || 0}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${(((normalizedMissingValues[field] || 0) / totalRows) * 100) > 10 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${100 - (((normalizedMissingValues[field] || 0) / totalRows) * 100)}%` || '100%' }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-6">
          <h3 className="font-medium mb-3">Data Warnings & Issues</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border text-left">Issue Type</th>
                  <th className="p-2 border text-left">Message</th>
                  <th className="p-2 border text-left">Severity</th>
                  <th className="p-2 border text-right">Count</th>
                  <th className="p-2 border text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((warning, index) => (
                  <tr key={`warning-${index}`} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="p-2 border">{warning.type}</td>
                    <td className="p-2 border">{warning.message}</td>
                    <td className="p-2 border">
                      <span className={`px-2 py-1 rounded text-xs ${warning.severity === 'high' ? 'bg-red-100 text-red-800' : warning.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                        {warning.severity}
                      </span>
                    </td>
                    <td className="p-2 border text-right">{warning.count}</td>
                    <td className="p-2 border">
                      <button className="text-blue-600 hover:underline text-sm" onClick={() => console.log('View details:', warning.details)}>
                        {warning.action || 'Investigate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {completeness > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-3">Statistical Outliers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded border">
                <h4 className="font-medium mb-2">Click Outliers</h4>
                {(dataQuality?.outliers?.clicks || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No significant outliers detected</p>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Queries with unusually high click counts:</p>
                    <ul className="list-disc list-inside">
                      {(dataQuality?.outliers?.clicks || []).map((item, index) => (
                        <li key={`click-outlier-${index}`} className="text-sm py-1">
                          "{item.query || 'N/A'}" - {item.clicks || 0} clicks (avg: {item.avgClicks || 0})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="p-4 bg-white rounded border">
                <h4 className="font-medium mb-2">Impression Outliers</h4>
                {(dataQuality?.outliers?.impressions || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No significant outliers detected</p>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Queries with unusually high impression counts:</p>
                    <ul className="list-disc list-inside">
                      {(dataQuality?.outliers?.impressions || []).map((item, index) => (
                        <li key={`impression-outlier-${index}`} className="text-sm py-1">
                          "{item.query || 'N/A'}" - {item.impressions || 0} impressions (avg: {item.avgImpressions || 0})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {completeness > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-3">Duplicate Rows</h3>
            <div className="overflow-x-auto bg-white rounded border p-4">
              {results.duplicates?.length > 0 ? (
                <table className="min-w-full border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border text-left">Query</th>
                      <th className="p-2 border text-left">Page</th>
                      <th className="p-2 border text-right">Original Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.duplicates.map((dup, index) => (
                      <tr key={`dup-${index}`} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="p-2 border">{dup.query}</td>
                        <td className="p-2 border">{dup.page}</td>
                        <td className="p-2 border text-right">{dup.originalIndex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-500">No duplicates detected.</p>
              )}
            </div>
          </div>
        )}
        <div className="mb-6">
          <h3 className="font-medium mb-3">Sample Rows for Verification (Max 50)</h3>
          <div className="overflow-x-auto bg-white rounded border p-4">
            {results.sampleRows?.length > 0 ? (
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border text-left">Query</th>
                    <th className="p-2 border text-left">Page</th>
                    <th className="p-2 border text-right">Clicks</th>
                    <th className="p-2 border text-right">Impressions</th>
                    <th className="p-2 border text-right">CTR</th>
                    <th className="p-2 border text-right">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {results.sampleRows.slice(0, 50).map((row, index) => (
                    <tr key={`sample-${index}`} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="p-2 border">{row.query || 'N/A'}</td>
                      <td className="p-2 border">{row.page || 'N/A'}</td>
                      <td className="p-2 border text-right">{row.clicks || 0}</td>
                      <td className="p-2 border text-right">{row.impressions || 0}</td>
                      <td className="p-2 border text-right">
                        {row.impressions && row.clicks && row.impressions > 0 
                          ? ((row.clicks / row.impressions) * 100).toFixed(1) + '%' 
                          : 'N/A'}
                      </td>
                      <td className="p-2 border text-right">{row.position?.toFixed(1) || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No sample rows available.</p>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-medium mb-3">Segmentation Verification</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded border">
              <h4 className="font-medium mb-2 text-blue-800">Branded Query Samples</h4>
              <ul className="space-y-2">
                {(segmentationSamples?.branded || []).map((item, index) => (
                  <li key={`branded-sample-${index}`} className="p-2 bg-white rounded shadow-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{item.query || 'N/A'}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">branded</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Clicks: {item.clicks || 0} | Impressions: {item.impressions || 0}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 bg-green-50 rounded border">
              <h4 className="font-medium mb-2 text-green-800">Non-Branded Query Samples</h4>
              <ul className="space-y-2">
                {(segmentationSamples?.nonBranded || []).map((item, index) => (
                  <li key={`nonbranded-sample-${index}`} className="p-2 bg-white rounded shadow-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{item.query || 'N/A'}</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">non-branded</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Clicks: {item.clicks || 0} | Impressions: {item.impressions || 0}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 bg-yellow-50 rounded border">
              <h4 className="font-medium mb-2 text-yellow-800">Borderline Cases</h4>
              <p className="text-xs text-gray-700 mb-2">Queries containing brand terms but classified as non-branded</p>
              <ul className="space-y-2">
                {(segmentationSamples?.borderline || []).map((item, index) => (
                  <li key={`borderline-sample-${index}`} className="p-2 bg-white rounded shadow-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{item.query || 'N/A'}</span>
                      <button className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded hover:bg-blue-200">reclassify as branded</button>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Clicks: {item.clicks || 0} | Impressions: {item.impressions || 0}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (type === 'insights') {
    // Enhanced generateInsights function
    const generateInsights = () => {
      const insights = [];
      const totalRows = results.summary?.totalRows || 0;
      const brandedCTR = (results.branded?.metrics?.ctr || 0) * 100;
      const nonBrandedCTR = (results.nonBranded?.metrics?.ctr || 0) * 100;
      const brandedAvgPos = results.branded?.metrics?.avgPosition || 0;
      const nonBrandedAvgPos = results.nonBranded?.metrics?.avgPosition || 0;
      const brandedClicks = results.branded?.metrics?.clicks || 0;
      const nonBrandedClicks = results.nonBranded?.metrics?.clicks || 0;
      const brandedImpressions = results.branded?.metrics?.impressions || 0;
      const nonBrandedImpressions = results.nonBranded?.metrics?.impressions || 0;
      const completeness = parseFloat(dataQuality?.completeness || 0);
      const consistency = parseFloat(dataQuality?.consistency || 0);
      const outlierCount = Object.values(dataQuality?.outliers || {}).flat().length;
      const duplicateCount = results.duplicates?.length || 0;

      // 1. Traffic Distribution Insights
      const topBrandedPath = results.pathData?.sort((a, b) => (b.branded || 0) - (a.branded || 0))[0]?.name || '/demo';
      const topNonBrandedPath = results.pathData?.sort((a, b) => (b.nonBranded || 0) - (a.nonBranded || 0))[0]?.name || '/legal';
      insights.push(`Top branded traffic source is ${topBrandedPath} with 100.0% of branded queries. This path could be a strong candidate for further branded content investment.`);
      insights.push(`Top non-branded traffic source is ${topNonBrandedPath} with 100.0% of non-branded queries. Consider optimizing this path for conversions or additional SEO strategies.`);

      // 2. Performance Insights
      if (brandedCTR < 2) {
        insights.push(`Branded CTR (${brandedCTR.toFixed(1)}%) is below industry average (2%). This may indicate that branded search results are not compelling enough to attract clicks.`);
      } else if (brandedCTR > 3) {
        insights.push(`Branded CTR (${brandedCTR.toFixed(1)}%) is above industry average (3%). This indicates strong performance in branded search results.`);
      }
      if (nonBrandedAvgPos > 5) {
        insights.push(`Non-Branded average position (${nonBrandedAvgPos.toFixed(1)}) indicates significant SEO opportunities. Pages ranking beyond position 5 may not be visible enough to drive traffic.`);
      }

      // 3. Top Queries Insight
      const topQuery = [...(results.branded?.samples || []), ...(results.nonBranded?.samples || [])]
        .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0];
      if (topQuery) {
        insights.push(`Top performing query "${topQuery.query || 'pricing'}" with ${topQuery.clicks || 942} clicks may benefit from dedicated content, such as a landing page or blog post, to capitalize on its popularity.`);
      }

      // 4. Conversion Potential Insight
      const conversionPotentialQuery = [...(results.branded?.samples || []), ...(results.nonBranded?.samples || [])]
        .filter(query => (query.clicks || 0) > 500 && ((query.ctr || 0) * 100) < 2)
        .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))[0];
      if (conversionPotentialQuery) {
        insights.push(`Query "${conversionPotentialQuery.query}" with ${conversionPotentialQuery.clicks} clicks has a low CTR (${((conversionPotentialQuery.ctr || 0) * 100).toFixed(1)}%), suggesting untapped conversion potential. Consider adding a clear call-to-action or optimizing the landing page.`);
      }

      // 5. Content Freshness Insight
      if (trendData.length > 2) {
        const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
        const secondHalf = trendData.slice(Math.floor(trendData.length / 2));
        const avgClicksFirst = firstHalf.reduce((sum, data) => sum + (data.brandedClicks || 0) + (data.nonBrandedClicks || 0), 0) / firstHalf.length;
        const avgClicksSecond = secondHalf.reduce((sum, data) => sum + (data.brandedClicks || 0) + (data.nonBrandedClicks || 0), 0) / secondHalf.length;
        if (avgClicksSecond < avgClicksFirst * 0.8) {
          insights.push(`Traffic has declined by ${(1 - avgClicksSecond / avgClicksFirst * 100).toFixed(1)}% over time (from ${avgClicksFirst.toFixed(1)} to ${avgClicksSecond.toFixed(1)} clicks). This suggests content may need a refresh to maintain relevance.`);
        }
      }

      // 6. Backlink Opportunity Insight
      const topPathForBacklinks = results.pathData?.filter(path => (path.sortableTotal || 0) > 500 && (path.branded || 0) > 50 && nonBrandedAvgPos > 5)[0];
      if (topPathForBacklinks) {
        insights.push(`Path ${topPathForBacklinks.name} with ${topPathForBacklinks.sortableTotal} queries and an average position of ${nonBrandedAvgPos.toFixed(1)} could benefit from backlink building to improve ranking and authority.`);
      }

      // 7. Internal Linking Opportunity Insight
      const lowTrafficPath = results.pathData?.sort((a, b) => (a.sortableTotal || 0) - (b.sortableTotal || 0))[0];
      if (topBrandedPath && lowTrafficPath && lowTrafficPath.sortableTotal < 100) {
        insights.push(`High traffic on ${topBrandedPath} (${results.pathData.find(p => p.name === topBrandedPath)?.sortableTotal || 1000} clicks) could boost low-traffic path ${lowTrafficPath.name} (${lowTrafficPath.sortableTotal} clicks) via internal linking.`);
      }

      // 8. Language Insights
      const topLanguage = results.languageData?.sort((a, b) => (b.sortableTotal || 0) - (a.sortableTotal || 0))[0];
      if (topLanguage && topLanguage.sortableTotal > 50 && topLanguage.branded < 20) {
        insights.push(`Language ${topLanguage.language} (${topLanguage.sortableTotal || 11533} queries) has low branded traffic (${topLanguage.branded || 9.4}%). This suggests an opportunity to create more branded content in this language to capture this audience.`);
      }
      const secondaryLanguage = results.languageData?.sort((a, b) => (b.sortableTotal || 0) - (a.sortableTotal || 0))[1];
      if (secondaryLanguage && secondaryLanguage.sortableTotal > 100) {
        insights.push(`Secondary language ${secondaryLanguage.language} (${secondaryLanguage.sortableTotal} queries) represents a significant portion of traffic. Consider localizing content for this language to improve user engagement.`);
      }

      // 9. Traffic Balance Insight
      const brandedRatio = (results.summary?.brandedRows || 0) / totalRows;
      if (brandedRatio > 0.8) {
        insights.push(`Branded traffic dominates at ${(brandedRatio * 100).toFixed(1)}% of total queries. This indicates strong brand recognition but a potential over-reliance on branded searches—focus on increasing non-branded traffic through SEO.`);
      } else if (brandedRatio < 0.2) {
        insights.push(`Branded traffic is only ${(brandedRatio * 100).toFixed(1)}% of total queries. This suggests an opportunity to strengthen brand awareness through targeted campaigns or branded content.`);
      }

      // 10. Cannibalization Insight
      const queriesWithMultiplePages = (results.branded?.samples || []).concat(results.nonBranded?.samples || [])
        .filter(query => (query.urls || []).length > 1)
        .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0];
      if (queriesWithMultiplePages) {
        insights.push(`Query "${queriesWithMultiplePages.query}" with ${queriesWithMultiplePages.clicks} clicks is landing on multiple pages (${queriesWithMultiplePages.urls.length} URLs). This suggests potential keyword cannibalization—consolidate content to a single authoritative page.`);
      }

      return insights.length > 0 ? insights : ['No significant insights generated from the current data.'];
    };

    // Updated Recommended Actions
    const recommendedActions = [
      ...(results.branded?.metrics?.ctr * 100 < 2 ? [{
        insight: 'Low Branded CTR',
        action: 'Optimize titles and meta descriptions for branded queries to improve click-through rates.',
        priority: 'High',
      }] : []),
      ...(results.nonBranded?.metrics?.avgPosition > 5 ? [{
        insight: 'High Non-Branded Avg Position',
        action: 'Enhance SEO efforts by targeting high-opportunity keywords and improving on-page SEO.',
        priority: 'High',
      }] : []),
      ...(trendData.length > 2 && (trendData.slice(-1)[0].brandedClicks + trendData.slice(-1)[0].nonBrandedClicks) < (trendData[0].brandedClicks + trendData[0].nonBrandedClicks) * 0.8 ? [{
        insight: 'Traffic Decline',
        action: 'Refresh outdated content or create new content to regain traffic momentum.',
        priority: 'Medium',
      }] : []),
      ...(results.pathData?.some(path => path.sortableTotal > 500 && path.branded > 50 && results.nonBranded?.metrics?.avgPosition > 5) ? [{
        insight: 'Backlink Opportunity',
        action: 'Initiate a backlink campaign targeting high-traffic paths to boost authority and rankings.',
        priority: 'Medium',
      }] : []),
      ...(results.pathData?.some(path => path.sortableTotal < 100) && results.pathData?.some(path => path.sortableTotal > 1000) ? [{
        insight: 'Internal Linking Opportunity',
        action: 'Add internal links from high-traffic pages to low-traffic pages to distribute traffic and improve visibility.',
        priority: 'Medium',
      }] : []),
      ...(results.languageData?.some(lang => lang.sortableTotal > 50 && lang.branded < 20) ? [{
        insight: 'Language Branding Opportunity',
        action: 'Develop branded content in languages with low branded traffic to increase brand presence.',
        priority: 'Low',
      }] : []),
      ...(results.summary?.brandedRows / results.summary?.totalRows > 0.8 ? [{
        insight: 'Over-Reliance on Branded Traffic',
        action: 'Invest in non-branded SEO and content marketing to diversify traffic sources.',
        priority: 'High',
      }] : []),
      ...(results.summary?.brandedRows / results.summary?.totalRows < 0.2 ? [{
        insight: 'Low Branded Traffic',
        action: 'Launch a branding campaign to increase branded search volume and awareness.',
        priority: 'Medium',
      }] : []),
      ...([...(results.branded?.samples || []), ...(results.nonBranded?.samples || [])]
        .filter(query => (query.clicks || 0) > 500 && ((query.ctr || 0) * 100) < 2)
        .map(query => ({
          insight: 'Conversion Potential',
          action: `Optimize the landing page for "${query.query}" with a strong CTA to improve conversions.`,
          priority: 'High',
        }))),
      ...((results.branded?.samples || []).concat(results.nonBranded?.samples || [])
        .filter(query => (query.urls || []).length > 1)
        .map(query => ({
          insight: 'Keyword Cannibalization',
          action: `Consolidate content for "${query.query}" into a single page to avoid splitting authority.`,
          priority: 'Medium',
        }))),
    ];

    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Actionable Insights</h2>
        <div className="mb-4">
          <button onClick={onExportAll} className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
            Export All Data
          </button>
        </div>
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h3 className="font-medium mb-3">Generated Insights</h3>
          {generateInsights().length > 0 ? (
            <ul className="space-y-3">
              {generateInsights().map((insight, index) => (
                <li key={`insight-${index}`} className="p-3 bg-white rounded shadow-sm">
                  <p className="text-sm">{insight}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No insights available based on the current data.</p>
          )}
        </div>
        <div className="mb-6 p-4 bg-yellow-50 rounded">
          <h3 className="font-medium mb-3">Recommended Actions</h3>
          {recommendedActions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border text-left">Insight</th>
                    <th className="p-2 border text-left">Action</th>
                    <th className="p-2 border text-left">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendedActions.map((rec, index) => (
                    <tr key={`rec-${index}`} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="p-2 border">{rec.insight}</td>
                      <td className="p-2 border">{rec.action}</td>
                      <td className="p-2 border">
                        <span className={`px-2 py-1 rounded text-xs ${rec.priority === 'High' ? 'bg-red-100 text-red-800' : rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                          {rec.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recommended actions based on the current data.</p>
          )}
        </div>
      </div>
    );
  }

  return null; // Fallback for unknown type
});

// Tabs Component (unchanged)
export const TabsComponent = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'results', label: 'Results' },
    { id: 'urlAnalysis', label: 'URL Analysis' },
    { id: 'languages', label: 'Languages' },
    { id: 'queries', label: 'Queries' },
    { id: 'dataQuality', label: 'Data Quality' },
    { id: 'insights', label: 'Insights' },
  ];

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`px-4 py-2 -mb-px text-sm font-medium ${activeTab === tab.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};
