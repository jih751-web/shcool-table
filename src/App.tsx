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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
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
