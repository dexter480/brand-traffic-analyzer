import Papa from 'papaparse';

const inferContentTypeCache = new Map();
export const inferContentType = (url) => {
  if (!url) return 'Unknown';
  if (inferContentTypeCache.has(url)) return inferContentTypeCache.get(url);
  const normalizedUrl = url.toLowerCase();
  const contentTypes = [
    { patterns: ['/blog', '/article', '/news'], type: 'Blog' },
    { patterns: ['/product', '/pricing', '/shop'], type: 'Product' },
    { patterns: ['/support', '/help', '/faq'], type: 'Support' },
    { patterns: ['/about', '/company', '/team'], type: 'About' },
    { patterns: ['/login', '/signin', '/account'], type: 'Auth' },
    { patterns: ['/', ''], type: 'Homepage' }
  ];
  const matchedType = contentTypes.find(ct => 
    ct.patterns.some(pattern => normalizedUrl.includes(pattern))
  )?.type || 'Other';
  inferContentTypeCache.set(url, matchedType);
  return matchedType;
};

export const processCsvData = (fileOrData, config) => {
  return new Promise((resolve) => {
    if (fileOrData instanceof File) {
      const reader = new FileReader();
      reader.onload = (event) => {
        Papa.parse(event.target.result, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const processedData = processCsvResults(results.data, config);
            resolve(processedData);
          },
          error: (err) => {
            throw new Error(`Error parsing CSV: ${err.message}`);
          },
        });
      };
      reader.readAsText(fileOrData);
    } else if (Array.isArray(fileOrData)) {
      const processedData = processCsvResults(fileOrData, config);
      resolve(processedData);
    } else {
      throw new Error('Invalid input: Expected File or Array');
    }
  });
};

export const analyzeDataQuality = (data) => {
  const totalRows = data.length;
  const missingValues = {};
  const outliers = {};
  const warnings = [];

  ['query', 'page', 'clicks', 'impressions', 'ctr', 'position'].forEach((field) => {
    missingValues[field] = data.filter((row) => !row[field] && row[field] !== 0).length;
  });

  const clicks = data.map((row) => row.clicks || 0).filter((v) => !isNaN(v));
  const impressions = data.map((row) => row.impressions || 0).filter((v) => !isNaN(v));
  if (clicks.length) {
    const meanClicks = clicks.reduce((a, b) => a + b, 0) / clicks.length;
    const stdClicks = Math.sqrt(clicks.reduce((a, b) => a + Math.pow(b - meanClicks, 2), 0) / clicks.length);
    outliers.clicks = data
      .filter((row) => row.clicks > meanClicks + 3 * stdClicks || row.clicks < meanClicks - 3 * stdClicks)
      .map((row) => ({ query: row.query, clicks: row.clicks, avgClicks: meanClicks }));
  }
  if (impressions.length) {
    const meanImpressions = impressions.reduce((a, b) => a + b, 0) / impressions.length;
    const stdImpressions = Math.sqrt(impressions.reduce((a, b) => a + Math.pow(b - meanImpressions, 2), 0) / impressions.length);
    outliers.impressions = data
      .filter((row) => row.impressions > meanImpressions + 3 * stdImpressions || row.impressions < meanImpressions - 3 * stdImpressions)
      .map((row) => ({ query: row.query, impressions: row.impressions, avgImpressions: meanImpressions }));
  }

  const completeness = totalRows > 0 ? (1 - (Object.values(missingValues).reduce((a, b) => a + b, 0) / (totalRows * Object.keys(missingValues).length))) * 100 : 0;
  if (Object.values(missingValues).some((v) => v > 0)) {
    warnings.push({
      type: 'MissingData',
      message: 'Missing values detected in dataset',
      severity: 'medium',
      count: Object.values(missingValues).reduce((a, b) => a + b, 0),
      action: 'View affected rows',
      details: missingValues,
    });
  }
  if (Object.values(outliers).some((arr) => arr.length > 0)) {
    warnings.push({
      type: 'Outliers',
      message: 'Statistical outliers detected in metrics',
      severity: 'low',
      count: Object.values(outliers).reduce((a, b) => a + b.length, 0),
      action: 'Review outliers',
      details: outliers,
    });
  }

  return {
    healthScore: Math.max(0, Math.min(95, completeness)),
    missingValues,
    outliers,
    warnings,
    confidenceScores: { brandedClicks: 100, nonBrandedClicks: 100 },
  };
};

const detectLanguageOrPath = (pathname, languageCodes) => {
  const segments = pathname.split('/').filter(Boolean);
  let lang = 'unknown';
  let pathSegments = [];
  segments.forEach((seg) => {
    if (languageCodes.has(seg.toLowerCase()) && lang === 'unknown') lang = seg;
    else pathSegments.push(seg);
  });
  const path = pathSegments.length ? '/' + pathSegments.join('/') : '/homepage';
  const primaryPath = pathSegments.length ? '/' + pathSegments[0] : '/homepage';
  return { lang, path, primaryPath };
};

