import React from 'react';
import { MapPin, Clock, Users, Route } from 'lucide-react';

interface SemanticTagsCardProps {
  level: 1 | 2 | 3 | 4;
  title: string;
  tags: string[];
  description?: string;
  onTagClick?: (tag: string) => void;
}

const levelConfig = {
  1: {
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    icon: MapPin,
    title: 'L1 地點DNA'
  },
  2: {
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-700',
    icon: Clock,
    title: 'L2 即時狀態'
  },
  3: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    icon: Users,
    title: 'L3 服務脈絡'
  },
  4: {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    icon: Route,
    title: 'L4 移動時間軸'
  }
};

export const SemanticTagsCard: React.FC<SemanticTagsCardProps> = ({
  level,
  title,
  tags,
  description,
  onTagClick
}) => {
  const config = levelConfig[level];
  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 shadow-sm`}>
      <div className="flex items-center mb-3">
        <Icon className={`w-5 h-5 ${config.textColor} mr-2`} />
        <h3 className={`font-semibold ${config.textColor}`}>{config.title}</h3>
      </div>
      
      {description && (
        <p className="text-sm text-gray-600 mb-3">{description}</p>
      )}
      
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <button
            key={index}
            onClick={() => onTagClick?.(tag)}
            className={`px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor} border ${config.borderColor} hover:shadow-md transition-shadow`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SemanticTagsCard;