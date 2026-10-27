import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  format?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  lineColor?: string;
  background?: string;
  className?: string;
}

export const Barcode: React.FC<BarcodeProps> = ({
  value,
  format = 'CODE128',
  width = 1.6,
  height = 36,
  displayValue = true,
  fontSize = 12,
  lineColor = '#000000',
  background = '#ffffff',
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      // Clean value to alphanumeric or standard symbols for CODE128
      const cleanVal = String(value).trim();
      if (!cleanVal) return;

      JsBarcode(svgRef.current, cleanVal, {
        format,
        width,
        height,
        displayValue,
        fontSize,
        font: 'monospace',
        textMargin: 2,
        margin: 4,
        lineColor,
        background
      });
    } catch (err) {
      console.warn('Barcode rendering error:', err);
    }
  }, [value, format, width, height, displayValue, fontSize, lineColor, background]);

  if (!value) return null;

  return (
    <svg 
      ref={svgRef} 
      className={`max-w-full h-auto rounded ${className}`}
    />
  );
};

export default Barcode;
