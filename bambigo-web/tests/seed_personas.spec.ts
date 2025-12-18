
import { describe, it, expect, vi, afterEach } from 'vitest'
import { seedPersonas } from '../scripts/seed_personas'
import { Client } from 'pg'
import fs from 'fs' // Default import

// Mock FS
vi.mock('fs', () => {
  const existsSync = vi.fn()
  const readFileSync = vi.fn()
  return {
    default: { existsSync, readFileSync },
    existsSync, // Named export
    readFileSync // Named export
  }
})

describe('seedPersonas', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('updates nodes based on persona data', async () => {
    // Setup Mock Data
    // Access the default export's mock functions
    const existsSyncMock = fs.existsSync as unknown as ReturnType<typeof vi.fn>
    const readFileSyncMock = fs.readFileSync as unknown as ReturnType<typeof vi.fn>
    
    existsSyncMock.mockReturnValue(true)
    readFileSyncMock.mockReturnValue(JSON.stringify([
      {
        node_id: 'node_test',
        name: 'TestStation',
        wards: [],
        operators: ['TestOp'],
        complexity_score: 50,
        archetype: 'The Tester',
        trap_warnings: ['Trap1'],
        system_prompt: 'You are a test.'
      }
    ]))

    // Mock PG Client
    // First call: check column (returns 0 rows -> need to add)
    // Second call: alter table
    // Third call: update (returns 1 row)
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rowCount: 0 }) // Check column -> not found
      .mockResolvedValueOnce({}) // Alter table
      .mockResolvedValueOnce({ rowCount: 1 }) // Update

    const clientMock = {
      connect: vi.fn(),
      query: queryMock,
      end: vi.fn()
    } as unknown as Client

    await seedPersonas(clientMock)

    // Verify
    // 1. Check column existence check
    expect(queryMock).toHaveBeenNthCalledWith(1, expect.stringContaining("SELECT column_name"))
    
    // 2. Alter table because we returned rowCount 0
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining("ALTER TABLE nodes ADD COLUMN"))
    
    // 3. Update query
    const updateCall = queryMock.mock.calls[2]
    expect(updateCall[0]).toContain('UPDATE nodes')
    const params = updateCall[1]
    expect(params[0]).toBe('You are a test.') // system_prompt
    expect(params[2]).toBe('TestStation') // name
    
    const metadata = JSON.parse(params[1])
    expect(metadata.persona_archetype).toBe('The Tester')
    expect(metadata.complexity_score).toBe(50)
  })

  it('skips alter table if column exists', async () => {
     // Setup Mock Data
     const existsSyncMock = fs.existsSync as unknown as ReturnType<typeof vi.fn>
     const readFileSyncMock = fs.readFileSync as unknown as ReturnType<typeof vi.fn>

     existsSyncMock.mockReturnValue(true)
     readFileSyncMock.mockReturnValue(JSON.stringify([])) // No personas
 
     const queryMock = vi.fn()
       .mockResolvedValueOnce({ rowCount: 1 }) // Check column -> found
 
     const clientMock = {
       connect: vi.fn(),
       query: queryMock,
       end: vi.fn()
     } as unknown as Client
 
     await seedPersonas(clientMock)
 
     expect(queryMock).toHaveBeenCalledTimes(1) // Only check
     expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining("ALTER TABLE"))
  })
})
