const RAIN_TM = `let drops = []

tm.setup(() => {
  tm.fontSize(14)
  tm.frameRate(20)

  for (let i = 0; i < 50; i++) {
    drops.push({
      x: Math.random() * tm.grid.cols,
      y: Math.random() * tm.grid.rows,
      speed: 0.5 + Math.random() * 1.5,
      char: ['|', '/', '\\\\', ':'][Math.floor(Math.random() * 4)]
    })
  }
})

tm.draw(() => {
  tm.background(0, 0, 0, 0)

  for (const drop of drops) {
    tm.push()
    tm.translate(
      drop.x - tm.grid.cols / 2,
      drop.y - tm.grid.rows / 2,
      0
    )
    tm.char(drop.char)
    tm.charColor(100, 150, 255)
    tm.point()
    tm.pop()

    drop.y += drop.speed
    if (drop.y > tm.grid.rows) {
      drop.y = -1
      drop.x = Math.random() * tm.grid.cols
    }
  }
})`;

const TORUS_TM = `let A = 0
let B = 0

tm.setup(() => {
  tm.fontSize(10)
  tm.frameRate(30)
})

tm.draw(() => {
  tm.background(0, 0, 0, 0)

  const cols = tm.grid.cols
  const rows = tm.grid.rows
  const output = Array(cols * rows).fill(' ')
  const zbuffer = Array(cols * rows).fill(0)

  const R1 = 1, R2 = 2
  const K2 = 5
  const K1 = cols * K2 * 3 / (8 * (R1 + R2))

  for (let theta = 0; theta < 6.28; theta += 0.07) {
    for (let phi = 0; phi < 6.28; phi += 0.02) {
      const cosA = Math.cos(A), sinA = Math.sin(A)
      const cosB = Math.cos(B), sinB = Math.sin(B)
      const cosTheta = Math.cos(theta), sinTheta = Math.sin(theta)
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi)

      const circleX = R2 + R1 * cosTheta
      const circleY = R1 * sinTheta

      const x = circleX * (cosB * cosPhi + sinA * sinB * sinPhi) - circleY * cosA * sinB
      const y = circleX * (sinB * cosPhi - sinA * cosB * sinPhi) + circleY * cosA * cosB
      const z = K2 + cosA * circleX * sinPhi + circleY * sinA
      const ooz = 1 / z

      const xp = Math.floor(cols / 2 + K1 * ooz * x)
      const yp = Math.floor(rows / 2 - K1 * ooz * y * 0.5)

      const L = cosPhi * cosTheta * sinB - cosA * cosTheta * sinPhi -
                sinA * sinTheta + cosB * (cosA * sinTheta - cosTheta * sinA * sinPhi)

      if (L > 0 && xp >= 0 && xp < cols && yp >= 0 && yp < rows) {
        const idx = xp + yp * cols
        if (ooz > zbuffer[idx]) {
          zbuffer[idx] = ooz
          const luminanceIndex = Math.floor(L * 8)
          output[idx] = '.,-~:;=!*#$@'[Math.max(0, Math.min(11, luminanceIndex))]
        }
      }
    }
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const char = output[x + y * cols]
      if (char !== ' ') {
        tm.push()
        tm.translate(x - cols / 2, y - rows / 2, 0)
        tm.char(char)
        tm.charColor(255, 200, 100)
        tm.point()
        tm.pop()
      }
    }
  }

  A += 0.04
  B += 0.02
})`;

const FIRE_TM = `const palette = ' .:*oO#@'
const colors = [
  [0, 0, 0],
  [32, 0, 0],
  [64, 16, 0],
  [128, 32, 0],
  [192, 64, 0],
  [255, 128, 0],
  [255, 192, 64],
  [255, 255, 128]
]
let buffer = []

tm.setup(() => {
  tm.fontSize(10)
  tm.frameRate(20)
  buffer = Array(tm.grid.cols * tm.grid.rows).fill(0)
})

tm.draw(() => {
  tm.background(0, 0, 0, 0)

  const cols = tm.grid.cols
  const rows = tm.grid.rows

  // Seed bottom row with random values
  for (let x = 0; x < cols; x++) {
    buffer[x + (rows - 1) * cols] = Math.random() > 0.5 ? 7 : 0
  }

  // Propagate fire upward
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols; x++) {
      const src = ((x - 1 + cols) % cols) + (y + 1) * cols
      const decay = Math.floor(Math.random() * 2)
      const newVal = Math.max(0, buffer[src] - decay)
      buffer[x + y * cols] = newVal
    }
  }

  // Render
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const val = buffer[x + y * cols]
      if (val > 0) {
        tm.push()
        tm.translate(x - cols / 2, y - rows / 2, 0)
        tm.char(palette[val])
        tm.charColor(...colors[val])
        tm.point()
        tm.pop()
      }
    }
  }
})`;