const processCsvResults = (data, config) => {
  const { brandTerms, useCustomRegex, customRegex, caseSensitive, detectLanguageCodes } = config;

  const normalizedData = data.map((row) => {
    const normalizedRow = {};
    Object.keys(row).forEach((key) => {
      normalizedRow[key.toLowerCase()] = row[key];
    });
    return normalizedRow;
  });

  const isBranded = (query) => {
    if (!query) return false;
    const terms = brandTerms.toLowerCase().split(',').map((term) => term.trim());
    const queryLower = caseSensitive ? query : query.toLowerCase();
    if (useCustomRegex && customRegex) {
      try {
        const regex = new RegExp(customRegex, caseSensitive ? '' : 'i');
        
        // Use a "maximum steps" approach for ReDoS protection
        const maxSteps = 1000;
        let steps = 0;
        const safeRegexTest = (regexPattern, str) => {
          // Ensure regexPattern is a RegExp object if it's passed as a string
          const currentRegex = (typeof regexPattern === 'string') 
            ? new RegExp(regexPattern, caseSensitive ? '' : 'i') 
            : regexPattern;

          const chunkSize = 100;
          for (let i = 0; i < str.length; i += chunkSize) {
            const chunk = str.substring(i, Math.min(i + chunkSize, str.length)); // Use substring and Math.min for safety
            currentRegex.test(chunk); // Test on chunk, primarily to increment steps
            steps++;
            if (steps > maxSteps) {
              console.warn('Regex execution stopped: Exceeded maximum steps.');
              throw new Error('Regex timeout - pattern potentially too complex or string too long against pattern');
            }
          }
          // Final test on the whole string, only if steps not exceeded
          return currentRegex.test(str);
        };
        
        return safeRegexTest(regex, query);
      } catch (e) {
        console.error('Regex error or timeout:', e.message);
        return false; // Treat regex errors (including timeout) as not branded for safety
      }
    }
    // Fallback to simple term checking if not using custom regex or if customRegex is empty
    return terms.some((term) => term && queryLower.includes(term)); // ensure term is not empty
  };

  const languageCodes = new Set([
    'en', 'es', 'es-es', 'de', 'fr', 'pt', 'ru', 'it', 'pl', 'zh', 'zh-hant', 'zh-hans', 'ja', 'uk', 'id', 'lv',
    'ar', 'bg', 'ca', 'cs', 'da', 'el', 'fi', 'he', 'hi', 'hr', 'hu', 'ko', 'lt', 'nl', 'no', 'ro', 'sk', 'sl', 'sr', 'sv', 'th', 'tr', 'vi'
  ]);

  const acc = {
    branded: { samples: [], metrics: { clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 } },
    nonBranded: { samples: [], metrics: { clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 } },
    summary: { totalRows: 0, brandedRows: 0, nonBrandedRows: 0, brandedPercentage: 0, nonBrandedPercentage: 0 },
    pathData: {},
    languageData: {},
    pathUrlExamples: {},
    pathUrlCounts: {},
    borderline: { samples: [] },
    duplicates: [],
    sampleRows: normalizedData.slice(0, 50),
  };

  normalizedData.forEach((row, index) => {
    if (!row.query || !row.page) {
      console.warn(`Skipping row ${index}: Missing Query or Page`, row);
      return;
    }

    acc.summary.totalRows++;
    const isBrand = isBranded(row.query);
    const category = isBrand ? 'branded' : 'nonBranded';
    const target = isBrand ? acc.branded : acc.nonBranded;

    const clicks = Number(row.clicks) || 0;
    const impressions = Number(String(row.impressions || '0').replace(/,/g, '')) || 0;
    const ctr = Number(String(row.ctr || '0').replace('%', '')) / 100 || 0;
    const position = Number(row.position) || 0;

    target.metrics.clicks += clicks;
    target.metrics.impressions += impressions;
    target.metrics.avgPosition = (target.metrics.avgPosition * (acc.summary.totalRows - 1) + position) / acc.summary.totalRows;
    if (target.samples.length < 10) {
      target.samples.push({ query: row.query, clicks, impressions, ctr, avgPosition: position, contentTypes: [inferContentType(row.page)], urls: [{ url: row.page, contentType: inferContentType(row.page), language: detectLanguageCodes ? 'en' : null }] });
    }
    if (isBrand) acc.summary.brandedRows++;
    else acc.summary.nonBrandedRows++;

    let path = '/homepage', primaryPath = '/homepage', lang = 'unknown';
    try {
      const url = new URL(row.page.startsWith('http') ? row.page : `https://${row.page}`);
      const { lang: detectedLang, path: detectedPath, primaryPath: detectedPrimaryPath } = detectLanguageOrPath(url.pathname, languageCodes);
      lang = detectLanguageCodes ? detectedLang : 'unknown';
      path = detectedPath;
      primaryPath = detectedPrimaryPath;
    } catch (e) {
      console.warn(`Invalid URL in row ${index}: ${row.page}`, e);
      path = primaryPath = '/invalid';
    }

    acc.pathData[primaryPath] = acc.pathData[primaryPath] || { total: 0, branded: 0, nonBranded: 0, sortableTotal: 0 };
    acc.pathData[primaryPath].total++;
    acc.pathData[primaryPath][category]++;
    acc.pathData[primaryPath].sortableTotal = acc.pathData[primaryPath].total;
    acc.pathUrlCounts[primaryPath] = (acc.pathUrlCounts[primaryPath] || 0) + 1;
    acc.pathUrlExamples[primaryPath] = (acc.pathUrlExamples[primaryPath] || []).concat([row.page]).slice(0, 10);

    if (detectLanguageCodes) {
      acc.languageData[lang] = acc.languageData[lang] || { language: lang.charAt(0).toUpperCase() + lang.slice(1), code: lang, total: 0, clicks: 0, branded: 0, nonBranded: 0, sortableTotal: 0 };
      acc.languageData[lang].total++;
      acc.languageData[lang].clicks += clicks;
      acc.languageData[lang][category]++;
      acc.languageData[lang].sortableTotal = acc.languageData[lang].total;
    }

    const duplicate = normalizedData.find((r, i) => i < index && r.query === row.query && r.page === row.page);
    if (duplicate) acc.duplicates.push({ ...row, originalIndex: normalizedData.indexOf(duplicate) });
  });

  acc.summary.brandedPercentage = acc.summary.totalRows ? (acc.summary.brandedRows / acc.summary.totalRows) * 100 : 0;
  acc.summary.nonBrandedPercentage = acc.summary.totalRows ? (acc.summary.nonBrandedRows / acc.summary.totalRows) * 100 : 0;
  acc.branded.metrics.ctr = acc.branded.metrics.impressions > 0 ? acc.branded.metrics.clicks / acc.branded.metrics.impressions : 0;
  acc.nonBranded.metrics.ctr = acc.nonBranded.metrics.impressions > 0 ? acc.nonBranded.metrics.clicks / acc.nonBranded.metrics.impressions : 0;

  const result = {
    data: normalizedData,
    branded: acc.branded,
    nonBranded: acc.nonBranded,
    summary: acc.summary,
    pathData: Object.entries(acc.pathData).map(([name, stats]) => ({
      name,
      total: stats.total,
      branded: stats.total ? (stats.branded / stats.total) * 100 : 0,
      nonBranded: stats.total ? (stats.nonBranded / stats.total) * 100 : 0,
      sortableTotal: stats.sortableTotal,
    })),
    languageData: Object.values(acc.languageData).map((item) => ({
      ...item,
      branded: item.total ? (item.branded / item.total) * 100 : 0,
      nonBranded: item.total ? (item.nonBranded / item.total) * 100 : 0,
      sortableTotal: item.sortableTotal,
    })),
    pathUrlExamples: acc.pathUrlExamples,
    pathUrlCounts: acc.pathUrlCounts,
    borderline: acc.borderline,
    duplicates: acc.duplicates,
    sampleRows: acc.sampleRows,
  };

  return result;
};

