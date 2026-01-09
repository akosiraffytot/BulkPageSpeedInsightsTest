# PageSpeed Insights Scanner 🚀

A powerful web application built with Next.js that analyzes website performance using Google PageSpeed Insights API. Scan multiple URLs from your sitemap and get comprehensive performance metrics for both mobile and desktop devices.

![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)

## ✨ Features

### 🔗 Flexible URL Input
- **Sitemap Mode**: Parse XML sitemaps to extract all page URLs
- **Manual Mode**: Enter URLs directly via textarea (comma or newline-separated)
- Tabbed interface for easy switching between input modes
- Auto-validation and deduplication of URLs

### 🔍 Sitemap Scanning
- Parse XML sitemaps to extract all page URLs
- Support for insecure HTTPS connections (self-signed/expired certificates)
- Automatic URL extraction with selection interface
- Select/deselect individual URLs or use select all/deselect all

### 📊 Performance Analysis
- **Lighthouse Scores**: Performance, Accessibility, Best Practices, SEO
- **Core Web Vitals**: FCP (First Contentful Paint), LCP (Largest Contentful Paint), CLS (Cumulative Layout Shift)
- **Dual Device Analysis**: Separate metrics for Mobile 📱 and Desktop 💻
- **Issue Detection**: Detailed audit issues with descriptions and scores
- **Collapsible Issue Details**: Click on issue counts to view detailed information

### 🎯 Smart Scanning
- Sequential URL scanning with 3-second rate limiting
- Real-time status indicators (Pending, Scanning, Completed, Error)
- Stop scan functionality with confirmation
- Progress tracking with completed/failed/remaining counts
- Browser reload protection during active scans

### 🔄 Error Recovery
- **Global Rescan**: "Rescan Errors" button to retry all failed URLs at once
- **Individual Retry**: Retry button next to each error status for granular control
- Preserves successful scan results during error rescans
- Smart result merging - only updates rescanned URLs

