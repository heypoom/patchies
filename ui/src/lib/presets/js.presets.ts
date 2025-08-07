const MESSAGE_CONSOLE_JS = `onMessage(m => console.log(m))`;

const DELAY_JS = `onMessage(async (m) => {
  await delay(1000) // how long to wait for
  send(m)
})`;

const FRAME_TIMER_JS = `setInterval(() => {
  send({type: 'bang'})
}, 1000 / 60)`;

export const JS_PRESETS: Record<
	string,
	{ type: string; data: { code: string; showConsole?: boolean; runOnMount?: boolean } }
> = {
	'message-console.js': {
		type: 'js',
		data: { code: MESSAGE_CONSOLE_JS.trim(), showConsole: true, runOnMount: true }
	},
	'delay.js': {
		type: 'js',
		data: { code: DELAY_JS.trim(), showConsole: false, runOnMount: true }
	},
	'frame-timer.js': {
		type: 'js',
		data: { code: FRAME_TIMER_JS, showConsole: false, runOnMount: false }
	}
};
