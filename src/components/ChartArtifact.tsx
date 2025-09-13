import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Download, Maximize2 } from 'lucide-react';
import * as echarts from 'echarts';

// Ensure Plotly is available when external HTML expects it
const PLOTLY_CDN_URL = 'https://cdn.plot.ly/plotly-2.35.2.min.js';

interface ChartArtifactProps {
	title: string;
	chartOptions?: any;
	htmlCdnUrl?: string; // external pre-rendered HTML page
	jsonCdnUrl?: string; // remote JSON configuration (e.g., Plotly spec)
}

const ChartArtifact: React.FC<ChartArtifactProps> = ({ title, chartOptions, htmlCdnUrl, jsonCdnUrl }) => {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<echarts.ECharts | null>(null);
	const plotlyRef = useRef<HTMLDivElement>(null);

	// External HTML rendering
	const isExternalHtml = !!htmlCdnUrl;
	const isJsonPlotly = !!jsonCdnUrl;
	const externalContainerRef = useRef<HTMLDivElement>(null);
	const [htmlContent, setHtmlContent] = useState<string>('');
	const [loadingHtml, setLoadingHtml] = useState<boolean>(false);
	const [htmlError, setHtmlError] = useState<string | null>(null);
	const [renderIframe, setRenderIframe] = useState<boolean>(false);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [loadingJson, setLoadingJson] = useState<boolean>(false);
	// If the external URL returns JSON instead of HTML, we detect and render via Plotly
	const [detectedPlotlySpec, setDetectedPlotlySpec] = useState<any | null>(null);

	// Fetch and render external HTML inline; fallback to iframe on CORS errors
	useEffect(() => {
		if (!isExternalHtml || !htmlCdnUrl) return;

		// Dispose any existing ECharts instance when switching to external
		if (chartInstanceRef.current) {
			chartInstanceRef.current.dispose();
			chartInstanceRef.current = null;
		}

		let aborted = false;
		setLoadingHtml(true);
		setHtmlError(null);
		setRenderIframe(false);
		setDetectedPlotlySpec(null);

		fetch(htmlCdnUrl, { mode: 'cors' })
			.then(async (res) => {
				if (aborted) return;
				const contentType = (res.headers.get('content-type') || '').toLowerCase();
				// If the response is JSON, render via Plotly path instead of injecting as HTML
				if (contentType.includes('application/json') || contentType.includes('text/json')) {
					try {
						const spec = await res.json();
						if (aborted) return;
						setDetectedPlotlySpec(spec);
						setHtmlContent('');
						return;
					} catch (e: any) {
						setHtmlError('Failed to parse JSON chart spec');
						return;
					}
				}
				// Otherwise, treat as HTML/text
				const text = await res.text();
				if (aborted) return;
				// Heuristic fallback: sometimes servers mislabel JSON; detect by content
				const trimmed = text.trim();
				if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
					try {
						const spec = JSON.parse(trimmed);
						setDetectedPlotlySpec(spec);
						setHtmlContent('');
						return;
					} catch {}
				}
				const parser = new DOMParser();
				const doc = parser.parseFromString(text, 'text/html');
				const bodyInner = doc?.body ? doc.body.innerHTML : '';
				setHtmlContent(bodyInner || text);
			})
			.catch((err) => {
				if (!aborted) {
					console.warn('Falling back to iframe due to CORS/error:', err);
					setHtmlError('');
					setRenderIframe(true);
				}
			})
			.finally(() => {
				if (!aborted) setLoadingHtml(false);
			});

		return () => {
			aborted = true;
		};
	}, [isExternalHtml, htmlCdnUrl]);

	// Inject HTML into container and execute scripts (skip when using iframe fallback)
	useEffect(() => {
		if (!isExternalHtml || renderIframe || detectedPlotlySpec) return;
		const container = externalContainerRef.current;
		if (!container) return;

		container.innerHTML = '';
		if (!htmlContent) return;

		container.innerHTML = htmlContent;

		const toAbs = (value: string | null | undefined) => {
			if (!value) return value as any;
			try {
				const abs = new URL(value, htmlCdnUrl);
				return abs.href;
			} catch {
				return value;
			}
		};

		container.querySelectorAll('link[href]').forEach((el) => {
			const link = el as HTMLLinkElement;
			const href = link.getAttribute('href');
			const abs = toAbs(href);
			if (abs) link.setAttribute('href', abs);
		});
		container.querySelectorAll('img[src]').forEach((el) => {
			const img = el as HTMLImageElement;
			const src = img.getAttribute('src');
			const abs = toAbs(src);
			if (abs) img.setAttribute('src', abs);
		});

		const originalScripts = Array.from(container.querySelectorAll('script')) as HTMLScriptElement[];
		originalScripts.forEach(s => s.parentElement?.removeChild(s));

		let cancelled = false;

		const ensurePlotly = async () => {
			const needsPlotly = /plotly|Plotly\.newPlot|plotly-.*\.js/i.test(htmlContent);
			const hasPlotly = (window as any).Plotly != null;
			if (!needsPlotly || hasPlotly) return;

			await new Promise<void>((resolve, reject) => {
				const existing = document.querySelector(`script[src="${PLOTLY_CDN_URL}"]`) as HTMLScriptElement | null;
				if (existing && (window as any).Plotly) {
					resolve();
					return;
				}
				const script = document.createElement('script');
				script.src = PLOTLY_CDN_URL;
				(script as any).async = false;
				script.onload = () => resolve();
				script.onerror = () => reject(new Error('Failed to load Plotly CDN'));
				document.head.appendChild(script);
			});
		};

		const run = async () => {
			try {
				await ensurePlotly();
				for (const oldScript of originalScripts) {
					if (cancelled) return;
					const newScript = document.createElement('script');
					for (const { name, value } of Array.from(oldScript.attributes)) {
						if (name.toLowerCase() === 'src') {
							const abs = toAbs(value);
							if (abs) newScript.setAttribute('src', abs);
						} else {
							newScript.setAttribute(name, value);
						}
					}
					(newScript as any).async = false;
					(newScript as any).defer = false;
					if (oldScript.src) {
						await new Promise<void>((resolve, reject) => {
							newScript.onload = () => resolve();
							newScript.onerror = () => reject(new Error(`Failed to load script: ${newScript.src}`));
							container.appendChild(newScript);
						});
					} else {
						newScript.textContent = oldScript.textContent;
						container.appendChild(newScript);
					}
				}
			} catch (e) {
				console.error(e);
				setHtmlError('Failed to execute chart scripts');
			}
		};

		run();

		return () => {
			cancelled = true;
		};
	}, [isExternalHtml, renderIframe, htmlContent, htmlCdnUrl, detectedPlotlySpec]);

	// ECharts path (legacy)
	useEffect(() => {
		if (isExternalHtml || isJsonPlotly) return; // handled elsewhere

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
	}, [chartOptions, isExternalHtml, isJsonPlotly]);

	// Plotly JSON path
	useEffect(() => {
		if (!isJsonPlotly || !jsonCdnUrl) return;

		let cancelled = false;
		let mounted = true;
		setJsonError(null);
		setLoadingJson(true);

		const ensurePlotly = async () => {
			if ((window as any).Plotly) return;
			await new Promise<void>((resolve, reject) => {
				const existing = document.querySelector(`script[src="${PLOTLY_CDN_URL}"]`) as HTMLScriptElement | null;
				if (existing) {
					existing.addEventListener('load', () => resolve());
					existing.addEventListener('error', () => reject(new Error('Failed to load Plotly')));
					return;
				}
				const s = document.createElement('script');
				s.src = PLOTLY_CDN_URL;
				s.onload = () => resolve();
				s.onerror = () => reject(new Error('Failed to load Plotly'));
				document.head.appendChild(s);
			});
		};

		const loadAndRender = async () => {
			try {
				await ensurePlotly();
				const res = await fetch(jsonCdnUrl, { mode: 'cors' });
				if (!res.ok) throw new Error(`Failed to fetch JSON (${res.status})`);
				const spec = await res.json();
				if (cancelled) return;
				const plotlyContainer = plotlyRef.current;
				if (!plotlyContainer) return;
				const data = spec.data || spec.traces || spec; // heuristic
				const layout = spec.layout || spec.figure?.layout || {};
				const config = spec.config || { responsive: true };
				await (window as any).Plotly.newPlot(plotlyContainer, data, layout, config);
				// Handle resize
				const handleResize = () => {
					(window as any).Plotly.Plots.resize(plotlyContainer);
				};
				window.addEventListener('resize', handleResize);
				return () => {
					window.removeEventListener('resize', handleResize);
					if ((window as any).Plotly && plotlyContainer) {
						try { (window as any).Plotly.purge(plotlyContainer); } catch {}
					}
				};
			} catch (e: any) {
				if (!cancelled) setJsonError(e.message || 'Failed to render chart');
			} finally {
				if (!cancelled) setLoadingJson(false);
			}
		};

		const cleanupPromise = loadAndRender();

		return () => {
			cancelled = true;
			if (mounted) {
				cleanupPromise.then(cleaner => {
					if (typeof cleaner === 'function') cleaner();
				});
			}
			mounted = false;
		};
	}, [isJsonPlotly, jsonCdnUrl]);

	// Plotly render for detected JSON spec from external HTML URL
	useEffect(() => {
		if (!isExternalHtml || !detectedPlotlySpec) return;

		let cancelled = false;

		const ensurePlotly = async () => {
			if ((window as any).Plotly) return;
			await new Promise<void>((resolve, reject) => {
				const existing = document.querySelector(`script[src="${PLOTLY_CDN_URL}"]`) as HTMLScriptElement | null;
				if (existing) {
					existing.addEventListener('load', () => resolve());
					existing.addEventListener('error', () => reject(new Error('Failed to load Plotly')));
					return;
				}
				const s = document.createElement('script');
				s.src = PLOTLY_CDN_URL;
				s.onload = () => resolve();
				s.onerror = () => reject(new Error('Failed to load Plotly'));
				document.head.appendChild(s);
			});
		};

		const render = async () => {
			try {
				await ensurePlotly();
				const plotlyContainer = plotlyRef.current;
				if (!plotlyContainer) return;
				const spec = detectedPlotlySpec;
				const data = spec.data || spec.traces || spec; // heuristic
				const layout = spec.layout || spec.figure?.layout || {};
				const config = spec.config || { responsive: true };
				await (window as any).Plotly.newPlot(plotlyContainer, data, layout, config);
				const handleResize = () => {
					(window as any).Plotly.Plots.resize(plotlyContainer);
				};
				window.addEventListener('resize', handleResize);
				return () => {
					window.removeEventListener('resize', handleResize);
					if ((window as any).Plotly && plotlyContainer) {
						try { (window as any).Plotly.purge(plotlyContainer); } catch {}
					}
				};
			} catch (e: any) {
				setHtmlError(e.message || 'Failed to render chart');
			}
		};

		const cleanup = render();
		return () => {
			cancelled = true;
			Promise.resolve(cleanup).then((cleaner: any) => {
				if (typeof cleaner === 'function') cleaner();
			});
		};
	}, [isExternalHtml, detectedPlotlySpec]);

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

	return (
		<div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
			<div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
				<div className="flex items-center space-x-2">
					<BarChart3 size={16} className="text-gray-600" />
					<span className="text-sm font-medium text-gray-800">{title}</span>
				</div>
				<div className="flex items-center space-x-2">
					{/* For external HTML, we render inline and do not expose download/open controls */}
					{!isExternalHtml && !isJsonPlotly && (
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
					{isExternalHtml ? (
						renderIframe ? (
							<iframe
								src={htmlCdnUrl}
								title={title}
								className="w-full h-full bg-white rounded-lg border border-gray-200"
							/>
						) : (
							<>
								{detectedPlotlySpec ? (
									<div
										ref={plotlyRef}
										className="w-full h-full bg-white rounded-lg border border-gray-200"
										style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
									/>
								) : (
									<div className="w-full h-full bg-white rounded-lg border border-gray-200 p-0 overflow-auto" ref={externalContainerRef}>
										{/* HTML will be injected here */}
									</div>
								)}
							</>
						)
					) : isJsonPlotly ? (
						<div
							ref={plotlyRef}
							className="w-full h-full bg-white rounded-lg border border-gray-200"
							style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
						/>
					) : (
						<div
							ref={chartRef}
							className="w-full h-full bg-white rounded-lg border border-gray-200"
							style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
						/>
					)}

					{isExternalHtml && loadingHtml && !renderIframe && (
						<div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
							<div className="text-sm text-gray-600">Loading chart…</div>
						</div>
					)}

					{isExternalHtml && htmlError && !renderIframe && (
						<div className="absolute inset-0 bg-gray-50 rounded-lg flex items-center justify-center">
							<div className="text-center">
								<BarChart3 size={48} className="text-gray-400 mx-auto mb-2" />
								<p className="text-gray-500 text-sm">{htmlError}</p>
							</div>
						</div>
					)}

					{isJsonPlotly && (loadingJson || jsonError) && (
						<div className="absolute inset-0 bg-gray-50 rounded-lg flex items-center justify-center">
							<div className="text-center">
								<BarChart3 size={48} className="text-gray-400 mx-auto mb-2" />
								<p className="text-gray-500 text-sm">{loadingJson ? 'Loading chart data…' : jsonError}</p>
							</div>
						</div>
					)}

					{!isExternalHtml && !isJsonPlotly && !chartOptions && (
						<div className="absolute inset-0 bg-gray-50 rounded-lg flex items-center justify-center">
							<div className="text-center">
								<BarChart3 size={48} className="text-gray-400 mx-auto mb-2" />
								<p className="text-gray-500 text-sm">No chart data available</p>
							</div>
						</div>
					)}
				</div>

				{!isExternalHtml && !isJsonPlotly && (
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
