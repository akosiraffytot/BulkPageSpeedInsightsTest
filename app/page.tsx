'use client';

import { useState, useEffect, useRef, Fragment } from 'react';

interface UrlItem {
  url: string;
  selected: boolean;
}

type ScanStatus = 'pending' | 'scanning' | 'completed' | 'error';

interface PageSpeedMetrics {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

interface FieldData {
  fcp?: number;
  fid?: number;
  lcp?: number;
  cls?: number;
}

interface AuditIssue {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
}

interface ScanResult {
  url: string;
  status: ScanStatus;
  showIssues?: boolean;
  mobile?: {
    scores: PageSpeedMetrics;
    fieldData: FieldData;
    issues: AuditIssue[];
  };
  desktop?: {
    scores: PageSpeedMetrics;
    fieldData: FieldData;
    issues: AuditIssue[];
  };
  error?: string;
}

export default function Home() {
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [isLoadingUrls, setIsLoadingUrls] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [scannedSitemapUrl, setScannedSitemapUrl] = useState('');
  const [urlInputMode, setUrlInputMode] = useState<'sitemap' | 'manual'>('sitemap');
  const [manualUrlsInput, setManualUrlsInput] = useState('');
  
  // Refs for scrolling
  const urlSelectionRef = useRef<HTMLDivElement>(null);
  const scanResultsRef = useRef<HTMLDivElement>(null);
  
  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [currentScanIndex, setCurrentScanIndex] = useState<number | null>(null);
  const [currentScanDevice, setCurrentScanDevice] = useState<'mobile' | 'desktop' | null>(null);
  const stopScanningRef = useRef(false);

  // Load API key from session storage on mount
  useEffect(() => {
    const savedApiKey = sessionStorage.getItem('psi_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      setIsApiKeySaved(true);
    }

    // Load allowInsecure setting from localStorage
    const savedAllowInsecure = localStorage.getItem('psi_allow_insecure');
    if (savedAllowInsecure === 'true') {
      setAllowInsecure(true);
    }
  }, []);

  // Warn user before closing/reloading during scan
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isScanning) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isScanning]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sitemapUrl || !apiKey) {
      alert('Please fill in all fields');
      return;
    }

    // If there are existing scan results, confirm before rescanning
    if (scanResults.length > 0) {
      const hasCompletedScans = scanResults.some(r => r.status === 'completed');
      const message = hasCompletedScans 
        ? 'You have existing scan results. We recommend exporting them as HTML or JSON before rescanning.\n\nAre you sure you want to rescan the sitemap? This will clear all current results.'
        : 'Are you sure you want to rescan the sitemap? This will clear all current results.';
      
      const confirmed = window.confirm(message);
      if (!confirmed) {
        return;
      }
    }

    setIsLoadingUrls(true);
    setError(null);
    setDebugInfo(null);
    setUrls([]);
    setScanResults([]);
    setCurrentScanIndex(null);

    try {
      // Call the API route to parse the sitemap
      const response = await fetch('/api/parse-sitemap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sitemapUrl, allowInsecure }),
      });

      const data = await response.json();

      console.log('API Response:', data);

      if (!response.ok) {
        setError(data.error || 'Failed to parse sitemap');
        setDebugInfo(data.debug);
        return;
      }

      if (!data.urls || data.urls.length === 0) {
        setError('No URLs found in the sitemap.');
        return;
      }

      // Convert to UrlItem objects with all selected by default
      const urlItems: UrlItem[] = data.urls.map((url: string) => ({
        url,
        selected: true,
      }));

      setUrls(urlItems);
      setScannedSitemapUrl(sitemapUrl);
      console.log(`Extracted ${urlItems.length} URLs from sitemap`);
      
      // Scroll to URL selection section
      setTimeout(() => {
        urlSelectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error('Error parsing sitemap:', err);
      const errorMessage = err instanceof Error 
        ? `Failed to parse sitemap: ${err.message}` 
        : 'Failed to parse sitemap. Please check the URL and try again.';
      setError(errorMessage);
      setDebugInfo({
        clientError: true,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      });
    } finally {
      setIsLoadingUrls(false);
    }
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      sessionStorage.setItem('psi_api_key', apiKey);
      setIsApiKeySaved(true);
    }
  };

  const handleRemoveApiKey = () => {
    sessionStorage.removeItem('psi_api_key');
    setApiKey('');
    setIsApiKeySaved(false);
    setShowApiKey(false);
  };

  const handleReplaceApiKey = () => {
    setIsApiKeySaved(false);
    setShowApiKey(true);
  };

  const toggleAllowInsecure = (checked: boolean) => {
    setAllowInsecure(checked);
    // Save to localStorage for persistence
    localStorage.setItem('psi_allow_insecure', checked.toString());
  };

  const parseManualUrls = (value: string): string[] => {
    return Array.from(
      new Set(
        value
          .split(/[\n,]+/)
          .map((u) => u.trim())
          .filter(Boolean)
      )
    );
  };

  const handleManualUrlsSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      alert('Please provide your Google PageSpeed Insights API key');
      return;
    }

    if (!manualUrlsInput.trim()) {
      alert('Please enter at least one URL');
      return;
    }

    const parsedUrls = parseManualUrls(manualUrlsInput);
    if (parsedUrls.length === 0) {
      alert('No valid URLs found. Please check your input.');
      return;
    }

    // If there are existing scan results, confirm before resetting
    if (scanResults.length > 0) {
      const hasCompletedScans = scanResults.some(r => r.status === 'completed');
      const message = hasCompletedScans
        ? 'You have existing scan results. We recommend exporting them as HTML or JSON before loading a new URL list.\n\nAre you sure you want to continue? This will clear all current results.'
        : 'Are you sure you want to load a new URL list? This will clear all current results.';

      const confirmed = window.confirm(message);
      if (!confirmed) {
        return;
      }
    }

    setError(null);
    setDebugInfo(null);
    setScanResults([]);
    setCurrentScanIndex(null);

    const urlItems: UrlItem[] = parsedUrls.map((url) => ({
      url,
      selected: true,
    }));

    setUrls(urlItems);
    setScannedSitemapUrl('Manual URLs');

    // Automatically start performance scan for manual URLs
    setTimeout(() => {
      // Initialize scan results for manual URLs
      const initialResults: ScanResult[] = urlItems.map(item => ({
        url: item.url,
        status: 'pending' as ScanStatus,
      }));
      setScanResults(initialResults);
      
      startPerformanceScanWithUrls(urlItems);
      // Scroll to scan results section
      setTimeout(() => {
        scanResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }, 100);
  };

  const toggleUrlSelection = (index: number) => {
    setUrls(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const toggleSelectAll = () => {
    const allSelected = urls.every(item => item.selected);
    setUrls(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  const scanUrl = async (url: string, strategy: 'mobile' | 'desktop') => {
    try {
      const response = await fetch('/api/pagespeed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, apiKey, strategy }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan URL');
      }

      return {
        scores: data.scores,
        fieldData: data.fieldData,
        issues: data.issues,
      };
    } catch (error: any) {
      console.error(`Error scanning ${url} (${strategy}):`, error);
      throw error;
    }
  };

  const startPerformanceScan = async () => {
    const selectedUrls = urls.filter(item => item.selected);
    
    if (selectedUrls.length === 0) {
      alert('Please select at least one URL to scan');
      return;
    }

    // Initialize scan results for first time
    const initialResults: ScanResult[] = selectedUrls.map(item => ({
      url: item.url,
      status: 'pending' as ScanStatus,
    }));
    setScanResults(initialResults);

    // Scroll to scan results section
    setTimeout(() => {
      scanResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    await startPerformanceScanWithUrls(selectedUrls);
  };

  const startPerformanceScanWithUrls = async (urlsToScan: UrlItem[]) => {
    setIsScanning(true);
    stopScanningRef.current = false;

    // Scan each URL sequentially
    for (let i = 0; i < urlsToScan.length; i++) {
      if (stopScanningRef.current) {
        console.log('Scan stopped by user');
        break;
      }

      const urlItem = urlsToScan[i];
      
      // Find the index in scanResults for this URL
      const resultIndex = scanResults.findIndex(r => r.url === urlItem.url);
      if (resultIndex === -1) continue;

      setCurrentScanIndex(resultIndex);

      // Update status to scanning
      setScanResults(prev => prev.map((result, idx) =>
        idx === resultIndex ? { ...result, status: 'scanning' } : result
      ));

      try {
        // Scan mobile
        console.log(`Scanning ${urlItem.url} (mobile)...`);
        setCurrentScanDevice('mobile');
        const mobileResult = await scanUrl(urlItem.url, 'mobile');

        // Wait 3 seconds before desktop scan
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (stopScanningRef.current) break;

        // Scan desktop
        console.log(`Scanning ${urlItem.url} (desktop)...`);
        setCurrentScanDevice('desktop');
        const desktopResult = await scanUrl(urlItem.url, 'desktop');

        // Update with completed results
        setScanResults(prev => prev.map((result, idx) =>
          idx === resultIndex ? {
            ...result,
            status: 'completed',
            mobile: mobileResult,
            desktop: desktopResult,
            error: undefined,
          } : result
        ));

        // Wait 3 seconds before next URL (rate limiting)
        if (i < urlsToScan.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error: any) {
        console.error(`Failed to scan ${urlItem.url}:`, error);
        setScanResults(prev => prev.map((result, idx) =>
          idx === resultIndex ? {
            ...result,
            status: 'error',
            error: error.message,
          } : result
        ));
      }
    }

    setIsScanning(false);
    setCurrentScanDevice(null);
    console.log('Scan complete!');
  };

  const stopScan = () => {
    stopScanningRef.current = true;
    setIsScanning(false);
  };

  const rescanErrorUrls = async () => {
    const errorResults = scanResults.filter(r => r.status === 'error');
    
    if (errorResults.length === 0) {
      alert('No failed scans to retry');
      return;
    }

    const confirmed = window.confirm(`Rescan ${errorResults.length} failed URL(s)?`);
    if (!confirmed) return;

    // Convert error results back to UrlItem format
    const urlsToRescan: UrlItem[] = errorResults.map(r => ({
      url: r.url,
      selected: true,
    }));

    // Update status back to pending for error URLs
    setScanResults(prev => prev.map(result => 
      result.status === 'error' ? { ...result, status: 'pending', error: undefined } : result
    ));

    // Scroll to results
    setTimeout(() => {
      scanResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    await startPerformanceScanWithUrls(urlsToRescan);
  };

  const rescanSingleUrl = async (index: number) => {
    const result = scanResults[index];
    
    if (!result) return;

    const confirmed = window.confirm(`Rescan this URL?\n${result.url}`);
    if (!confirmed) return;

    setIsScanning(true);
    stopScanningRef.current = false;
    setCurrentScanIndex(index);

    // Reset the specific result to pending
    setScanResults(prev => prev.map((r, idx) =>
      idx === index ? { url: r.url, status: 'pending' } : r
    ));

    // Scroll to results
    setTimeout(() => {
      scanResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
      // Update status to scanning
      setScanResults(prev => prev.map((r, idx) =>
        idx === index ? { ...r, status: 'scanning' } : r
      ));

      // Scan mobile
      console.log(`Rescanning ${result.url} (mobile)...`);
      setCurrentScanDevice('mobile');
      const mobileResult = await scanUrl(result.url, 'mobile');

      // Wait 3 seconds before desktop scan
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (stopScanningRef.current) {
        setIsScanning(false);
        setCurrentScanDevice(null);
        return;
      }

      // Scan desktop
      console.log(`Rescanning ${result.url} (desktop)...`);
      setCurrentScanDevice('desktop');
      const desktopResult = await scanUrl(result.url, 'desktop');

      // Update with completed results
      setScanResults(prev => prev.map((r, idx) =>
        idx === index ? {
          ...r,
          status: 'completed',
          mobile: mobileResult,
          desktop: desktopResult,
          error: undefined,
        } : r
      ));
    } catch (error: any) {
      console.error(`Failed to rescan ${result.url}:`, error);
      setScanResults(prev => prev.map((r, idx) =>
        idx === index ? {
          ...r,
          status: 'error',
          error: error.message,
        } : r
      ));
    }

    setIsScanning(false);
    setCurrentScanDevice(null);
  };

  const toggleIssues = (index: number) => {
    setScanResults(prev => prev.map((result, i) =>
      i === index ? { ...result, showIssues: !result.showIssues } : result
    ));
  };

  // Export functions
  const exportToJSON = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      sitemapUrl: scannedSitemapUrl,
      totalScanned: scanResults.length,
      completedScans: completedCount,
      failedScans: errorCount,
      results: scanResults.map(result => ({
        url: result.url,
        status: result.status,
        mobile: result.mobile ? {
          scores: result.mobile.scores,
          fieldData: result.mobile.fieldData,
          issues: result.mobile.issues
        } : null,
        desktop: result.desktop ? {
          scores: result.desktop.scores,
          fieldData: result.desktop.fieldData,
          issues: result.desktop.issues
        } : null,
        error: result.error
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagespeed-results-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToHTML = () => {
    const getScoreColor = (score: number) => {
      if (score >= 90) return '#10b981';
      if (score >= 50) return '#f59e0b';
      return '#ef4444';
    };

    const formatFieldData = (value: string | number | undefined) => {
      if (value === undefined || value === 'N/A') return 'N/A';
      return value;
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PageSpeed Insights Report - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; padding: 20px; line-height: 1.6; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header h1 { color: #1f2937; font-size: 32px; margin-bottom: 10px; }
        .header-info { color: #6b7280; font-size: 14px; }
        .summary { background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; }
        .summary-item { padding: 15px; background: #f9fafb; border-radius: 8px; }
        .summary-item h3 { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
        .summary-item p { font-size: 24px; font-weight: bold; color: #1f2937; }
        .result-card { background: white; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .result-url { color: #2563eb; font-size: 16px; font-weight: 600; margin-bottom: 20px; word-break: break-all; }
        .device-section { margin-bottom: 25px; }
        .device-title { font-size: 14px; font-weight: 600; color: #6b7280; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric-card { padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #e5e7eb; }
        .metric-header { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
        .metric-scores { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .score-item { display: flex; align-items: center; gap: 8px; }
        .score-badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 14px; color: white; }
        .field-data-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .field-data-item { text-align: center; padding: 12px; background: #f9fafb; border-radius: 6px; }
        .field-data-label { font-size: 11px; color: #6b7280; margin-bottom: 5px; }
        .field-data-value { font-size: 16px; font-weight: 600; color: #1f2937; }
        .issues-section { margin-top: 20px; }
        .issues-title { font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 10px; }
        .issue-item { padding: 12px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 6px; margin-bottom: 10px; }
        .issue-title { font-weight: 600; color: #92400e; font-size: 13px; margin-bottom: 5px; }
        .issue-desc { font-size: 12px; color: #78350f; line-height: 1.5; }
        .issue-meta { display: flex; gap: 15px; margin-top: 8px; font-size: 11px; color: #92400e; }
        .error-card { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 8px; color: #991b1b; }
        @media print { body { background: white; } .result-card { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 PageSpeed Insights Report</h1>
            <div class="header-info">
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Sitemap:</strong> ${scannedSitemapUrl}</p>
            </div>
        </div>

        <div class="summary">
            <h2 style="color: #1f2937; margin-bottom: 15px;">Summary</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <h3>Total URLs</h3>
                    <p>${scanResults.length}</p>
                </div>
                <div class="summary-item">
                    <h3>Completed</h3>
                    <p style="color: #10b981;">${completedCount}</p>
                </div>
                <div class="summary-item">
                    <h3>Failed</h3>
                    <p style="color: #ef4444;">${errorCount}</p>
                </div>
                <div class="summary-item">
                    <h3>Pending</h3>
                    <p style="color: #6b7280;">${scanResults.filter(r => r.status === 'pending').length}</p>
                </div>
            </div>
        </div>

${scanResults.map(result => `
        <div class="result-card">
            <div class="result-url">🔗 ${result.url}</div>
            
            ${result.status === 'error' ? `
            <div class="error-card">
                <strong>❌ Error:</strong> ${result.error || 'Unknown error occurred'}
            </div>
            ` : ''}
            
            ${result.mobile ? `
            <div class="device-section">
                <div class="device-title">📱 MOBILE</div>
                
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-header">Lighthouse Scores</div>
                        <div class="metric-scores">
                            <div class="score-item">
                                <span style="font-size: 12px; color: #6b7280;">Performance:</span>
                                <span class="score-badge" style="background-color: ${getScoreColor(result.mobile.scores.performance)}">${result.mobile.scores.performance}</span>
                            </div>
                            <div class="score-item">
                                <span style="font-size: 12px; color: #6b7280;">Accessibility:</span>
                                <span class="score-badge" style="background-color: ${getScoreColor(result.mobile.scores.accessibility)}">${result.mobile.scores.accessibility}</span>
                            </div>
                            <div class="score-item">
                                <span style="font-size: 12px; color: #6b7280;">Best Practices:</span>
                                <span class="score-badge" style="background-color: ${getScoreColor(result.mobile.scores.bestPractices)}">${result.mobile.scores.bestPractices}</span>
                            </div>
                            <div class="score-item">
                                <span style="font-size: 12px; color: #6b7280;">SEO:</span>
                                <span class="score-badge" style="background-color: ${getScoreColor(result.mobile.scores.seo)}">${result.mobile.scores.seo}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-header">Core Web Vitals</div>
                        <div class="field-data-grid">
                            <div class="field-data-item">
                                <div class="field-data-label">FCP</div>
                                <div class="field-data-value">${formatFieldData(result.mobile.fieldData.fcp)}</div>
                            </div>
                            <div class="field-data-item">
                                <div class="field-data-label">LCP</div>
                                <div class="field-data-value">${formatFieldData(result.mobile.fieldData.lcp)}</div>
                            </div>
                            <div class="field-data-item">
                                <div class="field-data-label">CLS</div>
                                <div class="field-data-value">${formatFieldData(result.mobile.fieldData.cls)}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${result.mobile.issues.length > 0 ? `
                <div class="issues-section">
                    <div class="issues-title">⚠️ Issues Found (${result.mobile.issues.length})</div>
                    ${result.mobile.issues.map(issue => `
                    <div class="issue-item">
                        <div class="issue-title">${issue.title}</div>
                        <div class="issue-desc">${issue.description}</div>
                        <div class="issue-meta">
                            ${issue.displayValue ? `<span><strong>Value:</strong> ${issue.displayValue}</span>` : ''}
                            ${issue.score !== null ? `<span><strong>Score:</strong> ${Math.round(issue.score * 100)}</span>` : ''}
                        </div>
                    </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            ${result.desktop ? `
            <div class="device-section">
                <div class="device-title">💻 DESKTOP</div>
                
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-header">Lighthouse Scores</div>
                        <div class="metric-scores">
                            <div class="score-item">
                                <span style="font-size: 12px; color: #6b7280;">Performance:</span>
                                <span class="score-badge" style="background-color: ${getScoreColor(result.desktop.scores.performance)}">${result.desktop.scores.performance}</span>
                            </div>
                            <div class="score-item">
                                <span style="font-size: 12px; color: #6b7280;">Accessibility:</span>
                                <span class="score-badge" style="background-color: ${getScoreColor(result.desktop.scores.accessibility)}">${result.desktop.scores.accessibility}</span>
                            </div>
                            <div class="score-item">
                                <span style="font-size: 12px; color: #6b7280;">Best Practices:</span>
                                <span class="score-badge" style="background-color: ${getScoreColor(result.desktop.scores.bestPractices)}">${result.desktop.scores.bestPractices}</span>
                            </div>
                            <div class="score-item">
                                <span style="font-size: 12px; color: #6b7280;">SEO:</span>
                                <span class="score-badge" style="background-color: ${getScoreColor(result.desktop.scores.seo)}">${result.desktop.scores.seo}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-header">Core Web Vitals</div>
                        <div class="field-data-grid">
                            <div class="field-data-item">
                                <div class="field-data-label">FCP</div>
                                <div class="field-data-value">${formatFieldData(result.desktop.fieldData.fcp)}</div>
                            </div>
                            <div class="field-data-item">
                                <div class="field-data-label">LCP</div>
                                <div class="field-data-value">${formatFieldData(result.desktop.fieldData.lcp)}</div>
                            </div>
                            <div class="field-data-item">
                                <div class="field-data-label">CLS</div>
                                <div class="field-data-value">${formatFieldData(result.desktop.fieldData.cls)}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${result.desktop.issues.length > 0 ? `
                <div class="issues-section">
                    <div class="issues-title">⚠️ Issues Found (${result.desktop.issues.length})</div>
                    ${result.desktop.issues.map(issue => `
                    <div class="issue-item">
                        <div class="issue-title">${issue.title}</div>
                        <div class="issue-desc">${issue.description}</div>
                        <div class="issue-meta">
                            ${issue.displayValue ? `<span><strong>Value:</strong> ${issue.displayValue}</span>` : ''}
                            ${issue.score !== null ? `<span><strong>Score:</strong> ${Math.round(issue.score * 100)}</span>` : ''}
                        </div>
                    </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>
`).join('')}
    </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagespeed-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 50) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const formatMetric = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    if (value < 1) return value.toFixed(3);
    if (value < 1000) return `${Math.round(value)}ms`;
    return `${(value / 1000).toFixed(2)}s`;
  };

  const selectedCount = urls.filter(item => item.selected).length;
  const isFormValid =
    apiKey.trim() !== '' &&
    (urlInputMode === 'sitemap'
      ? sitemapUrl.trim() !== ''
      : manualUrlsInput.trim() !== '');
  const isSitemapChanged = scannedSitemapUrl !== sitemapUrl;
  const completedCount = scanResults.filter(r => r.status === 'completed').length;
  const errorCount = scanResults.filter(r => r.status === 'error').length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <main className="w-full max-w-7xl flex-grow">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
              PageSpeed Insights Scanner
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Analyze your website's performance via sitemap or manual URL lists
            </p>
          </div>

          {/* Tabs for input mode */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-4" aria-label="URL input mode">
              <button
                type="button"
                onClick={() => setUrlInputMode('sitemap')}
                className={`pb-2 text-sm font-medium border-b-2 ${
                  urlInputMode === 'sitemap'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
                disabled={isScanning || isLoadingUrls}
              >
                From Sitemap
              </button>
              <button
                type="button"
                onClick={() => setUrlInputMode('manual')}
                className={`pb-2 text-sm font-medium border-b-2 ${
                  urlInputMode === 'manual'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
                disabled={isScanning || isLoadingUrls}
              >
                Manual URLs
              </button>
            </nav>
          </div>

          {/* Form */}
          <form
            onSubmit={urlInputMode === 'sitemap' ? handleScan : handleManualUrlsSubmit}
            className="space-y-6"
          >
            {urlInputMode === 'sitemap' ? (
              /* Sitemap URL Field */
              <div>
                <label 
                  htmlFor="sitemap-url" 
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2"
                >
                  Sitemap URL
                </label>
                <input
                  id="sitemap-url"
                  type="url"
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  placeholder="https://example.com/sitemap.xml"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                  required={urlInputMode === 'sitemap'}
                  disabled={isScanning}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter the full URL to your XML sitemap
                </p>
                
                {/* Allow Insecure HTTPS Checkbox */}
                <label className="mt-3 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowInsecure}
                    onChange={(e) => toggleAllowInsecure(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    disabled={isScanning}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Allow insecure HTTPS connections (self-signed/expired certificates)
                  </span>
                </label>
              </div>
            ) : (
              /* Manual URLs Field */
              <div>
                <label
                  htmlFor="manual-urls"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2"
                >
                  URL List
                </label>
                <textarea
                  id="manual-urls"
                  value={manualUrlsInput}
                  onChange={(e) => setManualUrlsInput(e.target.value)}
                  placeholder="https://example.com/&#10;https://example.com/about&#10;&#10;Or: https://example.com/, https://example.com/about"
                  className="w-full min-h-[140px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all text-sm font-mono"
                  disabled={isScanning}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter one URL per line or separate multiple URLs with commas.
                </p>
              </div>
            )}

            {/* API Key Field - [KEEPING EXISTING CODE] */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label 
                  htmlFor="api-key" 
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-200"
                >
                  Google PageSpeed Insights API Key
                </label>
                {isApiKeySaved && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Saved
                  </span>
                )}
              </div>
              
              {isApiKeySaved && !showApiKey ? (
                <div className="space-y-2">
                  <div className="w-full px-4 py-3 border border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg font-mono text-sm text-gray-700 dark:text-gray-300">
                    API Key: ••••••••••••••••{apiKey.slice(-6)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleReplaceApiKey}
                      className="flex-1 px-3 py-2 text-sm border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                      disabled={isScanning}
                    >
                      Replace Key
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveApiKey}
                      className="flex-1 px-3 py-2 text-sm border border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      disabled={isScanning}
                    >
                      Remove Key
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    id="api-key"
                    type="text"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (isApiKeySaved) setIsApiKeySaved(false);
                    }}
                    placeholder="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all font-mono text-sm"
                    required
                    disabled={isScanning}
                  />
                  {apiKey && !isApiKeySaved && (
                    <button
                      type="button"
                      onClick={handleSaveApiKey}
                      className="mt-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
                    >
                      💾 Save API Key for this session
                    </button>
                  )}
                </>
              )}
              
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from{' '}
                <a 
                  href="https://developers.google.com/speed/docs/insights/v5/get-started" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Google Cloud Console
                </a>
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoadingUrls || !isFormValid || isScanning}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            >
              {isLoadingUrls && urlInputMode === 'sitemap' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning Sitemap...
                </span>
              ) : urlInputMode === 'sitemap' ? (
                urls.length > 0 && !isSitemapChanged ? 'Rescan Sitemap' : 'Start Scanning Sitemap'
              ) : (
                'Start Performance Scan'
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-6 space-y-3">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Error:</p>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
              
              {/* Debug Information */}
              {debugInfo && (
                <details className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <summary className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                    🔍 Show Debug Information
                  </summary>
                  <pre className="mt-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs overflow-x-auto">
                    <code className="text-gray-800 dark:text-gray-200">{JSON.stringify(debugInfo, null, 2)}</code>
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
              How it works:
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
              <li>Choose whether to load URLs from a sitemap or enter them manually</li>
              <li>Provide your PageSpeed Insights API key</li>
              <li>Select which URLs to scan</li>
              <li>Each URL will be analyzed for performance metrics</li>
            </ul>
          </div>
        </div>

        {/* URL Selection Section */}
        {urls.length > 0 && scanResults.length === 0 && urlInputMode === 'sitemap' && (
          <div ref={urlSelectionRef} className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Select URLs to Scan
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCount} of {urls.length} selected
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                >
                  {urls.every(item => item.selected) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {urls.map((item, index) => (
                  <label
                    key={index}
                    className="flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleUrlSelection(index)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    />
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 break-all">
                      {item.url}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Start Performance Scan Button */}
            <button
              type="button"
              onClick={startPerformanceScan}
              disabled={selectedCount === 0}
              className="mt-6 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            >
              Start Performance Scan ({selectedCount} URLs)
            </button>
          </div>
        )}

        {/* Scan Results Section */}
        {scanResults.length > 0 && (
          <div ref={scanResultsRef} className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            {/* Warning Notice */}
            {isScanning && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      ⚠️ Scan in Progress
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Please do not close or reload this page while the scan is running. The scan will be interrupted and you'll lose your progress.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Scan Results
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {completedCount} completed • {errorCount} errors • {scanResults.length - completedCount - errorCount} remaining
                </p>
              </div>
              <div className="flex gap-3">
                {/* Export Buttons */}
                {!isScanning && scanResults.some(r => r.status === 'completed') && (
                  <>
                    <button
                      onClick={exportToJSON}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium shadow-md"
                      title="Export results as JSON"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export JSON
                    </button>
                    <button
                      onClick={exportToHTML}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium shadow-md"
                      title="Export results as HTML report"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export HTML
                    </button>
                  </>
                )}
                {/* Rescan Errors Button */}
                {!isScanning && scanResults.some(r => r.status === 'error') && (
                  <button
                    onClick={rescanErrorUrls}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium shadow-md"
                    title="Rescan all failed URLs"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Rescan Errors ({errorCount})
                  </button>
                )}
                {isScanning && (
                  <button
                    onClick={stopScan}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all"
                  >
                    ⏹ Stop Scan
                  </button>
                )}
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">URL</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">Device</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">Perf</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">A11y</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">BP</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">SEO</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">FCP</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">LCP</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">CLS</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {scanResults.map((result, idx) => (
                    <Fragment key={result.url}>
                      {/* Mobile Row */}
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-md truncate" rowSpan={2} title={result.url}>
                          {result.url}
                        </td>
                        <td className="px-4 py-3 text-center" rowSpan={2}>
                          {result.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              ⏸ Pending
                            </span>
                          )}
                          {result.status === 'scanning' && idx === currentScanIndex && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Scanning
                            </span>
                          )}
                          {result.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                              ✓ Done
                            </span>
                          )}
                          {result.status === 'error' && (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400" title={result.error}>
                                ✗ Error
                              </span>
                              {!isScanning && (
                                <button
                                  onClick={() => rescanSingleUrl(idx)}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                  title="Retry this URL"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Retry
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                          <span className="flex items-center justify-center gap-1">
                            📱 Mobile
                            {result.status === 'scanning' && idx === currentScanIndex && currentScanDevice === 'mobile' && (
                              <span className="text-blue-600 dark:text-blue-400 animate-pulse">◀</span>
                            )}
                          </span>
                        </td>
                        {result.mobile ? (
                          <>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(result.mobile.scores.performance)} ${getScoreColor(result.mobile.scores.performance)}`}>
                                {result.mobile.scores.performance}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(result.mobile.scores.accessibility)} ${getScoreColor(result.mobile.scores.accessibility)}`}>
                                {result.mobile.scores.accessibility}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(result.mobile.scores.bestPractices)} ${getScoreColor(result.mobile.scores.bestPractices)}`}>
                                {result.mobile.scores.bestPractices}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(result.mobile.scores.seo)} ${getScoreColor(result.mobile.scores.seo)}`}>
                                {result.mobile.scores.seo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-700 dark:text-gray-300">
                              {formatMetric(result.mobile.fieldData.fcp)}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-700 dark:text-gray-300">
                              {formatMetric(result.mobile.fieldData.lcp)}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-700 dark:text-gray-300">
                              {formatMetric(result.mobile.fieldData.cls)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => toggleIssues(idx)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                {result.mobile.issues.length} {result.showIssues ? '▼' : '▶'}
                              </button>
                            </td>
                          </>
                        ) : (
                          <td colSpan={8} className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                            -
                          </td>
                        )}
                      </tr>
                      {/* Desktop Row */}
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b-2 border-gray-300 dark:border-gray-600">
                        <td className="px-4 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                          <span className="flex items-center justify-center gap-1">
                            💻 Desktop
                            {result.status === 'scanning' && idx === currentScanIndex && currentScanDevice === 'desktop' && (
                              <span className="text-blue-600 dark:text-blue-400 animate-pulse">◀</span>
                            )}
                          </span>
                        </td>
                        {result.desktop ? (
                          <>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(result.desktop.scores.performance)} ${getScoreColor(result.desktop.scores.performance)}`}>
                                {result.desktop.scores.performance}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(result.desktop.scores.accessibility)} ${getScoreColor(result.desktop.scores.accessibility)}`}>
                                {result.desktop.scores.accessibility}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(result.desktop.scores.bestPractices)} ${getScoreColor(result.desktop.scores.bestPractices)}`}>
                                {result.desktop.scores.bestPractices}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(result.desktop.scores.seo)} ${getScoreColor(result.desktop.scores.seo)}`}>
                                {result.desktop.scores.seo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-700 dark:text-gray-300">
                              {formatMetric(result.desktop.fieldData.fcp)}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-700 dark:text-gray-300">
                              {formatMetric(result.desktop.fieldData.lcp)}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-700 dark:text-gray-300">
                              {formatMetric(result.desktop.fieldData.cls)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => toggleIssues(idx)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                {result.desktop.issues.length} {result.showIssues ? '▼' : '▶'}
                              </button>
                            </td>
                          </>
                        ) : (
                          <td colSpan={8} className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                            -
                          </td>
                        )}
                      </tr>
                      
                      {/* Issues Detail Row */}
                      {result.showIssues && (result.mobile || result.desktop) && (
                        <tr className="bg-gray-50 dark:bg-gray-900/50">
                          <td colSpan={11} className="px-4 py-4">
                            <div className="space-y-4">
                              {/* Mobile Issues */}
                              {result.mobile && result.mobile.issues.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    📱 Mobile Issues ({result.mobile.issues.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {result.mobile.issues.map((issue, issueIdx) => (
                                      <div key={`${idx}-mobile-${issueIdx}`} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                              {issue.title}
                                            </p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                              {issue.description}
                                            </p>
                                            {issue.displayValue && (
                                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono">
                                                {issue.displayValue}
                                              </p>
                                            )}
                                          </div>
                                          {issue.score !== null && (
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(issue.score * 100)} ${getScoreColor(issue.score * 100)}`}>
                                              {Math.round(issue.score * 100)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Desktop Issues */}
                              {result.desktop && result.desktop.issues.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    💻 Desktop Issues ({result.desktop.issues.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {result.desktop.issues.map((issue, issueIdx) => (
                                      <div key={`${idx}-desktop-${issueIdx}`} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                              {issue.title}
                                            </p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                              {issue.description}
                                            </p>
                                            {issue.displayValue && (
                                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono">
                                                {issue.displayValue}
                                              </p>
                                            )}
                                          </div>
                                          {issue.score !== null && (
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${getScoreBgColor(issue.score * 100)} ${getScoreColor(issue.score * 100)}`}>
                                              {Math.round(issue.score * 100)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl py-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>
          Built using{' '}
          <a
            href="https://qoder.com/referral?referral_code=1h8QowRIQ5YLknq8XJslQPkJtNEBi24v"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Qoder
          </a>
          {' '}with ❤️ by{' '}
          <a
            href="https://akosiraffytot.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            akosiraffytot
          </a>
        </p>
      </footer>
    </div>
  );
}
