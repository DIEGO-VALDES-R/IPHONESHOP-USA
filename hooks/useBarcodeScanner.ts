import { useEffect, useRef, useState } from 'react';

/**
 * Hook para manejar lectores de códigos de barras
 * Los lectores de códigos de barras se comportan como teclados que escriben rápidamente
 * y terminan con Enter. Este hook detecta esa secuencia.
 */
export const useBarcodeScanner = (onScan: (barcode: string) => void) => {
  const barcodeBufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input de búsqueda o texto
      const target = event.target as HTMLElement;
      const isInputField = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.contentEditable === 'true';

      // Si es un input de búsqueda específico, permitir que funcione normalmente
      if (isInputField && (target as HTMLInputElement).placeholder?.includes('Buscar')) {
        return;
      }

      // Detectar tecla Enter - fin de escaneo
      if (event.key === 'Enter' && barcodeBufferRef.current.length > 0) {
        event.preventDefault();
        setIsScanning(false);
        onScan(barcodeBufferRef.current);
        barcodeBufferRef.current = '';
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return;
      }

      // Detectar caracteres imprimibles (códigos de barras típicos)
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        // No es un input de texto, entonces es probablemente un escaneo
        if (!isInputField) {
          event.preventDefault();
          setIsScanning(true);
          barcodeBufferRef.current += event.key;

          // Resetear timeout si existe
          if (timeoutRef.current) clearTimeout(timeoutRef.current);

          // Timeout de seguridad: si no hay Enter en 2 segundos, limpiar buffer
          timeoutRef.current = setTimeout(() => {
            barcodeBufferRef.current = '';
            setIsScanning(false);
          }, 2000);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onScan]);

  return { isScanning };
};