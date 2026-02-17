import { supabase } from '../supabaseClient';
import { productService } from './productService';

export interface InvoiceItem {
  product_id: string;
  quantity: number;
  price: number;
  tax_rate: number;
  discount?: number;
  serial_number?: string;
}

export interface Invoice {
  id?: string;
  company_id: string;
  branch_id: string;
  invoice_number?: string;
  customer_id?: string;
  user_id?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount?: number;
  total_amount: number;
  status?: string;
  payment_method?: Record<string, any>;
}

export const invoiceService = {
  async getAll(company_id: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(name), invoice_items(*)')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(invoice: Invoice, items: InvoiceItem[]): Promise<any> {
    const { count } = await supabase
      .from('invoices').select('*', { count: 'exact', head: true })
      .eq('company_id', invoice.company_id);
    const invoiceNumber = `POS-${String((count || 0) + 1).padStart(6, '0')}`;

    const { data: newInvoice, error: invErr } = await supabase
      .from('invoices')
      .insert({ ...invoice, invoice_number: invoiceNumber })
      .select().single();
    if (invErr) throw invErr;

    const { error: itemsErr } = await supabase
      .from('invoice_items')
      .insert(items.map(i => ({ ...i, invoice_id: newInvoice.id })));
    if (itemsErr) throw itemsErr;

    for (const item of items) {
      await productService.decrementStock(item.product_id, item.quantity);
    }

    return newInvoice;
  },

  async getSalesByDay(company_id: string, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data, error } = await supabase
      .from('invoices')
      .select('created_at, total_amount')
      .eq('company_id', company_id)
      .gte('created_at', since.toISOString());
    if (error) throw error;

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const grouped: Record<string, number> = {};
    (data || []).forEach(inv => {
      const d = dayNames[new Date(inv.created_at).getDay()];
      grouped[d] = (grouped[d] || 0) + inv.total_amount;
    });
    return Object.entries(grouped).map(([name, sales]) => ({ name, sales }));
  }
};
