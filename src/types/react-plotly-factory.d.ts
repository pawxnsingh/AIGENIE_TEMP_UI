declare module 'react-plotly.js/factory' {
  import * as React from 'react';
  import type { PlotlyHTMLElement } from 'plotly.js';

  type PlotlyType = any;
  type Figure = {
    data: any[];
    layout?: any;
    frames?: any[];
  };

  export default function createPlotlyComponent(plotly: PlotlyType): React.ComponentType<{
    data: any[];
    layout?: any;
    config?: any;
    frames?: any[];
    onInitialized?: (figure: Figure, graphDiv: PlotlyHTMLElement) => void;
    onUpdate?: (figure: Figure, graphDiv: PlotlyHTMLElement) => void;
    onPurge?: (graphDiv: PlotlyHTMLElement) => void;
    useResizeHandler?: boolean;
    style?: React.CSSProperties;
    className?: string;
    debug?: boolean;
  }>;
}
