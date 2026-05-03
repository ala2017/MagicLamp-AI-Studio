import { Skill } from '@shared/types';
import { DiscoveryProvider } from './discovery/DiscoveryProvider';
import { GlobalSkillProvider } from './discovery/GlobalSkillProvider';
import { McpConfigProvider } from './discovery/McpConfigProvider';
import { CursorProvider } from './discovery/CursorProvider';
import { LocalSkillProvider } from './discovery/LocalSkillProvider';
import { WorkflowProvider } from './discovery/WorkflowProvider';

export class DiscoveryService {
    private providers: DiscoveryProvider[] = [];

    constructor() {
        // Register Providers
        this.providers.push(new GlobalSkillProvider());
        this.providers.push(new McpConfigProvider());
        this.providers.push(new CursorProvider());
        this.providers.push(new LocalSkillProvider());
        this.providers.push(new WorkflowProvider());
    }

    public async discoverAll(): Promise<Skill[]> {
        console.log('[Discovery] Starting full system scan...');

        const promises = this.providers.map(p => p.discover().catch(e => {
            console.error(`[Discovery] Provider failed:`, e);
            return [];
        }));

        const results = await Promise.all(promises);
        const allSkills = results.flat();

        console.log(`[Discovery] Total assets found: ${allSkills.length}`);
        return allSkills;
    }
}
