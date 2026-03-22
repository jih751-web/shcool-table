import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import GlobalTimetablePage from './pages/GlobalTimetablePage';
import MyTimetablePage from './pages/MyTimetablePage';
import StatusPage from './pages/StatusPage'; // 교체 현황판 모듈
import EventsPage from './pages/EventsPage';
import SpecialRoomPage from './pages/SpecialRoomPage';
import NotificationToast from './components/NotificationToast';

import AdminUserPage from './pages/AdminUserPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center animate-pulse">
          <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-brand-700 font-black text-sm tracking-widest uppercase">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  
  return (
    <>
      {children}
      <NotificationToast />
    </>
  );
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { userData, loading } = useAuth();
  
  if (loading) return null;
  if (!userData?.isAdmin) return <Navigate to="/dashboard" replace />;
  
  return (
    <>
      {children}
      <NotificationToast />
    </>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/global" 
        element={
          <ProtectedRoute>
            <GlobalTimetablePage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/mytimetable" 
        element={
          <ProtectedRoute>
            <MyTimetablePage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/events" 
        element={
          <ProtectedRoute>
            <EventsPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/rooms" 
        element={
          <ProtectedRoute>
            <SpecialRoomPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/status" 
        element={
          <ProtectedRoute>
            <StatusPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin/users" 
        element={
          <AdminRoute>
            <AdminUserPage />
          </AdminRoute>
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
