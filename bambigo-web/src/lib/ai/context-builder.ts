import { NodeRepository } from '../services/node-repository'

export class AIContextBuilder {
  constructor(private repo: NodeRepository) {}

  async buildContext(nodeId: string): Promise<string> {
    const facilities = await this.repo.getFacilities(nodeId)
    
    if (facilities.length === 0) {
      return `No facility data available for node ${nodeId}.`
    }

    // In L3 Schema, subCategory is at root level
    const elevators = facilities.filter(f => f.subCategory === 'elevator')
    const escalators = facilities.filter(f => f.subCategory === 'escalator')
    const toilets = facilities.filter(f => f.subCategory === 'accessible_toilet')

    let context = `Facility Status for Node: ${nodeId}\n`
    context += `=====================================\n`
    
    // Elevators
    if (elevators.length > 0) {
      // count is in attributes
      const count = elevators.reduce((sum, e) => {
        const c = e.attributes['count'] as number | undefined
        return sum + (c || 0)
      }, 0)
      context += `- Elevators: ${count} units available.\n`
    } else {
      context += `- Elevators: None reported.\n`
    }

    // Escalators
    if (escalators.length > 0) {
      const count = escalators.reduce((sum, e) => {
        const c = e.attributes['count'] as number | undefined
        return sum + (c || 0)
      }, 0)
      context += `- Escalators: ${count} units available.\n`
    } else {
      context += `- Escalators: None reported.\n`
    }

    // Toilets
    if (toilets.length > 0) {
      const t = toilets[0].attributes
      const features = []
      if (t['has_ostomate']) features.push('Ostomate')
      if (t['has_baby_chair']) features.push('Baby Chair')
      if (t['has_wheelchair_access']) features.push('Wheelchair Access')
      
      context += `- Accessible Toilet: Available.\n`
      if (features.length > 0) {
        context += `  Features: ${features.join(', ')}\n`
      }
    } else {
      context += `- Accessible Toilet: None reported.\n`
    }

    context += `\n(Source: ${facilities[0].source || 'Unknown'})\n`
    
    return context
  }
}
