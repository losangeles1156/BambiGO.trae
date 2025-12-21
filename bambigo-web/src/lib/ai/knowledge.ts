
export interface KnowledgeRequest {
  nodeId?: string
  userStates: string[]
  // Potential future context fields
  // time?: string
  // weather?: string
}

export interface KnowledgeResponse {
  [key: string]: string // key: trigger (e.g., 'large_luggage'), value: knowledge text
}

/**
 * Knowledge Base Service (Design Reservation)
 * 
 * Currently serves as a mock implementation.
 * In the future, this will connect to a Supabase table 'station_knowledge' 
 * or a Vector DB to retrieve context-aware transportation advice.
 */
export async function fetchTransportKnowledge(req: KnowledgeRequest): Promise<KnowledgeResponse> {
  const knowledge: KnowledgeResponse = {}

  // --- MOCK DATA LAYER (To be replaced by DB Query) ---
  
  // 1. Global/General Knowledge Rules
  // These apply to all stations unless overridden
  const GLOBAL_KNOWLEDGE: Record<string, string> = {
    'large_luggage': '提示：本站部分出口僅有樓梯，請依循黃色無障礙標示移動。',
    'stroller': '警告：尖峰時段中央改札口極度擁擠，建議改走北改札口。',
    'mobility_impaired': '提示：部分轉乘路線需使用專用升降機，建議聯繫站務員協助。',
    'rush': '專家經驗：此站轉乘平均需 8-10 分鐘，請預留充裕時間。'
  }

  // 2. Station-Specific Logic (Example placeholder)
  // This simulates fetching specific data for a node
  if (req.nodeId) {
    const id = req.nodeId.toLowerCase()

    // --- 都營淺草線 (Toei Asakusa Line) Expert Knowledge (Source: MATCHA) ---
    
    // Asakusa Station (淺草站)
    if (id.includes('asakusa') && !id.includes('asakusabashi')) {
      if (req.userStates.includes('large_luggage') || req.userStates.includes('stroller') || req.userStates.includes('mobility_impaired')) {
        knowledge['large_luggage'] = '專家提示 (MATCHA)：淺草站出口眾多，但直通地面的電梯只有一座！請務必使用『A2b』出口（駒形橋方面），避免搬運噩夢。'
        knowledge['stroller'] = '專家提示 (MATCHA)：地面電梯位於『A2b』出口（駒形橋方面），距離雷門稍遠但最為省力。'
        knowledge['mobility_impaired'] = '專家提示 (MATCHA)：唯一地面電梯位於『A2b』出口。A4 出口雖近雷門但無電梯。'
      }
    }

    // Stations skipped by "Airport Kaitoku" (Airport 快特)
    // Kuramae (藏前), Asakusabashi (淺草橋), Ningyocho (人形町), Higashi-ginza (東銀座)
    const skippedStations = ['kuramae', 'asakusabashi', 'ningyocho', 'higashi-ginza', 'higashiginza']
    if (skippedStations.some(s => id.includes(s))) {
      if (req.userStates.includes('rush')) {
        knowledge['rush'] = '專家警告 (MATCHA)：搭乘都營淺草線請注意，『Airport 快特』列車不停靠此站！趕時間請務必確認列車車種，以免搭過站。'
      }
    }

    // Shimbashi (新橋)
    if (id.includes('shimbashi')) {
      if (req.userStates.includes('rush')) {
        knowledge['rush'] = '專家提示 (MATCHA)：早晨通勤時段此站會有大量上班族下車，是尋找空位休息的絕佳時機。'
      }
    }

    // Oshiage (押上)
    if (id.includes('oshiage')) {
      if (req.userStates.includes('large_luggage')) {
        knowledge['large_luggage'] = '專家提示 (MATCHA)：此站直通成田機場與東京晴空塔，站內動線極度複雜，建議預留額外 10 分鐘轉乘時間。'
      }
    }

    // Tokyo Station (東京站) Expert Knowledge
    // Sources: MATCHA (3526, 18263), LetsGoJP (98676)
    if (id === 'tokyo' || id.includes('tokyo station') || id === '東京') {
      
      // 1. The "Keiyo Line Trap" - Deep analysis for multiple states
      if (req.userStates.includes('rush')) {
        knowledge['rush'] = '專家警告 (MATCHA/樂吃購)：前往迪士尼（京葉線）需步行約 20 分鐘（相當於一站距離），且月台位於地下5樓。趕時間者請務必預留緩衝，或考慮從八重洲口搭乘計程車。';
      } else if (req.userStates.includes('stroller') || req.userStates.includes('mobility_impaired')) {
        knowledge['stroller'] = '專家建議 (MATCHA)：京葉線轉乘距離極長（約 15-20 分），建議尋找「UNIQLO」招牌附近的電梯動線。若需哺乳室，請前往 1F 新幹線北轉乘口或 B1 Square Zero。';
        knowledge['mobility_impaired'] = '專家提示 (MATCHA)：京葉線月台位於地下5樓，轉乘距離極長。若前往迪士尼，建議預留 20-30 分鐘移動時間，或利用「八重洲南口」的無障礙電梯直達地面層轉乘巴士。';
      }

      // 2. Shinkansen vs Sightseeing (Exit Strategy)
      if (req.userStates.includes('large_luggage')) {
        knowledge['large_luggage'] = '專家策略 (樂吃購)：搭乘新幹線請務必走「八重洲口」（東側）；若要前往皇居/丸之內大樓才走「丸之內口」（西側）。走錯出口需繞行北自由通道，耗時且費力。大型置物櫃推薦前往 1F「駅弁屋 祭」旁。';
      }

      // 3. Narita Airport Access (The Budget/Convenience Trade-off)
      // This is a general tip, could be triggered by specific query, but good to show for general context if relevant
      // We'll attach it to 'large_luggage' as a secondary tip if not already set, or append.
      // For now, let's keep it specific.
    }

    // Shinjuku Station (新宿站) - The Dungeon
    // Sources: MATCHA (1061), Navitime
    if (id === 'shinjuku' || id.includes('shinjuku station') || id === '新宿') {
      if (req.userStates.includes('rush')) {
        knowledge['rush'] = '專家攻略 (MATCHA)：新宿站迷宮破解法——永遠優先尋找「南口 (South Gate)」或「新南改札」。這是唯一位於地面層且直線導航的出口，避開地下迷宮的混亂。';
      }
      if (req.userStates.includes('large_luggage')) {
        knowledge['large_luggage'] = '專家提示 (MATCHA)：若搭乘 NEX 成田特快，月台位於車站最南端。前往歌舞伎町（東口）需步行極遠，建議利用「東南口」電梯先至地面再移動，避免地下人潮。';
      }
      if (req.userStates.includes('stroller') || req.userStates.includes('mobility_impaired')) {
        knowledge['stroller'] = '專家建議 (Navitime)：新宿西口與東口之間的地下聯絡通道人潮洶湧，極難通行。推嬰兒車建議走「東西自由通路」或地面層的「甲州街道」天橋。';
        knowledge['mobility_impaired'] = '專家提示：大江戶線新宿站位於地下7樓（深坑），轉乘 JR 需預留 15 分鐘以上。若非必要，建議在「代代木站」轉乘大江戶線會輕鬆許多。';
      }
    }

    // Shibuya Station (澀谷站) - The Vertical Maze
    // Sources: LetsGoJP (310939)
    if (id === 'shibuya' || id.includes('shibuya station') || id === '澀谷' || id === '涉谷') {
      if (req.userStates.includes('rush')) {
        knowledge['rush'] = '專家警告 (樂吃購)：銀座線位於 3F，副都心線/東橫線位於 B5，垂直轉乘猶如登山。趕時間請務必使用「Shibuya Scramble Square」或「Hikarie」的大型電梯移動。';
      }
      if (req.userStates.includes('stroller')) {
        knowledge['stroller'] = '專家策略 (樂吃購)：八公口（Hachiko Exit）人潮過於密集，推車極難移動。建議改由「澀谷 Stream」或「Hikarie」側出口進出，享有寬敞電梯與平坦動線。';
      }
      if (req.userStates.includes('large_luggage')) {
        knowledge['large_luggage'] = '專家提示：前往澀谷 Sky 或 Scramble Square，請認準「B6」出口直結電梯。切勿在八公口地面拖行行李與人潮搏鬥。';
      }
    }

    // Ikebukuro Station (池袋站) - East/West Trap
    // Sources: MATCHA (6572)
    if (id === 'ikebukuro' || id.includes('ikebukuro station') || id === '池袋') {
      const mnemonics = '口訣：「西武 (Seibu) 在東口，東武 (Tobu) 在西口」。';
      if (req.userStates.includes('rush') || req.userStates.includes('large_luggage')) {
        knowledge['rush'] = knowledge['rush'] 
          ? `${knowledge['rush']} ${mnemonics}` 
          : `專家提示 (MATCHA)：池袋最大陷阱！${mnemonics} 走錯方向需繞行整個車站，耗時極長。`;
          
        knowledge['large_luggage'] = `專家策略 (MATCHA)：前往 Sunshine City (太陽城) 請走「東口 (35號出口)」。若不想走地面人行道，可利用「ISP 地下街」通道，但需注意部分區段只有樓梯。${mnemonics}`;
      }
    }

    // Ueno Station (上野站) - Park vs Market
    // Sources: Good Luck Trip (20004)
    if (id === 'ueno' || id.includes('ueno station') || id === '上野') {
      if (req.userStates.includes('stroller') || req.userStates.includes('mobility_impaired')) {
        knowledge['stroller'] = '專家建議 (GoodLuckTrip)：前往上野動物園/公園，請務必使用「公園改札 (Park Gate)」，出站即達平地。若走「不忍改札」需爬坡，極度費力。';
      }
      if (req.userStates.includes('large_luggage')) {
        knowledge['large_luggage'] = '專家提示：搭乘京成電鐵（Skyliner）往成田機場，請走「不忍改札」或「中央改札」，切勿走「公園改札」（距離極遠）。大型置物櫃集中在中央改札外。';
      }
    }
  }

  // 3. Populate Response based on requested states (Fallback to Global if specific not found)
  req.userStates.forEach(state => {
    if (!knowledge[state] && GLOBAL_KNOWLEDGE[state]) {
      knowledge[state] = GLOBAL_KNOWLEDGE[state]
    }
  })

  return knowledge
}