export const filterFN = (data, threshold = 0) => data.filter((item) => item.value > threshold);
export const samplePathData = [
  { name: '/blog', total: 1000, branded: 20, nonBranded: 80, sortableTotal: 1000 },
  { name: '/product', total: 800, branded: 70, nonBranded: 30, sortableTotal: 800 },
];
export const sampleLanguageData = [
  { language: 'English', code: 'en', total: 500, clicks: 2000, branded: 60, nonBranded: 40, sortableTotal: 500 },
];
export const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF7300'];

export const sanitize = (content) => {
  if (typeof content === undefined || content === null) return '';
  if (typeof content !== 'string') return String(content);
  return String(content)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const sanitizeCSVCell = (content) => {
  if (typeof content !== 'string') return content;
  // Prevent CSV formula injection attacks
  if (content.startsWith('=') || content.startsWith('+') || 
      content.startsWith('-') || content.startsWith('@')) {
    return `\'${content}`; // Prefix with apostrophe
  }
  return content;
};

export const validateCSVContent = (data) => {
  // Check for suspicious content
  const suspiciousPatterns = [
    /<script/i, /<iframe/i, /javascript:/i, /data:/i, /vbscript:/i
  ];
  
  for (const row of data) {
    for (const key in row) {
      // Ensure row.hasOwnProperty(key) if iterating over object properties directly from an unknown source is a concern,
      // though PapaParse results are usually structured arrays of objects.
      const value = String(row[key] || '');
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          return {
            valid: false,
            message: `Suspicious content detected in CSV file (e.g., in row with data like: ${String(row[key]).substring(0,50)}...).`
          };
        }
      }
    }
  }
  
  return { valid: true };
};