import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{id: string; text: string; isUser: boolean; timestamp: Date}>>([]);

  const handleSendMessage = (message: string) => {
    const newMessage = {
      id: Date.now().toString(),
      text: message,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        text: '感謝您的詢問！我正在為您查找相關資訊...',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const sampleRecommendations = [
    {
      id: '1',
      title: '台北101觀景台',
      description: '台北地標性建築，可俯瞰整個台北市美景，是遊客必訪景點之一。',
      imageUrl: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=Taipei+101+skyscraper+observation+deck+city+view&image_size=landscape_16_9',
      rating: 4.5,
      reviewCount: 1234,
      location: '信義區',
      distance: '約2.5公里',
      openHours: '09:00 - 22:00',
      priceRange: '$300-600',
      tags: ['觀景台', '地標', '熱門景點']
    },
    {
      id: '2',
      title: '鼎泰豐信義店',
      description: '世界知名的小籠包專賣店，以薄皮多汁的小籠包聞名。',
      imageUrl: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=Traditional+Chinese+restaurant+steamed+soup+dumplings&image_size=landscape_16_9',
      rating: 4.8,
      reviewCount: 2156,
      location: '信義區',
      distance: '約1.8公里',
      openHours: '10:00 - 21:30',
      priceRange: '$200-400',
      tags: ['小籠包', '中式料理', '米其林']
    },
    {
      id: '3',
      title: '象山步道',
      description: '輕鬆的登山步道，可欣賞台北101和城市美景，適合晨間運動。',
      imageUrl: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=Mountain+hiking+trail+with+city+view+Taipei+101&image_size=landscape_16_9',
      rating: 4.3,
      reviewCount: 567,
      location: '信義區',
      distance: '約3.2公里',
      openHours: '全天開放',
      priceRange: '免費',
      tags: ['登山', '步道', '自然']
    }
  ];

  const semanticTagsData = [
    {
      level: 1 as const,
      title: 'L1 地點DNA',
      tags: ['商業區', '交通樞紐', '觀光景點', '美食天堂'],
      description: '台北市的地理位置特徵和基礎屬性'
    },
    {
      level: 2 as const,
      title: 'L2 即時狀態',
      tags: ['晴朗', '人潮適中', '營業中', '交通便利'],
      description: '當前的即時環境狀態'
    },
    {
      level: 3 as const,
      title: 'L3 服務脈絡',
      tags: ['購物中心', '餐廳聚集', '文化活動', '商務會議'],
      description: '周邊的服務設施和活動脈絡'
    },
    {
      level: 4 as const,
      title: 'L4 移動時間軸',
      tags: ['早高峰', '午餐時段', '下午茶', '晚間娛樂'],
      description: '不同時間段的活動建議'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="text-lg font-semibold">Dashboard（占位頁面）</div>
      <div className="mt-3 text-sm text-gray-600">此頁面目前不使用，請至首頁體驗 PWA 介面。</div>
      <button
        onClick={() => setIsAIAssistantOpen(true)}
        className="mt-6 rounded bg-orange-500 px-4 py-2 text-white"
      >
        <MessageCircle className="inline-block h-4 w-4" /> 開啟示範對話
      </button>
    </div>
  );
};

export default Dashboard;