### 💾 Export Capabilities
- **JSON Export**: Structured data for programmatic analysis
- **HTML Export**: Beautiful, print-ready reports with embedded styling
- Export buttons appear only when scanning is complete

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm, yarn, pnpm, or bun
- Google PageSpeed Insights API key ([Get one here](https://developers.google.com/speed/docs/insights/v5/get-started))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/akosiraffytot/BulkPageSpeedInsightsTest.git
cd BulkPageSpeedInsightsTest
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📖 Usage

### Method 1: From Sitemap

1. **Enter Sitemap URL**: Provide the URL to your XML sitemap
2. **Add API Key**: Enter your Google PageSpeed Insights API key
3. **Optional**: Check "Allow insecure HTTPS connections" if your sitemap uses self-signed certificates
4. **Scan Sitemap**: Click to extract all URLs from the sitemap
5. **Select URLs**: Choose which URLs you want to analyze
6. **Start Performance Scan**: Begin the analysis (scans run sequentially with 3-second delays)
7. **View Results**: See real-time results with scores, metrics, and issues
8. **Export**: Download results as JSON or HTML when scanning completes

### Method 2: Manual URLs

1. **Switch to Manual URLs Tab**: Click the "Manual URLs" tab
2. **Add API Key**: Enter your Google PageSpeed Insights API key
3. **Enter URLs**: Add URLs in the textarea (one per line or comma-separated)
4. **Start Performance Scan**: Click to begin - scanning starts immediately (no URL selection step)
5. **View Results**: See real-time results with device scanning indicators
6. **Retry Failed Scans**: Use global "Rescan Errors" or individual retry buttons
7. **Export**: Download results as JSON or HTML when scanning completes

## 🛠️ Tech Stack

- **Framework**: [Next.js 16.1.1](https://nextjs.org/) with App Router
- **Build Tool**: Turbopack
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Sitemap Parser**: [sitemapper](https://www.npmjs.com/package/sitemapper)
- **API**: Google PageSpeed Insights API v5

## 📁 Project Structure

```
BulkPageSpeedInsightsTest/
├── app/
│   ├── api/
│   │   ├── pagespeed/
│   │   │   └── route.ts          # PageSpeed Insights API handler
│   │   └── parse-sitemap/
│   │       └── route.ts          # Sitemap parsing API handler
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main application page
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## 🔧 Configuration

### API Routes

#### `/api/parse-sitemap`
Parses XML sitemaps and returns a list of URLs.

**Request:**
```json
{
  "sitemapUrl": "https://example.com/sitemap.xml",
  "allowInsecure": false
}
```

**Response:**
```json
{
  "urls": ["https://example.com/page1", "https://example.com/page2"],
  "count": 2
}
```

#### `/api/pagespeed`
Fetches PageSpeed Insights data for a specific URL.

**Request:**
```json
{
  "url": "https://example.com",
  "apiKey": "your-api-key",
  "strategy": "mobile"
}
```

**Response:**
```json
{
  "url": "https://example.com",
  "strategy": "mobile",
  "scores": {
    "performance": 95,
    "accessibility": 100,
    "bestPractices": 92,
    "seo": 100
  },
  "fieldData": {
    "fcp": "1.2s",
    "lcp": "2.5s",
    "cls": "0.05"
  },
  "issues": []
}
```

## 🎨 Features in Detail

### Rate Limiting Protection
The application automatically adds 3-second delays between API calls to prevent rate limiting from Google's API.

### Data Persistence
- **API Key**: Stored in sessionStorage (cleared when browser closes)
- **Insecure HTTPS Setting**: Stored in localStorage (persists across sessions)
- **Scan Results**: Kept in memory until page reload or rescan

### Browser Protection
Active scans are protected from accidental page closure with:
- `beforeunload` event listener
- Browser's native confirmation dialog
- Visual warning banner during scanning

## 🚀 Deployment

The easiest way to deploy is using [Vercel](https://vercel.com):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=<your-repo-url>)

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 💖 Credits

Built using [Qoder](https://qoder.com/referral?referral_code=1h8QowRIQ5YLknq8XJslQPkJtNEBi24v)

## 📋 Changelog

### Version 2.0.0 (January 2026)

#### 🎉 New Features
- **Dual Input Mode System**: Added tabbed interface for choosing between Sitemap and Manual URL entry
- **Manual URL Input**: New textarea-based URL input supporting comma or newline separation
- **Streamlined Manual Workflow**: Manual mode skips URL selection and starts scanning immediately
- **Auto-scroll Navigation**: Automatic smooth scrolling to relevant sections after button clicks
- **Global Error Rescan**: "Rescan Errors" button to retry all failed URLs in one action
- **Individual URL Retry**: Retry button next to each error status for precise control
- **Device Scanning Indicator**: Real-time visual indicator showing which device (Mobile/Desktop) is being analyzed
- **Smart Result Preservation**: Error rescans now preserve successful results instead of clearing them

#### 🐛 Bug Fixes
- Fixed issue where rescanning errors would clear all successful scan results
- Improved result merging logic to only update URLs being rescanned

#### 🎨 UI/UX Improvements
- Updated button labels for clarity ("Start Performance Scan" for manual mode)
- Added pulsing arrow animation for device scanning indicator
- Conditional URL selection display (only shown for sitemap mode)
- Enhanced visual feedback during scanning process

#### 🔧 Technical Improvements
- Refactored scan function to use URL-based result matching instead of index-based
- Improved state management for dual input modes
- Added `currentScanDevice` state for precise device tracking
- Enhanced `startPerformanceScanWithUrls` to preserve existing results

### Version 1.0.0 (December 2025)
- Initial release with sitemap scanning
- Lighthouse score analysis
- Core Web Vitals metrics
- Dual device support (Mobile/Desktop)
- JSON and HTML export functionality
- Rate limiting protection
- Browser reload protection

## 🔗 Links

- [Google PageSpeed Insights API Documentation](https://developers.google.com/speed/docs/insights/v5/get-started)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
