const LOG_MESSAGE_JS = `onMessage(message => console.log(message.data))`;

const DELAY_JS = `onMessage(async (m) => {
  await delay(1000) // how long to wait for
  send(m.data)
})`;

export const JS_PRESETS: Record<
	string,
	{ type: string; data: { code: string; showConsole?: boolean; runOnMount?: boolean } }
> = {
	'log_message.js': {
		type: 'js',
		data: { code: LOG_MESSAGE_JS.trim(), showConsole: true, runOnMount: true }
	},
	'delay.js': {
		type: 'js',
		data: { code: DELAY_JS.trim(), showConsole: false, runOnMount: true }
	}
};
