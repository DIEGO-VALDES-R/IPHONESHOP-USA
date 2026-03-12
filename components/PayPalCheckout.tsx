import { useEffect, useRef } from 'react';

interface PayPalCheckoutProps {
  clientId: string;
  env: 'production' | 'sandbox';
  amount: number;
  currency?: string;
  onApprove: (orderId: string) => void;
  onError: () => void;
  setLoading: (v: boolean) => void;
}

const PayPalCheckout: React.FC<PayPalCheckoutProps> = ({
  clientId, env, amount, currency = 'USD', onApprove, onError, setLoading,
}) => {
  const rendered = useRef(false);

  useEffect(() => {
    if (rendered.current || !clientId || amount <= 0) return;
    rendered.current = true;

    const containerId = 'paypal-button-container';
    const scriptId = 'paypal-sdk-script';

    const render = () => {
      const win = window as any;
      if (!win.paypal) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      setLoading(false);

      // Convertir COP → USD aproximado si la moneda es COP
      // PayPal requiere USD para la mayoría de cuentas latam
      const usdAmount = currency === 'USD'
        ? amount.toFixed(2)
        : (amount / 4200).toFixed(2); // tasa aproximada COP/USD

      win.paypal.Buttons({
        style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },
        createOrder: (_data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [{ amount: { value: usdAmount, currency_code: 'USD' } }],
          });
        },
        onApprove: (_data: any, actions: any) => {
          return actions.order.capture().then((details: any) => {
            onApprove(details.id);
          });
        },
        onError: () => { onError(); },
      }).render(`#${containerId}`);
    };

    // Si ya está cargado el SDK
    if ((window as any).paypal) { render(); return; }

    // Cargar el SDK
    setLoading(true);
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture${env === 'sandbox' ? '&debug=true' : ''}`;
    script.async = true;
    script.onload = render;
    script.onerror = () => { setLoading(false); onError(); };
    document.body.appendChild(script);

    return () => {
      // Limpiar botones al desmontar
      const c = document.getElementById(containerId);
      if (c) c.innerHTML = '';
    };
  }, [clientId, env, amount]);

  return null;
};

export default PayPalCheckout;
