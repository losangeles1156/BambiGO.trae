'use client';

import React from 'react';
import { clsx } from 'clsx';
import { 
  BriefcaseIcon, 
  UserGroupIcon, 
  ClockIcon, 
  ShieldExclamationIcon 
} from '@heroicons/react/24/outline';

export type UserStatus = 'luggage' | 'stroller' | 'impaired' | 'rush';

interface UserStatusSelectorProps {
  selectedStatuses: UserStatus[];
  onToggleStatus: (status: UserStatus) => void;
  className?: string;
}

const STATUS_CONFIG: Record<UserStatus, { label: string; icon: React.ElementType; color: string }> = {
  luggage: { 
    label: '大型行李', 
    icon: BriefcaseIcon, 
    color: 'bg-blue-100 text-blue-700 border-blue-200' 
  },
  stroller: { 
    label: '推嬰兒車', 
    icon: UserGroupIcon, 
    color: 'bg-pink-100 text-pink-700 border-pink-200' 
  },
  impaired: { 
    label: '行動不便', 
    icon: ShieldExclamationIcon, 
    color: 'bg-purple-100 text-purple-700 border-purple-200' 
  },
  rush: { 
    label: '趕時間', 
    icon: ClockIcon, 
    color: 'bg-orange-100 text-orange-700 border-orange-200' 
  }
};

export const UserStatusSelector: React.FC<UserStatusSelectorProps> = ({
  selectedStatuses,
  onToggleStatus,
  className
}) => {
  return (
    <div className={clsx("flex flex-wrap gap-2", className)}>
      {(Object.entries(STATUS_CONFIG) as [UserStatus, typeof STATUS_CONFIG[UserStatus]][]).map(([key, config]) => {
        const isSelected = selectedStatuses.includes(key);
        const Icon = config.icon;
        
        return (
          <button
            key={key}
            onClick={() => onToggleStatus(key)}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 rounded-full border-2 transition-all duration-200 text-sm font-bold",
              isSelected 
                ? `${config.color} shadow-sm scale-105` 
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            )}
            aria-pressed={isSelected}
          >
            <Icon className={clsx("w-5 h-5", isSelected ? "stroke-2" : "stroke-1.5")} />
            {config.label}
          </button>
        );
      })}
    </div>
  );
};
