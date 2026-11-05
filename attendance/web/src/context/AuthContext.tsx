import {
  createContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import api from '../api/index';

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  employee: any;
  login: (data: any) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  employee: null,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);

  /*
   * Check existing authentication
   */
  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('access_token');

      if (!token) {
        setIsAuthenticated(false);
        setUser(null);
        setEmployee(null);
        setIsLoading(false);
        return;
      }

      /*
       * Admin authentication
       *
       * Admin user information is already stored
       * during login, so don't call /employees/me/.
       */
      const userStr = localStorage.getItem('user');

      if (userStr) {
        try {
          const storedUser = JSON.parse(userStr);

          if (
            ['SUPER_ADMIN', 'HR', 'ADMIN', 'REPORTING_MANAGER'].includes(storedUser?.role)
          ) {
            setUser(storedUser);
            setEmployee(null);
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error(
            'Unable to read stored user:',
            error
          );

          localStorage.removeItem('user');
        }
      }

      /*
       * Employee authentication
       *
       * Employee profile is fetched from backend.
       */
      const response = await api.get('/employees/me/');

      setEmployee(response.data);

      if (response.data?.user) {
        setUser(response.data.user);

        localStorage.setItem(
          'user',
          JSON.stringify(response.data.user)
        );
      }

      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Authentication check failed:', error);

      /*
       * Only remove authentication when backend
       * explicitly says the token is invalid.
       *
       * Network/server errors should NOT immediately
       * log the user out.
       */
      if (error?.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');

        setIsAuthenticated(false);
        setUser(null);
        setEmployee(null);
      } else {
        /*
         * If we already have a token, keep the current
         * authentication state during temporary network
         * problems.
         */
        const tokenExists =
          !!localStorage.getItem('access_token');

        setIsAuthenticated(tokenExists);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /*
   * Check authentication when application starts
   */
  useEffect(() => {
    checkAuth();
  }, []);

  /*
   * Login
   *
   * Called from Login.tsx after successful API login.
   */
  const login = (data: any) => {
    if (!data?.access || !data?.refresh || !data?.user) {
      console.error(
        'Invalid login response:',
        data
      );
      return;
    }

    /*
     * Save JWT tokens
     */
    localStorage.setItem(
      'access_token',
      data.access
    );

    localStorage.setItem(
      'refresh_token',
      data.refresh
    );

    /*
     * Save user
     */
    localStorage.setItem(
      'user',
      JSON.stringify(data.user)
    );

    /*
     * Admin
     */
    if (
      ['SUPER_ADMIN', 'HR', 'ADMIN'].includes(data.user.role)
    ) {
      setUser(data.user);
      setEmployee(null);
      setIsAuthenticated(true);
      setIsLoading(false);

      return;
    }

    /*
     * Employee
     */
    setUser(data.user);
    setIsAuthenticated(true);

    /*
     * Fetch complete employee profile
     */
    checkAuth();
  };

  /*
   * Logout
   */
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    setIsAuthenticated(false);
    setIsLoading(false);
    setUser(null);
    setEmployee(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        employee,
        login,
        logout,
        refreshUser: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

