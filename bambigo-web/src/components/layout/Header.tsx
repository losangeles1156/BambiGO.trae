'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, Search, User, Sparkles, ChevronDown, Globe, ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '../../contexts/LanguageContext';
import { Locale } from '../../i18n/dictionary';
import { LanguageSelector } from './LanguageSelector';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

interface HeaderProps {
  onMenuClick?: () => void;
  breadcrumbs?: BreadcrumbItem[];
  locationName?: string;
}

export default function Header({ onMenuClick, breadcrumbs = [], locationName }: HeaderProps) {
  const [elderlyMode] = useState(false);
  const { locale, setLocale, t } = useLanguage();

  return (
    <header className="ui-header">
      <div className="ui-header__row">
        {/* Left: Breadcrumbs or Location */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button 
            onClick={onMenuClick}
            className="ui-btn md:hidden"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="hidden md:flex ui-breadcrumb">
              <Link href="/" className="ui-breadcrumb__item hover:text-blue-600 transition-colors">
                <Home className="w-4 h-4" />
                <span>{t('common.home')}</span>
              </Link>
              {breadcrumbs.map((item, index) => (
                <div key={index} className="ui-breadcrumb__item">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  {item.href ? (
                    <Link 
                      href={item.href}
                      className={`hover:text-blue-600 transition-colors ${item.active ? 'ui-breadcrumb__item--active' : ''}`}
                    >
                      {item.label}
                    </Link>
                  ) : item.onClick ? (
                    <button 
                      onClick={item.onClick}
                      className={`hover:text-blue-600 transition-colors text-left ${item.active ? 'ui-breadcrumb__item--active' : ''}`}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className={item.active ? 'ui-breadcrumb__item--active' : ''}>
                      {item.label}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          ) : (
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-sm font-medium text-gray-500 whitespace-nowrap hidden sm:inline">
                {t('header.youAreAt')}
              </span>
              <button className="ui-btn !min-w-0 !p-2 !h-auto bg-gray-100 hover:bg-gray-200">
                <span className="text-sm font-semibold text-blue-600 truncate">
                  {locationName || t('header.defaultLocation')}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500 ml-1" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Status Chips (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
          <div className="ui-chip ui-chip--yellow gap-2">
            <Sparkles className="w-3 h-3" />
            <span>{t('header.weather')}：{t('header.weatherRain')}</span>
          </div>
          <div className="ui-chip ui-chip--blue">
            <span>{t('header.rainRoute')}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center">
            <LanguageSelector />
          </div>

          <button className="ui-btn hover:bg-gray-100" aria-label="Search">
            <Search className="w-5 h-5 text-gray-600" />
          </button>

          <Link href="/profile" className="ui-btn hover:bg-gray-100" aria-label="Profile">
            <User className="w-5 h-5 text-gray-600" />
          </Link>
        </div>
      </div>
    </header>
  );
}
