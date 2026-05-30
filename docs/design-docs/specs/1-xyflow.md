# 1. Setup Svelte Flow

- Setup the svelte-flow library
- The app should be in dark theme. This app uses Zinc color for greys.
- The index page should render a component that renders a svelte-flow canvas. make sure to not add the component logic directly to the page, because eventually we want to expose the canvas as a Web Component.
- Create a basic node that render a rounded-corner JavaScript canvas.
- I should be able to drag and drop the node: drag the node in from the bottom bar, and drop it onto the canvas.

## Selected Edge Styling

Selected edges should use a yellow stroke with a yellow-ish glow so the selection remains obvious over background output. Selection color takes precedence over edge type colors such as audio blue, video orange, and message zinc.
