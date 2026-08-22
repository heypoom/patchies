export interface ConnectionDetails {
  instanceURL: string;
  sessionID: string;
  secret: string;
}

const CONNECTION_SCHEME = 'patchies://v2/';

export const createConnectionString = (details: ConnectionDetails): string => {
  const payload = JSON.stringify({
    instanceURL: new URL(details.instanceURL).origin,
    sessionID: details.sessionID,
    secret: details.secret
  });

  return CONNECTION_SCHEME + toBase64URL(payload);
};

const toBase64URL = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};
