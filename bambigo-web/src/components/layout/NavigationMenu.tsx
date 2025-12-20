'use client';

import React, { useState } from 'react';
import { X, ChevronRight, Settings, Globe, User, Shield, HelpCircle, LogOut, Moon, Sun } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Locale } from '../../i18n/dictionary';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
  action?: () => void;
}

interface NavigationMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NavigationMenu({ isOpen, onClose }: NavigationMenuProps) {
  const { t, locale, setLocale } = useLanguage();
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false); // In real app, use a theme context

  // Toggle Theme Mock
  const toggleTheme = () => {
    setDarkMode(!darkMode);
    // document.documentElement.classList.toggle('dark');
  };

  const menuItems: MenuItem[] = [
    {
      id: 'settings',
      label: t('common.settings'),
      icon: <Settings className="w-5 h-5" />,
      children: [
        {
          id: 'language',
          label: t('common.language'),
          icon: <Globe className="w-4 h-4" />,
          children: [
            { id: 'lang-en', label: 'English', action: () => setLocale('en') },
            { id: 'lang-ja', label: '日本語', action: () => setLocale('ja') },
            { id: 'lang-zh', label: '繁體中文', action: () => setLocale('zh-TW') },
          ]
        },
        {
          id: 'theme',
          label: t('common.theme'),
          icon: darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
          children: [
            { id: 'theme-light', label: t('common.lightMode'), action: () => setDarkMode(false) },
            { id: 'theme-dark', label: t('common.darkMode'), action: () => setDarkMode(true) },
          ]
        }
      ]
    },
    {
      id: 'profile',
      label: t('common.profile'),
      icon: <User className="w-5 h-5" />,
      action: () => alert('Profile clicked')
    },
    {
      id: 'safety',
      label: t('common.safetyCenter'),
      icon: <Shield className="w-5 h-5" />,
      children: [
        { id: 'sos', label: t('common.emergencyContacts'), action: () => alert('SOS') },
        { id: 'guide', label: t('common.safetyGuide'), action: () => alert('Guide') },
      ]
    },
    {
      id: 'help',
      label: t('common.helpSupport'),
      icon: <HelpCircle className="w-5 h-5" />,
      action: () => alert('Help clicked')
    }
  ];

  // Helper to render menu level
  const renderMenuLevel = (items: MenuItem[], depth = 0) => {
    return (
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = activeSubmenu === item.id;

          return (
            <div key={item.id} className="w-full">
              <button
                onClick={() => {
                  if (hasChildren) {
                    setActiveSubmenu(isExpanded ? null : item.id);
                  } else {
                    item.action?.();
                    if (item.id.startsWith('lang-') || item.id.startsWith('theme-')) {
                      // Optional: close on selection
                    }
                  }
                }}
                className={`
                  w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200
                  ${depth > 0 ? 'pl-8' : ''}
                  hover:bg-gray-100 active:bg-gray-200
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                `}
                aria-expanded={hasChildren ? isExpanded : undefined}
              >
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-gray-500">{item.icon}</span>}
                  <span className="text-gray-800 font-medium">{item.label}</span>
                </div>
                {hasChildren && (
                  <ChevronRight 
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                  />
                )}
              </button>
              
              {/* Recursive Submenu */}
              {hasChildren && isExpanded && (
                <div className="mt-1 animate-in slide-in-from-top-2 fade-in duration-200">
                  {renderMenuLevel(item.children!, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-[1000] transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sidebar */}
      <div
        className={`absolute top-0 left-0 bottom-0 w-[85%] max-w-sm bg-white shadow-2xl transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-bottom flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t('common.menu') || 'Menu'}</h2>
              <p className="text-xs text-slate-500 font-medium">{t('common.settings')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Quick Language Switch (Mobile Optimized) */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
              {t('common.language') || 'Language'}
            </h3>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {[
                { id: 'zh-TW', label: '繁中' },
                { id: 'en', label: 'EN' },
                { id: 'ja', label: '日本語' }
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setLocale(lang.id as Locale)}
                  className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                    locale === lang.id
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </section>

          {/* Menu Items */}
          <nav className="space-y-1">
            {renderMenuLevel(menuItems)}
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button 
            className="w-full flex items-center gap-3 p-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            onClick={() => alert('Logout')}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{t('common.signOut')}</span>
          </button>
          <div className="mt-4 text-xs text-center text-gray-400">
            v1.2.0 • BambiGO
          </div>
        </div>
      </div>
    </div>
  );
}
