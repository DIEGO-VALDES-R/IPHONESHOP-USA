import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface CompanyContext {
  companyId: string | null;
  branchId: string | null;
  userId: string | null;
  isLoading: boolean;
}

// NO usar cache global — el MASTER cambia de empresa dinamicamente
export function useCompany(): CompanyContext {
  const [ctx, setCtx] = useState<CompanyContext>(
    { companyId: null, branchId: null, userId: null, isLoading: true }
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCtx({ companyId: null, branchId: null, userId: null, isLoading: false });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, branch_id, role')
        .eq('id', user.id)
        .single();

      // Si es MASTER, usar la empresa guardada en localStorage
      if (profile?.role === 'MASTER') {
        const masterCompany = localStorage.getItem('master_selected_company');

        if (masterCompany) {
          // Buscar branch de esa empresa
          const { data: branches } = await supabase
            .from('branches')
            .select('id')
            .eq('company_id', masterCompany)
            .limit(1);

          setCtx({
            companyId: masterCompany,
            branchId: branches && branches.length > 0 ? branches[0].id : null,
            userId: user.id,
            isLoading: false,
          });
        } else {
          setCtx({ companyId: null, branchId: null, userId: user.id, isLoading: false });
        }
        return;
      }

      // Usuario normal: usar su company_id del perfil
      setCtx({
        companyId: profile?.company_id || null,
        branchId:  profile?.branch_id  || null,
        userId:    user.id,
        isLoading: false,
      });
    })();
  }, []);

  return ctx;
}
