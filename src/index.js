import ChartjsAdapter from "./adapters/chartjs";
import HighchartsAdapter from "./adapters/highcharts";
import GoogleChartsAdapter from "./adapters/google";

import { dataEmpty, processSeries, processSimple } from "./data";
import { merge, isFunction, toDate } from "./helpers";
import { pushRequest } from "./request-queue";

let config = {};
let adapters = [];

// helpers

function setText(element, text) {
  if (document.body.innerText) {
    element.innerText = text;
  } else {
    element.textContent = text;
  }
}

// TODO remove prefix for all messages
function chartError(element, message, noPrefix) {
  if (!noPrefix) {
    message = "Error Loading Chart: " + message;
  }
  setText(element, message);
  element.style.color = "#ff0000";
}

function errorCatcher(chart) {
  try {
    chart.__render();
  } catch (err) {
    chartError(chart.element, err.message);
    throw err;
  }
}

function fetchDataSource(chart, dataSource, showLoading) {
  // only show loading message for urls and callbacks
  if (showLoading && chart.options.loading && (typeof dataSource === "string" || typeof dataSource === "function")) {
    setText(chart.element, chart.options.loading);
  }

  if (typeof dataSource === "string") {
    pushRequest(dataSource, function (data) {
      chart.rawData = data;
      errorCatcher(chart);
    }, function (message) {
      chartError(chart.element, message);
    });
  } else if (typeof dataSource === "function") {
    try {
      dataSource(function (data) {
        chart.rawData = data;
        errorCatcher(chart);
      }, function (message) {
        chartError(chart.element, message, true);
      });
    } catch (err) {
      chartError(chart.element, err, true);
    }
  } else {
    chart.rawData = dataSource;
    errorCatcher(chart);
  }
}

function addDownloadButton(chart) {
  let element = chart.element;
  let link = document.createElement("a");

  let download = chart.options.download;
  if (download === true) {
    download = {};
  } else if (typeof download === "string") {
    download = {filename: download};
  }
  link.download = download.filename || "chart.png"; // https://caniuse.com/download

  link.style.position = "absolute";
  link.style.top = "20px";
  link.style.right = "20px";
  link.style.zIndex = 1000;
  link.style.lineHeight = "20px";
  link.target = "_blank"; // for safari
  let image = document.createElement("img");
  image.alt = "Download";
  image.style.border = "none";
  // icon from font-awesome
  // http://fa2png.io/
  image.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAABCFBMVEUAAADMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMywEsqxAAAAV3RSTlMAAQIDBggJCgsMDQ4PERQaHB0eISIjJCouLzE0OTo/QUJHSUpLTU5PUllhYmltcHh5foWLjI+SlaCio6atr7S1t7m6vsHHyM7R2tze5Obo7fHz9ff5+/1hlxK2AAAA30lEQVQYGUXBhVYCQQBA0TdYWAt2d3d3YWAHyur7/z9xgD16Lw0DW+XKx+1GgX+FRzM3HWQWrHl5N/oapW5RPe0PkBu+UYeICvozTWZVK23Ao04B79oJrOsJDOoxkZoQPWgX29pHpCZEk7rEvQYiNSFq1UMqvlCjJkRBS1R8hb00Vb/TajtBL7nTHE1X1vyMQF732dQhyF2o6SAwrzP06iUQzvwsArlnzcOdrgBhJyHa1QOgO9U1GsKuvjUTjavliZYQ8nNPapG6sap/3nrIdJ6bOWzmX/fy0XVpfzZP3S8OJT3g9EEiJwAAAABJRU5ErkJggg==";
  link.appendChild(image);
  element.style.position = "relative";

  chart.__downloadAttached = true;

  // mouseenter
  chart.__enterEvent = addEvent(element, "mouseover", function(e) {
    let related = e.relatedTarget;
    // check download option again to ensure it wasn't changed
    if ((!related || (related !== this && !childOf(this, related))) && chart.options.download) {
      link.href = chart.toImage(download);
      element.appendChild(link);
    }
  });

  // mouseleave
  chart.__leaveEvent = addEvent(element, "mouseout", function(e) {
    let related = e.relatedTarget;
    if (!related || (related !== this && !childOf(this, related))) {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }
  });
}

// https://stackoverflow.com/questions/10149963/adding-event-listener-cross-browser
function addEvent(elem, event, fn) {
  if (elem.addEventListener) {
    elem.addEventListener(event, fn, false);
    return fn;
  } else {
    let fn2 = function() {
      // set the this pointer same as addEventListener when fn is called
      return(fn.call(elem, window.event));
    };
    elem.attachEvent("on" + event, fn2);
    return fn2;
  }
}

