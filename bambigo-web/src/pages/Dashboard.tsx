import React from 'react';
// import { useState } from 'react'; // Unused
import { MessageCircle } from 'lucide-react';

const Dashboard: React.FC = () => {
  // const [selectedCategory, setSelectedCategory] = useState('全部'); // Unused
  // const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false); // Unused

  // Unused state placeholders - kept for future implementation
  // const [messages, setMessages] = useState<any[]>([]);
  // const semanticTagsData = ...

  // const handleCategoryChange = (category: string) => {
  //   setSelectedCategory(category);
  // };

  // Mock data for recommendations
  // const sampleRecommendations: Recommendation[] = [
  //   {
  //     id: '1',
  //     title: '象山步道',
  //     description: '絕佳的台北市景觀拍攝點，步道設施完善，適合銀髮族健行。',
  //     imageUrl: 'https://images.unsplash.com/photo-1536696160351-344c20756779?auto=format&fit=crop&q=80',
  //     rating: 4.8,
  //     reviewCount: 1250,
  //     distance: '2.5 km',
  //     duration: '步行 45 分鐘',
  //     tags: ['自然景觀', '夜景', '健行'],
  //     isFavorite: true,
  //   },
  //   // ... more items
  // ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="text-lg font-semibold">Dashboard（占位頁面）</div>
      <div className="mt-3 text-sm text-gray-600">此頁面目前不使用，請至首頁體驗 PWA 介面。</div>
      <button
        onClick={() => {}}
        className="mt-6 rounded bg-orange-500 px-4 py-2 text-white"
      >
        <MessageCircle className="inline-block h-4 w-4" /> 開啟示範對話
      </button>
    </div>
  );
};

export default Dashboard;
