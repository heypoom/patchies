export const BAR_CHART_JS = `setTitle('Bar Chart')

const d3 = await esm("d3");

// Configuration & State
let data = [10, 40, 20, 70, 45, 90, 30];

const margin = { top: 20, right: 20, bottom: 30, left: 40 };
const width = 450;
const height = 280;

noPan();
setSize(width, height);

root.className = "p-4 rounded-lg overflow-hidden font-mono text-[10px]";
root.style.background = 'transparent';

await settings.define([
  { key: 'barColor', label: 'Bar Color', type: 'color', default: '#22d3ee' },
  { key: 'bufferSize', label: 'Buffer Size', type: 'slider', min: 2, max: 512, default: 20 },
  { key: 'showValues', label: 'Show Values', type: 'boolean', default: false }
]);

const render = () => {
  root.innerHTML = '';

  const svg = d3.select(root)
    .append("svg")
    .attr("viewBox", \`0 0 \${width} \${height}\`)
    .attr("class", "w-full h-auto");

  const x = d3.scaleBand()
    .domain(data.map((_, i) => i))
    .range([margin.left, width - margin.right])
    .padding(0.18);

  const yMax = data.length > 0 ? d3.max(data) : 100;
  const yPad = yMax * 0.1 || 5;

  const y = d3.scaleLinear()
    .domain([0, yMax + yPad])
    .range([height - margin.bottom, margin.top])
    .nice();

  const color = settings.get('barColor');

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

  // Baseline
  svg.append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .attr("stroke", "#3f3f46")
    .attr("stroke-width", 1);

  // Bars
  const barGroup = svg.selectAll(".bar")
    .data(data)
    .enter()
    .append("g");

  barGroup.append("rect")
    .attr("class", "cursor-pointer")
    .attr("x", (d, i) => x(i))
    .attr("y", d => y(d))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d))
    .attr("fill", color)
    .attr("rx", 2)
    .attr("opacity", 0.85)
    .on("mouseover", function() {
      d3.select(this).attr("opacity", 1).attr("fill", "white");
    })
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 0.85).attr("fill", color);
    })
    .on("click", (event, d) => {
      send({ type: 'bar_selected', value: d });
    });

  // Value Labels
  if (settings.get('showValues')) {
    barGroup.append("text")
      .attr("x", (d, i) => x(i) + x.bandwidth() / 2)
      .attr("y", d => y(d) - 4)
      .attr("text-anchor", "middle")
      .attr("fill", color)
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .text(d => Number.isInteger(d) ? d : d.toFixed(1));
  }

  // Y Axis
  const yAxis = d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8);
  svg.append("g")
    .attr("transform", \`translate(\${margin.left},0)\`)
    .call(yAxis)
    .call(g => g.select(".domain").remove())
    .attr("color", "#52525b");
};

recv(msg => {
  if (typeof msg === 'number') {
    data.push(msg);
    const bufferSize = settings.get('bufferSize');
    while (data.length > bufferSize) data.shift();
    render();
  } else if (Array.isArray(msg)) {
    data = msg.slice(0, settings.get('bufferSize'));
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

export const barChartPreset = {
  type: 'dom' as const,
  data: {
    code: BAR_CHART_JS,
    inletCount: 1,
    outletCount: 1
  }
};
