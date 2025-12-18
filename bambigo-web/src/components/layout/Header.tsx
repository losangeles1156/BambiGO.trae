'use client';

import { useState } from 'react';
import { Menu, Search, User, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [elderlyMode] = useState(false); // Used in JSX logic
  const [language, setLanguage] = useState<'zh' | 'en' | 'ja'>('zh');

  const languageLabels = {
    zh: '繁',
    en: 'EN', 
    ja: '日'
  };

  const toggleLanguage = () => {
    const languages: Array<'zh' | 'en' | 'ja'> = ['zh', 'en', 'ja'];
    const currentIndex = languages.indexOf(language);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLanguage(languages[nextIndex]);
  };

  return (
    <header className="ui-header">
      {/* 主要導航列 */}
      <div className="ui-header__bar">
        <div className="ui-header__row">
          {/* 左側：位置選擇器 */}
          <div className="flex items-center space-x-4">
            <button 
              className="ui-header__location"
            >
              <span className="text-gray-900 font-medium text-sm">你在</span>
              <span className="text-primary-600 font-semibold text-sm">捷運台北101/世貿站</span>
              <Menu className="w-4 h-4 text-gray-400" onClick={onMenuClick} />
            </button>

            {/* 長者模式標籤 */}
            <div className="hidden sm:flex items-center">
              <span className={`text-xs ${elderlyMode ? 'text-blue-600 font-bold' : 'text-gray-500'} transform -rotate-90 origin-center whitespace-nowrap`}>
                {elderlyMode ? '長者模式開啟' : '長者模式'}
              </span>
            </div>
          </div>

          {/* 中間：狀態標籤 */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="px-2 py-1 bg-status-yellow-light rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-yellow-600" />
              <span className="text-xs text-gray-800">天氣：雨 24°C</span>
            </div>
            <div className="px-2 py-1 bg-status-yellow-light rounded-full">
              <span className="text-xs text-gray-800">雨天備援路線啟用</span>
            </div>
            <div className="px-2 py-1 bg-status-yellow-light rounded-full">
              <span className="text-xs text-gray-800">目前人潮普通</span>
            </div>
            <div className="px-2 py-1 bg-status-yellow-light rounded-full">
              <span className="text-xs text-gray-800">信義商圈活動中</span>
            </div>
          </div>

          {/* 右側：操作按鈕 */}
          <div className="flex items-center space-x-3">
            {/* 語言切換 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={toggleLanguage}
                className="px-3 py-1 text-xs font-medium rounded-md transition-colors"
              >
                {languageLabels[language]}
              </button>
            </div>

            {/* 搜尋按鈕 */}
            <button
              className="ui-header__btn"
            >
              <Search className="w-5 h-5 text-gray-600" />
            </button>

            {/* 個人檔案 */}
            <Link href="/profile" className="ui-header__btn">
              <User className="w-5 h-5 text-gray-600" />
            </Link>
          </div>
        </div>
      </div>

      {/* 手機版狀態標籤 */}
      <div className="md:hidden px-4 pb-3">
          <div className="flex flex-wrap gap-2">
          <div className="ui-chip ui-chip--yellow">
            <span className="text-xs text-gray-800">天氣：雨 24°C</span>
          </div>
          <div className="ui-chip ui-chip--yellow">
            <span className="text-xs text-gray-800">雨天備援路線啟用</span>
          </div>
          <div className="ui-chip ui-chip--yellow">
            <span className="text-xs text-gray-800">目前人潮普通</span>
          </div>
          <div className="ui-chip ui-chip--yellow">
            <span className="text-xs text-gray-800">信義商圈活動中</span>
          </div>
        </div>
      </div>
    </header>
  );
}
