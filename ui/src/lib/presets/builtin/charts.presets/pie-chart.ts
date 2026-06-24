export const PIE_CHART_JS = `setTitle('Pie Chart')

const d3 = await esm('d3');

// Configuration & State
let data = [
  { label: 'A', value: 30 },
  { label: 'B', value: 20 },
  { label: 'C', value: 25 },
  { label: 'D', value: 15 },
  { label: 'E', value: 10 }
];

const width = 420;
const height = 320;

noPan();
setSize(width, height);

root.className = 'rounded-lg overflow-hidden';
root.style.background = 'transparent';
root.style.fontFamily = '"DM Mono", monospace';

await settings.define([
  { key: 'donut', label: 'Donut Mode', type: 'boolean', default: true },
  { key: 'innerRadius', label: 'Inner Radius %', type: 'slider', min: 10, max: 80, default: 45 },
  { key: 'showLabels', label: 'Show Labels', type: 'boolean', default: true },
  { key: 'spacing', label: 'Slice Spacing', type: 'slider', min: 0, max: 10, default: 0 }
]);

const palette = [
  '#22d3ee', '#f472b6', '#a3e635', '#fb923c', '#818cf8',
  '#34d399', '#fbbf24', '#e879f9', '#38bdf8', '#4ade80'
];

const fmtVal = v => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);

  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(2)).toString();
};

/**
 * Normalizes incoming data formats to {label, value}[]
 */
const normalizeData = (input) => {
  if (!Array.isArray(input)) return [];

  // Check if first element is an array [label, value]
  if (input.length > 0 && Array.isArray(input[0])) {
    return input.map(item => ({ label: String(item[0]), value: Number(item[1]) }));
  }

  return input;
};

const render = () => {
  root.innerHTML = '';

  const legendWidth = 80;
  const padding = 20;
  const chartAreaWidth = width - legendWidth - (padding * 2);
  const cx = padding + chartAreaWidth / 2;
  const cy = height / 2;
  const outerR = Math.min(chartAreaWidth / 2, cy - padding);

  const isDonut = settings.get('donut');
  const innerR = isDonut ? outerR * (settings.get('innerRadius') / 100) : 0;
  const showLabels = settings.get('showLabels');
  const padAngle = settings.get('spacing') / 100;

  const svg = d3.select(root)
    .append('svg')
    .attr('viewBox', \`0 0 \${width} \${height}\`)
    .attr('width', width)
    .attr('height', height)
    .style('shape-rendering', 'geometricPrecision');

  const pie = d3.pie()
    .value(d => d.value)
    .sort(null)
    .padAngle(padAngle);

  const arc = d3.arc()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .cornerRadius(0);

  const arcHover = d3.arc()
    .innerRadius(innerR)
    .outerRadius(outerR + 4)
    .cornerRadius(0);

  const arcs = pie(data);

  const g = svg.append('g')
    .attr('transform', \`translate(\${cx}, \${cy})\`);

  // Tooltip
  const tooltip = d3.select(root)
    .append('div')
    .attr('class', 'pointer-events-none absolute opacity-0 transition-opacity duration-150 z-10')
    .style('background', '#18181bE6')
    .style('backdrop-filter', 'blur(4px)')
    .style('border', '1px solid #3f3f46')
    .style('padding', '4px 8px')
    .style('border-radius', '4px')
    .style('font-size', '10px')
    .style('color', '#fff');

  // Slices
  g.selectAll('path')
    .data(arcs)
    .enter()
    .append('path')
    .attr('d', arc)
    .attr('fill', (d, i) => palette[i % palette.length])
    .attr('stroke', 'transparent')
    .attr('stroke-width', padAngle > 0 ? 0 : 0.5)
    .attr('class', 'cursor-pointer transition-all duration-200')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('d', arcHover).style('filter', 'brightness(1.1)');
      tooltip.style('opacity', '1').html(\`<span style="color:\${palette[arcs.indexOf(d) % palette.length]}">\${d.data.label}</span>: \${fmtVal(d.data.value)}\`);
    })
    .on('mousemove', function(event) {
      const [mx, my] = d3.pointer(event, root);
      tooltip.style('left', \`\${mx + 15}px\`).style('top', \`\${my - 15}px\`);
    })
    .on('mouseout', function() {
      d3.select(this).attr('d', arc).style('filter', null);
      tooltip.style('opacity', '0');
    })
    .on('click', (event, d) => {
      send({ type: 'slice_selected', label: d.data.label, value: d.data.value });
    });

  // Center Text
  if (isDonut) {
    const total = d3.sum(data, d => d.value);
    const centerText = g.append('g').attr('class', 'pointer-events-none');

    centerText.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', '24px')
      .attr('font-weight', '600')
      .text(fmtVal(total));

    centerText.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 18)
      .attr('fill', '#71717a')
      .attr('font-size', '10px')
      .attr('text-transform', 'uppercase')
      .attr('letter-spacing', '0.05em')
      .text('total');
  }

  // Legend
  const legendX = cx + outerR + 25;
  const legendG = svg.append('g')
    .attr('transform', \`translate(\${legendX}, \${cy - (data.length * 20) / 2})\`);

  data.forEach((d, i) => {
    const row = legendG.append('g')
      .attr('transform', \`translate(0, \${i * 20})\`)
      .attr('class', 'cursor-default group');

    row.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('rx', 2)
      .attr('fill', palette[i % palette.length]);

    row.append('text')
      .attr('x', 16)
      .attr('y', 9)
      .attr('fill', '#a1a1aa')
      .attr('font-size', '11px')
      .text(d.label);

    row.append('text')
      .attr('x', 16)
      .attr('y', 9)
      .attr('text-anchor', 'start')
      .attr('fill', '#52525b')
      .attr('font-size', '10px')
      .attr('transform', \`translate(28, 0)\`)
      .text(fmtVal(d.value));
  });
};

recv(msg => {
  // Handle direct array input (supporting both {label, value} and [label, value])
  if (Array.isArray(msg)) {
    data = normalizeData(msg);
    render();

    return;
  }

  // Handle object-based messages
  if (msg && typeof msg === 'object') {
    if (msg.type === 'set' && Array.isArray(msg.data)) {
      data = normalizeData(msg.data);
    } else if (msg.type === 'update') {
      const entry = data.find(d => d.label === msg.label);
      if (entry) entry.value = msg.value;
      else data.push({ label: msg.label, value: msg.value });
    } else if (msg.type === 'clear') {
      data = [];
    }

    render();
  }
});

settings.onChange(() => render());
render();`;

export const pieChartPreset = {
  type: 'dom' as const,
  data: {
    code: PIE_CHART_JS,
    inletCount: 1,
    outletCount: 1
  }
};
