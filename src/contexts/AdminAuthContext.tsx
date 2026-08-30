import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api';

export interface AdminUser {
  _id: string;
  username: string;
  name: string;
  email: string;
  role: 'superadmin';
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  adminToken: string | null;
  adminLoading: boolean;
  adminLogin: (username: string, password: string) => Promise<void>;
  adminLogout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(
    localStorage.getItem('adminToken')
  );
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('adminUser');
    if (adminToken && stored) {
      try { setAdmin(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setAdminLoading(false);
  }, [adminToken]);

  const adminLogin = async (username: string, password: string) => {
    const { data } = await api.post('/admin/login', { username, password });
    const { token, admin: adminData } = data.data;
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUser', JSON.stringify(adminData));
    // Temporarily set Authorization header for admin calls
    setAdminToken(token);
    setAdmin(adminData);
  };

  const adminLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setAdminToken(null);
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, adminToken, adminLoading, adminLogin, adminLogout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
};
