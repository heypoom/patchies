# Changelog

## Week of September 6-13, 2025

### 🎵 New Audio Nodes & Objects

- **Added DSP~ node**: Real-time audio processing with custom DSP code, dynamic inlets/outlets, and Web Audio integration
- **Added Tone~ node**: Tone.js integration for advanced audio synthesis and effects
- **Added Spigot object**: Message routing control object for conditional message passing
- **Enhanced audio edge detection**: Added dsp~ and tone~ to audio edge types for proper routing

### 🎛️ New Control Interfaces

- **Added Toggle Button node**: Persistent on/off state control with visual feedback
- **Added Vertical Sliders**: New `vslider` and `vfslider` objects with vertical orientation
- **Added Text Input node**: Text input interface for message passing and data entry
- **Enhanced Slider functionality**: 
  - Run on mount by default
  - Support for loadbang initialization
  - Hide slider inlets for cleaner UI

### 📹 Video & Media Capabilities

- **Added Video node**: Local video file playback with looping, resizing, and audio routing
- **Added Webcam node**: Live camera input with dynamic resolution controls  
- **Added Screen Capture node**: Desktop/window capture functionality
- **Enhanced video pipeline**: Improved chaining, loading states, and GL compatibility

### 🤖 AI & Creative Tools

- **Added Nano Banana support**: Google's image generation AI for ai.img node
- **Enhanced AI image generation**: Higher resolution output, bang outlets, and improved preview
- **AI Music improvements**: Better string input handling and error management
- **AI Text enhancements**: Added hint text and double-click to run functionality

### 🎨 Visual & Interface Improvements

- **Added Vim mode**: CodeMirror editor now supports vim keybindings
- **Dynamic inlet/outlet opacity**: Visual feedback when connecting nodes
- **Enhanced node selection**: Improved selection colors and borders
- **Port opacity transitions**: Smooth visual feedback for connections
- **Improved handle styling**: Consistent StandardHandle implementation across all nodes
- **Better canvas preview**: Sharper rendering and improved visual quality

### 📊 Audio Analysis & Processing

- **Enhanced FFT support**: Better frequency analysis in JS blocks
- **Added RMS analysis**: Root mean square audio level detection with `getEnergy()`
- **Improved audio chaining**: Better routing and processing pipeline
- **New audio presets**: FFT visualization examples and analysis tools

### 🔧 Expression & Processing

- **expr~ enhancements**: 
  - Support for variables $1-$9
  - Added time variable `t` support
  - Run on exit functionality
- **P5.js improvements**:
  - Added pause/play controls
  - Better width/height handling based on canvas size
  - New text-banner functionality with `setHidePorts()`
- **Canvas node optimizations**: GPU pipeline improvements and performance enhancements

### 📚 Documentation & Presets

- **New example presets**:
  - Text banner P5 examples
  - Fractal tree visualizations  
  - Beat generation examples
  - Random walker demonstrations
  - FFT analysis presets
  - Music from image generation
- **Updated documentation**: Audio chaining, tools, rendering pipeline, and node descriptions
- **Improved examples**: Added samples from dtinth with slider integration

### 🛠️ Developer Experience

- **Copy-paste functionality**: Ability to duplicate nodes within patches
- **Fullscreen command**: Better workspace utilization
- **Improved mobile UI**: Better button visibility and touch interactions
- **Enhanced patch management**: 
  - Auto-save and restore functionality
  - Load patches from URLs
  - Share patches with others
  - Clear patch functionality
- **UI/UX refinements**:
  - Improved button contrast and sizing
  - Better NodeList usability
  - Command palette opacity adjustments
  - Object descriptions and autocomplete

### 🔄 System Improvements

- **Message passing enhancements**: Better `recv()` alias support and documentation
- **Performance optimizations**: Reduced backdrop blur for better performance, optimized rendering
- **Audio system improvements**: Better Web Audio context handling and click-to-play functionality
- **Node management**: Dynamic port counting, better edge cleanup, and lifecycle management

### 🐛 Bug Fixes & Stability

- **Fixed modulation issues**: Resolved audio modulation not working properly
- **Video chaining fixes**: Proper inlet/outlet handling for GLSL and Hydra nodes
- **Canvas rendering improvements**: Removed unnecessary clear operations and optimized offscreen rendering
- **Edge connection fixes**: Better validation and cleanup of invalid connections
- **Mobile responsiveness**: Fixed various mobile UI issues and touch interactions
- **Hydra production fixes**: Resolved chaining failures in production builds due to code mangling

### 📦 Presets & Examples Added

- `text-banner.p5` - Text display with customizable styling
- `fractal-tree.canvas` - Recursive tree generation
- `fft.canvas` - Audio frequency visualization  
- `pipe.js` - Message passing utilities
- `switcher.gl` - GLSL channel switching
- `overlay.gl` - Video overlay effects
- `add.hydra` / `sub.hydra` - Math operations in Hydra
- Various timer and animation presets with `requestAnimationFrame`
- Multiple RMS analysis variants
- Beat generation examples

