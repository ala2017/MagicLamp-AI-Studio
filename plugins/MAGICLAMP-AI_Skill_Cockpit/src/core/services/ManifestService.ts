import { Registry, Skill } from '@shared/types';

const DEFAULT_MANIFEST_URL = 'https://raw.githubusercontent.com/antigravity-ai/skill-cockpit/main/registry/discovery_manifest.json';

export class ManifestService {

    /**
     * Fetches the discovery manifest from the given URL.
     * Uses built-in fetch (Node 18+) or VS Code API if available.
     */
    public async fetchManifest(url: string = DEFAULT_MANIFEST_URL): Promise<Skill[]> {
        console.log(`Fetching manifest from: ${url}`);

        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Skill-Cockpit' } });
            
            if (!response.ok) {
                console.warn(`Failed to fetch manifest from ${url}: ${response.statusText}`);
                return [];
            }

            const data = await response.json();
            
            if (!data || !Array.isArray(data.skills)) {
                console.warn(`Invalid manifest format from ${url}`);
                return [];
            }

            return data.skills.map((s: any) => ({
                ...s,
                scope: 'global',
                enabled: false,
                source: 'global-antigravity',
                security: { 
                    riskScore: s.security?.riskScore || 0,
                    isOfficial: s.security?.isOfficial || true,
                    permissions: s.security?.permissions || []
                }
            }));

        } catch (error) {
            console.error(`Error fetching manifest from ${url}:`, error);
            return [];
        }
    }

    /**
     * Aggregates skills from all subscribed registries.
     */
    public async fetchAllRegistries(registries: Registry[]): Promise<Skill[]> {
        const promises = registries
            .filter(r => r.enabled)
            .map(r => this.fetchManifest(r.url));

        const results = await Promise.all(promises);
        return results.flat();
    }
}
