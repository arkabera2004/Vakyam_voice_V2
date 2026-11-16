// Barrel: provider, context and hook live in separate files so Fast Refresh
// sees component-only modules. Import sites keep using "@/contexts/AuthContext".
export { AuthProvider } from './AuthProvider';
export { AuthContext, type AuthContextType } from './auth-context';
export { useAuth } from './useAuth';
