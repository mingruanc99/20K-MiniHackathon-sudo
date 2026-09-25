// src/components/layout/AppLayout.tsx
import React from 'react';
import { Navbar } from './Navbar';
import { PRODUCT_NAME } from '../../config/brand';

/** Every signed-in route, lecturer flow and "Nâng cao" alike, lives in the logbook world. */
export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="ledger-world flex min-h-screen flex-col bg-paper">
    <Navbar />
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    <footer className="border-t border-rule py-4 text-center text-xs text-ink-faint">{PRODUCT_NAME} · chạy trên biểu diễn bài giảng CLSG-IR</footer>
  </div>
);
