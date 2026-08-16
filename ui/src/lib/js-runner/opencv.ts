type OpenCvModule = {
  Mat?: unknown;
  onRuntimeInitialized?: () => void;
};

type EsmLoader = (name: string) => Promise<unknown>;

let openCvPromise: Promise<OpenCvModule> | null = null;

async function waitForOpenCv(module: OpenCvModule | Promise<OpenCvModule>): Promise<OpenCvModule> {
  const cv = await module;

  if (cv.Mat) return cv;

  await new Promise<void>((resolve) => {
    cv.onRuntimeInitialized = resolve;
  });

  return cv;
}

/** Load OpenCV.js once per JavaScript realm and wait for its WASM runtime. */
export function opencv(esm: EsmLoader): Promise<OpenCvModule> {
  openCvPromise ??= esm('@techstark/opencv-js').then((imported) => {
    const module = (imported as { default?: unknown }).default ?? imported;

    return waitForOpenCv(module as OpenCvModule | Promise<OpenCvModule>);
  });

  return openCvPromise;
}
