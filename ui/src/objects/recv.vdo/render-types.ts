export type RecvVideoRenderNode = {
  type: 'recv.vdo';
  data: {
    channel: string;
    shorthand?: boolean;
  };
};
