'use client';

import { Menu, Search, User, Sparkles, ChevronDown, ChevronRight, Home, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '../../contexts/LanguageContext';
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
  const { t } = useLanguage();

  return (
    <header className="ui-header sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-gray-200 supports-[backdrop-filter]:bg-white/60">
      <div className="ui-header__row px-4 h-16 flex items-center justify-between gap-4">
        {/* Left: Breadcrumbs or Location */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button 
            onClick={onMenuClick}
            className="ui-btn md:hidden -ml-2 p-3 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>

          {/* Desktop Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="hidden md:flex ui-breadcrumb items-center text-sm text-gray-500">
              <Link href="/" className="ui-breadcrumb__item hover:text-blue-600 transition-colors flex items-center gap-1">
                <Home className="w-4 h-4" />
                <span>{t('common.home')}</span>
              </Link>
              {breadcrumbs.map((item, index) => (
                <div key={index} className="flex items-center">
                  <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                  {item.href ? (
                    <Link 
                      href={item.href}
                      className={`hover:text-blue-600 transition-colors ${item.active ? 'font-bold text-gray-900' : ''}`}
                    >
                      {item.label}
                    </Link>
                  ) : item.onClick ? (
                    <button 
                      onClick={item.onClick}
                      className={`hover:text-blue-600 transition-colors text-left ${item.active ? 'font-bold text-gray-900' : ''}`}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className={item.active ? 'font-bold text-gray-900' : ''}>
                      {item.label}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          )}

          {/* Mobile Location/Title (or Fallback if no breadcrumbs) */}
          <div className={`flex items-center gap-2 overflow-hidden ${breadcrumbs.length > 0 ? 'md:hidden' : ''}`}>
            <span className="text-sm font-medium text-gray-500 whitespace-nowrap hidden sm:inline">
              {t('header.youAreAt')}
            </span>
            <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-blue-600 px-3 py-1.5 rounded-full transition-colors max-w-full">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-bold truncate">
                {locationName || (breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length-1].label : t('header.defaultLocation'))}
              </span>
              <ChevronDown className="w-3 h-3 text-blue-400 ml-0.5 flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Center: Status Chips (Desktop Only) */}
        <div className="hidden lg:flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
          <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-100 shadow-sm">
            <Sparkles className="w-3 h-3" />
            <span>{t('header.weather')}：{t('header.weatherRain')}</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium border border-blue-100 shadow-sm">
            <span>{t('header.rainRoute')}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Language Selector - Hide on mobile if space needed, but usually icon is small enough. 
              Let's hide it on very small screens since it's in the menu now. */}
          <div className="hidden sm:flex items-center">
            <LanguageSelector />
          </div>

          <button className="p-2.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors" aria-label="Search">
            <Search className="w-5 h-5" />
          </button>

          <Link href="/profile" className="p-2.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors" aria-label="Profile">
            <User className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
