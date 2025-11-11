import QRCode from 'qrcode';

export async function makePngDataUrl(text: string, ecc: 'L'|'M'|'Q'|'H' = 'M') {
  const buf = await QRCode.toBuffer(text, { errorCorrectionLevel: ecc });
  return `data:image/png;base64,${buf.toString('base64')}`;
}

export async function makeSvgDataUrl(text: string, ecc: 'L'|'M'|'Q'|'H' = 'M') {
  const svg = await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: ecc });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
