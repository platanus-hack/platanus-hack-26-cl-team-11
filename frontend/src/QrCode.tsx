import QRCode from 'qrcode';
import { useMemo } from 'react';

const QUIET_ZONE = 2;

export function QrCode({ text, label }: { text: string; label: string }) {
  const { side, path } = useMemo(() => {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const cells: string[] = [];
    for (let row = 0; row < modules.size; row += 1) {
      for (let column = 0; column < modules.size; column += 1) {
        if (modules.get(row, column)) cells.push(`M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
      }
    }
    return { side: modules.size + QUIET_ZONE * 2, path: cells.join('') };
  }, [text]);

  return (
    <svg className="app-qr" viewBox={`0 0 ${side} ${side}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <path d={path} fill="currentColor" />
    </svg>
  );
}
