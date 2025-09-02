import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Download, Maximize2 } from 'lucide-react';
import * as echarts from 'echarts';
import createPlotlyComponent from 'react-plotly.js/factory';
import PlotlyCore from 'plotly.js/lib/core';
import scatter from 'plotly.js/lib/scatter';
import bar from 'plotly.js/lib/bar';
import pie from 'plotly.js/lib/pie';
import box from 'plotly.js/lib/box';
import histogram from 'plotly.js/lib/histogram';
import heatmap from 'plotly.js/lib/heatmap';
import contour from 'plotly.js/lib/contour';
import violin from 'plotly.js/lib/violin';

// Register only needed traces to avoid pulling Node-only modules (e.g., image)
(PlotlyCore as any).register([scatter, bar, pie, box, histogram, heatmap, contour, violin]);
const Plot = createPlotlyComponent(PlotlyCore as any);

interface ChartArtifactProps {
  title: string;
  chartOptions?: any;
  htmlCdnUrl?: string; // now expected to return Plotly JSON
  plotlyFigs?: any[];  // direct Plotly figures
}

const ChartArtifact: React.FC<ChartArtifactProps> = ({ title, chartOptions, htmlCdnUrl, plotlyFigs }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // Plotly JSON handling
  const [fetchedFigs, setFetchedFigs] = useState<any[] | null>(null);
  const [loadingJson, setLoadingJson] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const providedFigs = Array.isArray(plotlyFigs) && plotlyFigs.length > 0 ? plotlyFigs : null;
  const resolvedFigs = providedFigs ?? fetchedFigs;
  const hasPlotly = Array.isArray(resolvedFigs) && resolvedFigs.length > 0;

  // If no direct figs but a URL is provided, fetch JSON (array or single fig)
  useEffect(() => {
    let cancelled = false;
    if (providedFigs || !htmlCdnUrl) {
      setFetchedFigs(null);
      setLoadingJson(false);
      setJsonError(null);
      return;
    }

    setLoadingJson(true);
    setJsonError(null);
    setFetchedFigs(null);

    fetch(htmlCdnUrl, { mode: 'cors' })
      .then(async (res) => {
        const text = await res.text();
        if (cancelled) return;
        try {
          const parsed = JSON.parse(text);
          const figs = Array.isArray(parsed) ? parsed : [parsed];
          setFetchedFigs(figs);
        } catch (e) {
          setJsonError('Invalid Plotly JSON response');
        }
      })
      .catch((err) => {
        console.error('Failed to fetch Plotly JSON:', err);
        if (!cancelled) setJsonError('Failed to load chart data');
      })
      .finally(() => {
        if (!cancelled) setLoadingJson(false);
      });

    return () => { cancelled = true; };
  }, [htmlCdnUrl, providedFigs]);

  // ECharts path (legacy)
  useEffect(() => {
    if (hasPlotly) return; // handled by Plotly path

    if (chartRef.current && chartOptions) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
      }
      chartInstanceRef.current = echarts.init(chartRef.current, 'shine', { renderer: 'svg' });
      chartInstanceRef.current.setOption(chartOptions);

      let resizeTimeout: NodeJS.Timeout;
      const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          chartInstanceRef.current?.resize();
        }, 100);
      };
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(resizeTimeout);
        chartInstanceRef.current?.dispose();
      };
    }
  }, [chartOptions, hasPlotly]);

  const handleDownload = () => {
    if (chartInstanceRef.current) {
      const url = chartInstanceRef.current.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' });
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/\s+/g, '_').toLowerCase()}_chart.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleMaximize = () => {
    if (chartRef.current) {
      if (chartRef.current.requestFullscreen) {
        chartRef.current.requestFullscreen();
      }
      setTimeout(() => chartInstanceRef.current?.resize(), 100);
    }
  };

  // Normalize figs for rendering
  const normalizedFigs = hasPlotly ? (resolvedFigs as any[]).map((fig) => ({
    data: fig?.data ?? fig ?? [],
    layout: fig?.layout ?? { autosize: true, margin: { t: 40, r: 20, b: 40, l: 50 } },
    config: fig?.config ?? { responsive: true, displaylogo: false }
  })) : [];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <BarChart3 size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-800">{title}</span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Download/maximize only for ECharts path */}
          {!hasPlotly && chartOptions && (
            <>
              <button onClick={handleDownload} className="p-1.5 rounded-md hover:bg-gray-200 transition-colors" title="Download chart">
                <Download size={14} className="text-gray-600" />
              </button>
              <button onClick={handleMaximize} className="p-1.5 rounded-md hover:bg-gray-200 transition-colors" title="Maximize chart">
                <Maximize2 size={14} className="text-gray-600" />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="relative w-full h-[600px] overflow-hidden">
          {hasPlotly ? (
            <div className="w-full h-full bg-white rounded-lg border border-gray-200 overflow-auto p-2">
              {normalizedFigs.map((f, idx) => (
                <div key={idx} className="mb-3 last:mb-0" style={{ height: normalizedFigs.length > 1 ? 300 : '100%' }}>
                  <Plot
                    data={f.data}
                    layout={{ ...f.layout, autosize: true }}
                    config={{ ...f.config, responsive: true, displaylogo: false }}
                    useResizeHandler
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              ))}
            </div>
          ) : chartOptions ? (
            <div ref={chartRef} className="w-full h-full bg-white rounded-lg border border-gray-200" style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <div className="absolute inset-0 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <BarChart3 size={48} className="text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No chart data available</p>
              </div>
            </div>
          )}

          {/* Loading and error for JSON fetch path */}
          {!providedFigs && htmlCdnUrl && loadingJson && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
              <div className="text-sm text-gray-600">Loading chart…</div>
            </div>
          )}
          {!providedFigs && htmlCdnUrl && jsonError && !hasPlotly && (
            <div className="absolute inset-0 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <BarChart3 size={48} className="text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">{jsonError}</p>
              </div>
            </div>
          )}
        </div>

        {/* ECharts config preview */}
        {!hasPlotly && chartOptions && (
          <details className="mt-4">
            <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">View Chart Configuration</summary>
            <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded overflow-x-auto">{JSON.stringify(chartOptions, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default ChartArtifact;
