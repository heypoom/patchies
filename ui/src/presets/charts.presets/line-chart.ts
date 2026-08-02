export const LINE_CHART_JS = `setTitle('Line Chart')

const d3 = await esm("d3");

// Configuration & State
let data = [10, 40, 20, 70, 45, 90, 30];

const margin = { top: 20, right: 20, bottom: 10, left: 40 };
const width = 450;
const height = 280;

// Aesthetic Setup
noPan();
setSize(width, height);

root.className = "p-4 rounded-lg overflow-hidden font-mono text-[10px]";
root.style.background = 'transparent';

// Define Settings
await settings.define([
  { key: 'lineColor', label: 'Line Color', type: 'color', default: '#22d3ee' },
  { key: 'pointSize', label: 'Point Size', type: 'slider', min: 2, max: 10, default: 4 },
  { key: 'bufferSize', label: 'Buffer Size', type: 'slider', min: 2, max: 512, default: 20 }
]);

const render = () => {
  root.innerHTML = '';

  const svg = d3.select(root)
    .append("svg")
    .attr("viewBox", \`0 0 \${width} \${height}\`)
    .attr("class", "w-full h-auto");

  const x = d3.scaleLinear()
    .domain([0, data.length - 1])
    .range([margin.left, width - margin.right]);

  const yMin = data.length > 0 ? d3.min(data) : 0;
  const yMax = data.length > 0 ? d3.max(data) : 100;
  const yPad = (yMax - yMin) * 0.1 || 5;

  const y = d3.scaleLinear()
    .domain([yMin - yPad, yMax + yPad])
    .range([height - margin.bottom, margin.top])
    .nice();

  // Grid Lines
  svg.append("g")
    .attr("stroke", "#27272a")
    .selectAll("line")
    .data(y.ticks(5))
    .join("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", d => y(d))
    .attr("y2", d => y(d));

  // Line Generator
  const line = d3.line()
    .x((d, i) => x(i))
    .y(d => y(d))
    .curve(d3.curveMonotoneX);

  // Draw Line
  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", settings.get('lineColor'))
    .attr("stroke-width", 2.5)
    .attr("d", line);

  // Interactive Points
  svg.selectAll(".dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d, i) => x(i))
    .attr("cy", d => y(d))
    .attr("r", settings.get('pointSize'))
    .attr("class", "cursor-pointer hover:fill-white transition-all")
    .attr("fill", settings.get('lineColor'))
    .on("click", (event, d) => {
       send({ type: 'point_selected', value: d });
       d3.select(event.currentTarget)
         .attr("r", settings.get('pointSize') * 2)
         .transition()
         .duration(300)
         .attr("r", settings.get('pointSize'));
    });

  // Y Axis only
  const yAxis = d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(10);

  svg.append("g")
    .attr("transform", \`translate(\${margin.left},0)\`)
    .call(yAxis)
    .call(g => g.select(".domain").remove())
    .attr("color", "#52525b");
};

// Handle incoming data to update chart dynamically
recv(msg => {
  if (typeof msg === 'number') {
    data.push(msg);
    const bufferSize = settings.get('bufferSize');
    while (data.length > bufferSize) data.shift();
    render();
  } else if (msg && typeof msg === 'object' && msg.type === 'clear') {
    data = [];
    render();
  }
});

settings.onChange((key) => {
  if (key === 'bufferSize') {
    const bufferSize = settings.get('bufferSize');
    while (data.length > bufferSize) data.shift();
  }

  render();
});

render();`;

export const lineChartPreset = {
  type: 'dom' as const,
  data: {
    code: LINE_CHART_JS,
    inletCount: 1,
    outletCount: 1
  }
};
