import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { L3ServiceFacilitySchema } from '../validators/tagging'

export interface NodeRepository {
  getFacilities(nodeId: string): Promise<z.infer<typeof L3ServiceFacilitySchema>[]>
  getAllNodes(): Promise<string[]>
}

export class FileSystemNodeRepository implements NodeRepository {
  private data: z.infer<typeof L3ServiceFacilitySchema>[] = []
  private isLoaded = false

  constructor(private filePath: string = 'data/nodes_l3_strict.json') {}

  private async loadData() {
    if (this.isLoaded) return

    try {
      const fullPath = path.resolve(process.cwd(), this.filePath)
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        const raw = JSON.parse(content)
        
        // Validate but don't crash on single failures, just filter
        this.data = raw.filter((item: any) => {
          const result = L3ServiceFacilitySchema.safeParse(item)
          if (!result.success) {
            console.warn(`[FileSystemNodeRepository] Invalid item skipped:`, result.error)
          }
          return result.success
        })
        
        this.isLoaded = true
        console.log(`[FileSystemNodeRepository] Loaded ${this.data.length} records`)
      } else {
        console.warn(`[FileSystemNodeRepository] Data file not found: ${fullPath}`)
        this.data = []
      }
    } catch (e) {
      console.error(`[FileSystemNodeRepository] Error loading data:`, e)
      this.data = []
    }
  }

  async getFacilities(nodeId: string): Promise<z.infer<typeof L3ServiceFacilitySchema>[]> {
    await this.loadData()
    return this.data.filter(item => item.nodeId === nodeId)
  }

  async getAllNodes(): Promise<string[]> {
    await this.loadData()
    return Array.from(new Set(this.data.map(item => item.nodeId)))
  }
}

// Singleton instance for easy import
export const fsNodeRepo = new FileSystemNodeRepository()