function removeEvent(elem, event, fn) {
  if (elem.removeEventListener) {
    elem.removeEventListener(event, fn, false);
  } else {
    elem.detachEvent("on" + event, fn);
  }
}

// https://gist.github.com/shawnbot/4166283
function childOf(p, c) {
  if (p === c) return false;
  while (c && c !== p) c = c.parentNode;
  return c === p;
}

function getAdapterType(library) {
  if (library) {
    if (library.product === "Highcharts") {
      return HighchartsAdapter;
    } else if (library.charts) {
      return GoogleChartsAdapter;
    } else if (isFunction(library)) {
      return ChartjsAdapter;
    }
  }
  throw new Error("Unknown adapter");
}

function addAdapter(library) {
  let adapterType = getAdapterType(library);
  let adapter = new adapterType(library);

  if (adapters.indexOf(adapter) === -1) {
    adapters.push(adapter);
  }
}

function loadAdapters() {
  if ("Chart" in window) {
    addAdapter(window.Chart);
  }

  if ("Highcharts" in window) {
    addAdapter(window.Highcharts);
  }

  if (window.google && window.google.charts) {
    addAdapter(window.google);
  }
}

function renderChart(chartType, chart) {
  if (dataEmpty(chart.data, chartType)) {
    let message = chart.options.empty || (chart.options.messages && chart.options.messages.empty) || "No data";
    setText(chart.element, message);
  } else {
    callAdapter(chartType, chart);
    if (chart.options.download && !chart.__downloadAttached && chart.adapter === "chartjs") {
      addDownloadButton(chart);
    }
  }
}

// TODO remove chartType if cross-browser way
// to get the name of the chart class
function callAdapter(chartType, chart) {
  let i, adapter, fnName, adapterName;
  fnName = "render" + chartType;
  adapterName = chart.options.adapter;

  loadAdapters();

  for (i = 0; i < adapters.length; i++) {
    adapter = adapters[i];
    if ((!adapterName || adapterName === adapter.name) && isFunction(adapter[fnName])) {
      chart.adapter = adapter.name;
      chart.__adapterObject = adapter;
      return adapter[fnName](chart);
    }
  }

  if (adapters.length > 0) {
    throw new Error("No charting library found for " + chartType);
  } else {
    throw new Error("No charting libraries found - be sure to include one before your charts");
  }
}

// define classes

class Chart {
  constructor(element, dataSource, options) {
    let elementId;
    if (typeof element === "string") {
      elementId = element;
      element = document.getElementById(element);
      if (!element) {
        throw new Error("No element with id " + elementId);
      }
    }
    this.element = element;
    this.options = merge(Chartkick.options, options || {});
    this.dataSource = dataSource;

    Chartkick.charts[element.id] = this;

    fetchDataSource(this, dataSource, true);

    if (this.options.refresh) {
      this.startRefresh();
    }
  }

  getElement() {
    return this.element;
  }

  getDataSource() {
    return this.dataSource;
  }

  getData() {
    return this.data;
  }

  getOptions() {
    return this.options;
  }

  getChartObject() {
    return this.chart;
  }

  getAdapter() {
    return this.adapter;
  }

  updateData(dataSource, options) {
    this.dataSource = dataSource;
    if (options) {
      this.__updateOptions(options);
    }
    fetchDataSource(this, dataSource, true);
  }

  setOptions(options) {
    this.__updateOptions(options);
    this.redraw();
  }

  redraw() {
    fetchDataSource(this, this.rawData);
  }

  refreshData() {
    if (typeof this.dataSource === "string") {
      // prevent browser from caching
      let sep = this.dataSource.indexOf("?") === -1 ? "?" : "&";
      let url = this.dataSource + sep + "_=" + (new Date()).getTime();
      fetchDataSource(this, url);
    } else if (typeof this.dataSource === "function") {
      fetchDataSource(this, this.dataSource);
    }
  }

  startRefresh() {
    let refresh = this.options.refresh;

    if (refresh && typeof this.dataSource !== "string" && typeof this.dataSource !== "function") {
      throw new Error("Data source must be a URL or callback for refresh");
    }

    if (!this.intervalId) {
      if (refresh) {
        this.intervalId = setInterval( () => {
          this.refreshData();
        }, refresh * 1000);
      } else {
        throw new Error("No refresh interval");
      }
    }
  }

