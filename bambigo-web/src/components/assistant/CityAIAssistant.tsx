import React, { useState } from 'react';
import { MessageCircle, Send, Mic, X } from 'lucide-react';

interface QuickIntent {
  id: string;
  text: string;
  icon?: string;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface CityAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  messages?: Message[];
}

const quickIntents: QuickIntent[] = [
  { id: '1', text: '附近有什麼好吃的？' },
  { id: '2', text: '推薦觀光景點' },
  { id: '3', text: '交通資訊' },
  { id: '4', text: '天氣狀況' },
  { id: '5', text: '活動資訊' },
  { id: '6', text: '住宿推薦' }
];

export const CityAIAssistant: React.FC<CityAIAssistantProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  messages = []
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isListening, setIsListening] = useState(false);

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      onSendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const handleIntentClick = (intent: QuickIntent) => {
    onSendMessage(intent.text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-2xl w-full max-w-md mx-4 mb-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <MessageCircle className="w-5 h-5 text-orange-500 mr-2" />
            <h3 className="font-semibold text-gray-800">城市小幫手</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-4 max-h-64 overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">有什麼可以幫助您的嗎？</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  message.isUser
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className={`text-xs mt-1 ${
                  message.isUser ? 'text-orange-100' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Intents */}
        <div className="p-4 border-t">
          <p className="text-sm text-gray-600 mb-3">快速提問：</p>
          <div className="flex flex-wrap gap-2">
            {quickIntents.map((intent) => (
              <button
                key={intent.id}
                onClick={() => handleIntentClick(intent)}
                className="px-3 py-2 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-200 hover:bg-orange-100 transition-colors"
              >
                {intent.text}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsListening(!isListening)}
              className={`p-2 rounded-full transition-colors ${
                isListening
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
            
            <div className="flex-1 flex items-center bg-gray-100 rounded-full px-4 py-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="輸入訊息..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="p-1 text-orange-500 hover:text-orange-600 disabled:text-gray-400 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CityAIAssistant;