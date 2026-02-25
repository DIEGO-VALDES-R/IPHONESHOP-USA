// useCompany.ts — delega al DatabaseContext, sin queries propias
import { useDatabase } from '../contexts/DatabaseContext';

export function useCompany() {
  const { companyId, branchId, isLoading } = useDatabase();
  return { companyId, branchId, userId: null, isLoading };
}