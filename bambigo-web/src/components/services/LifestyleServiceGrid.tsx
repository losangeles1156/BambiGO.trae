import React from 'react';
import { Coffee, ShoppingBag, Utensils, Camera, Music, Gamepad2, BookOpen, Dumbbell } from 'lucide-react';

interface ServiceItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  count?: number;
  onClick?: () => void;
}

interface LifestyleServiceGridProps {
  services?: ServiceItem[];
  onServiceClick?: (service: ServiceItem) => void;
}

const defaultServices: ServiceItem[] = [
  { id: '1', title: '咖啡廳', icon: Coffee, color: 'bg-amber-100 text-amber-700', count: 24 },
  { id: '2', title: '購物', icon: ShoppingBag, color: 'bg-pink-100 text-pink-700', count: 18 },
  { id: '3', title: '餐廳', icon: Utensils, color: 'bg-orange-100 text-orange-700', count: 32 },
  { id: '4', title: '景點', icon: Camera, color: 'bg-blue-100 text-blue-700', count: 15 },
  { id: '5', title: '娛樂', icon: Music, color: 'bg-purple-100 text-purple-700', count: 12 },
  { id: '6', title: '遊戲', icon: Gamepad2, color: 'bg-green-100 text-green-700', count: 8 },
  { id: '7', title: '學習', icon: BookOpen, color: 'bg-indigo-100 text-indigo-700', count: 6 },
  { id: '8', title: '運動', icon: Dumbbell, color: 'bg-red-100 text-red-700', count: 10 }
];

export const LifestyleServiceGrid: React.FC<LifestyleServiceGridProps> = ({
  services = defaultServices,
  onServiceClick
}) => {
  const handleServiceClick = (service: ServiceItem) => {
    onServiceClick?.(service);
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">生活服務</h3>
        <span className="text-sm text-gray-500">{services.length} 個分類</span>
      </div>
      
      <div className="grid grid-cols-4 gap-3">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <button
              key={service.id}
              onClick={() => handleServiceClick(service)}
              className="aspect-square flex flex-col items-center justify-center p-3 rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 hover:scale-105"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${service.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                {service.title}
              </span>
              {service.count && (
                <span className="text-xs text-gray-500 mt-1">
                  {service.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button className="w-full text-center text-sm text-orange-600 hover:text-orange-700 font-medium">
          查看所有服務
        </button>
      </div>
    </div>
  );
};

export default LifestyleServiceGrid;