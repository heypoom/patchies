export type SendVideoRenderNode = {
  type: 'send.vdo';
  data: {
    channel: string;
    shorthand?: boolean;
  };
};