const DIGITAL_RAIN_TM = `/**
 * @name [textmode.js] Digital Rain
 * @description Matrix-style falling digital rain using character-based graphics.
 * @author humanbydefinition
 * @link https://github.com/humanbydefinition/textmode.js
 */

const drops = [];
const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

tm.setup(() => {
  tm.fontSize(16)
  tm.frameRate(60)

  // Initialize rain drops
  for (let gridX = 0; gridX < tm.grid.cols; gridX++) {
    drops[gridX] = {
      y: Math.random() * -50,
      speed: Math.random() * 0.3 + 0.1,
      length: Math.floor(Math.random() * 15) + 5,
      chars: []
    };
    
    // Generate random characters for this drop
    for (let i = 0; i < drops[gridX].length; i++) {
      drops[gridX].chars[i] = chars[Math.floor(Math.random() * chars.length)];
    }
  }
});


tm.draw(() => {
  tm.background(0);

  // Update and draw each rain drop
  for (let gridX = 0; gridX < drops.length; gridX++) {
    const drop = drops[gridX];
    
    // Draw the trail
    for (let i = 0; i < drop.length; i++) {
      const gridY = drop.y - i;
      
      if (gridY >= 0 && gridY < tm.grid.rows) {
        // Calculate fade based on position in trail
        const fade = (drop.length - i) / drop.length;
        
        // Head of the trail is brightest white
        if (i === 0) {
          tm.charColor(255, 255, 255);
        } else {
          // Body fades from bright green to dark green
          const green = Math.floor(255 * fade * 0.8);
          tm.charColor(0, green, 0);
        }
        
        // Occasionally change character for glitch effect
        if (Math.random() < 0.1) {
          drop.chars[i] = chars[Math.floor(Math.random() * chars.length)];
        }
        
        tm.char(drop.chars[i]);
        tm.cellColor(0, 0, 0);
        
        // Convert grid coordinates to center-based coordinates
        const x = (gridX + 1) - tm.grid.cols / 2;
        const y = Math.floor(gridY) - tm.grid.rows / 2;
        
        tm.push();
        tm.translate(x, y, 0);
        tm.rect(1, 1);
        tm.pop();
      }
    }
    
    // Update drop position
    drop.y += drop.speed;
    
    // Reset drop when it goes off screen
    if (drop.y - drop.length > tm.grid.rows) {
      drop.y = Math.random() * -50;
      drop.speed = Math.random() * 0.3 + 0.1;
      drop.length = Math.floor(Math.random() * 15) + 5;
      
      // Generate new random characters
      for (let i = 0; i < drop.length; i++) {
        drop.chars[i] = chars[Math.floor(Math.random() * chars.length)];
      }
    }
  }
})`;

const ANIMATED_WAVE_TM = `/**
 * @name [textmode.js] Animated Wave Pattern
 * @description A sine wave interference pattern using character-based graphics.
 * @author humanbydefinition
 * @link https://github.com/humanbydefinition/textmode.js
 */

tm.draw(() => {
  tm.background(0);

  const time = tm.frameCount * 0.01;
  const step = 3;
  
  for (let gridY = 0; gridY < tm.grid.rows + step; gridY += step) {
      for (let gridX = 0; gridX < tm.grid.cols + step; gridX += step) {
          // Calculate distance from center (in grid coordinates)
          const dx = gridX - tm.grid.cols / 2;
          const dy = gridY - tm.grid.rows / 2;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Create ripple effect
          const wave = Math.sin(distance * 0.3 - time * 8) * 0.5 + 0.5;
          
          // Add secondary wave for interference
          const wave2 = Math.sin(gridX * 0.2 + time * 4) * Math.sin(gridY * 0.15 + time * 3);
          const combined = (wave + wave2 * 0.3) / 1.3;
          
          // Map to characters based on wave intensity
          if (combined > 0.7) {
              tm.char('#');
              tm.charColor(255, 200, 100);
          } else if (combined > 0.5) {
              tm.char('@');
              tm.charColor(200, 150, 255);
          } else if (combined > 0.3) {
              tm.char('%');
              tm.charColor(100, 255, 200);
          } else if (combined > 0.1) {
              tm.char('.');
              tm.charColor(150, 100, 255);
          } else {
              tm.char(' ');
          }
          
          // Convert grid coordinates to center-based coordinates
          const x = gridX + 1 - tm.grid.cols / 2;
          const y = gridY - tm.grid.rows / 2;
          
          tm.push();
          tm.translate(x, y, 0);
          tm.cellColor(0, 0, 0);
          tm.rect(step, step);
          tm.pop();
      }
  }
})`;

