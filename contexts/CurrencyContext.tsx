import React, { createContext, useContext, useState, ReactNode } from 'react';

export type CurrencyCode = 'COP' | 'USD' | 'EUR';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  formatMoney: (amount: number) => string;
  convert: (amount: number) => number;
  exchangeRates: Record<CurrencyCode, number>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Tasas de cambio base (Base: COP)
// En un sistema real, esto vendría de una API externa (ej. OpenExchangeRates)
const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  COP: 1,
  USD: 0.00025, // 1 COP = 0.00025 USD (Aprox 1 USD = 4000 COP)
  EUR: 0.00023, // 1 COP = 0.00023 EUR (Aprox 1 EUR = 4300 COP)
};

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrency] = useState<CurrencyCode>('COP');

  const convert = (amountInCOP: number) => {
    return amountInCOP * EXCHANGE_RATES[currency];
  };

  const formatMoney = (amountInCOP: number) => {
    const convertedAmount = convert(amountInCOP);
    
    return new Intl.NumberFormat(currency === 'COP' ? 'es-CO' : 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'COP' ? 0 : 2,
      maximumFractionDigits: currency === 'COP' ? 0 : 2,
    }).format(convertedAmount);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatMoney, convert, exchangeRates: EXCHANGE_RATES }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};