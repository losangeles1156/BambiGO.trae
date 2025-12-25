'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Settings, User, Heart, Shield, LogOut, Loader2 } from 'lucide-react';
import { RecommendationCard } from '../../components/cards/RecommendationCard';
import { useAuth } from '../../components/auth/AuthContext';
import { supabase } from '../../lib/supabase';
import TimePanel from '../../components/time/TimePanel';

// Type for the joined data from Supabase
type SavedLocation = {
  id: string;
  node_id: string | null;
  facility_id: string | null;
  title: string | null;
  notes: string | null;
  created_at: string;
  nodes?: {
    name: { ja?: string; en?: string; zh?: string };
    type: string;
  } | null;
  facilities?: {
    name: { ja?: string; en?: string; zh?: string };
    type: string;
  } | null;
};

export default function ProfilePage() {
  const { user, signOut, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');
  const [elderlyMode, setElderlyMode] = useState(false);
  const [favorites, setFavorites] = useState<SavedLocation[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  useEffect(() => {
    if (user && activeTab === 'favorites') {
      fetchFavorites();
    }
  }, [user, activeTab]);

  const fetchFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const { data, error } = await supabase
        .from('saved_locations')
        .select(`
          *,
          nodes (name, type),
          facilities (name, type)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites((data as unknown) as SavedLocation[] || []);
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoadingFavorites(false);
    }
  };

  const handleRemoveFavorite = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setFavorites(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  const handleLogin = async () => {
    // For demo/MVP, we can trigger a simple anonymous sign-in or OAuth
    // Here we'll use Google OAuth as a placeholder action
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/profile`,
      },
    });
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">歡迎來到 BambiGO</h1>
          <p className="text-gray-500 mb-6">登入以管理您的收藏地點與個人設定</p>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors"
          >
            使用 Google 登入
          </button>
          <Link href="/" className="mt-4 block text-sm text-gray-500 hover:text-gray-700">
            返回首頁
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Navigation */}
      <div className="bg-white px-4 py-3 shadow-sm sticky top-0 z-10 flex items-center justify-between">
        <Link href="/" className="p-2 -ml-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">個人中心</h1>
        <button className="p-2 -mr-2 text-gray-600 hover:text-gray-900">
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* User Profile Card */}
      <div className="m-4 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 overflow-hidden">
            {user.user_metadata?.avatar_url ? (
              <Image 
                src={user.user_metadata.avatar_url} 
                alt="Avatar" 
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <User className="h-8 w-8" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {user.user_metadata?.full_name || user.email?.split('@')[0] || '使用者'}
            </h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
               <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                 一般會員
               </span>
            </div>
          </div>
        </div>
      </div>

      {/* Settings / Toggles */}
      <div className="mx-4 mb-6 space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
           <div className="flex items-center gap-3">
             <div className="rounded-full bg-blue-50 p-2 text-blue-600">
               <Shield className="w-5 h-5" />
             </div>
             <div>
               <div className="font-medium text-gray-900">長者友善模式</div>
               <div className="text-xs text-gray-500">放大字體與簡化介面</div>
             </div>
           </div>
           <button 
             onClick={() => setElderlyMode(!elderlyMode)}
             className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${elderlyMode ? 'bg-blue-600' : 'bg-gray-200'}`}
           >
             <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition transition-transform ${elderlyMode ? 'translate-x-6' : 'translate-x-1'}`} />
           </button>
        </div>

        <TimePanel />
      </div>

      {/* Tabs */}
      <div className="sticky top-[60px] z-10 bg-gray-50 px-4 pb-2">
        <div className="flex space-x-1 rounded-xl bg-white p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === 'favorites'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Heart className={`w-4 h-4 ${activeTab === 'favorites' ? 'fill-current' : ''}`} />
              我的收藏
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            瀏覽紀錄
          </button>
        </div>
      </div>

      {/* Content List */}
      <div className="px-4 space-y-4 mt-2">
        {activeTab === 'favorites' ? (
          loadingFavorites ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : favorites.length > 0 ? (
            favorites.map((item) => {
              const name = item.title || item.nodes?.name?.zh || item.facilities?.name?.zh || '未命名地點';
              const type = item.nodes?.type || item.facilities?.type || '地點';
              return (
                <RecommendationCard
                  key={item.id}
                  id={item.id}
                  title={name}
                  description={item.notes || `已收藏的${type}`}
                  // Placeholder props as these are not yet in DB
                  imageUrl={`https://source.unsplash.com/featured/?${type}`}
                  rating={0}
                  reviewCount={0}
                  distance=""
                  tags={[type]}
                  isFavorite={true}
                  variant="horizontal"
                  onFavorite={() => handleRemoveFavorite(item.id)}
                />
              );
            })
          ) : (
            <div className="py-10 text-center text-gray-500">
              尚無收藏地點
            </div>
          )
        ) : (
          <div className="py-10 text-center text-gray-500">
            尚無瀏覽紀錄
          </div>
        )}
      </div>

      {/* Logout Button */}
      <div className="m-4 mt-8">
        <button 
          onClick={() => signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-5 h-5" />
          登出
        </button>
      </div>
    </div>
  );
}
