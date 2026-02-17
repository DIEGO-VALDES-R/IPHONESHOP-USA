import { supabase } from '../supabaseClient';

export interface Customer {
  id?: string;
  company_id: string;
  name: string;
  document_type?: string;
  document_number?: string;
  email?: string;
  phone?: string;
  address?: string;
  credit_limit?: number;
}

export const customerService = {
  async getAll(company_id: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers').select('*')
      .eq('company_id', company_id).order('name');
    if (error) throw error;
    return data || [];
  },

  async create(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers').insert(customer).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async search(company_id: string, query: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers').select('*')
      .eq('company_id', company_id)
      .or(`name.ilike.%${query}%,document_number.ilike.%${query}%,phone.ilike.%${query}%`);
    if (error) throw error;
    return data || [];
  }
};
