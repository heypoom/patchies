export interface VfsFileReader {
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
}

export function createVfsFileReader(
  path: string,
  getUrl: (path: string) => Promise<string>
): VfsFileReader {
  const fetchFile = async () => fetch(await getUrl(path));

  return {
    arrayBuffer: async () => (await fetchFile()).arrayBuffer(),
    blob: async () => (await fetchFile()).blob(),
    json: async <T = unknown>() => (await fetchFile()).json() as Promise<T>,
    text: async () => (await fetchFile()).text()
  };
}
