const LOG_MESSAGE_JS = `onMessage(message => console.log(message.data))`;

export const JS_PRESETS: Record<
	string,
	{ type: string; data: { code: string; showConsole?: boolean; runOnMount?: boolean } }
> = {
	'log_message.js': {
		type: 'js',
		data: { code: LOG_MESSAGE_JS.trim(), showConsole: true, runOnMount: true }
	}
};
