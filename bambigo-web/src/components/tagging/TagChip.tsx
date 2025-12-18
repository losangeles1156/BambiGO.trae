import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LAYER_CONFIG, TagLayer } from './constants';
import { XMarkIcon } from '@heroicons/react/20/solid';

interface TagChipProps {
  label: string;
  layer: TagLayer;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

export const TagChip: React.FC<TagChipProps> = ({ 
  label, 
  layer, 
  onRemove, 
  onClick,
  className,
  icon 
}) => {
  const config = LAYER_CONFIG[layer];
  const Icon = config.icon;

  return (
    <div
      onClick={onClick}
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors border',
          config.bgColor,
          config.textColor,
          config.borderColor,
          onClick && 'cursor-pointer hover:opacity-80',
          className
        )
      )}
    >
      {icon ? (
        <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
      ) : (
        <Icon className="w-4 h-4" />
      )}
      
      <span>{label}</span>

      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={clsx(
            'ml-1 p-0.5 rounded-full hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-1',
            `focus:ring-${config.color}-500`
          )}
          aria-label={`Remove ${label}`}
        >
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
