import QRCode from 'qrcode';

export default async function SlipQr({ value, size = 120 }: { value: string; size?: number }) {
  const src = await QRCode.toDataURL(value, { margin: 1, width: size * 3, errorCorrectionLevel: 'M' });
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={value} />;
}