const PLASMA_FIELD_TM = `/**
 * @name [textmode.js] Plasma Field
 * @description A colorful plasma field effect using multiple sine waves.
 * @author humanbydefinition
 * @link https://github.com/humanbydefinition/textmode.js
 */

tm.draw(() => {
    tm.background(0);

    const time = tm.frameCount * 0.02;
    
    for (let gridY = 0; gridY < tm.grid.rows; gridY++) {
        for (let gridX = 0; gridX < tm.grid.cols; gridX++) {
            // Normalize coordinates
            const nx = gridX / tm.grid.cols;
            const ny = gridY / tm.grid.rows;
            
            // Create multiple plasma waves
            const plasma1 = Math.sin(nx * 8 + time);
            const plasma2 = Math.sin(ny * 6 + time * 1.3);
            const plasma3 = Math.sin((nx + ny) * 4 + time * 0.8);
            const plasma4 = Math.sin(Math.sqrt(nx * nx + ny * ny) * 12 + time * 1.5);
            
            // Combine plasma values
            const combined = (plasma1 + plasma2 + plasma3 + plasma4) / 4;
            const intensity = (combined + 1) / 2; // Normalize to 0-1
            
            // Create rainbow color cycling
            const hue = (intensity + time * 0.5) % 1;
            const saturation = 1.0;
            const lightness = intensity;
            
            // Convert HSL to RGB
            const hsl2rgb = (h, s, l) => {
                const c = (1 - Math.abs(2 * l - 1)) * s;
                const x = c * (1 - Math.abs((h * 6) % 2 - 1));
                const m = l - c / 2;
                let r, g, b;
                
                if (h < 1/6) [r, g, b] = [c, x, 0];
                else if (h < 2/6) [r, g, b] = [x, c, 0];
                else if (h < 3/6) [r, g, b] = [0, c, x];
                else if (h < 4/6) [r, g, b] = [0, x, c];
                else if (h < 5/6) [r, g, b] = [x, 0, c];
                else [r, g, b] = [c, 0, x];
                
                return [
                    Math.floor((r + m) * 255),
                    Math.floor((g + m) * 255),
                    Math.floor((b + m) * 255)
                ];
            };
            
            const [r, g, b] = hsl2rgb(hue, saturation, lightness);
            
            // Map intensity to characters
            if (intensity > 0.8) {
                tm.char('█');
            } else if (intensity > 0.6) {
                tm.char('▓');
            } else if (intensity > 0.4) {
                tm.char('▒');
            } else if (intensity > 0.2) {
                tm.char('░');
            } else if (intensity > 0.1) {
                tm.char('·');
            } else {
                tm.char(' ');
            }
            
            tm.charColor(r, g, b);
            tm.cellColor(0, 0, 0);
            
            // Convert grid coordinates to center-based coordinates
            const x = (gridX + 1) - tm.grid.cols / 2;
            const y = gridY - tm.grid.rows / 2;
            
            tm.push();
            tm.translate(x, y, 0);
            tm.rect(1, 1);
            tm.pop();
        }
    }
})`;

export const TEXTMODE_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'digital-rain.tm': { type: 'textmode', data: { code: DIGITAL_RAIN_TM.trim() } },
	'animated-wave.tm': { type: 'textmode', data: { code: ANIMATED_WAVE_TM.trim() } },
	'plasma-field.tm': { type: 'textmode', data: { code: PLASMA_FIELD_TM.trim() } },
	'rain.tm': { type: 'textmode', data: { code: RAIN_TM.trim() } },
	'torus.tm': { type: 'textmode', data: { code: TORUS_TM.trim() } },
	'fire.tm': { type: 'textmode', data: { code: FIRE_TM.trim() } }
};
