import type { PdPort } from './pd-patch';

export type PdMessageInletLayout = {
  key: string;
  handleId: number;
  position: number;
  title: string;
};

export function getPdMessageInletLayout(messageInputs: PdPort[]): PdMessageInletLayout[] {
  const customInlets = messageInputs.map((port, index) => ({
    key: port.id,
    handleId: index + 2,
    position: index + 1,
    title: port.label
  }));

  return [
    ...customInlets,
    {
      key: 'pd-controls',
      handleId: 1,
      position: messageInputs.length + 1,
      title: 'Pd controls (load/set)'
    }
  ];
}
