import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load env from .env.local
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const envPath = path.resolve(__dirname, '../.env.local')
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf8')
      envConfig.split('\n').forEach(line => {
        const [key, val] = line.split('=')
        if (key && val) {
          process.env[key.trim()] = val.trim()
        }
      })
    }
  } catch (e) { console.warn('Could not load .env.local', e) }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function injectContexts() {
  console.log('Injecting Spatial Contexts...')

  // --- UENO STATION ---
  const uenoPrompt = `
上野車站是一個具有顯著「高低差」與「新舊融合」的複雜空間。
[空間結構]
- 地形特徵：車站橫跨了「上野山」（上野公園側，3F高度）與「下町平原」（廣小路口側，1F高度）。
- 這種地形導致「公園口」與「不忍口/廣小路口」彷彿位於兩個不同的世界。

[關鍵轉乘阻力 - 地鐵 vs JR]
- 銀座線/日比谷線（地下）轉乘 JR（高架）：垂直距離極大。
- 尤其是銀座線，雖然號稱「日本第一條地鐵」，但車站結構老舊，部分通道天花板低矮，給人壓迫感。
- 京成上野站（通往成田機場）：這是一個「獨立」的車站，雖有地下連通，但建議走地面（中央通），心理感受會比較近，但下雨時地下通道（Ueno Central Underground Passage）是救贖。

[心理建設]
- 「公園口」改建後非常漂亮，直通上野公園，適合前往動物園、美術館。
- 「不忍口」則是通往阿美橫丁的戰區，人潮洶湧，混亂度極高。
- 若攜帶大型行李要轉乘新幹線，建議使用「入谷口」或「淺草口」側的電梯，避開中央大廳的人流。
`
  
  // Find Ueno Node (Relaxed search)
  const { data: uenoNodes } = await supabase
    .from('nodes')
    .select('id')
    .ilike('name->>en', 'Ueno')
    .limit(5)

  if (uenoNodes && uenoNodes.length > 0) {
    // Pick Ginza line as the main anchor for Ueno context, or update all
    // Let's pick Ginza Ueno as the primary hub representation
    const targetUeno = uenoNodes.find(n => n.id.includes('Ginza')) || uenoNodes[0]

    await supabase.from('nodes').update({
      is_hub: true, // Mark as hub
      persona_prompt: uenoPrompt.trim(),
      metadata: {
        complexity_level: 'high',
        vertical_depth_meters: 15,
        terrain_type: 'cliff_edge', // 崖邊地形
        transfer_friction: {
          'Ginza_Line': { minutes: 8, difficulty: 'medium', notes: '老舊通道，天花板低' },
          'Keisei_Line': { minutes: 10, difficulty: 'high', notes: '需走出站體或長距離地下移動' }
        }
      }
    }).eq('id', targetUeno.id)
    console.log(`Updated Ueno (${targetUeno.id})`)
  } else {
    console.warn('Ueno node not found')
  }

  // --- TOKYO STATION (Refined) ---
  // (Re-applying Tokyo context to ensure it's up to date with user intent)
  const tokyoPrompt = `
東京車站是一個巨大的立體迷宮，也是日本最繁忙的交通樞紐之一。
[空間結構]
- 擁有地面月台（中央線、山手線）、地下月台（總武線、橫須賀線）以及深層地下月台（京葉線）。
- 「八重洲口」（商務/巴士/大丸百貨）與「丸之內口」（皇居/復古站舍）是兩個截然不同的立面。

[關鍵轉乘阻力 - 京葉線 (迪士尼)]
- 這是東京站最大的陷阱。京葉線月台位於地下5層，且距離主站體南方約400公尺。
- 心理建設：這不是單純的「轉乘」，而是一次「遠足」。你需要走過3組超長手扶梯與數段電動步道。
- 建議：若有兒童或大件行李，請預留20分鐘以上。若趕時間，請把自己當作在機場航廈間移動。

[關鍵轉乘阻力 - 總武線/橫須賀線 (N'EX)]
- 位於地下5層，但位置較中心。
- 注意：往成田機場的 N'EX 在這裡搭乘。與京葉線容易搞混，請認明「藍色」標示（總武線）而非「紅色」（京葉線）。

[無障礙與空間感知]
- 銀之鈴廣場 (B1)：位於八重洲地下中央口附近，是最佳會面點，也是迷路時的救星。
- 所有的「北通路」、「中央通路」、「南通路」都是東西向貫穿，但人流密度極高（尤其是中央通路）。若要避開人潮，建議走「北自由通路」。
`

  const { data: tokyoNode } = await supabase
    .from('nodes')
    .select('id')
    .ilike('name->>en', 'Tokyo')
    .limit(1)
    .single()

  if (tokyoNode) {
    await supabase.from('nodes').update({
      persona_prompt: tokyoPrompt.trim(),
      metadata: {
        complexity_level: 'extreme',
        vertical_depth_meters: 30,
        transfer_friction: {
          'Keiyo_Line': { minutes: 20, difficulty: 'extreme', notes: '如同機場航廈間移動' },
          'Sobu_Line': { minutes: 10, difficulty: 'medium', notes: '深層地下' }
        }
      }
    }).eq('id', tokyoNode.id)
    console.log(`Updated Tokyo (${tokyoNode.id})`)
  }
}

injectContexts()
