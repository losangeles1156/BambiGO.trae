'use client';

/**
 * Simple A/B Testing Utility
 * Allows toggling features for different user groups
 */

type FeatureFlag = 'new_navigation_ui' | 'shortest_path_default' | 'ai_assistant_voice';

class ABTesting {
  private static instance: ABTesting;
  private flags: Record<string, boolean> = {};

  private constructor() {
    this.init();
  }

  public static getInstance(): ABTesting {
    if (!ABTesting.instance) {
      ABTesting.instance = new ABTesting();
    }
    return ABTesting.instance;
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Persist or generate random group
    let group = localStorage.getItem('ab_group');
    if (!group) {
      group = Math.random() > 0.5 ? 'A' : 'B';
      localStorage.setItem('ab_group', group);
    }

    // Define feature allocations
    this.flags = {
      'new_navigation_ui': true, // 100% rollout
      'shortest_path_default': group === 'B', // 50% rollout
      'ai_assistant_voice': false // 0% rollout (dev)
    };

    console.log('🧪 A/B Group:', group, this.flags);
  }

  public isEnabled(flag: FeatureFlag): boolean {
    return !!this.flags[flag];
  }

  public getGroup(): string {
    return typeof window !== 'undefined' ? localStorage.getItem('ab_group') || 'A' : 'A';
  }
}

export const ab = ABTesting.getInstance();
