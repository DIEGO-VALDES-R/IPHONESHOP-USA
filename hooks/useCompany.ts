import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface CompanyContext {
  companyId: string | null;
  branchId: string | null;
  userId: string | null;
  isLoading: boolean;
}

let cached: CompanyContext | null = null;

export function useCompany(): CompanyContext {
  const [ctx, setCtx] = useState<CompanyContext>(
    cached || { companyId: null, branchId: null, userId: null, isLoading: true }
  );

  useEffect(() => {
    if (cached) { setCtx(cached); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const result = { companyId: null, branchId: null, userId: null, isLoading: false };
        cached = result; setCtx(result); return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, branch_id')
        .eq('id', user.id)
        .single();
      const result = {
        companyId: profile?.company_id || null,
        branchId: profile?.branch_id || null,
        userId: user.id,
        isLoading: false,
      };
      cached = result;
      setCtx(result);
    })();
  }, []);

  return ctx;
}