  stopRefresh() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  toImage(download) {
    if (this.adapter === "chartjs") {
      if (download && download.background && download.background !== "transparent") {
        // https://stackoverflow.com/questions/30464750/chartjs-line-chart-set-background-color
        let canvas = this.chart.canvas;
        let ctx = this.chart.ctx;
        let tmpCanvas = document.createElement("canvas");
        let tmpCtx = tmpCanvas.getContext("2d");
        tmpCanvas.width = ctx.canvas.width;
        tmpCanvas.height = ctx.canvas.height;
        tmpCtx.fillStyle = download.background;
        tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
        tmpCtx.drawImage(canvas, 0, 0);
        return tmpCanvas.toDataURL("image/png");
      } else {
        return this.chart.toBase64Image();
      }
    } else {
      throw new Error("Feature only available for Chart.js");
    }
  }

  destroy() {
    this.destroyed = true;
    this.stopRefresh();

    if (this.__adapterObject) {
      this.__adapterObject.destroy(this);
    }

    if (this.__enterEvent) {
      removeEvent(this.element, "mouseover", this.__enterEvent);
    }

    if (this.__leaveEvent) {
      removeEvent(this.element, "mouseout", this.__leaveEvent);
    }
  }

  __updateOptions(options) {
    let updateRefresh = options.refresh && options.refresh !== this.options.refresh;
    this.options = merge(Chartkick.options, options);
    if (updateRefresh) {
      this.stopRefresh();
      this.startRefresh();
    }
  }

  __render() {
    this.data = this.__processData();
    renderChart(this.__chartName(), this);
  }

  __config() {
    return config;
  }
}

class LineChart extends Chart {
  __processData() {
    return processSeries(this);
  }

  __chartName() {
    return "LineChart";
  }
}

class PieChart extends Chart {
  __processData() {
    return processSimple(this);
  }

  __chartName() {
    return "PieChart";
  }
}

class ColumnChart extends Chart {
  __processData() {
    return processSeries(this, null, true);
  }

  __chartName() {
    return "ColumnChart";
  }
}

class BarChart extends Chart {
  __processData() {
    return processSeries(this, null, true);
  }

  __chartName() {
    return "BarChart";
  }
}

class AreaChart extends Chart {
  __processData() {
    return processSeries(this);
  }

  __chartName() {
    return "AreaChart";
  }
}

class GeoChart extends Chart {
  __processData() {
    return processSimple(this);
  }

  __chartName() {
    return "GeoChart";
  }
}

class ScatterChart extends Chart {
  __processData() {
    return processSeries(this, "number");
  }

  __chartName() {
    return "ScatterChart";
  }
}

class BubbleChart extends Chart {
  __processData() {
    return processSeries(this, "bubble");
  }

  __chartName() {
    return "BubbleChart";
  }
}

class Timeline extends Chart {
  __processData() {
    let i, data = this.rawData;
    for (i = 0; i < data.length; i++) {
      data[i][1] = toDate(data[i][1]);
      data[i][2] = toDate(data[i][2]);
    }
    return data;
  }

  __chartName() {
    return "Timeline";
  }
}

const Chartkick = {
  LineChart: LineChart,
  PieChart: PieChart,
  ColumnChart: ColumnChart,
  BarChart: BarChart,
  AreaChart: AreaChart,
  GeoChart: GeoChart,
  ScatterChart: ScatterChart,
  BubbleChart: BubbleChart,
  Timeline: Timeline,
  charts: {},
  configure: function (options) {
    for (let key in options) {
      if (options.hasOwnProperty(key)) {
        config[key] = options[key];
      }
    }
  },
  setDefaultOptions: function (opts) {
    Chartkick.options = opts;
  },
  eachChart: function (callback) {
    for (let chartId in Chartkick.charts) {
      if (Chartkick.charts.hasOwnProperty(chartId)) {
        callback(Chartkick.charts[chartId]);
      }
    }
  },
  destroyAll: function() {
    for (let chartId in Chartkick.charts) {
      if (Chartkick.charts.hasOwnProperty(chartId)) {
        Chartkick.charts[chartId].destroy();
        delete Chartkick.charts[chartId];
      }
    }
  },
  config: config,
  options: {},
  adapters: adapters,
  addAdapter: addAdapter,
  use: function(adapter) {
    addAdapter(adapter);
    return Chartkick;
  }
};

// not ideal, but allows for simpler integration
if (typeof window !== "undefined" && !window.Chartkick) {
  window.Chartkick = Chartkick;

  // clean up previous charts before Turbolinks loads new page
  document.addEventListener("turbolinks:before-render", function() {
    Chartkick.destroyAll();
  });

  // use setTimeout so charting library can come later in same JS file
  setTimeout(function() {
    window.dispatchEvent(new Event("chartkick:load"));
  }, 0);
}

// backwards compatibility for esm require
Chartkick.default = Chartkick;

export default Chartkick;
