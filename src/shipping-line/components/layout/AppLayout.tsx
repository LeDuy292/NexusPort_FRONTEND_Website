import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '../common/Toast';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-sub">
      <Sidebar />
      <Topbar />
      <main className="ml-[240px] pt-[56px] min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
    </div>
  );
};

